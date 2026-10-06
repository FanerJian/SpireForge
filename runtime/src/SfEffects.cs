using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Logging;

namespace SpireForge.Api;

/// <summary>
/// 自定义效果执行上下文。第三方 mod 通过 SfEffects.Register 收到本对象，
/// 据此执行任意游戏命令 API（伤害/力量/遗物交互/自建 Power 等不受内建五种效果限制）。
/// </summary>
public sealed class SfEffectContext
{
    /// <summary>正在执行效果的卡牌（新建卡与被覆盖的原版卡都是 CardModel）。</summary>
    public required MegaCrit.Sts2.Core.Models.CardModel Card { get; init; }

    /// <summary>原始效果数据（Amount / Handler / Params / Target 等）。</summary>
    public required SpireForge.Runtime.SfEffect Effect { get; init; }

    /// <summary>玩家选择上下文；on_enter_combat 触发时为 null（游戏该钩子不带上下文）。</summary>
    public PlayerChoiceContext? Choice { get; init; }

    /// <summary>打出信息；由生命周期钩子触发时为 null。</summary>
    public CardPlay? Play { get; init; }

    /// <summary>触发时机：play / on_draw / on_discard / on_exhaust / on_enter_combat / on_turn_end_in_hand。</summary>
    public required string Trigger { get; init; }

    /// <summary>已解析的目标：打出时=玩家指定目标；钩子时按效果 target 字段解析（默认随机敌人）。</summary>
    public Creature? Target { get; init; }
}

/// <summary>自定义效果处理器。</summary>
public delegate Task SfEffectHandler(SfEffectContext ctx);

/// <summary>
/// 自定义效果注册表 —— SpireForge 的效果扩展接口。
/// 其他 mod（引用 SpireForgeRuntime.dll）在初始化时 Register 一个处理器名，
/// 卡包 JSON 中即可用 {"kind":"<名>", "amount":.., "params":{..}} 调用。
/// 注册时机宽松：效果在卡牌打出/触发时才查找处理器，晚注册同样生效。
/// </summary>
public static class SfEffects
{
    private static readonly Dictionary<string, SfEffectHandler> Handlers = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>当前已注册的自定义效果名。</summary>
    public static IReadOnlyCollection<string> Kinds => Handlers.Keys;

    /// <summary>注册/覆盖一个自定义效果处理器。</summary>
    public static void Register(string kind, SfEffectHandler handler)
    {
        if (string.IsNullOrWhiteSpace(kind))
        {
            throw new ArgumentException("kind is required", nameof(kind));
        }
        ArgumentNullException.ThrowIfNull(handler);
        Handlers[kind] = handler;
        Log.Info($"SPIREFORGE: custom effect registered: {kind}");
    }

    /// <summary>注销一个自定义效果处理器。</summary>
    public static bool Unregister(string kind) => Handlers.Remove(kind);

    /// <summary>查询某个自定义效果名是否已注册。</summary>
    public static bool IsRegistered(string kind) => Handlers.ContainsKey(kind);

    /// <summary>处理器的来源程序集名（目录导出用：编辑器据此标 MOD 徽章；未知返回空串）。</summary>
    public static string SourceOf(string kind) =>
        Handlers.TryGetValue(kind, out var h)
            ? h.Method.DeclaringType?.Assembly.GetName().Name ?? ""
            : "";

    /// <summary>执行自定义效果。返回 false 表示该名字未注册（调用方负责报错）。
    /// 前后触发 SfEvents.BeforeEffect / AfterEffect（插件监听点）。</summary>
    public static async Task<bool> TryInvoke(SfEffectContext ctx)
    {
        // 编辑器保存的自定义效果是 {"kind":"custom","handler":"名字"}；
        // 文档风格则是 {"kind":"名字"} 直接把 kind 当处理器名。两种都接受。
        SfEvents.RaiseBeforeEffect(ctx);
        var key = ctx.Effect.KindName;
        if (string.Equals(key, "custom", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(ctx.Effect.Handler))
        {
            key = ctx.Effect.Handler;
        }
        if (!Handlers.TryGetValue(key, out var handler))
        {
            SfEvents.RaiseAfterEffect(ctx, invoked: false);
            return false;
        }
        try
        {
            await handler(ctx);
            return true;
        }
        catch (Exception e)
        {
            Log.Error($"SPIREFORGE: custom effect '{key}' failed on {ctx.Card.Id}: {e}");
            return true;
        }
        finally
        {
            SfEvents.RaiseAfterEffect(ctx, invoked: true);
        }
    }
}

/// <summary>
/// 卡包内容查询接口：其他 mod 可读取全部已加载 SpireForge 卡包的定义。
/// </summary>
public static class SfPacks
{
    /// <summary>Entry → 卡牌定义（Entry = Slugify(Pascal(packId)+Pascal(cardId))）。</summary>
    public static IReadOnlyDictionary<string, SpireForge.Runtime.SfCardDef> All =>
        SpireForge.Runtime.PackLoader.Defs;

    /// <summary>Entry → 所属卡包 modId。</summary>
    public static IReadOnlyDictionary<string, string> PackOf =>
        SpireForge.Runtime.PackLoader.PackOf;

    /// <summary>按 packId + 卡牌 id 取定义。</summary>
    public static bool TryGetDef(string packId, string cardId, out SpireForge.Runtime.SfCardDef? def) =>
        SpireForge.Runtime.PackLoader.Defs.TryGetValue(
            SpireForge.Runtime.IdHelper.EntryOf(packId, cardId), out def);

    /// <summary>按 Entry 取运行时卡牌模型（SpireForge 新建卡与原版卡均可；找不到返回 false）。
    /// 拿到的模板可 ToMutable() 后交给 CardPileCmd / SfGrant 等游戏 API 自由使用。</summary>
    public static bool TryGetCardModel(string entry, out MegaCrit.Sts2.Core.Models.CardModel? model)
    {
        model = MegaCrit.Sts2.Core.Models.ModelDb.AllCards.FirstOrDefault(c =>
            string.Equals(c.Id.Entry, entry, StringComparison.OrdinalIgnoreCase));
        return model != null;
    }
}

/// <summary>统一前缀日志（godot.log 中过滤 SPIREFORGE 即可看到）。</summary>
public static class SfLog
{
    public static void Info(string msg) => Log.Info($"SPIREFORGE: {msg}");
    public static void Warn(string msg) => Log.Warn($"SPIREFORGE: {msg}");
    public static void Error(string msg) => Log.Error($"SPIREFORGE: {msg}");
}
