using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Commands.Builders;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Entities.Powers;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// Combat-only custom status. ModelDb discovers this compiled PowerModel with the other mod models.
/// Each creature may have several instances, identified by the source pack and the status ID.
/// The weak payload belongs to the applied instance and retains the first applying card's ownership.
/// </summary>
public sealed class SfRulePower : PowerModel
{
    private sealed class Payload
    {
        public required CardModel Source;
        public required string Pack;
        public required string Id;
        public required JsonElement Definition;
        public required JsonElement Statuses;
        public required string TextKey;
        public bool Firing;
        public int Turn = -1;
        public int Triggers;
        public bool IconResolved;
        public Texture2D? Icon;
    }

    private static readonly ConditionalWeakTable<PowerModel, Payload> Payloads = new();

    public override PowerType Type => PowerType.Buff;
    public override PowerStackType StackType => PowerStackType.Counter;
    public override PowerInstanceType InstanceType => PowerInstanceType.Instanced;

    public override LocString Title => Text("name", "title");
    public override LocString Description => Text("description", "description");

    private LocString Text(string field, string suffix)
    {
        var english = LocManager.Instance.Language == "eng";
        if (!Payloads.TryGetValue(this, out var payload))
        {
            var fallbackKey = "SF_RULE_POWER." + suffix;
            var fallback = suffix == "title"
                ? english ? "Rule status" : "规则状态"
                : english ? "Stacks: {Amount}." : "层数：{Amount}。";
            LocManager.Instance.GetTable("powers").MergeWith(new Dictionary<string, string> { [fallbackKey] = fallback });
            return new LocString("powers", fallbackKey);
        }
        var text = Localized(payload.Definition.GetProperty(field), english);
        var key = payload.TextKey + "." + suffix;
        LocManager.Instance.GetTable("powers").MergeWith(new Dictionary<string, string> { [key] = text });
        return new LocString("powers", key);
    }

    private static string Localized(JsonElement value, bool english)
    {
        var first = english ? "eng" : "zhs";
        var second = english ? "zhs" : "eng";
        if (value.TryGetProperty(first, out var preferred) && !string.IsNullOrWhiteSpace(preferred.GetString()))
            return preferred.GetString()!;
        return value.TryGetProperty(second, out var fallback) ? fallback.GetString() ?? "" : "";
    }

    internal static SfRulePower? Find(Creature owner, string pack, string id) =>
        owner.Powers.OfType<SfRulePower>().FirstOrDefault(power =>
            Payloads.TryGetValue(power, out var payload) && payload.Pack == pack && payload.Id == id);

    internal static async Task ChangeAsync(
        SfEffectContext context, Creature owner, string pack, string id,
        JsonElement definition, JsonElement statuses, int amount, bool remove)
    {
        if (amount < 0) throw new InvalidOperationException("Rule status stacks must be non-negative.");
        if (amount == 0 || owner.CombatState == null) return;
        var existing = Find(owner, pack, id);
        var choice = context.Choice ?? new ThrowingPlayerChoiceContext();
        if (remove)
        {
            if (existing == null) return;
            await PowerCmd.ModifyAmount(choice, existing, -Math.Min(existing.Amount, amount),
                context.Card.Owner.Creature, context.Card);
            return;
        }
        if (existing != null)
        {
            var payload = Payloads.GetValue(existing, _ => throw new InvalidOperationException("Missing rule status payload."));
            var next = StackedAmount(existing.Amount, amount, payload.Definition);
            if (next != existing.Amount)
            {
                await PowerCmd.ModifyAmount(choice, existing, next - existing.Amount,
                    context.Card.Owner.Creature, context.Card);
                EnforceMaximum(existing, payload.Definition);
            }
            return;
        }
        var power = (SfRulePower)ModelDb.Power<SfRulePower>().ToMutable();
        var identity = pack + "\n" + id + "\n" + definition.GetRawText();
        Payloads.Add(power, new Payload
        {
            Source = context.Card, Pack = pack, Id = id,
            Definition = definition.Clone(), Statuses = statuses.Clone(),
            TextKey = "SF_RULE_POWER_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity))),
        });
        await PowerCmd.Apply(choice, power, owner, StackedAmount(0, amount, definition),
            context.Card.Owner.Creature, context.Card);
        EnforceMaximum(power, definition);
    }

    private static int StackedAmount(int current, int incoming, JsonElement definition)
    {
        var maximum = SfRulesGame.NonNegativeInteger(definition.GetProperty("max_stacks").GetDecimal(), "max_stacks");
        if (maximum == 0) throw new InvalidOperationException("Rule max_stacks must be positive.");
        decimal next = definition.GetProperty("stacking").GetString() switch
        {
            "add" => (decimal)current + incoming,
            "replace" => incoming,
            "max" => Math.Max(current, incoming),
            _ => throw new InvalidOperationException("Unknown rule stacking mode."),
        };
        return (int)Math.Min(next, Math.Min(maximum, 999999999));
    }

    private static void EnforceMaximum(SfRulePower power, JsonElement definition)
    {
        if (power.Owner == null || !power.Owner.Powers.Contains(power)) return;
        var maximum = Math.Min(SfRulesGame.NonNegativeInteger(definition.GetProperty("max_stacks").GetDecimal(), "max_stacks"), 999999999);
        if (power.Amount > maximum) power.SetAmount(maximum);
    }

    public override async Task BeforeSideTurnStart(
        PlayerChoiceContext choiceContext, CombatSide side, IReadOnlyList<Creature> participants, ICombatState combatState)
    {
        if (side == Owner.Side && participants.Contains(Owner))
            await FireAsync(choiceContext, "turn_start", null);
    }

    public override async Task AfterSideTurnEnd(
        PlayerChoiceContext choiceContext, CombatSide side, IEnumerable<Creature> participants)
    {
        if (side != Owner.Side || !participants.Contains(Owner)) return;
        await FireAsync(choiceContext, "turn_end", null);
        if (!Payloads.TryGetValue(this, out var payload) || !IsActive()) return;
        var decay = SfRulesGame.NonNegativeInteger(payload.Definition.GetProperty("decay").GetDecimal(), "decay");
        if (decay > 0)
            await PowerCmd.ModifyAmount(choiceContext, this, -Math.Min(Amount, decay), null, payload.Source);
    }

    public override Task AfterCardPlayed(PlayerChoiceContext choiceContext, CardPlay cardPlay) =>
        cardPlay.Player.Creature == Owner
            ? FireAsync(choiceContext, "after_play", cardPlay)
            : Task.CompletedTask;

    public override Task AfterAttack(PlayerChoiceContext choiceContext, AttackCommand command) =>
        command.Attacker == Owner
            ? FireAsync(choiceContext, "after_attack", command.CardPlay)
            : Task.CompletedTask;

    private bool IsActive() => Amount > 0 && Owner != null && Owner.IsAlive
        && Owner.CombatState != null && Owner.Powers.Contains(this);

    private async Task FireAsync(PlayerChoiceContext choice, string trigger, CardPlay? play)
    {
        if (!IsActive() || !Payloads.TryGetValue(this, out var payload) || payload.Firing
            || payload.Definition.GetProperty("trigger").GetString() != trigger) return;
        var turn = Owner.Player?.PlayerCombatState?.TurnNumber ?? Owner.CombatState!.RoundNumber;
        if (payload.Turn != turn)
        {
            payload.Turn = turn;
            payload.Triggers = 0;
        }
        var limit = SfRulesGame.NonNegativeInteger(
            payload.Definition.GetProperty("max_triggers_per_turn").GetDecimal(), "max_triggers_per_turn");
        if (payload.Triggers >= limit) return;
        payload.Firing = true;
        payload.Triggers++;
        try
        {
            Flash();
            var context = new SfEffectContext
            {
                Card = payload.Source, Effect = new SfEffect { KindName = "custom", Handler = "sf_rules" },
                Choice = choice, Play = play, Target = Owner, Targets = [Owner], Trigger = "status_" + trigger,
            };
            await SfRulesEngine.ExecuteNodesAsync(context, payload.Definition.GetProperty("nodes"),
                payload.Statuses, SfRulesBudget.Current ?? new SfRulesBudget());
        }
        catch (Exception error)
        {
            SfLog.Error($"rule status '{payload.Pack}/{payload.Id}' from '{payload.Source.Id}' failed at {trigger}: {error}");
        }
        finally
        {
            payload.Firing = false;
        }
    }

    public static void InstallIconHook(Harmony harmony)
    {
        var postfix = new HarmonyMethod(typeof(SfRulePower), nameof(IconPostfix));
        harmony.Patch(AccessTools.PropertyGetter(typeof(PowerModel), "Icon"), postfix: postfix);
        harmony.Patch(AccessTools.PropertyGetter(typeof(PowerModel), "BigIcon"), postfix: postfix);
    }

    private static void IconPostfix(PowerModel __instance, ref Texture2D __result)
    {
        if (__instance is not SfRulePower || !Payloads.TryGetValue(__instance, out var payload)) return;
        if (!payload.IconResolved)
        {
            payload.IconResolved = true;
            var spec = payload.Definition.GetProperty("icon").GetString() ?? "";
            var type = SfPowerResolver.Find(spec);
            if (type != null && type != typeof(SfRulePower))
            {
                var model = ModelDb.DebugPower(type);
                payload.Icon = ResourceLoader.Load<Texture2D>(model.PackedIconPath, null, ResourceLoader.CacheMode.Reuse);
            }
        }
        if (payload.Icon != null) __result = payload.Icon;
    }
}
