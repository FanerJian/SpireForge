using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// Runtime 内置的可组合自定义效果——编辑器不写 C# 就能用的"自定义特效"。
/// 卡牌 JSON（或编辑器自定义效果的 params 框）按以下形态调用，kind 也可直接写处理器名：
///   {"kind":"custom","handler":"sf_repeat","amount":3,
///    "params":{"effects":[{"kind":"damage","amount":5,"props":["Move"]}]}}
///   {"kind":"custom","handler":"sf_random","params":{"pick":2,"effects":[…]}}
///   {"kind":"custom","handler":"sf_cond",
///    "params":{"when":[{"hp_pct_below":50},{"hand_at_least":3}],"effects":[…]}}
///
///   sf_repeat —— 内嵌清单重复执行 amount 次（amount 缺省 1）。
///   sf_random —— 内嵌清单随机挑 pick 条执行（pick 缺省 1，互不重复）。
///   sf_cond   —— when 条件全部成立才执行内嵌清单（when 缺省 = 无条件执行）。
///     when 条件（对象，或对象数组=AND）：hp_below / hp_above（绝对生命）、
///     hp_pct_below / hp_pct_above（0-100）、hand_at_least / hand_at_most（手牌数）、
///     enemies_at_least（可攻击敌人数）。未知/非法条件按不成立处理并记日志。
///
/// 内嵌清单一律按**字面数值**结算（useVarBinding=false，不借用卡牌变量的值，
/// 与 delayed 内嵌同规则）；目标语义与钩子一致（self / random_enemy / all_enemies，
/// 打出时可被玩家指定目标覆盖）。失败只记日志不中断结算（RunAsync 逐条 try/catch）。
/// </summary>
public static class SfBuiltinEffects
{
    /// <summary>内置处理器说明表（目录导出 + 编辑器下拉共用；key = handler 名）。</summary>
    public static readonly Dictionary<string, (string Zh, string En)> Docs = new(StringComparer.Ordinal)
    {
        ["sf_repeat"] = ("把内嵌效果清单重复执行 N 次（数值框 = 次数）",
                         "Repeat the inner effect list N times (amount = times)"),
        ["sf_random"] = ("从内嵌效果清单随机执行 pick 条（默认 1 条，互不重复）",
                         "Randomly run pick entry(ies) from the inner effect list (default 1)"),
        ["sf_cond"] = ("when 条件全部成立时执行内嵌效果清单（hp/手牌/敌人数）",
                       "Run the inner effect list when every 'when' condition holds (hp/hand/enemies)"),
        ["demo_kaka"] = ("示例：召唤改名「咔咔」的邪教徒，自身获得 1 层仪式",
                         "Demo: spawn a Cultist renamed Kaka, gain 1 Ritual"),
        ["sf_test_echo"] = ("调试：日志回显效果参数（仅调试模式注册）",
                            "Debug: echo effect params to the log (debug builds only)"),
    };

    /// <summary>随 Runtime 启动常驻注册（早于任何卡牌打出；晚注册同样生效）。</summary>
    public static void RegisterAll()
    {
        SfEffects.Register("sf_repeat", RepeatAsync);
        SfEffects.Register("sf_random", RandomAsync);
        SfEffects.Register("sf_cond", CondAsync);
    }

    private static async Task RepeatAsync(SfEffectContext ctx)
    {
        var inner = InnerList(ctx.Effect);
        if (inner == null)
        {
            SfLog.Error(ctx.Card.Id + ": sf_repeat needs params.effects (list)");
            return;
        }
        var times = System.Math.Max(1, (int)ctx.Effect.Amount);
        for (var i = 0; i < times; i++)
        {
            await RunInner(ctx, inner, "sf_repeat");
        }
    }

    private static async Task RandomAsync(SfEffectContext ctx)
    {
        var inner = InnerList(ctx.Effect);
        if (inner == null || inner.Count == 0)
        {
            SfLog.Error(ctx.Card.Id + ": sf_random needs a non-empty params.effects list");
            return;
        }
        var pick = IntParam(ctx.Effect, "pick", 1);
        var rng = ctx.Card.Owner?.RunState?.Rng?.CombatCardSelection;
        var pool = new List<SfEffect>(inner);
        var count = System.Math.Min(pick, pool.Count);
        for (var i = 0; i < count; i++)
        {
            var chosen = rng != null ? rng.NextItem(pool) : pool[0];
            if (chosen == null)
            {
                break;
            }
            pool.Remove(chosen);
            await RunInner(ctx, [chosen], "sf_random");
        }
    }

    private static async Task CondAsync(SfEffectContext ctx)
    {
        var inner = InnerList(ctx.Effect);
        if (inner == null)
        {
            SfLog.Error(ctx.Card.Id + ": sf_cond needs params.effects (list)");
            return;
        }
        if (!ConditionsHold(ctx.Effect, ctx.Card))
        {
            return; // 条件不成立：静默跳过（这是预期行为，不是错误）
        }
        await RunInner(ctx, inner, "sf_cond");
    }

    // ---- 内嵌清单与参数解析 ----

    private static List<SfEffect>? InnerList(SfEffect e)
    {
        if (e.Params == null || !e.Params.TryGetValue("effects", out var el)
            || el.ValueKind != JsonValueKind.Array)
        {
            return null;
        }
        try
        {
            return JsonSerializer.Deserialize<List<SfEffect>>(el.GetRawText());
        }
        catch (JsonException ex)
        {
            SfLog.Error("builtin effect: params.effects parse failed: " + ex.Message);
            return null;
        }
    }

    private static int IntParam(SfEffect e, string key, int fallback)
    {
        if (e.Params != null && e.Params.TryGetValue(key, out var v)
            && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n))
        {
            return n;
        }
        return fallback;
    }

    // ---- sf_cond 条件求值 ----

    private static bool ConditionsHold(SfEffect e, CardModel card)
    {
        if (e.Params == null || !e.Params.TryGetValue("when", out var when))
        {
            return true;
        }
        return EvalWhen(when, card);
    }

    private static bool EvalWhen(JsonElement when, CardModel card)
    {
        if (when.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in when.EnumerateArray())
            {
                if (!EvalWhen(item, card))
                {
                    return false;
                }
            }
            return true;
        }
        if (when.ValueKind != JsonValueKind.Object)
        {
            SfLog.Warn("sf_cond: when must be an object or array of objects, treating as failed");
            return false;
        }
        var creature = card.Owner?.Creature;
        foreach (var cond in when.EnumerateObject())
        {
            if (!cond.Value.TryGetDecimal(out var threshold))
            {
                SfLog.Warn("sf_cond: condition '" + cond.Name + "' needs a number, treating as failed");
                return false;
            }
            var ok = cond.Name switch
            {
                "hp_below" => creature != null && creature.CurrentHp < threshold,
                "hp_above" => creature != null && creature.CurrentHp > threshold,
                "hp_pct_below" => creature != null && creature.MaxHp > 0
                    && (decimal)creature.CurrentHp * 100m / creature.MaxHp < threshold,
                "hp_pct_above" => creature != null && creature.MaxHp > 0
                    && (decimal)creature.CurrentHp * 100m / creature.MaxHp > threshold,
                "hand_at_least" => HandCount(card) >= threshold,
                "hand_at_most" => HandCount(card) <= threshold,
                "enemies_at_least" => EnemyCount(card) >= threshold,
                _ => UnknownCondition(cond.Name),
            };
            if (!ok)
            {
                return false;
            }
        }
        return true;
    }

    private static bool UnknownCondition(string name)
    {
        SfLog.Warn("sf_cond: unknown condition '" + name + "', treating as failed");
        return false;
    }

    private static decimal HandCount(CardModel card) =>
        card.Owner?.PlayerCombatState?.Hand?.Cards.Count ?? 0;

    private static decimal EnemyCount(CardModel card) =>
        card.Owner?.Creature?.CombatState?.HittableEnemies.Count ?? 0;

    /// <summary>内嵌清单执行：字面数值、目标按钩子语义解析、失败逐条隔离。</summary>
    private static Task RunInner(SfEffectContext ctx, List<SfEffect> inner, string via) =>
        SfEffectEngine.RunAsync(ctx.Card, inner, ctx.Choice, ctx.Play, ctx.Trigger + ":" + via,
            useVarBinding: false);
}
