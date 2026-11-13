// The production command adapter and status class are linked by the test project.
// Only the game boundary and rule interpreter are replaced with controlled doubles.
using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace Godot
{
    public class Texture2D { }
    public static class ResourceLoader
    {
        public enum CacheMode { Reuse }
        public static T Load<T>(string path, object? hint, CacheMode mode) where T : new() => new();
    }
}
namespace HarmonyLib
{
    public class Harmony { public void Patch(object getter, HarmonyMethod postfix) { } }
    public class HarmonyMethod { public HarmonyMethod(Type type, string method) { } }
    public static class AccessTools { public static object PropertyGetter(Type type, string name) => new(); }
}
namespace MegaCrit.Sts2.Core.Combat
{
    public enum CombatSide { Player, Enemy }
    public interface ICombatState { IReadOnlyList<Creature> HittableEnemies { get; } int RoundNumber { get; } }
    public class TestCombat : ICombatState
    {
        public IReadOnlyList<Creature> HittableEnemies { get; set; } = [];
        public int RoundNumber { get; set; } = 1;
    }
}
namespace MegaCrit.Sts2.Core.Entities.Creatures
{
    public class Creature
    {
        public ICombatState? CombatState { get; set; }
        public bool IsAlive { get; set; } = true;
        public CombatSide Side { get; set; }
        public Player? Player { get; set; }
        public List<PowerModel> Powers { get; } = [];
    }
}
namespace MegaCrit.Sts2.Core.Entities.Cards
{
    public enum CardType { None, Attack, Skill, Power, Status, Curse, Quest }
    public enum PileType { Hand, Draw, Discard, Exhaust }
    public class CardPile(PileType type)
    {
        public PileType Type { get; } = type;
        public bool IsCombatPile => true;
        public List<CardModel> Cards { get; } = [];
    }
    public static class PileExtensions { public static CardPile GetPile(this PileType type, Player player) => player.Piles[type]; }
    public class CardPlay { public required Player Player { get; init; } }
    public class CardEnergyCost
    {
        public bool CostsX { get; set; }
        public int Canonical { get; set; } = 1;
        public int TurnDelta { get; private set; }
        public int CombatDelta { get; private set; }
        public void AddThisTurn(int amount) => TurnDelta += amount;
        public void AddThisCombat(int amount) => CombatDelta += amount;
    }
}
namespace MegaCrit.Sts2.Core.Entities.Powers
{
    public enum PowerType { Buff }
    public enum PowerStackType { Counter }
    public enum PowerInstanceType { Instanced }
}
namespace MegaCrit.Sts2.Core.GameActions.Multiplayer
{
    public class PlayerChoiceContext { }
    public class ThrowingPlayerChoiceContext : PlayerChoiceContext { }
}
namespace MegaCrit.Sts2.Core.Localization
{
    public class LocString(string table, string key)
    {
        public string GetRawText() => LocManager.Instance.GetTable(table).Entries.GetValueOrDefault(key, "");
    }
    public class LocTable
    {
        public Dictionary<string, string> Entries { get; } = [];
        public void MergeWith(Dictionary<string, string> entries) { foreach (var entry in entries) Entries[entry.Key] = entry.Value; }
    }
    public class LocManager
    {
        public static LocManager Instance { get; } = new();
        public string Language { get; set; } = "eng";
        private readonly Dictionary<string, LocTable> _tables = [];
        public LocTable GetTable(string name)
        {
            if (!_tables.TryGetValue(name, out var table)) _tables[name] = table = new();
            return table;
        }
    }
}
namespace MegaCrit.Sts2.Core.CardSelection
{
    public struct CardSelectorPrefs(MegaCrit.Sts2.Core.Localization.LocString prompt, int count)
    {
        public MegaCrit.Sts2.Core.Localization.LocString Prompt => prompt;
        public int MinSelect => count;
        public int MaxSelect => count;
    }
}
namespace MegaCrit.Sts2.Core.Commands.Builders
{
    public class AttackCommand { public Creature? Attacker { get; set; } public CardPlay? CardPlay { get; set; } }
}
namespace MegaCrit.Sts2.Core.Models
{
    public class ModelId { public string Entry { get; set; } = "CARD"; }
    public class Player
    {
        public Creature Creature { get; } = new();
        public RunState RunState { get; } = new();
        public PlayerCombatState PlayerCombatState { get; } = new();
        public Dictionary<PileType, CardPile> Piles { get; } = Enum.GetValues<PileType>().ToDictionary(type => type, type => new CardPile(type));
        public Player() { Creature.Player = this; }
    }
    public class PlayerCombatState { public int TurnNumber { get; set; } = 1; }
    public class RunState { public RngSet Rng { get; } = new(); }
    public class RngSet { public TestRng CombatCardSelection { get; } = new(); }
    public class TestRng { public int Calls { get; private set; } public int NextInt(int count) { Calls++; return count - 1; } }
    public class CardModel
    {
        public required Player Owner { get; init; }
        public ModelId Id { get; } = new();
        public CardType Type { get; set; } = CardType.Attack;
        public CardPile? Pile { get; set; }
        public CardEnergyCost EnergyCost { get; } = new();
        public bool IsUpgradable => Upgrades == 0;
        public int Upgrades { get; set; }
        public void InvokeEnergyCostChanged() { }
        public CardModel CreateClone() => new() { Owner = Owner, Type = Type };
    }
    public class PowerModel
    {
        public int Amount { get; set; }
        public Creature Owner { get; set; } = null!;
        public string PackedIconPath => "";
        public virtual MegaCrit.Sts2.Core.Entities.Powers.PowerType Type => default;
        public virtual MegaCrit.Sts2.Core.Entities.Powers.PowerStackType StackType => default;
        public virtual MegaCrit.Sts2.Core.Entities.Powers.PowerInstanceType InstanceType => default;
        public virtual MegaCrit.Sts2.Core.Localization.LocString Title => new("powers", "");
        public virtual MegaCrit.Sts2.Core.Localization.LocString Description => new("powers", "");
        public PowerModel ToMutable() => (PowerModel)Activator.CreateInstance(GetType())!;
        public void SetAmount(int amount) => Amount = amount;
        public void Flash() { }
        public virtual Task BeforeSideTurnStart(PlayerChoiceContext context, CombatSide side, IReadOnlyList<Creature> participants, ICombatState combat) => Task.CompletedTask;
        public virtual Task AfterSideTurnEnd(PlayerChoiceContext context, CombatSide side, IEnumerable<Creature> participants) => Task.CompletedTask;
        public virtual Task AfterCardPlayed(PlayerChoiceContext context, CardPlay play) => Task.CompletedTask;
        public virtual Task AfterAttack(PlayerChoiceContext context, MegaCrit.Sts2.Core.Commands.Builders.AttackCommand command) => Task.CompletedTask;
    }
    public static class ModelDb
    {
        public static T Power<T>() where T : PowerModel, new() => new();
        public static PowerModel DebugPower(Type type) => new();
    }
}
namespace MegaCrit.Sts2.Core.Commands
{
    using MegaCrit.Sts2.Core.CardSelection;
    public static class Calls { public static List<string> Items { get; } = []; }
    public static class CardSelectCmd
    {
        public static async Task<IEnumerable<CardModel>> FromHand(PlayerChoiceContext context, Player player, CardSelectorPrefs prefs, Func<CardModel, bool> filter, CardModel source)
        {
            Calls.Items.Add("choose_hand");
            await Task.Yield();
            return player.Piles[PileType.Hand].Cards.Where(filter).Take(prefs.MaxSelect).ToArray();
        }
        public static async Task<IEnumerable<CardModel>> FromCombatPile(PlayerChoiceContext context, CardPile pile, Player player, CardSelectorPrefs prefs, Func<CardModel, bool> filter)
        {
            Calls.Items.Add("choose_" + pile.Type);
            await Task.Yield();
            return pile.Cards.Where(filter).Take(prefs.MaxSelect).ToArray();
        }
    }
    public static class CardPileCmd
    {
        public static async Task Add(CardModel card, PileType type)
        {
            Calls.Items.Add("move_" + type);
            await Task.Yield();
            card.Pile?.Cards.Remove(card);
            card.Pile = type.GetPile(card.Owner);
            card.Pile.Cards.Add(card);
        }
        public static async Task AddGeneratedCardToCombat(CardModel card, PileType type, Player creator)
        {
            Calls.Items.Add("copy_" + type);
            await Add(card, type);
        }
    }
    public static class CardCmd
    {
        public static async Task Exhaust(PlayerChoiceContext context, CardModel card) { Calls.Items.Add("exhaust"); await CardPileCmd.Add(card, PileType.Exhaust); }
        public static void Upgrade(CardModel card) { Calls.Items.Add("upgrade"); card.Upgrades++; }
    }
    public static class PowerCmd
    {
        public static Task Apply(PlayerChoiceContext context, PowerModel power, Creature owner, decimal amount, Creature? applier, CardModel? source)
        { power.Owner = owner; power.Amount = (int)amount; owner.Powers.Add(power); return Task.CompletedTask; }
        public static Task<int> ModifyAmount(PlayerChoiceContext context, PowerModel power, decimal amount, Creature? applier, CardModel? source)
        {
            power.Amount += (int)amount;
            if (power.Amount <= 0) power.Owner.Powers.Remove(power);
            return Task.FromResult(power.Amount);
        }
    }
}
namespace SpireForge.Api
{
    public static class SfLog { public static List<string> Errors { get; } = []; public static void Error(string text) => Errors.Add(text); }
    public class SfEffectContext
    {
        public required CardModel Card { get; init; }
        public required SpireForge.Runtime.SfEffect Effect { get; init; }
        public PlayerChoiceContext? Choice { get; init; }
        public CardPlay? Play { get; init; }
        public Creature? Target { get; init; }
        public IReadOnlyList<Creature>? Targets { get; init; }
        internal IReadOnlyList<Creature> ResolvedTargets => Targets ?? (Target is { } target ? [target] : []);
        public required string Trigger { get; init; }
    }
}
namespace SpireForge.Runtime
{
    public class SfEffect { public string KindName { get; set; } = ""; public string Handler { get; set; } = ""; }
    public static class PackLoader { public static Dictionary<string, string> PackOf { get; } = []; }
    public static class SfVanillaOverride { public static bool TryPackOfEntry(string entry, out string pack) { pack = ""; return false; } }
    public static class RuntimeEntry { public const string ModId = "SpireForgeRuntime"; }
    public static class SfPowerResolver { public static Type? Find(string name) => null; }
    public static class SfRulesValues { public static decimal Evaluate(SfEffectContext context, JsonElement value) => value.GetDecimal(); }
    public static class SfRulesEngine
    {
        public static List<SfEffectContext> Executions { get; } = [];
        public static Func<SfEffectContext, Task>? OnExecute { get; set; }
        public static async Task ExecuteNodesAsync(SfEffectContext context, JsonElement nodes, JsonElement statuses, SfRulesBudget budget)
        {
            using var scope = SfRulesBudget.Enter(SfRulesBudget.Current ?? budget);
            Executions.Add(context);
            budget.Spend();
            if (OnExecute != null) await OnExecute(context);
        }
    }
}
