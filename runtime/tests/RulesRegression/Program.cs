using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;
using SpireForge.Runtime;

void Assert(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
JsonElement Json(string text) => JsonSerializer.Deserialize<JsonElement>(text);
SfEffect Rules(string nodes, string statuses = "[]") => JsonSerializer.Deserialize<SfEffect>(
    "{\"kind\":\"custom\",\"handler\":\"sf_rules\",\"params\":{\"rules_version\":1,\"nodes\":" + nodes + ",\"statuses\":" + statuses + "}}")!;
SfEffectContext Context(CardModel? card = null, Creature? target = null, SfEffect? effect = null) => new()
{
    Card = card ?? new CardModel(), Effect = effect ?? Rules("[]"), Target = target, Trigger = "play",
};
async Task Run(string nodes, CardModel? card = null, Creature? target = null) =>
    await SfRulesEngine.RunAsync(Context(card, target, Rules(nodes)));
var failures = new List<string>();
async Task Check(string name, Func<Task> test)
{
    Log.Errors.Clear();
    CardPileCmd.Draws.Clear();
    SfAttackProbe.Reset();
    try { await test(); Console.WriteLine("PASS " + name); }
    catch (Exception error) { failures.Add(name + " - " + error.Message); Console.WriteLine("FAIL " + failures[^1]); }
}
async Task Reject(Func<Task> action)
{
    try { await action(); }
    catch (Exception error) when (error is ArgumentException or InvalidOperationException or KeyNotFoundException or JsonException)
    { return; }
    throw new Exception("Invalid program executed successfully");
}

SfBuiltinEffects.RegisterAll();
var examples = Json(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "rules-v1.examples.json")));
await Check("five shared cross-language templates validate against the runtime", () =>
{
    Assert(examples.GetArrayLength() == 5, "Expected five shared templates");
    foreach (var example in examples.EnumerateArray())
    {
        var program = example.GetProperty("program");
        Assert(program.GetProperty("rules_version").GetInt32() == 1, "Example rules version changed");
        SfRulesValidation.Validate(program.GetProperty("nodes"), program.GetProperty("statuses"), 1);
    }
    return Task.CompletedTask;
});
await Check("shared Spark template damages its owner using current target stacks", async () =>
{
    var program = examples.EnumerateArray().Single(example => example.GetProperty("id").GetString() == "spark").GetProperty("program");
    var statuses = program.GetProperty("statuses");
    var target = new Creature();
    SfRulesGame.ReadStatus = (context, id, subject) =>
    {
        Assert(id == "spark" && subject == "target" && ReferenceEquals(context.Target, target), "Spark stack subject changed");
        return 3;
    };
    try
    {
        await SfRulesEngine.ExecuteNodesAsync(Context(target: target), statuses[0].GetProperty("nodes"), statuses, new());
        Assert(SfAttackProbe.Hits.Count == 1 && ReferenceEquals(SfAttackProbe.Hits[0].Target, target)
            && SfAttackProbe.Hits[0].Amount == 3, "Spark did not damage its owner for its stack count");
    }
    finally { SfRulesGame.ReadStatus = null; }
});
await Check("nested rules keep literal amounts and expand X once", async () =>
{
    var effect = Rules("""
    [{"type":"repeat","count":2,"nodes":[
      {"type":"if","match":"all","conditions":[{"left":2,"op":"gte","right":1}],
       "then":[{"type":"action","effect":{"kind":"draw","amount":3}}],"else":[]}
    ]}]
    """);
    foreach (var x in new[] { 0, 1, 3 })
    {
        var card = new CardModel { EnergyX = x };
        card.EnergyCost.CostsX = true;
        card.DynamicVars["Cards"] = new() { BaseValue = 99 };
        CardPileCmd.Draws.Clear();
        await SfEffectEngine.RunAsync(card, [effect], null, new CardPlay(), "play");
        Assert(CardPileCmd.Draws.Count == x * 2 && CardPileCmd.Draws.All(value => value == 3), "X expansion or literal binding changed");
    }
    Assert(Log.Errors.Count == 0, "Unexpected interpreter errors");
});
await Check("dynamic values use source factor offset rounding then clamps", () =>
{
    var card = new CardModel { EnergyX = 4, CurrentUpgradeLevel = 2 };
    card.EnergyCost.CostsX = true;
    card.Owner.Creature.CurrentHp = 7;
    card.Owner.Creature.MaxHp = 20;
    card.Owner.Creature.Block = 6;
    card.Owner.PlayerCombatState.Hand.Cards.Add(new());
    card.Owner.PlayerCombatState.DrawPile.Cards.AddRange([new(), new()]);
    card.Owner.PlayerCombatState.DiscardPile.Cards.AddRange([new(), new(), new()]);
    card.Owner.PlayerCombatState.ExhaustPile.Cards.AddRange([new(), new(), new(), new()]);
    card.Owner.Creature.CombatState = new TestCombat { Targets = [new(), new()] };
    var context = Context(card);
    foreach (var (source, expected) in new (string, decimal)[]
    {
        ("self_hp",7),("self_max_hp",20),("self_missing_hp",13),("self_block",6),
        ("hand_count",1),("draw_count",2),("discard_count",3),("exhaust_count",4),
        ("enemy_count",2),("x",4),("upgrade",2),
    }) Assert(SfRulesValues.Evaluate(context, Json("{\"source\":\"" + source + "\"}")) == expected, "Wrong source " + source);
    Assert(SfRulesValues.Evaluate(context, Json("2.75")) == 2.75m, "Literal was rounded");
    Assert(SfRulesValues.Evaluate(context, Json("""{"source":"self_hp","factor":0.5,"offset":0.25}""")) == 3, "Default floor changed");
    Assert(SfRulesValues.Evaluate(context, Json("""{"source":"self_hp","factor":0.5,"offset":0.25,"rounding":"ceil","max":3.5}""")) == 3.5m, "Clamp order changed");
    Assert(SfRulesValues.Evaluate(context, Json("""{"source":"upgrade","factor":-0.75,"rounding":"round"}""")) == -2, "Round midpoint changed");
    Assert(SfRulesValues.Evaluate(Context(), Json("""{"source":"x"}""")) == 0, "A fixed-cost card queried the X-only game API");
    return Task.CompletedTask;
});
await Check("dynamic amount overrides a copied action", async () =>
{
    var effect = Rules("""[{"type":"action","effect":{"kind":"draw","amount":99},"amount":{"source":"upgrade","factor":2,"offset":1}}]""");
    var card = new CardModel { CurrentUpgradeLevel = 2 };
    var original = effect.Params!["nodes"].GetRawText();
    await SfRulesEngine.RunAsync(Context(card, effect: effect));
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 5 }), "Dynamic amount was ignored");
    Assert(original == effect.Params["nodes"].GetRawText(), "Shared program data was mutated");
});
await Check("counter namespaces isolate packs players combat and extra turns", async () =>
{
    var combat = new TestCombat();
    var card = new CardModel();
    card.Id.Entry = "PACK_A_CARD";
    PackLoader.PackOf[card.Id.Entry] = "pack_a";
    card.Owner.Creature.CombatState = combat;
    await Run("""
    [
      {"type":"counter","key":"hits","scope":"combat","operation":"set","value":3},
      {"type":"counter","key":"hits","scope":"combat","operation":"add","value":2},
      {"type":"counter","key":"hits","scope":"turn","operation":"set","value":9}
    ]
    """, card);
    Assert(SfRulesValues.ReadCounter(Context(card), "hits") == 5, "Combat counter lost additions");
    Assert(SfRulesValues.ReadCounter(Context(card), "hits", "turn") == 9, "Turn counter missing");
    var samePack = new CardModel { Owner = card.Owner };
    samePack.Id.Entry = "PACK_A_SECOND";
    PackLoader.PackOf[samePack.Id.Entry] = "pack_a";
    Assert(SfRulesValues.ReadCounter(Context(samePack), "hits") == 5, "Same-pack cards cannot share counters");
    var otherPack = new CardModel { Owner = card.Owner };
    otherPack.Id.Entry = "PACK_B_CARD";
    PackLoader.PackOf[otherPack.Id.Entry] = "pack_b";
    Assert(SfRulesValues.ReadCounter(Context(otherPack), "hits") == 0, "Counter crossed pack namespaces");
    var otherPlayer = new CardModel();
    otherPlayer.Id.Entry = card.Id.Entry;
    otherPlayer.Owner.Creature.CombatState = combat;
    Assert(SfRulesValues.ReadCounter(Context(otherPlayer), "hits") == 0, "Counter crossed players");
    card.Owner.PlayerCombatState.TurnNumber++;
    Assert(SfRulesValues.ReadCounter(Context(card), "hits", "turn") == 0, "Extra turn kept stale turn counter");
    Assert(SfRulesValues.ReadCounter(Context(card), "hits") == 5, "Extra turn erased combat counter");
    card.Owner.Creature.CombatState = new TestCombat();
    Assert(SfRulesValues.ReadCounter(Context(card), "hits") == 0, "Counter crossed combats");
});
await Check("if any and else honor disabled nodes", async () =>
{
    await Run("""
    [
      {"type":"action","enabled":false,"effect":{"kind":"draw","amount":99}},
      {"type":"if","match":"any","conditions":[{"left":0,"op":"gt","right":1},{"left":2,"op":"eq","right":2}],
       "then":[{"type":"action","effect":{"kind":"draw","amount":2}}],"else":[]},
      {"type":"if","match":"all","conditions":[{"left":1,"op":"ne","right":1}],
       "then":[],"else":[{"type":"action","effect":{"kind":"draw","amount":4}}]}
    ]
    """);
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 2, 4 }), "Wrong branch or disabled execution");
});
await Check("random selection uses the game stream and distinct enabled entries", async () =>
{
    var card = new CardModel();
    await Run("""
    [{"type":"random","count":3,"nodes":[
      {"type":"action","effect":{"kind":"draw","amount":1}},
      {"type":"action","enabled":false,"effect":{"kind":"draw","amount":99}},
      {"type":"action","effect":{"kind":"draw","amount":2}},
      {"type":"action","effect":{"kind":"draw","amount":3}}
    ]}]
    """, card);
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 1, 2, 3 }), "Repeated an entry or selected a disabled node");
    Assert(card.Owner.RunState.Rng.CombatCardSelection.Calls == 3, "Random bypassed the game RNG");
});
await Check("fixed rule target survives nested legacy composites", async () =>
{
    var card = new CardModel();
    var target = new Creature();
    card.Owner.Creature.CombatState = new TestCombat { Targets = [new Creature()] };
    var calls = 0;
    SfEffects.Register("rule_probe", context =>
    {
        Assert(ReferenceEquals(context.Target, target), "Nested custom target changed");
        Assert(context.Trigger == "play", "Nested trigger changed");
        calls++;
        return Task.CompletedTask;
    });
    await Run("""
    [{"type":"action","effect":{"kind":"sf_repeat","amount":2,"params":{"effects":[
      {"kind":"damage","amount":7},{"kind":"rule_probe"}
    ]}}},{"type":"action","effect":{"kind":"damage","amount":1,"target":"self"}}]
    """, card, target);
    Assert(calls == 2 && SfAttackProbe.Hits.Count == 3, "Nested actions lost count");
    Assert(SfAttackProbe.Hits.Take(2).All(hit => ReferenceEquals(hit.Target, target)), "Rule action reselected an enemy");
    Assert(ReferenceEquals(SfAttackProbe.Hits[2].Target, card.Owner.Creature), "Explicit self target was ignored");
    SfEffects.Unregister("rule_probe");
});
await Check("power reads use the requested subject", () =>
{
    var card = new CardModel();
    var enemy = new Creature();
    card.Owner.Creature.Powers.Add(new TestPower { Amount = 3 });
    enemy.Powers.Add(new TestPower { Amount = 7 });
    SfContentRegistry.Models["TestPower"] = new TestPower();
    Assert(SfRulesValues.Evaluate(Context(card, enemy), Json("""{"source":"power_stacks","key":"TestPower"}""")) == 3, "Self power read failed");
    Assert(SfRulesValues.Evaluate(Context(card, enemy), Json("""{"source":"power_stacks","key":"TestPower","subject":"target"}""")) == 7, "Target power read failed");
    return Task.CompletedTask;
});
await Check("AllEnemies and explicit all_enemies rules keep both enemies and execute non-target nodes once", async () =>
{
    foreach (var explicitScope in new[] { false, true })
    {
        SfAttackProbe.Reset();
        CardPileCmd.Draws.Clear();
        PowerCmd.AppliedTargets.Clear();
        var card = new CardModel { TargetType = explicitScope ? TargetType.AnyEnemy : TargetType.AllEnemies };
        var enemies = new[] { new Creature(), new Creature() };
        var combat = new TestCombat { Targets = enemies };
        card.Owner.Creature.CombatState = combat;
        var effect = Rules("""
        [{"type":"counter","key":"plays","scope":"combat","operation":"add","value":1},
         {"type":"action","effect":{"kind":"draw","amount":1}},
         {"type":"action","effect":{"kind":"damage","amount":7}},
         {"type":"action","effect":{"kind":"power","power":"TestPower","amount":2}}]
        """);
        if (explicitScope) effect.Target = "all_enemies";
        SfContentRegistry.Models["TestPower"] = new TestPower();
        var play = new CardPlay { Target = explicitScope ? enemies[0] : null };
        await SfEffectEngine.RunAsync(card, [effect], null, play, "play");
        Assert(SfAttackProbe.Hits.Count == 2 && enemies.All(enemy => SfAttackProbe.Hits.Any(hit => ReferenceEquals(hit.Target, enemy) && hit.Amount == 7)), "All-enemy damage lost a target");
        Assert(PowerCmd.AppliedTargets.SequenceEqual(enemies), "All-enemy power lost a target");
        Assert(CardPileCmd.Draws.SequenceEqual(new[] { 1 }) && SfRulesValues.ReadCounter(Context(card), "plays") == 1, "All-enemy scope repeated the whole program");
        Assert(SfAttackProbe.AttackCommands == 1 && SfAttackProbe.AfterAttacks == 1 && SfAttackProbe.DirectCalls == 0
            && ReferenceEquals(SfAttackProbe.LastPlay, play), "Played rule attack bypassed the official AttackCommand boundary");
    }
    Assert(Log.Errors.Count == 0, "Unexpected all-enemy rule errors");
});
await Check("explicit action targets override the inherited enemy collection", async () =>
{
    var card = new CardModel { TargetType = TargetType.AllEnemies };
    var enemies = new[] { new Creature(), new Creature() };
    card.Owner.Creature.CombatState = new TestCombat { Targets = enemies };
    PowerCmd.AppliedTargets.Clear();
    SfContentRegistry.Models["TestPower"] = new TestPower();
    await SfEffectEngine.RunAsync(card, [Rules("""
    [{"type":"action","effect":{"kind":"damage","amount":2,"target":"self"}},
     {"type":"action","effect":{"kind":"power","power":"TestPower","amount":2,"target":"self"}},
     {"type":"action","effect":{"kind":"damage","amount":3,"target":"random_enemy"}}]
    """)], null, new CardPlay(), "play");
    Assert(SfAttackProbe.Hits.Count == 2 && ReferenceEquals(SfAttackProbe.Hits[0].Target, card.Owner.Creature)
        && ReferenceEquals(SfAttackProbe.Hits[1].Target, enemies[0]), "Explicit action target did not replace the collection");
    Assert(PowerCmd.AppliedTargets.SequenceEqual(new[] { card.Owner.Creature }), "Explicit power target did not replace the collection");
});
await Check("single-target play keeps AttackCommand while status ownership remains a single hook target", async () =>
{
    var card = new CardModel { TargetType = TargetType.AnyEnemy };
    var enemies = new[] { new Creature(), new Creature() };
    card.Owner.Creature.CombatState = new TestCombat { Targets = enemies };
    var effect = Rules("""[{"type":"action","effect":{"kind":"damage","amount":5}}]""");
    var play = new CardPlay { Target = enemies[1] };
    await SfEffectEngine.RunAsync(card, [effect], null, play, "play");
    Assert(SfAttackProbe.Hits.Count == 1 && ReferenceEquals(SfAttackProbe.Hits[0].Target, enemies[1])
        && SfAttackProbe.AttackCommands == 1 && SfAttackProbe.AfterAttacks == 1 && SfAttackProbe.DirectCalls == 0,
        "Single-target play lost its chosen target or attack lifecycle");
    SfAttackProbe.Reset();
    await SfRulesEngine.RunAsync(new SfEffectContext
    {
        Card = card, Effect = effect, Play = play, Target = enemies[0], Targets = [enemies[0]], Trigger = "status_after_attack",
    });
    Assert(SfAttackProbe.Hits.Count == 1 && ReferenceEquals(SfAttackProbe.Hits[0].Target, enemies[0])
        && SfAttackProbe.AttackCommands == 0 && SfAttackProbe.DirectCalls == 1,
        "Status owner target inherited the triggering card's play target or attack lifecycle");
});
await Check("target power expressions and conditions read total stacks across the collection", async () =>
{
    var card = new CardModel { TargetType = TargetType.AllEnemies };
    var enemies = new[] { new Creature(), new Creature() };
    enemies[0].Powers.Add(new TestPower { Amount = 2 });
    enemies[1].Powers.Add(new TestPower { Amount = 3 });
    card.Owner.Creature.CombatState = new TestCombat { Targets = enemies };
    SfContentRegistry.Models["TestPower"] = new TestPower();
    await SfEffectEngine.RunAsync(card, [Rules("""
    [{"type":"if","match":"all","conditions":[{"left":{"source":"power_stacks","key":"TestPower","subject":"target"},"op":"eq","right":5}],
      "then":[{"type":"action","effect":{"kind":"damage"},"amount":{"source":"power_stacks","key":"TestPower","subject":"target"}}],"else":[]}]
    """)], null, new CardPlay(), "play");
    Assert(SfAttackProbe.Hits.Count == 2 && SfAttackProbe.Hits.All(hit => hit.Amount == 5), "Target expression sampled only one enemy");
});
await Check("mathematical integer JSON forms validate and execute consistently", async () =>
{
    var effect = Rules("""[{"type":"action","effect":{"kind":"draw","amount":1}}]""",
        """[{"id":"integer","name":{"zhs":"","eng":""},"description":{"zhs":"","eng":""},"icon":"Strength","stacking":"add","max_stacks":99.0,"decay":1e0,"trigger":"turn_start","max_triggers_per_turn":1.0,"nodes":[]}]""");
    effect.Params!["rules_version"] = Json("1e0");
    await SfRulesEngine.RunAsync(Context(effect: effect));
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 1 }), "Mathematical integer JSON forms were rejected");
});
await Check("program validation precedes all side effects", async () =>
{
    foreach (var invalid in new[]
    {
        "{\"type\":\"repeat\",\"count\":{\"source\":\"unknown\"},\"nodes\":[]}",
        "{\"type\":\"action\",\"enabled\":\"false\",\"effect\":{\"kind\":\"draw\"}}",
        "{\"type\":\"counter\",\"key\":\"x\",\"operation\":\"erase\",\"value\":1}",
        "{\"type\":\"action\",\"effect\":{\"kind\":\"draw\"},\"amount\":1e999}",
        "{\"type\":\"action\",\"effect\":{\"kind\":\"draw\"},\"amount\":1000000001}",
        "{\"type\":\"action\",\"effect\":{\"kind\":\"draw\"},\"amount\":{\"source\":\"x\",\"factor\":-1000000001}}",
        "{\"type\":\"action\",\"effect\":{\"kind\":\"draw\"},\"amount\":{\"source\":\"x\",\"min\":2,\"max\":1}}",
    }) await Reject(() => Run("[{\"type\":\"action\",\"effect\":{\"kind\":\"draw\",\"amount\":1}}," + invalid + "]"));
    Assert(CardPileCmd.Draws.Count == 0, "Invalid data partially executed");
});
await Check("action effects reject nested rule handlers at every JSON depth", async () =>
{
    foreach (var effect in new[]
    {
        """{"kind":"custom","handler":"sf_rules","params":{"rules_version":1,"nodes":[],"statuses":[]}}""",
        """{"kind":"SF_RULES","params":{"rules_version":1,"nodes":[],"statuses":[]}}""",
        """{"kind":"delayed","effects":[{"kind":"custom","handler":"sf_rules"}]}""",
        """{"kind":"sf_repeat","params":{"effects":[{"kind":"custom","handler":"sf_rules"}]}}""",
        """{"kind":"third_party","params":{"preserved":{"items":[{"handler":"SF_RULES"}]}}}""",
    })
    {
        var action = "{\"type\":\"action\",\"effect\":" + effect + "}";
        try
        {
            await Run("[{\"type\":\"action\",\"effect\":{\"kind\":\"draw\",\"amount\":1}}," + action + "]");
            throw new Exception("Nested rule handler was accepted");
        }
        catch (ArgumentException error)
        {
            Assert(error.Message.Contains("action.effect") && error.Message.Contains("if/repeat/random"), "Nested handler diagnostic lost its repair guidance");
        }
        var status = Json("[{\"id\":\"blocked\",\"name\":{\"zhs\":\"\",\"eng\":\"\"},\"description\":{\"zhs\":\"\",\"eng\":\"\"},\"icon\":\"Strength\",\"stacking\":\"add\",\"max_stacks\":99,\"decay\":1,\"trigger\":\"turn_start\",\"max_triggers_per_turn\":1,\"nodes\":[" + action + "]}]");
        await Reject(() => SfRulesEngine.ExecuteNodesAsync(Context(), Json("[]"), status, new()));
    }
    Assert(CardPileCmd.Draws.Count == 0, "Nested handler rejection allowed partial execution");
});
await Check("legacy outer containers still execute rules and third-party action data stays intact", async () =>
{
    var rule = Rules("""[{"type":"action","effect":{"kind":"draw","amount":2}}]""");
    var outer = new SfEffect { KindName = "sf_repeat", Amount = 2,
        Params = new() { ["effects"] = JsonSerializer.SerializeToElement(new[] { rule }) } };
    await SfEffectEngine.RunAsync(new(), [outer], null, new CardPlay(), "play");
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 2, 2 }) && Log.Errors.Count == 0, "Legacy outer rule container changed");
    var calls = 0;
    SfEffects.Register("third_party", context =>
    {
        Assert(context.Effect.Params!["preserved"].GetProperty("items")[0].GetString() == "original", "Third-party payload was rewritten");
        calls++;
        return Task.CompletedTask;
    });
    try { await Run("""[{"type":"action","effect":{"kind":"custom","handler":"third_party","params":{"preserved":{"items":["original"]}}}}]"""); }
    finally { SfEffects.Unregister("third_party"); }
    Assert(calls == 1, "Third-party action dispatch changed");
});
await Check("numeric inputs share the cross-language range while calculated outputs stay decimal", () =>
{
    Assert(SfRulesValues.Evaluate(Context(), Json("1000000000")) == 1_000_000_000m, "Positive numeric boundary was rejected");
    Assert(SfRulesValues.Evaluate(Context(), Json("-1000000000")) == -1_000_000_000m, "Negative numeric boundary was rejected");
    var value = SfRulesValues.Evaluate(Context(), Json("""{"source":"self_hp","factor":1000000000,"offset":1000000000}"""));
    Assert(value == 11_000_000_000m, "Calculated output was clamped to the input range");
    return Task.CompletedTask;
});
await Check("expanded counts clamp to the supported repetition range", async () =>
{
    await Run("""[{"type":"repeat","count":500,"nodes":[{"type":"action","effect":{"kind":"draw","amount":1}}]}]""");
    Assert(CardPileCmd.Draws.Count == 100, "High literal count exceeded 100 or was skipped");
    await Run("""[{"type":"repeat","count":-1,"nodes":[{"type":"action","effect":{"kind":"draw","amount":1}}]}]""");
    Assert(CardPileCmd.Draws.Count == 100, "Negative literal count executed");
});
await Check("node and nested depth limits apply before execution", async () =>
{
    var action = "{\"type\":\"action\",\"effect\":{\"kind\":\"draw\",\"amount\":1}}";
    await Reject(() => Run("[" + string.Join(',', Enumerable.Repeat(action, 257)) + "]"));
    var deep = action;
    for (var i = 0; i < 8; i++) deep = "{\"type\":\"repeat\",\"count\":1,\"nodes\":[" + deep + "]}";
    await Reject(() => Run("[" + deep + "]"));
    Assert(CardPileCmd.Draws.Count == 0, "Oversized program executed");
    var boundary = "{\"type\":\"if\",\"match\":\"all\",\"conditions\":[],\"then\":[],\"else\":[]}";
    for (var i = 0; i < 7; i++) boundary = "{\"type\":\"repeat\",\"count\":1,\"nodes\":[" + boundary + "]}";
    await Run("[" + boundary + "]");
});
await Check("nested repeat execution shares the 512 action budget", async () =>
{
    await Reject(() => Run("""
    [{"type":"repeat","count":100,"nodes":[
      {"type":"repeat","count":100,"nodes":[{"type":"action","effect":{"kind":"draw","amount":1}}]}
    ]}]
    """));
    Assert(CardPileCmd.Draws.Count > 0 && CardPileCmd.Draws.Count <= 512, "Action budget did not bound work");
    Assert(SfRulesBudget.Current == null, "Ambient budget leaked after failure");
});
await Check("legacy combinators inside rules also spend the shared budget", async () =>
{
    var budget = new SfRulesBudget();
    await SfRulesEngine.ExecuteNodesAsync(Context(), Json("""
    [{"type":"action","effect":{"kind":"sf_repeat","amount":100,"params":{"effects":[
      {"kind":"sf_repeat","amount":100,"params":{"effects":[{"kind":"draw","amount":1}]}}
    ]}}}]
    """), Json("[]"), budget);
    Assert(CardPileCmd.Draws.Count <= 512 && budget.Spent > 512, "Legacy combinator bypassed the budget");
    Assert(Log.Errors.Count > 0 && SfRulesBudget.Current == null, "Expected bounded failure was not isolated");
});
await Check("empty legacy repeats skip iteration and preserve the ambient budget", async () =>
{
    var repeat = new SfEffect { KindName = "sf_repeat", Amount = decimal.MaxValue,
        Params = new() { ["effects"] = Json("[]") } };
    var budget = new SfRulesBudget();
    using (SfRulesBudget.Enter(budget))
    {
        await SfEffects.TryInvoke(Context(effect: repeat));
        Assert(ReferenceEquals(SfRulesBudget.Current, budget), "Empty repeat changed the ambient budget");
    }
    Assert(budget.Spent == 0 && Log.Errors.Count == 0, "Empty repeat performed work or overflowed");
    Assert(SfRulesBudget.Current == null, "Empty repeat leaked an ambient budget");
});
await Check("legacy repeat counts clamp before integer conversion", async () =>
{
    var repeat = new SfEffect { KindName = "sf_repeat", Amount = decimal.MaxValue,
        Params = new() { ["effects"] = Json("""[{"kind":"draw","amount":1}]""") } };
    await SfEffectEngine.RunAsync(new(), [repeat], null, new CardPlay(), "play");
    Assert(CardPileCmd.Draws.Count == SfRulesBudget.MaxRepeat, "Legacy count exceeded the shared repeat limit or overflowed");
    Assert(Log.Errors.Count == 0 && SfRulesBudget.Current == null, "Clamped repeat changed failure isolation or leaked its budget");
});
await Check("standalone nested legacy repeats share one execution budget", async () =>
{
    var repeat = JsonSerializer.Deserialize<SfEffect>("""
    {"kind":"sf_repeat","amount":100,"params":{"effects":[
      {"kind":"sf_repeat","amount":100,"params":{"effects":[{"kind":"draw","amount":1}]}}
    ]}}
    """)!;
    await SfEffectEngine.RunAsync(new(), [repeat], null, new CardPlay(), "play");
    Assert(CardPileCmd.Draws.Count > 0 && CardPileCmd.Draws.Count <= SfRulesBudget.MaxActions,
        "Standalone repeat created a fresh budget for every nested invocation");
    Assert(Log.Errors.Count > 0 && SfRulesBudget.Current == null, "Standalone repeat failed to restore its ambient budget");
});
await Check("status trigger entry validates definitions without double counting nodes", async () =>
{
    var nodes = "[" + string.Join(',', Enumerable.Repeat("{\"type\":\"action\",\"effect\":{\"kind\":\"draw\",\"amount\":1}}", 150)) + "]";
    var statuses = "[{\"id\":\"focus\",\"name\":{\"zhs\":\"专注\",\"eng\":\"Focus\"},\"description\":{\"zhs\":\"\",\"eng\":\"\"},\"icon\":\"Strength\",\"stacking\":\"add\",\"max_stacks\":99,\"decay\":1,\"trigger\":\"turn_start\",\"max_triggers_per_turn\":1,\"nodes\":" + nodes + "}]";
    await SfRulesEngine.ExecuteNodesAsync(Context(), Json(nodes), Json(statuses), new());
    Assert(CardPileCmd.Draws.Count == 150, "Status trigger duplicated its node count");
});
await Check("reentrant rule handlers inherit the ambient depth and budget", async () =>
{
    var calls = 0;
    var nested = Json("""[{"type":"action","effect":{"kind":"rule_reenter"}}]""");
    SfEffects.Register("rule_reenter", async context =>
    {
        calls++;
        Assert(SfRulesBudget.Current != null, "Nested handler lost ambient budget");
        await SfRulesEngine.ExecuteNodesAsync(context, nested, Json("[]"), new());
    });
    await SfRulesEngine.ExecuteNodesAsync(Context(), nested, Json("[]"), new());
    Assert(calls == 8 && Log.Errors.Count > 0, "Reentrant rules bypassed depth 8");
    Assert(SfRulesBudget.Current == null, "Ambient scope was not restored");
    SfEffects.Unregister("rule_reenter");
});
if (failures.Count > 0) throw new Exception(string.Join(Environment.NewLine, failures));
Console.WriteLine("PASS production rules interpreter regressions with controlled game boundaries.");

sealed class TestPower : PowerModel { }
sealed class TestCombat : ICombatState
{
    public IReadOnlyList<Creature> Targets { get; init; } = [];
    public IReadOnlyList<Creature> HittableEnemies => Targets;
    public IEnumerable<Creature> Enemies => Targets;
    public IEnumerable<Creature> Creatures => Targets;
    public IEnumerable<Player> Players => [];
    public Encounter? Encounter => null;
    public CardModel CreateCard(CardModel card, Player player) => throw new NotSupportedException();
    public Creature CreateCreature(MonsterModel model, CombatSide side, string? slot) => throw new NotSupportedException();
    public bool ContainsCreature(Creature creature) => Targets.Contains(creature);
}
