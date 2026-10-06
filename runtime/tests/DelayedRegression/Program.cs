using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Runtime;

var combat = new TestCombat();
var context = new PlayerChoiceContext();
var cases = 0;
void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
foreach (var timing in new[] { "turn_start", "turn_end" })
foreach (var side in new[] { "player", "enemy", "both" })
foreach (var every in new[] { true, false })
foreach (var turns in new[] { 1, 2, 4 })
{
    SfEffectEngine.Triggers.Clear();
    var card = new CardModel();
    await SfDelayedPower.Schedule(combat, card, null, [new()], turns, timing, every, side);
    var power = PowerCmd.Last;
    async Task Tick(CombatSide currentSide)
    {
        if (power.Amount <= 0) return; // Game hook listener stops after removal.
        Creature[] participants = currentSide == CombatSide.Player ? [card.Owner.Creature] : [new Creature()];
        var before = power.Amount;
        var eligible = power.AmountOnTurnStart > 0 && (side == "both" || (side == "player") == (currentSide == CombatSide.Player));
        await power.BeforeSideTurnStart(context, currentSide, participants, combat);
        Assert(power.Amount == before - (eligible && timing == "turn_start" ? 1 : 0), "Wrong start decrement");
        if (power.Amount > 0) await power.AfterSideTurnEnd(context, currentSide, participants);
        Assert(power.Amount == before - (eligible ? 1 : 0), "Each matching side must decrement exactly once");
    }
    // Applied during an existing turn: no trigger/decrement before the next turn snapshot.
    await Tick(CombatSide.Player);
    Assert(power.Amount == turns && SfEffectEngine.Triggers.Count == 0, "Same-turn activation");
    for (var i = 0; i < turns * 2 + 2 && power.Amount > 0; i++)
    {
        power.AmountOnTurnStart = power.Amount;
        await Tick(i % 2 == 0 ? CombatSide.Player : CombatSide.Enemy);
    }
    Assert(power.Amount == 0, "Countdown did not finish");
    Assert(SfEffectEngine.Triggers.Count == (every ? turns : 1), "Wrong trigger count");
    Assert(SfEffectEngine.Triggers.All(t => t == "delayed_" + timing), "Wrong timing executed");
    cases++;
}
Console.WriteLine($"PASS: {cases} production delayed-state cases (timing, side, each/final, countdown, same-turn guard).");
Console.WriteLine("Game command boundaries are controlled; this does not certify in-game combat behavior.");
sealed class TestCombat : ICombatState { }
