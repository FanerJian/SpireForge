// Controlled game boundary; production classes implement scheduling, schema, upgrades and text.
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
    public class HarmonyMethod(Type type, string method) { }
    public static class AccessTools { public static object PropertyGetter(Type type, string name) => new(); }
}
namespace MegaCrit.Sts2.Core.Entities.Creatures { public class Creature { } }
namespace MegaCrit.Sts2.Core.Entities.Cards
{
    public enum CardType { Attack, Skill, Power, Status, Curse, Quest }
    public enum CardRarity { Basic, Common, Uncommon, Rare, Ancient, Event, Token, Status, Curse, Quest }
    public enum TargetType { None, Self, AnyEnemy, AllEnemies, RandomEnemy, AnyPlayer, AnyAlly, AllAllies, TargetedNoCreature, Osty }
    public enum CardKeyword { Unplayable }
}
namespace MegaCrit.Sts2.Core.Entities.Powers { public enum PowerType { Buff } public enum PowerStackType { Counter } public enum PowerInstanceType { Instanced } }
namespace MegaCrit.Sts2.Core.Combat { public enum CombatSide { Player, Enemy } public interface ICombatState { } }
namespace MegaCrit.Sts2.Core.GameActions.Multiplayer { public class PlayerChoiceContext { } public class ThrowingPlayerChoiceContext : PlayerChoiceContext { } }
namespace MegaCrit.Sts2.Core.Localization
{
    public class LocString(string table = "powers", string key = "")
    {
        public string LocEntryKey => key;
        public string GetRawText() => LocManager.Instance.GetTable(table).Entries.GetValueOrDefault(key, "");
        public string GetFormattedText() => GetRawText();
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
        private readonly LocTable _table = new();
        public LocTable GetTable(string name) => _table;
    }
}
namespace MegaCrit.Sts2.Core.Logging { public static class Log { public static void Error(string text) => throw new Exception(text); public static void Info(string text) { } } }
namespace MegaCrit.Sts2.Core.Models
{
    using MegaCrit.Sts2.Core.Entities.Creatures;
    using MegaCrit.Sts2.Core.Entities.Powers;
    using MegaCrit.Sts2.Core.Localization;
    using MegaCrit.Sts2.Core.Combat;
    using MegaCrit.Sts2.Core.GameActions.Multiplayer;
    public class TestVar(decimal value) { public decimal BaseValue { get; private set; } = value; public void UpgradeValueBy(decimal delta) => BaseValue += delta; }
    public class Player { public Creature Creature { get; } = new(); }
    public class ModelId { public string Entry => "TEST_CARD"; }
    public class CardModel
    {
        public Player Owner { get; } = new();
        public ModelId Id { get; } = new();
        public int CurrentUpgradeLevel { get; set; }
        public Dictionary<string, TestVar> DynamicVars { get; } = [];
    }
    public class PowerModel
    {
        public int Amount { get; set; }
        public int AmountOnTurnStart { get; set; }
        public Creature Owner { get; set; } = null!;
        public string PackedIconPath => "";
        public virtual PowerType Type => default;
        public virtual PowerStackType StackType => default;
        public virtual PowerInstanceType InstanceType => default;
        public virtual LocString Title => new();
        public virtual LocString Description => new();
        public PowerModel ToMutable() => (PowerModel)Activator.CreateInstance(GetType())!;
        public void Flash() { }
        public virtual Task BeforeSideTurnStart(PlayerChoiceContext context, CombatSide side, IReadOnlyList<Creature> participants, ICombatState combat) => Task.CompletedTask;
        public virtual Task AfterSideTurnEnd(PlayerChoiceContext context, CombatSide side, IEnumerable<Creature> participants) => Task.CompletedTask;
    }
    public static class ModelDb
    {
        public static T Power<T>() where T : PowerModel, new() => new();
        public static PowerModel DebugPower(Type type) => new();
    }
}
namespace MegaCrit.Sts2.Core.Commands
{
    using MegaCrit.Sts2.Core.Entities.Creatures;
    using MegaCrit.Sts2.Core.Models;
    using MegaCrit.Sts2.Core.GameActions.Multiplayer;
    public static class PowerCmd
    {
        public static PowerModel Last { get; private set; } = null!;
        public static Task Apply(PlayerChoiceContext context, PowerModel power, Creature owner, int amount, object? source, CardModel card, bool silent)
        { power.Owner = owner; power.Amount = amount; Last = power; return Task.CompletedTask; }
        public static Task Decrement(PowerModel power) { power.Amount--; return Task.CompletedTask; }
    }
}
namespace SpireForge.Runtime
{
    using MegaCrit.Sts2.Core.Models;
    using MegaCrit.Sts2.Core.GameActions.Multiplayer;
    public static class PackLoader { public static Dictionary<string, string> PackOf { get; } = []; }
    public static class SfVanillaOverride { public static bool TryPackOfEntry(string entry, out string pack) { pack = ""; return false; } }
    public static class SfPowerResolver { public static Type? Find(string name) => null; }
    public static class SfEffectEngine
    {
        public static readonly List<string> Triggers = [];
        public static readonly List<decimal> Amounts = [];
        public static Task RunAsync(CardModel card, List<SfEffect> effects, PlayerChoiceContext context, object? play, string trigger, bool useVarBinding)
        { if (useVarBinding) throw new Exception("Delayed effects must use snapshot values"); Triggers.Add(trigger); Amounts.AddRange(effects.Select(e => e.Amount)); return Task.CompletedTask; }
    }
}
