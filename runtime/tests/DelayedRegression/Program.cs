using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization;
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
    await SfDelayedPower.Schedule(combat, card, null, [new(SfEffectKind.Block, 4)], turns, timing, every, side);
    var power = PowerCmd.Last;
    bool Matches(CombatSide currentSide) => side == "both" || (side == "player") == (currentSide == CombatSide.Player);
    Creature[] Participants(CombatSide currentSide) => currentSide == CombatSide.Player ? [card.Owner.Creature] : [new Creature()];
    // Application happens after the current turn start. Only its end is still upcoming.
    await power.AfterSideTurnEnd(context, CombatSide.Player, Participants(CombatSide.Player));
    var currentEnd = timing == "turn_end" && Matches(CombatSide.Player);
    Assert(power.Amount == turns - (currentEnd ? 1 : 0), "Current turn end must count immediately");
    Assert(SfEffectEngine.Triggers.Count == (currentEnd && (every || turns == 1) ? 1 : 0), "Wrong current-turn execution");
    for (var i = 0; i < turns * 2 + 2 && power.Amount > 0; i++)
    {
        var currentSide = i % 2 == 0 ? CombatSide.Enemy : CombatSide.Player;
        var before = power.Amount;
        // The obsolete snapshot intentionally stays zero: next enemy start must still work.
        await power.BeforeSideTurnStart(context, currentSide, Participants(currentSide), combat);
        Assert(power.Amount == before - (Matches(currentSide) && timing == "turn_start" ? 1 : 0), "Wrong start decrement");
        if (power.Amount > 0) await power.AfterSideTurnEnd(context, currentSide, Participants(currentSide));
        Assert(power.Amount == before - (Matches(currentSide) ? 1 : 0), "Each matching side must decrement exactly once");
    }
    Assert(power.Amount == 0, "Countdown did not finish");
    Assert(SfEffectEngine.Triggers.Count == (every ? turns : 1), "Wrong trigger count");
    Assert(SfEffectEngine.Triggers.All(t => t == "delayed_" + timing), "Wrong timing executed");
    cases++;
}
// Use the actual JSON definition and production snapshot resolver.
var definition = JsonSerializer.Deserialize<SfEffect>("""
{"kind":"delayed","turns":2,"upgrade_turns":1,"effects":[
  {"kind":"block","amount":4,"upgrade_amount":3},
  {"kind":"block","amount":8,"upgrade_amount":-2},
  {"kind":"delayed","turns":2,"upgrade_turns":-2,"effects":[{"kind":"draw","amount":1,"upgrade_amount":1}]}
]}
""")!;
for (var level = 0; level <= 3; level++)
{
    var resolved = SfDelayedValues.Resolve(definition, level);
    Assert(resolved.Turns == 2 + level, "Wrong upgraded count");
    Assert(resolved.Effects![0].Amount == 4 + 3 * level && resolved.Effects[1].Amount == 8 - 2 * level, "Nested values collided");
    Assert(resolved.Effects[2].Turns == Math.Max(1, 2 - 2 * level), "Trigger count must clamp to one");
    var nestedAgain = SfDelayedValues.Resolve(resolved.Effects[2], level);
    Assert(nestedAgain.Effects![0].Amount == 1 + level, "Nested delayed upgraded twice");
    Assert(definition.Effects![0].Amount == 4, "Shared card definition was mutated");
    var card = new CardModel();
    await SfDelayedPower.Schedule(combat, card, null, resolved.Effects, (int)resolved.Turns!, "turn_end", true, "player");
    var frozen = PowerCmd.Last;
    card.CurrentUpgradeLevel = level + 1;
    SfEffectEngine.Amounts.Clear();
    await frozen.AfterSideTurnEnd(context, CombatSide.Player, [card.Owner.Creature]);
    Assert(SfEffectEngine.Amounts[0] == 4 + 3 * level, "Scheduled buff values changed with source card");
    cases++;
}
var paramDelay = JsonSerializer.Deserialize<SfEffect>("""{"kind":"delayed","params":{"turns":2},"upgrade_turns":1,"effects":[{"kind":"draw","amount":1}]}""")!;
var paramResolved = SfDelayedValues.Resolve(paramDelay, 2);
Assert(SfDelayedValues.Resolve(paramResolved, 2).Turns == 4, "Legacy params.turns overwrote snapshot");
var def = new SfCardDef { Effects = [definition], OnDraw = [definition] };
var bindings = SfDelayedValues.CardValues(def).ToList();
Assert(bindings.Select(v => v.Name).Distinct().Count() == bindings.Count, "Hook and nested variables collided");
Assert(bindings.Any(v => v.Name == "DelayedOnDraw1Effect1Amount" && v.Delta == 3), "Hook variable contract changed");
var upgradeCard = new CardModel();
foreach (var binding in bindings) upgradeCard.DynamicVars[binding.Name] = new(binding.Base);
SfDelayedValues.Upgrade(upgradeCard, def);
Assert(upgradeCard.DynamicVars["DelayedPlay1Effect1Amount"].BaseValue == 7, "Card upgrade variable not updated");
Assert(upgradeCard.DynamicVars["DelayedPlay1Effect3Turns"].BaseValue == 1, "Upgrade display count not clamped");
var ownerCard = new CardModel();
var customNames = new Dictionary<string, string> { ["zhs"] = "希望", ["eng"] = "Hope" };
var customText = new Dictionary<string, string> { ["zhs"] = "剩余 {Amount} 次：获得 {Effect1Amount} 点格挡。", ["eng"] = "{Amount} remaining. Gain {Effect1Amount} Block." };
await SfDelayedPower.Schedule(combat, ownerCard, null, [new(SfEffectKind.Block, 7)], 2, "turn_end", true, "player", buffName: customNames, buffDescription: customText);
var first = PowerCmd.Last;
await SfDelayedPower.Schedule(combat, ownerCard, null, [new(SfEffectKind.Block, 10)], 1, "turn_end", false, "player", buffName: new() { ["eng"] = "Other" });
var second = PowerCmd.Last;
LocManager.Instance.Language = "eng";
Assert(first.Title.GetRawText() == "Hope" && second.Title.GetRawText() == "Other", "Independent buff names collided");
Assert(first.Description.GetRawText().Contains("Gain 7 Block") && first.Description.GetRawText().Contains("{Amount}"), "Template values/counter were not preserved");
Assert(second.Description.GetRawText().Contains("Gain 10 Block"), "Blank text did not auto-generate");
LocManager.Instance.Language = "zhs";
Assert(first.Title.GetRawText() == "希望" && first.Description.GetRawText().Contains("7 点格挡"), "Language switching lost custom text");
Assert(second.Title.GetRawText() == "延迟效果", "Blank language must use automatic name");
Assert(SfDelayedText.Description(new() { ["zhs"] = "{Effect99Amount}" }, [new(SfEffectKind.Block, 1)], "turn_end", "player", true, false) == "?",
    "Deleted nested effect placeholders must not break game localization");
await first.AfterSideTurnEnd(context, CombatSide.Player, [new Creature()]);
Assert(first.Amount == 2, "Other player must not trigger owner's buff");
Console.WriteLine($"PASS: {cases} timing/side/count/upgrade cases; nested snapshots, JSON, independent localization and owner guard.");
Console.WriteLine("Game command boundaries are controlled; this does not certify in-game combat behavior.");
sealed class TestCombat : ICombatState { }
