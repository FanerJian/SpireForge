// Controlled game boundaries. Tests link the production interpreter and effect registry above.
// Every unrelated command throws so accidental use is visible in the captured error log.
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.ValueProps;
using SpireForge.Runtime;

namespace MegaCrit.Sts2.Core.Entities.Cards
{
    public enum CardType { Attack, Skill }
    public enum CardRarity { Common }
    public enum TargetType { AnyEnemy, RandomEnemy, Self, AllEnemies }
    public enum CardKeyword { Unplayable }
    public enum PileType { Hand, Discard, Draw }
    public sealed class CardPlay { public Creature? Target { get; init; } }
}
namespace MegaCrit.Sts2.Core.GameActions.Multiplayer
{
    public class PlayerChoiceContext { }
    public class BlockingPlayerChoiceContext : PlayerChoiceContext { }
}
namespace MegaCrit.Sts2.Core.Entities.Creatures
{
    public class Creature
    {
        public ICombatState? CombatState { get; set; }
        public int CurrentHp { get; set; } = 10;
        public int MaxHp { get; set; } = 10;
        public int Block { get; set; }
        public List<PowerModel> Powers { get; } = [];
        public string? SlotName => null;
        public bool IsDead => false;
        public MonsterModel? Monster => null;
        public void PrepareForNextTurn(IEnumerable<Creature> targets) => throw new NotSupportedException();
    }
}
namespace MegaCrit.Sts2.Core.Combat
{
    public enum CombatSide { Player, Enemy }
    public interface ICombatState
    {
        IReadOnlyList<Creature> HittableEnemies { get; }
        IEnumerable<Creature> Enemies { get; }
        IEnumerable<Creature> Creatures { get; }
        IEnumerable<Player> Players { get; }
        Encounter? Encounter { get; }
        CardModel CreateCard(CardModel card, Player player);
        Creature CreateCreature(MonsterModel model, CombatSide side, string? slot);
        bool ContainsCreature(Creature creature);
    }
    public sealed class Encounter { public List<string> Slots { get; } = []; }
    public sealed class CombatManager
    {
        public static CombatManager Instance { get; } = new();
        public ICombatState? DebugOnlyGetState() => null;
    }
}
namespace MegaCrit.Sts2.Core.Models
{
    public class AbstractModel { public ModelId Id { get; } = new(); }
    public sealed class ModelId { public string Entry { get; set; } = "TEST_CARD"; public override string ToString() => Entry; }
    public class CardModel : AbstractModel
    {
        public Player Owner { get; set; } = new();
        public EnergyCost EnergyCost { get; } = new();
        public int EnergyX { get; set; }
        public int ResolveEnergyXValue() => EnergyCost.CostsX ? EnergyX : throw new InvalidOperationException("This card does not have an X-cost.");
        public Dictionary<string, DynamicVar> DynamicVars { get; } = [];
        public TargetType TargetType { get; set; } = TargetType.Self;
        public int CurrentUpgradeLevel { get; set; }
    }
    public class PowerModel : AbstractModel { public int Amount { get; set; } }
    public class MonsterModel : AbstractModel { public MonsterModel ToMutable() => throw new NotSupportedException(); }
    public class OrbModel : AbstractModel
    {
        public OrbModel ToMutable() => throw new NotSupportedException();
        public static OrbModel GetRandomOrb(TestRng rng) => throw new NotSupportedException();
    }
    public sealed class EnergyCost { public bool CostsX { get; set; } }
    public class DynamicVar { public decimal BaseValue { get; set; } }
    public sealed class Player
    {
        public Creature Creature { get; } = new();
        public object Character { get; } = new();
        public RunState RunState { get; } = new();
        public PlayerCombatState PlayerCombatState { get; } = new();
    }
    public sealed class PlayerCombatState
    {
        public Hand Hand { get; } = new();
        public Hand DrawPile { get; } = new();
        public Hand DiscardPile { get; } = new();
        public Hand ExhaustPile { get; } = new();
        public int TurnNumber { get; set; } = 1;
    }
    public sealed class Hand { public List<CardModel> Cards { get; } = []; }
    public sealed class RunState { public RngSet Rng { get; } = new(); }
    public sealed class RngSet
    {
        public TestRng CombatTargets { get; } = new();
        public TestRng CombatCardSelection { get; } = new();
        public TestRng CombatOrbGeneration { get; } = new();
    }
    public sealed class TestRng
    {
        public int Calls { get; private set; }
        public int NextInt(int maximum) { Calls++; return 0; }
        public T? NextItem<T>(IReadOnlyList<T> items) => items.FirstOrDefault();
    }
    public static class ModelDb
    {
        public static IEnumerable<CardModel> AllCards => [];
        public static OrbModel? DebugOrb(Type type) => null;
    }
}
namespace MegaCrit.Sts2.Core.Models.Powers { }
namespace MegaCrit.Sts2.Core.Localization.DynamicVars
{
    public class BlockVar : DynamicVar { }
}
namespace MegaCrit.Sts2.Core.ValueProps
{
    [Flags] public enum ValueProp { Unblockable = 2, Unpowered = 4, Move = 8 }
}
namespace MegaCrit.Sts2.Core.Logging
{
    public static class Log
    {
        public static List<string> Errors { get; } = [];
        public static void Error(string text) { lock (Errors) Errors.Add(text); }
        public static void Info(string text) { }
        public static void Warn(string text) { }
    }
}
namespace MegaCrit.Sts2.Core.Commands
{
    public static class CardPileCmd
    {
        public static List<int> Draws { get; } = [];
        public static Task Draw(PlayerChoiceContext context, int amount, Player player)
        {
            Draws.Add(amount);
            return Task.CompletedTask;
        }
        public static Task AddGeneratedCardToCombat(CardModel card, PileType pile, Player player) => throw new NotSupportedException();
    }
    public static class CreatureCmd
    {
#if RULE_ATTACK_PRODUCTION
        public static Task Damage(PlayerChoiceContext context, IEnumerable<Creature>? targets, decimal amount, ValueProp props, Creature source, CardModel card, CardPlay? play)
        {
            SfAttackProbe.DirectCalls++;
            SfAttackProbe.Hits.AddRange((targets ?? []).Select(target => (target, amount)));
            return Task.CompletedTask;
        }
#endif
        public static Task GainBlock(Creature target, MegaCrit.Sts2.Core.Localization.DynamicVars.BlockVar value, CardPlay play) => throw new NotSupportedException();
        public static Task GainBlock(Creature target, decimal amount, ValueProp props, CardPlay? play) => throw new NotSupportedException();
        public static Task Heal(Creature target, decimal amount) => throw new NotSupportedException();
        public static Task Damage(PlayerChoiceContext context, Creature target, decimal amount, ValueProp props, object? source, object? unknown, CardPlay? play) => throw new NotSupportedException();
        public static Task GainMaxHp(Creature target, decimal amount) => throw new NotSupportedException();
        public static Task Add(Creature creature) => throw new NotSupportedException();
        public static Task SetMaxAndCurrentHp(Creature creature, decimal hp) => throw new NotSupportedException();
    }
    public static class CardCmd
    {
        public static Task Discard(PlayerChoiceContext context, CardModel card) => throw new NotSupportedException();
        public static Task Exhaust(PlayerChoiceContext context, CardModel card) => throw new NotSupportedException();
    }
    public static class PlayerCmd
    {
        public static Task GainEnergy(decimal amount, Player player) => throw new NotSupportedException();
        public static Task GainGold(decimal amount, Player player) => throw new NotSupportedException();
        public static Task LoseGold(decimal amount, Player player) => throw new NotSupportedException();
    }
    public static class OstyCmd
    {
        public static Task Summon(PlayerChoiceContext context, Player player, decimal hp, CardModel card) => throw new NotSupportedException();
    }
    public static class OrbCmd
    {
        public static Task AddSlots(Player player, int amount) => throw new NotSupportedException();
        public static void RemoveSlots(Player player, int amount) => throw new NotSupportedException();
        public static Task Channel(PlayerChoiceContext context, OrbModel orb, Player player) => throw new NotSupportedException();
    }
    public static class PowerCmd
    {
        public static List<Type> AppliedTypes { get; } = [];
        public static List<Creature> AppliedTargets { get; } = [];
        public static async Task<T?> Apply<T>(PlayerChoiceContext context, Creature target, decimal amount, Creature? applier, CardModel? source, bool silent = false) where T : PowerModel
        {
            await Task.Yield();
            AppliedTypes.Add(typeof(T));
            AppliedTargets.Add(target);
            return null;
        }
        public static Task<IReadOnlyList<T>> Apply<T>(PlayerChoiceContext context, IEnumerable<Creature>? targets, decimal amount, Creature? applier, CardModel? source, bool silent = false) where T : PowerModel => throw new NotSupportedException();
    }
    public static class SfxCmd { public static void Play(string name) => throw new NotSupportedException(); }
}
namespace MegaCrit.Sts2.Core.Audio.Debug
{
    public class NDebugAudioManager
    {
        public static NDebugAudioManager? Instance => null;
        public void Play(string name) => throw new NotSupportedException();
    }
}
namespace SpireForge.Runtime
{
    public static class PackLoader
    {
        public static Dictionary<string, SfCardDef> Defs { get; } = [];
        public static Dictionary<string, string> PackOf { get; } = [];
    }
    public static class IdHelper { public static string EntryOf(string pack, string card) => pack + card; }
    public static class SfContentRegistry
    {
        public static Dictionary<string, AbstractModel> Models { get; } = [];
        public static T? Find<T>(string name) where T : AbstractModel => Models.GetValueOrDefault(name) as T;
    }
#if !RULE_ATTACK_PRODUCTION
    public static class SfAttacks
    {
        public static List<(Creature Target, decimal Amount)> Hits { get; } = [];
        public static Task RunTargetsAttack(CardModel card, IReadOnlyList<Creature> targets, decimal amount, SfEffect effect, PlayerChoiceContext? context)
        {
            Hits.AddRange(targets.Select(target => (target, amount)));
            return Task.CompletedTask;
        }
        public static Task RunCardAttack(CardModel card, IReadOnlyList<Creature>? targets, decimal amount, SfEffect effect, PlayerChoiceContext? context, CardPlay play, Creature? target, bool allOpponents = false) => throw new NotSupportedException();
    }
#endif
    public static class SfDelayedValues { public static SfEffect Resolve(SfEffect effect, int level) => throw new NotSupportedException(); }
    public static class SfDelayedPower
    {
        public static Task Schedule(ICombatState combat, CardModel card, PlayerChoiceContext? context, List<SfEffect> effects, int turns, string timing, bool everyTurn, string side, string icon, Dictionary<string, string>? buffName, Dictionary<string, string>? buffDescription) => throw new NotSupportedException();
    }
    public static class SfSummonLayout { public static void SpreadEnemies(ICombatState combat) => throw new NotSupportedException(); }
    public static class SfVfx
    {
        public static string? Resolve(string value) => value;
        public static void PlayOnCreature(Creature target, string spec)
        {
#if RULE_ATTACK_PRODUCTION
            SfAttackProbe.Effects.Add((target, spec));
#else
            throw new NotSupportedException();
#endif
        }
        public static void PlayFullScreen(string spec, Creature? source) => throw new NotSupportedException();
        public static void PlayOnSide(CombatSide side, string spec, ICombatState combat) => throw new NotSupportedException();
    }
    public static class SfRulesGame
    {
        public static string PackOf(CardModel card) => PackLoader.PackOf.GetValueOrDefault(card.Id.Entry, "SpireForgeRuntime");
        public static int NextIndex(SpireForge.Api.SfEffectContext context, int count) => context.Card.Owner.RunState.Rng.CombatCardSelection.NextInt(count);
        public static Func<SpireForge.Api.SfEffectContext, string, string, decimal>? ReadStatus { get; set; }
        public static decimal StatusStacks(SpireForge.Api.SfEffectContext context, string id, string subject) => ReadStatus?.Invoke(context, id, subject) ?? 0;
        public static Task ApplyStatusAsync(SpireForge.Api.SfEffectContext context, System.Text.Json.JsonElement node, System.Text.Json.JsonElement statuses, SfRulesBudget budget) => throw new NotSupportedException();
        public static Task SelectAsync(SpireForge.Api.SfEffectContext context, System.Text.Json.JsonElement node, SfRulesBudget budget) => throw new NotSupportedException();
    }
}
