using System.Text.Json;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;
using SpireForge.Runtime;

void Assert(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
SfEffect Parse(string json) => JsonSerializer.Deserialize<SfEffect>(json)!;
SfEffectContext Context(string key) => new()
{
    Card = new CardModel(), Effect = new SfEffect { KindName = key }, Trigger = "play",
};
var failures = new List<string>();
async Task Check(string name, Func<Task> test)
{
    Log.Errors.Clear();
    try
    {
        await test();
        Console.WriteLine("PASS " + name);
    }
    catch (Exception exception)
    {
        failures.Add(name + " - " + exception.Message);
        Console.WriteLine("FAIL " + failures[^1]);
    }
}

SfBuiltinEffects.RegisterAll();
await Check("nested composites apply energy X once", async () =>
{
    var nested = Parse("""
    {"kind":"sf_repeat","amount":2,"params":{"effects":[
      {"kind":"sf_cond","params":{"effects":[{"kind":"draw","amount":3}]}}
    ]}}
    """);
    foreach (var x in new[] { 0, 1, 2, 3 })
    {
        var card = new CardModel { EnergyX = x };
        card.EnergyCost.CostsX = true;
        card.DynamicVars["Cards"] = new() { BaseValue = 99 };
        CardPileCmd.Draws.Clear();
        await SfEffectEngine.RunAsync(card, [nested], null, new CardPlay(), "play");
        Assert(CardPileCmd.Draws.Count == x * 2, $"X={x}, expected {x * 2}, received {CardPileCmd.Draws.Count}");
        Assert(CardPileCmd.Draws.All(amount => amount == 3), "Nested literal amount changed");
    }
    Assert(Log.Errors.Count == 0, "Unexpected engine errors");
});
await Check("nested qualified handlers keep the lifecycle trigger", async () =>
{
    var calls = 0;
    var key = SfEffects.Register(new SfEffectDescriptor("regression", "play_only", "Play", "", [], ["play"]), context =>
    {
        Assert(context.Trigger == "play", "Lifecycle trigger was rewritten");
        calls++;
        return Task.CompletedTask;
    });
    var composite = Parse("""{"kind":"sf_cond","params":{"effects":[{"kind":"effect:regression:play_only"}]}}""");
    await SfEffectEngine.RunAsync(new(), [composite], null, new CardPlay(), "play");
    Assert(calls == 1 && Log.Errors.Count == 0, "Allowed play handler was rejected inside a composite");
    SfEffects.Unregister(key);
});
await Check("random composites, hooks and top-level order keep their counts", async () =>
{
    var random = Parse("""
    {"kind":"sf_random","params":{"pick":2,"effects":[
      {"kind":"draw","amount":1},{"kind":"draw","amount":2},{"kind":"draw","amount":3}
    ]}}
    """);
    var card = new CardModel { EnergyX = 3 };
    card.EnergyCost.CostsX = true;
    card.Owner.Creature.CombatState = new TestCombat();
    CardPileCmd.Draws.Clear();
    await SfEffectEngine.RunAsync(card, [random], null, new CardPlay(), "play");
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 1, 2, 1, 2, 1, 2 }), "Random pick was multiplied within a composite");
    CardPileCmd.Draws.Clear();
    await SfEffectEngine.RunAsync(card, [random], null, null, "on_draw", useVarBinding: false);
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 1, 2 }), "Hook multiplied by the source card's energy X");
    CardPileCmd.Draws.Clear();
    await SfEffectEngine.RunAsync(card, [new(SfEffectKind.Draw, 4), new(SfEffectKind.Draw, 6)], null, new CardPlay(), "play");
    Assert(CardPileCmd.Draws.SequenceEqual(new[] { 4, 4, 4, 6, 6, 6 }), "Top-level effect order changed");
    Assert(Log.Errors.Count == 0, "Unexpected engine errors");
});
await Check("legacy overwrite replaces its descriptor", async () =>
{
    var key = SfEffects.Register(new SfEffectDescriptor("regression", "replace", "Old", "", [], ["on_draw"]), _ => Task.CompletedTask);
    var calls = 0;
    SfEffects.Register(key, _ => { calls++; return Task.CompletedTask; });
    await SfEffects.TryInvoke(Context(key));
    Assert(calls == 1 && Log.Errors.Count == 0, "Old descriptor still restricted the replacement handler");
    Assert(SfEffects.Describe(key) == null, "Old descriptor stayed registered");
    SfEffects.Unregister(key);
});
await Check("kind enumeration uses a stable snapshot", () =>
{
    var keys = SfEffects.Kinds;
    SfEffects.Register("snapshot_new", _ => Task.CompletedTask);
    Assert(!keys.Contains("snapshot_new"), "Previously returned kinds changed during registration");
    SfEffects.Unregister("snapshot_new");
    return Task.CompletedTask;
});
await Check("qualified registration stays atomic during concurrent writes", () =>
{
    var accepted = 0;
    var descriptor = new SfEffectDescriptor("regression", "concurrent", "Atomic", "", []);
    Parallel.For(0, 32, _ =>
    {
        try
        {
            SfEffects.Register(descriptor, _ => Task.CompletedTask);
            Interlocked.Increment(ref accepted);
        }
        catch (InvalidOperationException) { }
    });
    const string key = "effect:regression:concurrent";
    Assert(accepted == 1, "Multiple qualified registrations replaced each other");
    Assert(SfEffects.Describe(key) == descriptor && SfEffects.SourceOf(key) == "regression", "Registration metadata was detached");
    Assert(SfEffects.IsRegistered(key.ToUpperInvariant()), "Case-insensitive registration changed");
    SfEffects.Unregister(key);
    return Task.CompletedTask;
});
await Check("handler and subscriber faults remain isolated", async () =>
{
    var observed = 0;
    Action<SfEffectContext> failing = _ => throw new InvalidOperationException("expected before fault");
    Action<SfEffectContext, bool> observer = (_, invoked) => { if (invoked) observed++; };
    SfEvents.BeforeEffect += failing;
    SfEvents.AfterEffect += observer;
    SfEffects.Register("throwing", _ => throw new InvalidOperationException("expected handler fault"));
    try
    {
        Assert(await SfEffects.TryInvoke(Context("throwing")), "Registered throwing handler lost invoked status");
        Assert(observed == 1 && Log.Errors.Count == 2, "Fault isolation/event pairing changed");
    }
    finally
    {
        SfEvents.BeforeEffect -= failing;
        SfEvents.AfterEffect -= observer;
        SfEffects.Unregister("throwing");
    }
});
await Check("power invocation preserves generic type and awaits completion", async () =>
{
    var card = new CardModel();
    PowerCmd.AppliedTypes.Clear();
    foreach (var type in new[] { typeof(FirstPower), typeof(FirstPower), typeof(SecondPower) })
        await SfPowerResolver.Apply(new(), type, card.Owner.Creature, 2, card.Owner.Creature, card);
    Assert(PowerCmd.AppliedTypes.SequenceEqual(new[] { typeof(FirstPower), typeof(FirstPower), typeof(SecondPower) }), "Wrong power overload/type or await boundary");
});
if (failures.Count > 0) throw new Exception(string.Join(Environment.NewLine, failures));
Console.WriteLine("PASS production interpreter/registry regressions with controlled game command boundaries.");

sealed class FirstPower : PowerModel { }
sealed class SecondPower : PowerModel { }
sealed class TestCombat : ICombatState
{
    public IReadOnlyList<Creature> HittableEnemies => [];
    public IEnumerable<Creature> Enemies => [];
    public IEnumerable<Creature> Creatures => [];
    public IEnumerable<Player> Players => [];
    public Encounter? Encounter => null;
    public CardModel CreateCard(CardModel card, Player player) => throw new NotSupportedException();
    public Creature CreateCreature(MonsterModel model, CombatSide side, string? slot) => throw new NotSupportedException();
    public bool ContainsCreature(Creature creature) => false;
}
