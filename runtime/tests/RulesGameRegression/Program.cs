using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Commands.Builders;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;
using SpireForge.Runtime;

var assertions = 0;
void Assert(bool passed, string message)
{
    if (!passed) throw new Exception(message);
    assertions++;
}
async Task Reject(Func<Task> run, string message)
{
    try { await run(); }
    catch (InvalidOperationException) { assertions++; return; }
    throw new Exception(message);
}
JsonElement Json(string value) => JsonDocument.Parse(value).RootElement.Clone();
JsonElement Status(string trigger = "turn_end", string stacking = "add", int maximum = 9, int decay = 1, int limit = 1, string id = "charge") =>
    JsonSerializer.SerializeToElement(new
    {
        id, name = new { zhs = "充能", eng = "Charge" }, description = new { zhs = "充能层数", eng = "Charge stacks" },
        icon = "Strength", stacking, max_stacks = maximum, decay, trigger, max_triggers_per_turn = limit, nodes = Array.Empty<object>(),
    });
(Player Player, CardModel Card, TestCombat Combat, SfEffectContext Context) Fixture(string entry = "CARD", string pack = "test")
{
    var player = new Player();
    var combat = new TestCombat();
    player.Creature.CombatState = combat;
    var card = new CardModel { Owner = player };
    card.Id.Entry = entry;
    PackLoader.PackOf[entry] = pack;
    return (player, card, combat, new SfEffectContext
    {
        Card = card, Choice = new PlayerChoiceContext(), Effect = new SfEffect(), Target = player.Creature, Trigger = "play",
    });
}
CardModel AddCard(Player owner, PileType pile, CardType type = CardType.Attack)
{
    var card = new CardModel { Owner = owner, Type = type, Pile = pile.GetPile(owner) };
    card.Pile.Cards.Add(card);
    return card;
}
Task Apply(SfEffectContext context, JsonElement status, int amount, string operation = "apply", string target = "self") =>
    SfRulesGame.ApplyStatusAsync(context,
        JsonSerializer.SerializeToElement(new { type = "status", id = status.GetProperty("id").GetString(), operation, target, stacks = amount }),
        JsonSerializer.SerializeToElement(new[] { status }), new SfRulesBudget());

// The real adapter awaits the official selection and pile commands, preserving operation order.
var selection = Fixture();
var attack = AddCard(selection.Player, PileType.Hand);
var skill = AddCard(selection.Player, PileType.Hand, CardType.Skill);
await SfRulesGame.SelectAsync(selection.Context, Json("""
    {"from":"hand","mode":"choose","card_type":"Attack","count":4,"operations":[
      {"type":"move","pile":"draw"},{"type":"copy","pile":"discard"},{"type":"exhaust"},{"type":"upgrade"},
      {"type":"cost","amount":-2,"duration":"turn"},{"type":"cost","amount":1,"duration":"combat"}]}
    """), new SfRulesBudget());
Assert(Calls.Items.SequenceEqual(new[] { "choose_hand", "move_Draw", "copy_Discard", "move_Discard", "exhaust", "move_Exhaust", "upgrade" }), "Selection and operations lost await order.");
Assert(attack.Pile!.Type == PileType.Exhaust && skill.Pile!.Type == PileType.Hand, "Filtered selection touched the wrong card.");
Assert(attack.Upgrades == 1 && attack.EnergyCost.TurnDelta == -2 && attack.EnergyCost.CombatDelta == 1, "Card changes did not use relative turn/combat modifiers.");
Assert(PileType.Discard.GetPile(selection.Player).Cards.Count == 1, "Copy was not generated into its requested pile.");

Calls.Items.Clear();
await SfRulesGame.SelectAsync(selection.Context, Json("""
    {"from":"discard","mode":"choose","count":1,"operations":[{"type":"move","pile":"hand"}]}
    """), new SfRulesBudget());
Assert(Calls.Items.SequenceEqual(new[] { "choose_Discard", "move_Hand" }), "Discard selection did not use the official combat pile selector.");
var random = Fixture("RANDOM");
for (var i = 0; i < 5; i++) AddCard(random.Player, PileType.Draw);
await SfRulesGame.SelectAsync(random.Context, Json("""
    {"from":"draw","mode":"random","count":3,"operations":[{"type":"move","pile":"hand"}]}
    """), new SfRulesBudget());
Assert(random.Player.RunState.Rng.CombatCardSelection.Calls == 3 && PileType.Hand.GetPile(random.Player).Cards.Count == 3,
    "Random selection must consume the game RNG and choose distinct cards.");
await SfRulesGame.SelectAsync(random.Context, Json("""
    {"from":"draw","mode":"all","count":0,"operations":[{"type":"move","pile":"hand"}]}
    """), new SfRulesBudget());
Assert(PileType.Hand.GetPile(random.Player).Cards.Count == 5, "All selection lost cards while mutating the source pile.");
await Reject(() => SfRulesGame.SelectAsync(random.Context,
    Json("""{"from":"hand","mode":"random","count":-1,"operations":[]}"""), new SfRulesBudget()), "Negative selection count accepted.");
await Reject(() => SfRulesGame.SelectAsync(random.Context,
    Json("""{"from":"hand","mode":"random","count":1,"card_type":"Typo","operations":[]}"""), new SfRulesBudget()), "Invalid card type accepted.");
var x = AddCard(random.Player, PileType.Hand);
x.EnergyCost.CostsX = true;
var unplayable = AddCard(random.Player, PileType.Hand);
unplayable.EnergyCost.Canonical = -1;
await SfRulesGame.SelectAsync(random.Context, Json("""
    {"from":"hand","mode":"all","count":0,"operations":[{"type":"cost","amount":-1,"duration":"turn"}]}
    """), new SfRulesBudget());
Assert(x.EnergyCost.TurnDelta == 0 && unplayable.EnergyCost.TurnDelta == 0, "Special cost sentinels received numeric cost modifiers.");

// Stacking identity includes pack and creature. The first applying card remains the source.
foreach (var (stacking, expected) in new[] { ("add", 9), ("replace", 7), ("max", 7) })
{
    var fixture = Fixture("STACK_" + stacking);
    var status = Status(stacking: stacking, decay: 0);
    await Apply(fixture.Context, status, 4);
    var first = SfRulePower.Find(fixture.Player.Creature, "test", "charge")!;
    await Apply(fixture.Context, status, 7);
    Assert(first.Amount == expected && fixture.Player.Creature.Powers.Count == 1, "Stacking policy or shared identity failed.");
    await Apply(fixture.Context, status, 100);
    Assert(first.Amount == 9, "Maximum stacks were exceeded.");
    await Apply(fixture.Context, status, 20, "remove");
    Assert(fixture.Player.Creature.Powers.Count == 0, "Removing more than the current amount must remove the status.");
}
var owner = Fixture("FIRST");
var secondCard = new CardModel { Owner = owner.Player };
secondCard.Id.Entry = "SECOND";
PackLoader.PackOf["SECOND"] = "test";
var secondContext = new SfEffectContext { Card = secondCard, Effect = new SfEffect(), Choice = owner.Context.Choice, Target = owner.Player.Creature, Trigger = "play" };
var charge = Status(decay: 0);
await Apply(owner.Context, charge, 2);
await Apply(secondContext, charge, 3);
var shared = SfRulePower.Find(owner.Player.Creature, "test", "charge")!;
Assert(shared.Amount == 5 && SfRulesGame.StatusStacks(secondContext, "charge", "self") == 5, "Cards from a shared pack did not share status stacks.");
var otherPack = Fixture("OTHER_PACK", "other");
var foreignContext = new SfEffectContext { Card = otherPack.Card, Effect = new SfEffect(), Target = owner.Player.Creature, Trigger = "play" };
otherPack.Player.Creature.CombatState = owner.Combat;
await Apply(foreignContext, charge, 2, target: "target");
Assert(owner.Player.Creature.Powers.Count == 2, "Two packs collided on the same status ID.");
await shared.AfterSideTurnEnd(owner.Context.Choice!, CombatSide.Player, new[] { owner.Player.Creature });
Assert(SfRulesEngine.Executions.Last().Card == owner.Card && SfRulesEngine.Executions.Last().Target == owner.Player.Creature,
    "Status execution lost the original source card or owner target.");
LocManager.Instance.Language = "zhs";
Assert(shared.Title.GetRawText() == "充能", "Chinese status title was lost.");
LocManager.Instance.Language = "eng";
Assert(shared.Title.GetRawText() == "Charge", "Language switch did not reload status text.");
await Reject(() => Apply(owner.Context, charge, -1), "Negative status application accepted.");
await Reject(() => Apply(owner.Context, charge, -1, "remove"), "Negative status removal accepted.");

// Owner-specific turn events trigger before decay, and extra player turns reset the trigger limit.
var lifecycle = Fixture("LIFECYCLE");
await Apply(lifecycle.Context, Status(limit: 1), 3);
var timed = SfRulePower.Find(lifecycle.Player.Creature, "test", "charge")!;
SfRulesEngine.Executions.Clear();
SfRulesEngine.OnExecute = _ => { Assert(timed.Amount == 3, "Decay ran before trigger nodes."); return Task.CompletedTask; };
await timed.AfterSideTurnEnd(lifecycle.Context.Choice!, CombatSide.Enemy, Array.Empty<Creature>());
Assert(timed.Amount == 3 && SfRulesEngine.Executions.Count == 0, "Enemy turn changed a player-owned status.");
await timed.AfterSideTurnEnd(lifecycle.Context.Choice!, CombatSide.Player, new[] { lifecycle.Player.Creature });
Assert(timed.Amount == 2 && SfRulesEngine.Executions.Count == 1, "Turn-end trigger or decay failed.");
SfRulesEngine.OnExecute = null;
await timed.AfterSideTurnEnd(lifecycle.Context.Choice!, CombatSide.Player, new[] { lifecycle.Player.Creature });
Assert(SfRulesEngine.Executions.Count == 1, "Per-turn limit was bypassed.");
lifecycle.Player.PlayerCombatState.TurnNumber++;
await timed.AfterSideTurnEnd(lifecycle.Context.Choice!, CombatSide.Player, new[] { lifecycle.Player.Creature });
Assert(SfRulesEngine.Executions.Count == 2 && lifecycle.Player.Creature.Powers.Count == 0, "New owner turn or decay-to-zero failed.");

foreach (var trigger in new[] { "turn_start", "after_play", "after_attack" })
{
    var fixture = Fixture("HOOK_" + trigger);
    await Apply(fixture.Context, Status(trigger: trigger, decay: 0), 1);
    var power = SfRulePower.Find(fixture.Player.Creature, "test", "charge")!;
    SfRulesEngine.Executions.Clear();
    async Task Invoke(bool sameOwner)
    {
        var actor = sameOwner ? fixture.Player : new Player();
        if (trigger == "turn_start") await power.BeforeSideTurnStart(fixture.Context.Choice!, CombatSide.Player, new[] { actor.Creature }, fixture.Combat);
        if (trigger == "after_play") await power.AfterCardPlayed(fixture.Context.Choice!, new CardPlay { Player = actor });
        if (trigger == "after_attack") await power.AfterAttack(fixture.Context.Choice!, new AttackCommand { Attacker = actor.Creature });
    }
    await Invoke(false);
    Assert(SfRulesEngine.Executions.Count == 0, "Another actor triggered an owner status.");
    SfRulesEngine.OnExecute = _ => Invoke(true);
    await Invoke(true);
    Assert(SfRulesEngine.Executions.Count == 1, "Status reentry was not suppressed.");
    SfRulesEngine.OnExecute = null;
    fixture.Player.PlayerCombatState.TurnNumber++;
    await Invoke(true);
    Assert(SfRulesEngine.Executions.Count == 2, "Extra player turn did not reset the trigger count.");
}
var enemyFixture = Fixture("ENEMY_OWNER");
var enemy = new Creature { CombatState = enemyFixture.Combat, Side = CombatSide.Enemy };
enemyFixture.Combat.HittableEnemies = new[] { enemy };
var enemyContext = new SfEffectContext
{
    Card = enemyFixture.Card, Effect = new SfEffect(), Target = enemy, Choice = enemyFixture.Context.Choice, Trigger = "play",
};
await Apply(enemyContext, Status(trigger: "after_attack", decay: 0, limit: 2), 2, target: "all_enemies");
var enemyStatus = SfRulePower.Find(enemy, "test", "charge")!;
SfRulesEngine.Executions.Clear();
await enemyStatus.AfterAttack(enemyContext.Choice!, new AttackCommand { Attacker = enemy });
Assert(SfRulesEngine.Executions.Last().Target == enemy && SfRulesEngine.Executions.Last().Card == enemyFixture.Card,
    "Enemy-owned status lost its owner target or player source.");
Assert(SfRulesGame.StatusStacks(enemyContext, "charge", "target") == 2 && SfRulesGame.StatusStacks(enemyContext, "charge", "self") == 0,
    "Status expression subjects were mixed.");
using (var scope = SfRulesBudget.Enter(new SfRulesBudget()))
{
    var sharedBudget = SfRulesBudget.Current!;
    for (var i = 0; i < SfRulesBudget.MaxActions; i++) sharedBudget.Spend();
    enemyFixture.Combat.RoundNumber++;
    await enemyStatus.AfterAttack(enemyContext.Choice!, new AttackCommand { Attacker = enemy });
    Assert(sharedBudget.Spent == SfRulesBudget.MaxActions + 1 && SfLog.Errors.Last().Contains("512 action budget"),
        "Status hook failed to inherit and isolate the parent's exhausted action budget.");
}
enemyFixture.Combat.RoundNumber++;
var beforeRecovery = SfRulesEngine.Executions.Count;
await enemyStatus.AfterAttack(enemyContext.Choice!, new AttackCommand { Attacker = enemy });
Assert(SfRulesEngine.Executions.Count == beforeRecovery + 1, "Failed status execution left the reentry guard set.");
var empty = Fixture("EMPTY");
await Reject(() => SfRulesGame.SelectAsync(empty.Context,
    Json("""{"from":"hand","mode":"choose","count":-1,"operations":[]}"""), new SfRulesBudget()), "Empty pile bypassed negative count validation.");
var largeCount = Fixture("LARGE_COUNT");
AddCard(largeCount.Player, PileType.Hand);
await SfRulesGame.SelectAsync(largeCount.Context,
    Json("""{"from":"hand","mode":"choose","count":999999999999,"operations":[{"type":"move","pile":"draw"}]}"""), new SfRulesBudget());
Assert(PileType.Draw.GetPile(largeCount.Player).Cards.Count == 1, "Finite large counts failed to clamp to the pile size.");
var multiTarget = Fixture("MULTI_TARGET");
var firstEnemy = new Creature { CombatState = multiTarget.Combat, Side = CombatSide.Enemy };
var secondEnemy = new Creature { CombatState = multiTarget.Combat, Side = CombatSide.Enemy };
multiTarget.Combat.HittableEnemies = [firstEnemy, secondEnemy];
var multiContext = new SfEffectContext
{
    Card = multiTarget.Card, Effect = new SfEffect(), Choice = multiTarget.Context.Choice,
    Target = firstEnemy, Targets = [firstEnemy, secondEnemy], Trigger = "play",
};
await Apply(multiContext, Status(decay: 0), 2, target: "target");
Assert(SfRulePower.Find(firstEnemy, "test", "charge")?.Amount == 2
    && SfRulePower.Find(secondEnemy, "test", "charge")?.Amount == 2, "Current-target status did not reach both enemies.");
Assert(SfRulesGame.StatusStacks(multiContext, "charge", "target") == 4, "Target status expression did not sum current targets.");
await Apply(multiContext, Status(decay: 0), 1, operation: "remove", target: "target");
Assert(SfRulesGame.StatusStacks(multiContext, "charge", "target") == 2, "Current-target status removal lost a target.");
await Apply(multiContext, Status(decay: 0), 3, target: "self");
Assert(SfRulesGame.StatusStacks(multiContext, "charge", "self") == 3
    && SfRulesGame.StatusStacks(multiContext, "charge", "target") == 2, "Explicit self status target did not replace the collection.");
var numericForms = Fixture("NUMERIC_FORMS");
var numericStatus = Json("""{"id":"numbers","name":{"zhs":"","eng":""},"description":{"zhs":"","eng":""},"icon":"Strength","stacking":"add","max_stacks":99.0,"decay":1e0,"trigger":"turn_end","max_triggers_per_turn":1.0,"nodes":[]}""");
await Apply(numericForms.Context, numericStatus, 3);
var numericPower = SfRulePower.Find(numericForms.Player.Creature, "test", "numbers")!;
await numericPower.AfterSideTurnEnd(numericForms.Context.Choice!, CombatSide.Player, [numericForms.Player.Creature]);
Assert(numericPower.Amount == 2, "Mathematical integer status metadata did not execute.");
Console.WriteLine($"Rules game regression passed ({assertions} assertions).");
