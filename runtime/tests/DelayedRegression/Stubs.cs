// Controlled game-command boundary. The linked production class owns all scheduling decisions.
namespace MegaCrit.Sts2.Core.Entities.Creatures { public enum CombatSide { Player, Enemy } public class Creature { } }
namespace MegaCrit.Sts2.Core.Entities.Powers { public enum PowerType { Buff } public enum PowerStackType { Counter } public enum PowerInstanceType { Instanced } }
namespace MegaCrit.Sts2.Core.Combat { public interface ICombatState { } }
namespace MegaCrit.Sts2.Core.GameActions.Multiplayer { public class PlayerChoiceContext { } public class ThrowingPlayerChoiceContext : PlayerChoiceContext { } }
namespace MegaCrit.Sts2.Core.Localization
{
    public class LocString { }
    public class LocTable { public void MergeWith(Dictionary<string, string> entries) { } }
    public class LocManager { public static LocManager Instance { get; } = new(); public string Language => "eng"; public LocTable GetTable(string name) => new(); }
}
namespace MegaCrit.Sts2.Core.Logging { public static class Log { public static void Error(string text) => throw new Exception(text); public static void Info(string text) { } } }
namespace MegaCrit.Sts2.Core.Models
{
    using MegaCrit.Sts2.Core.Entities.Creatures;
    using MegaCrit.Sts2.Core.Entities.Powers;
    using MegaCrit.Sts2.Core.Localization;
    using MegaCrit.Sts2.Core.Combat;
    using MegaCrit.Sts2.Core.GameActions.Multiplayer;
    public class Player { public Creature Creature { get; } = new(); }
    public class CardModel { public Player Owner { get; } = new(); public string Id => "TEST_CARD"; }
    public class PowerModel
    {
        public int Amount { get; set; }
        public int AmountOnTurnStart { get; set; }
        public Creature Owner { get; set; } = null!;
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
    public static class ModelDb { public static T Power<T>() where T : PowerModel, new() => new(); }
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
    public class SfEffect { }
    public static class SfEffectEngine
    {
        public static readonly List<string> Triggers = [];
        public static Task RunAsync(CardModel card, List<SfEffect> effects, PlayerChoiceContext context, object? play, string trigger, bool useVarBinding)
        { if (useVarBinding) throw new Exception("Delayed effects must use literal values"); Triggers.Add(trigger); return Task.CompletedTask; }
    }
}
