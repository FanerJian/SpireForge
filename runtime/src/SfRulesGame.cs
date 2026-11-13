using System.Text.Json;
using MegaCrit.Sts2.Core.CardSelection;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>Rules' game command boundary. Selection snapshots are processed in their original order.</summary>
internal static class SfRulesGame
{
    internal static string PackOf(CardModel card)
    {
        var entry = card.Id?.Entry ?? "";
        if (PackLoader.PackOf.TryGetValue(entry, out var pack)) return pack;
        return SfVanillaOverride.TryPackOfEntry(entry, out pack) ? pack : RuntimeEntry.ModId;
    }

    internal static int NextIndex(SfEffectContext context, int count)
    {
        if (count <= 0) throw new ArgumentOutOfRangeException(nameof(count));
        var rng = context.Card.Owner.RunState?.Rng.CombatCardSelection
            ?? throw new InvalidOperationException("Rule randomness requires an active run RNG.");
        return rng.NextInt(count);
    }

    internal static decimal StatusStacks(SfEffectContext context, string id, string subject)
    {
        var targets = subject == "target" ? context.ResolvedTargets : [context.Card.Owner.Creature];
        var pack = PackOf(context.Card);
        return targets.Sum(owner => (decimal)(SfRulePower.Find(owner, pack, id)?.Amount ?? 0));
    }

    internal static async Task ApplyStatusAsync(
        SfEffectContext context, JsonElement node, JsonElement statuses, SfRulesBudget budget)
    {
        var combat = context.Card.Owner.Creature.CombatState;
        if (combat == null) return;
        var id = node.GetProperty("id").GetString()!;
        var amount = NonNegativeInteger(SfRulesValues.Evaluate(context, node.GetProperty("stacks")), "status stacks");
        if (amount == 0) return;
        var definition = statuses.EnumerateArray().FirstOrDefault(status => status.GetProperty("id").GetString() == id);
        if (definition.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException($"Rule status '{id}' has no definition.");
        var pack = PackOf(context.Card);
        IReadOnlyList<Creature> targets = node.GetProperty("target").GetString() switch
        {
            "self" => new[] { context.Card.Owner.Creature },
            "target" => context.ResolvedTargets,
            "all_enemies" => combat.HittableEnemies.ToArray(),
            _ => throw new InvalidOperationException("Unknown rule status target."),
        };
        foreach (var target in targets)
        {
            budget.Spend();
            if (target.CombatState != combat || !target.IsAlive) continue;
            await SfRulePower.ChangeAsync(context, target, pack, id, definition, statuses,
                amount, node.GetProperty("operation").GetString() == "remove");
        }
    }

    internal static async Task SelectAsync(SfEffectContext context, JsonElement node, SfRulesBudget budget)
    {
        if (context.Card.Owner.Creature.CombatState == null) return;
        var pileType = Pile(node.GetProperty("from").GetString()!, allowExhaust: true);
        var pile = pileType.GetPile(context.Card.Owner);
        var filterName = node.TryGetProperty("card_type", out var filterValue) ? filterValue.GetString() : null;
        CardType? filterType = null;
        if (!string.IsNullOrEmpty(filterName))
        {
            if (!Enum.TryParse<CardType>(filterName, true, out var parsed) || !Enum.IsDefined(parsed))
                throw new InvalidOperationException($"Unknown rule card type '{filterName}'.");
            filterType = parsed;
        }
        bool Matches(CardModel card) => filterType == null || card.Type == filterType;
        var candidates = pile.Cards.Where(Matches).ToList();
        var mode = node.GetProperty("mode").GetString();
        var count = Math.Min(candidates.Count,
            NonNegativeInteger(SfRulesValues.Evaluate(context, node.GetProperty("count")), "selection count"));
        if (candidates.Count == 0) return;
        List<CardModel> selected;
        switch (mode)
        {
            case "all":
                selected = candidates;
                break;
            case "random":
                selected = new List<CardModel>();
                while (selected.Count < count)
                {
                    var index = NextIndex(context, candidates.Count);
                    selected.Add(candidates[index]);
                    candidates.RemoveAt(index);
                }
                break;
            case "choose":
                if (count == 0) return;
                var prompt = SelectionPrompt();
                var prefs = new CardSelectorPrefs(prompt, count);
                var choice = context.Choice ?? new ThrowingPlayerChoiceContext();
                var result = pileType == PileType.Hand
                    ? await CardSelectCmd.FromHand(choice, context.Card.Owner, prefs, Matches, context.Card)
                    : await CardSelectCmd.FromCombatPile(choice, pile, context.Card.Owner, prefs, Matches);
                selected = result.Where(candidates.Contains).Distinct().Take(count).ToList();
                break;
            default:
                throw new InvalidOperationException($"Unknown rule selection mode '{mode}'.");
        }
        foreach (var card in selected)
        foreach (var operation in node.GetProperty("operations").EnumerateArray())
        {
            budget.Spend();
            // An exhaust/discard hook may end combat or remove a card while the command is awaited.
            if (context.Card.Owner.Creature.CombatState == null || card.Pile == null || !card.Pile.IsCombatPile) continue;
            await ApplyCardOperationAsync(context, card, operation);
        }
    }

    private static async Task ApplyCardOperationAsync(SfEffectContext context, CardModel card, JsonElement operation)
    {
        switch (operation.GetProperty("type").GetString())
        {
            case "move":
                await CardPileCmd.Add(card, Pile(operation.GetProperty("pile").GetString()!));
                break;
            case "copy":
                await CardPileCmd.AddGeneratedCardToCombat(card.CreateClone(),
                    Pile(operation.GetProperty("pile").GetString()!), context.Card.Owner);
                break;
            case "exhaust":
                if (card.Pile?.Type != PileType.Exhaust)
                    await CardCmd.Exhaust(context.Choice ?? new ThrowingPlayerChoiceContext(), card);
                break;
            case "upgrade":
                if (card.IsUpgradable) CardCmd.Upgrade(card);
                break;
            case "cost":
                var amount = CheckedInteger(SfRulesValues.Evaluate(context, operation.GetProperty("amount")), "cost delta");
                // X and unplayable costs use sentinel values in the game's cost model.
                if (card.EnergyCost.CostsX || card.EnergyCost.Canonical < 0) break;
                switch (operation.GetProperty("duration").GetString())
                {
                    case "turn": card.EnergyCost.AddThisTurn(amount); break;
                    case "combat": card.EnergyCost.AddThisCombat(amount); break;
                    default: throw new InvalidOperationException("Unknown rule cost duration.");
                }
                card.InvokeEnergyCostChanged();
                break;
            default:
                throw new InvalidOperationException("Unknown rule card operation.");
        }
    }

    private static LocString SelectionPrompt()
    {
        const string key = "SF_RULES_SELECT";
        LocManager.Instance.GetTable("card_selection").MergeWith(new Dictionary<string, string>
        {
            [key] = LocManager.Instance.Language == "eng" ? "Select {Amount} cards." : "选择 {Amount} 张牌。",
        });
        return new LocString("card_selection", key);
    }

    private static PileType Pile(string name, bool allowExhaust = false) => name switch
    {
        "hand" => PileType.Hand,
        "draw" => PileType.Draw,
        "discard" => PileType.Discard,
        "exhaust" when allowExhaust => PileType.Exhaust,
        _ => throw new InvalidOperationException($"Unknown rule pile '{name}'."),
    };

    private static int CheckedInteger(decimal value, string name)
    {
        if (value < int.MinValue || value > int.MaxValue)
            throw new InvalidOperationException($"Rule {name} is outside the integer range.");
        return (int)decimal.Floor(value);
    }

    internal static int NonNegativeInteger(decimal value, string name)
    {
        if (value < 0) throw new InvalidOperationException($"Rule {name} must be non-negative.");
        return (int)decimal.Floor(Math.Min(value, int.MaxValue));
    }
}
