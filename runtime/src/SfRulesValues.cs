using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>数值表达式和按战斗、玩家、卡包隔离的规则计数器。</summary>
public static class SfRulesValues
{
    internal const decimal MaxInputValue = 1_000_000_000m;
    private sealed class Counters
    {
        public readonly Dictionary<(object Player, string Pack, string Key, string Scope), Counter> Values = [];
    }
    private sealed record Counter(decimal Value, int Turn);
    private static readonly ConditionalWeakTable<object, Counters> CombatCounters = new();
    private static readonly HashSet<string> Sources = new(StringComparer.Ordinal)
    {
        "self_hp", "self_max_hp", "self_missing_hp", "self_block", "hand_count", "draw_count",
        "discard_count", "exhaust_count", "enemy_count", "x", "upgrade", "counter", "status_stacks", "power_stacks",
    };

    public static decimal Evaluate(SfEffectContext context, JsonElement value)
    {
        Validate(value);
        if (value.ValueKind == JsonValueKind.Number) return value.GetDecimal();
        var source = value.GetProperty("source").GetString()!;
        var player = context.Card.Owner;
        var creature = player?.Creature;
        var state = player?.PlayerCombatState;
        var key = Text(value, "key");
        var subject = Text(value, "subject", "self");
        decimal raw = source switch
        {
            "self_hp" => creature?.CurrentHp ?? 0,
            "self_max_hp" => creature?.MaxHp ?? 0,
            "self_missing_hp" => Math.Max(0, (creature?.MaxHp ?? 0) - (creature?.CurrentHp ?? 0)),
            "self_block" => creature?.Block ?? 0,
            "hand_count" => state?.Hand.Cards.Count ?? 0,
            "draw_count" => state?.DrawPile.Cards.Count ?? 0,
            "discard_count" => state?.DiscardPile.Cards.Count ?? 0,
            "exhaust_count" => state?.ExhaustPile.Cards.Count ?? 0,
            "enemy_count" => creature?.CombatState?.HittableEnemies.Count ?? 0,
            "x" => context.Card.EnergyCost?.CostsX == true ? context.Card.ResolveEnergyXValue() : 0,
            "upgrade" => context.Card.CurrentUpgradeLevel,
            "counter" => ReadCounter(context, key, Text(value, "scope", "combat")),
            "status_stacks" => SfRulesGame.StatusStacks(context, key, subject),
            "power_stacks" => PowerStacks(context, key, subject),
            _ => throw new InvalidOperationException("sf_rules: unknown value source " + source),
        };
        var result = checked(raw * Number(value, "factor", 1) + Number(value, "offset", 0));
        result = Text(value, "rounding", "floor") switch
        {
            "ceil" => decimal.Ceiling(result),
            "round" => decimal.Round(result, 0, MidpointRounding.AwayFromZero),
            _ => decimal.Floor(result),
        };
        if (value.TryGetProperty("min", out var minimum)) result = Math.Max(minimum.GetDecimal(), result);
        if (value.TryGetProperty("max", out var maximum)) result = Math.Min(maximum.GetDecimal(), result);
        return result;
    }

    public static decimal ReadCounter(SfEffectContext context, string key, string scope = "combat")
    {
        var combat = context.Card.Owner?.Creature?.CombatState;
        if (combat == null || !CombatCounters.TryGetValue(combat, out var counters)) return 0;
        var identity = (context.Card.Owner!, SfRulesGame.PackOf(context.Card), key, scope);
        lock (counters.Values)
        {
            if (!counters.Values.TryGetValue(identity, out var counter)) return 0;
            return scope == "turn" && counter.Turn != Turn(context) ? 0 : counter.Value;
        }
    }

    internal static void SetCounter(SfEffectContext context, string key, string scope, string operation, decimal value)
    {
        var combat = context.Card.Owner?.Creature?.CombatState
            ?? throw new InvalidOperationException("sf_rules: counters require a combat");
        var counters = CombatCounters.GetValue(combat, _ => new());
        var identity = (context.Card.Owner!, SfRulesGame.PackOf(context.Card), key, scope);
        lock (counters.Values)
        {
            var current = ReadCounter(context, key, scope);
            counters.Values[identity] = new(operation == "add" ? checked(current + value) : value, Turn(context));
        }
    }

    private static int Turn(SfEffectContext context) => context.Card.Owner?.PlayerCombatState?.TurnNumber ?? 0;

    private static decimal PowerStacks(SfEffectContext context, string key, string subject)
    {
        var creatures = subject == "target" ? context.ResolvedTargets : [context.Card.Owner.Creature];
        var type = SfPowerResolver.Find(key);
        return type == null ? 0 : creatures.SelectMany(creature => creature.Powers)
            .Where(power => power.GetType() == type).Sum(power => (decimal)power.Amount);
    }

    internal static void Validate(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number)
        {
            ValidateNumber(value);
            return;
        }
        if (value.ValueKind != JsonValueKind.Object || !Sources.Contains(Text(value, "source")))
            throw new ArgumentException("sf_rules: value needs a supported source or a number");
        var source = Text(value, "source");
        if (source is "counter" or "status_stacks" or "power_stacks") RequiredText(value, "key");
        Option(value, "scope", "turn", "combat");
        Option(value, "subject", "self", "target");
        Option(value, "rounding", "floor", "ceil", "round");
        foreach (var field in new[] { "factor", "offset", "min", "max" })
            if (value.TryGetProperty(field, out var number)) ValidateNumber(number);
        if (value.TryGetProperty("min", out var min) && value.TryGetProperty("max", out var max)
            && min.GetDecimal() > max.GetDecimal())
            throw new ArgumentException("sf_rules: min must be at most max");
    }

    private static void ValidateNumber(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetDecimal(out var number)
            || number < -MaxInputValue || number > MaxInputValue)
            throw new ArgumentException("sf_rules: numeric input must be finite and between -1000000000 and 1000000000");
    }

    internal static decimal Number(JsonElement element, string key, decimal fallback) =>
        element.TryGetProperty(key, out var value) ? value.GetDecimal() : fallback;

    internal static string Text(JsonElement element, string key, string fallback = "") =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(key, out var value)
            && value.ValueKind == JsonValueKind.String ? value.GetString()! : fallback;

    internal static string RequiredText(JsonElement element, string key)
    {
        var result = Text(element, key);
        if (string.IsNullOrWhiteSpace(result)) throw new ArgumentException("sf_rules: " + key + " is required");
        return result;
    }

    internal static void Option(JsonElement element, string key, params string[] options)
    {
        if (element.TryGetProperty(key, out var value)
            && (value.ValueKind != JsonValueKind.String || !options.Contains(value.GetString())))
            throw new ArgumentException("sf_rules: unsupported " + key);
    }
}
