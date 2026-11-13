// The production attack planner is linked. This boundary records official AttackCommand execution.
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Models;

namespace SpireForge.Runtime
{
    internal static class SfAttackProbe
    {
        public static List<(Creature Target, decimal Amount)> Hits { get; } = [];
        public static int DirectCalls;
        public static int AttackCommands;
        public static int AfterAttacks;
        public static CardPlay? LastPlay;
        public static void Reset()
        {
            Hits.Clear();
            DirectCalls = 0;
            AttackCommands = 0;
            AfterAttacks = 0;
            LastPlay = null;
        }
    }
}
namespace MegaCrit.Sts2.Core.Commands
{
    public static class DamageCmd
    {
        public static TestAttackCommand Attack(decimal amount) => new(amount);
    }
    public sealed class TestAttackCommand(decimal amount)
    {
        private IReadOnlyList<Creature> _targets = [];
        private CardPlay? _play;
        private int _hitCount = 1;
        public TestAttackCommand FromCard(CardModel card, CardPlay? play) { _play = play; return this; }
        public TestAttackCommand Targeting(Creature target) { _targets = [target]; return this; }
        public TestAttackCommand TargetingAllOpponents(ICombatState combat) { _targets = combat.HittableEnemies; return this; }
        public TestAttackCommand SpawningHitVfxOnEachCreature() => this;
        public TestAttackCommand Unpowered() => this;
        public TestAttackCommand WithHitCount(int count) { _hitCount = count; return this; }
        public TestAttackCommand WithHitFx(string? vfx, string? fmod, string? temporary) => this;
        public TestAttackCommand WithAttackerFx(string? vfx) => this;
        public Task Execute(PlayerChoiceContext? context)
        {
            SpireForge.Runtime.SfAttackProbe.AttackCommands++;
            SpireForge.Runtime.SfAttackProbe.LastPlay = _play;
            for (var hit = 0; hit < _hitCount; hit++)
                SpireForge.Runtime.SfAttackProbe.Hits.AddRange(_targets.Select(target => (target, amount)));
            SpireForge.Runtime.SfAttackProbe.AfterAttacks++;
            return Task.CompletedTask;
        }
    }
}
