using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>规则数据的受限执行器，基础游戏动作沿用现有效果入口。</summary>
public static class SfRulesEngine
{
    private static readonly JsonElement EmptyStatuses = JsonSerializer.SerializeToElement(Array.Empty<object>());

    public static async Task RunAsync(SfEffectContext context)
    {
        var parameters = context.Effect.Params;
        if (parameters == null || !parameters.TryGetValue("rules_version", out var version)
            || version.ValueKind != JsonValueKind.Number || !version.TryGetDecimal(out var v) || v != 1)
            throw new ArgumentException("sf_rules: rules_version must be 1");
        if (!parameters.TryGetValue("nodes", out var nodes))
            throw new ArgumentException("sf_rules: nodes is required");
        var statuses = parameters.GetValueOrDefault("statuses", EmptyStatuses);
        SfRulesValidation.Validate(nodes, statuses, Math.Max(1, (SfRulesBudget.Current?.Depth ?? 0) + 1));
        await ExecuteNodesAsync(context, nodes, statuses, SfRulesBudget.Current ?? new());
    }

    /// <summary>状态触发沿用来源卡和目标，并与当前执行共享预算。</summary>
    public static async Task ExecuteNodesAsync(SfEffectContext context, JsonElement nodes, JsonElement statuses,
        SfRulesBudget budget, int depth = 1)
    {
        budget = SfRulesBudget.Current ?? budget;
        var startDepth = Math.Max(depth, budget.Depth + 1);
        SfRulesValidation.Validate(nodes, statuses, startDepth, separateEntry: true);
        using var scope = SfRulesBudget.Enter(budget);
        await ExecuteAsync(context, nodes, statuses, budget, startDepth);
    }

    private static async Task ExecuteAsync(SfEffectContext context, JsonElement nodes, JsonElement statuses,
        SfRulesBudget budget, int depth)
    {
        if (nodes.GetArrayLength() == 0) return;
        if (depth > SfRulesBudget.MaxDepth) throw new InvalidOperationException("sf_rules: nesting exceeds depth 8");
        var previousDepth = budget.Depth;
        budget.Depth = depth;
        try
        {
            foreach (var node in nodes.EnumerateArray())
            {
                if (node.TryGetProperty("enabled", out var enabled) && !enabled.GetBoolean()) continue;
                budget.Spend();
                switch (SfRulesValues.Text(node, "type"))
                {
                    case "action":
                    {
                        var effect = node.GetProperty("effect").Deserialize<SfEffect>()!;
                        if (node.TryGetProperty("amount", out var amount)) effect.Amount = SfRulesValues.Evaluate(context, amount);
                        await SfEffectEngine.RunRuleActionAsync(context, [effect]);
                        break;
                    }
                    case "if":
                    {
                        var conditions = node.GetProperty("conditions").EnumerateArray();
                        var matches = SfRulesValues.Text(node, "match", "all") == "any"
                            ? conditions.Any(condition => Matches(context, condition))
                            : conditions.All(condition => Matches(context, condition));
                        if (node.TryGetProperty(matches ? "then" : "else", out var branch))
                            await ExecuteAsync(context, branch, statuses, budget, depth + 1);
                        break;
                    }
                    case "repeat":
                    {
                        var count = Count(context, node.GetProperty("count"));
                        for (var index = 0; index < count; index++)
                            await ExecuteAsync(context, node.GetProperty("nodes"), statuses, budget, depth + 1);
                        break;
                    }
                    case "random":
                    {
                        var pool = node.GetProperty("nodes").EnumerateArray()
                            .Where(item => !item.TryGetProperty("enabled", out var flag) || flag.GetBoolean()).ToList();
                        var count = Math.Min(Count(context, node.GetProperty("count")), pool.Count);
                        for (var index = 0; index < count; index++)
                        {
                            var chosen = SfRulesGame.NextIndex(context, pool.Count);
                            var child = pool[chosen];
                            pool.RemoveAt(chosen);
                            await ExecuteAsync(context, JsonSerializer.SerializeToElement(new[] { child }), statuses, budget, depth + 1);
                        }
                        break;
                    }
                    case "counter":
                        SfRulesValues.SetCounter(context, SfRulesValues.Text(node, "key"),
                            SfRulesValues.Text(node, "scope", "combat"), SfRulesValues.Text(node, "operation"),
                            SfRulesValues.Evaluate(context, node.GetProperty("value")));
                        break;
                    case "status":
                        await SfRulesGame.ApplyStatusAsync(context, node, statuses, budget);
                        break;
                    case "select":
                        await SfRulesGame.SelectAsync(context, node, budget);
                        break;
                }
            }
        }
        finally { budget.Depth = previousDepth; }
    }

    internal static int Count(SfEffectContext context, JsonElement value)
    {
        var count = decimal.Floor(SfRulesValues.Evaluate(context, value));
        if (count < 0 || count > SfRulesBudget.MaxRepeat)
        {
            SfLog.Warn("sf_rules: count " + count + " clamped to the supported range 0..100");
            count = Math.Clamp(count, 0, SfRulesBudget.MaxRepeat);
        }
        return (int)count;
    }

    private static bool Matches(SfEffectContext context, JsonElement condition)
    {
        var left = SfRulesValues.Evaluate(context, condition.GetProperty("left"));
        var right = SfRulesValues.Evaluate(context, condition.GetProperty("right"));
        return SfRulesValues.Text(condition, "op") switch
        {
            "eq" => left == right,
            "ne" => left != right,
            "gt" => left > right,
            "gte" => left >= right,
            "lt" => left < right,
            "lte" => left <= right,
            _ => throw new ArgumentException("sf_rules: unknown comparison operator"),
        };
    }
}
