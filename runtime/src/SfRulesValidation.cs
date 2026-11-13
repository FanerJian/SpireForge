using System;
using System.Collections.Generic;
using System.Text.Json;

namespace SpireForge.Runtime;

/// <summary>在执行任何动作前检查整个规则程序及可移植状态快照。</summary>
internal static class SfRulesValidation
{
    public static void Validate(JsonElement nodes, JsonElement statuses, int depth, bool separateEntry = false)
    {
        var count = 0;
        Nodes(nodes, depth, ref count, StatusIds(statuses));
        if (separateEntry) count = 0;
        Statuses(statuses, separateEntry ? 1 : depth, ref count);
    }

    private static void Statuses(JsonElement statuses, int depth, ref int count)
    {
        Array(statuses, "statuses");
        var ids = StatusIds(statuses);
        foreach (var status in statuses.EnumerateArray())
        {
            Object(status);
            Localized(status.GetProperty("name"));
            Localized(status.GetProperty("description"));
            SfRulesValues.RequiredText(status, "icon");
            SfRulesValues.RequiredText(status, "stacking");
            SfRulesValues.RequiredText(status, "trigger");
            SfRulesValues.Option(status, "stacking", "add", "replace", "max");
            SfRulesValues.Option(status, "trigger", "turn_start", "turn_end", "after_play", "after_attack");
            PositiveInteger(status, "max_stacks", 1);
            PositiveInteger(status, "decay", 0);
            PositiveInteger(status, "max_triggers_per_turn", 1);
            Nodes(status.GetProperty("nodes"), depth, ref count, ids);
        }
    }

    private static HashSet<string> StatusIds(JsonElement statuses)
    {
        Array(statuses, "statuses");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var status in statuses.EnumerateArray())
        {
            Object(status);
            if (!ids.Add(SfRulesValues.RequiredText(status, "id"))) Fail("duplicate status id");
        }
        return ids;
    }

    private static void Nodes(JsonElement nodes, int depth, ref int count, HashSet<string> ids)
    {
        Array(nodes, "nodes");
        if (nodes.GetArrayLength() == 0) return;
        if (depth > SfRulesBudget.MaxDepth) Fail("nesting exceeds depth 8");
        foreach (var node in nodes.EnumerateArray())
        {
            Object(node);
            if (++count > SfRulesBudget.MaxNodes) Fail("program exceeds 256 nodes");
            if (node.TryGetProperty("enabled", out var enabled)
                && enabled.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) Fail("enabled must be boolean");
            switch (SfRulesValues.RequiredText(node, "type"))
            {
                case "action":
                {
                    var effect = node.GetProperty("effect");
                    Object(effect);
                    SfRulesValues.RequiredText(effect, "kind");
                    ActionRules(effect);
                    Effect(effect, depth);
                    if (node.TryGetProperty("amount", out var amount)) Value(amount, ids);
                    break;
                }
                case "if":
                    SfRulesValues.Option(node, "match", "all", "any");
                    var conditions = node.GetProperty("conditions");
                    Array(conditions, "conditions");
                    foreach (var condition in conditions.EnumerateArray())
                    {
                        Object(condition);
                        Value(condition.GetProperty("left"), ids);
                        Value(condition.GetProperty("right"), ids);
                        SfRulesValues.RequiredText(condition, "op");
                        SfRulesValues.Option(condition, "op", "eq", "ne", "gt", "gte", "lt", "lte");
                    }
                    if (node.TryGetProperty("then", out var yes)) Nodes(yes, depth + 1, ref count, ids);
                    if (node.TryGetProperty("else", out var no)) Nodes(no, depth + 1, ref count, ids);
                    break;
                case "repeat":
                case "random":
                    Value(node.GetProperty("count"), ids);
                    Nodes(node.GetProperty("nodes"), depth + 1, ref count, ids);
                    break;
                case "counter":
                    SfRulesValues.RequiredText(node, "key");
                    SfRulesValues.Option(node, "scope", "turn", "combat");
                    SfRulesValues.RequiredText(node, "operation");
                    SfRulesValues.Option(node, "operation", "set", "add");
                    Value(node.GetProperty("value"), ids);
                    break;
                case "status":
                    SfRulesValues.RequiredText(node, "id");
                    if (!ids.Contains(SfRulesValues.Text(node, "id"))) Fail("status is missing its definition");
                    SfRulesValues.RequiredText(node, "operation");
                    SfRulesValues.RequiredText(node, "target");
                    SfRulesValues.Option(node, "operation", "apply", "remove");
                    SfRulesValues.Option(node, "target", "self", "target", "all_enemies");
                    Value(node.GetProperty("stacks"), ids);
                    break;
                case "select":
                    SfRulesValues.RequiredText(node, "from");
                    SfRulesValues.RequiredText(node, "mode");
                    SfRulesValues.Option(node, "from", "hand", "draw", "discard", "exhaust");
                    SfRulesValues.Option(node, "mode", "choose", "random", "all");
                    Value(node.GetProperty("count"), ids);
                    if (node.TryGetProperty("card_type", out var cardType) && cardType.ValueKind != JsonValueKind.String)
                        Fail("card_type must be a string");
                    Operations(node.GetProperty("operations"), ids);
                    break;
                default:
                    Fail("unsupported node type");
                    break;
            }
        }
    }

    private static void ActionRules(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in value.EnumerateArray()) ActionRules(item);
        }
        if (value.ValueKind != JsonValueKind.Object) return;
        if (string.Equals(SfRulesValues.Text(value, "handler"), "sf_rules", StringComparison.OrdinalIgnoreCase)
            || string.Equals(SfRulesValues.Text(value, "kind"), "sf_rules", StringComparison.OrdinalIgnoreCase))
            Fail("action.effect contains a nested sf_rules handler. Compose rules with if/repeat/random nodes");
        foreach (var property in value.EnumerateObject()) ActionRules(property.Value);
    }

    private static void Effect(JsonElement effect, int depth)
    {
        if (depth > SfRulesBudget.MaxDepth) Fail("effect nesting exceeds depth 8");
        _ = effect.Deserialize<SfEffect>() ?? throw new ArgumentException("sf_rules: invalid action effect");
        if (effect.TryGetProperty("effects", out var inner))
        {
            Array(inner, "effects");
            foreach (var child in inner.EnumerateArray()) Effect(child, depth + 1);
        }
        if (effect.TryGetProperty("params", out var options) && options.ValueKind == JsonValueKind.Object
            && options.TryGetProperty("effects", out var children))
        {
            Array(children, "params.effects");
            foreach (var child in children.EnumerateArray()) Effect(child, depth + 1);
        }
    }

    private static void Value(JsonElement value, HashSet<string> ids)
    {
        SfRulesValues.Validate(value);
        if (SfRulesValues.Text(value, "source") == "status_stacks"
            && !ids.Contains(SfRulesValues.Text(value, "key"))) Fail("status value is missing its definition");
    }

    private static void Operations(JsonElement operations, HashSet<string> ids)
    {
        Array(operations, "operations");
        if (operations.GetArrayLength() > SfRulesBudget.MaxNodes) Fail("too many card operations");
        foreach (var operation in operations.EnumerateArray())
        {
            Object(operation);
            switch (SfRulesValues.RequiredText(operation, "type"))
            {
                case "move":
                case "copy":
                    SfRulesValues.RequiredText(operation, "pile");
                    SfRulesValues.Option(operation, "pile", "hand", "draw", "discard");
                    break;
                case "exhaust":
                case "upgrade":
                    break;
                case "cost":
                    Value(operation.GetProperty("amount"), ids);
                    SfRulesValues.RequiredText(operation, "duration");
                    SfRulesValues.Option(operation, "duration", "turn", "combat");
                    break;
                default:
                    Fail("unsupported card operation");
                    break;
            }
        }
    }

    private static void Localized(JsonElement value)
    {
        Object(value);
        foreach (var locale in new[] { "zhs", "eng" })
            if (!value.TryGetProperty(locale, out var text) || text.ValueKind != JsonValueKind.String)
                Fail("localized text requires zhs and eng strings");
    }

    private static void PositiveInteger(JsonElement element, string name, int min, int max = 1_000_000_000)
    {
        if (!element.TryGetProperty(name, out var value)
            || value.ValueKind != JsonValueKind.Number || !value.TryGetDecimal(out var number)
            || decimal.Truncate(number) != number || number < min || number > max)
            Fail(name + " must be an integer in its supported range");
    }
    private static void Object(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) Fail("expected an object");
    }
    private static void Array(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Array) Fail(name + " must be an array");
    }
    private static void Fail(string message) => throw new ArgumentException("sf_rules: " + message);
}
