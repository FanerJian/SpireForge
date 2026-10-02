using System;

namespace SpireForge.Api;

/// <summary>
/// SpireForge 生命周期事件总线 —— 插件式扩展接口（三）。
/// 第三方 mod（引用 SpireForgeRuntime.dll）随时订阅/退订：
/// <code>
/// SfEvents.CardGranted += (entry, inCombat) => SfLog.Info("got " + entry);
/// SfEvents.AfterEffect += (ctx, ok) => { /* 统计/联动/成就 */ };
/// </code>
/// 事件同步触发；逐订阅者异常隔离——单个订阅者抛错只记 SfLog，
/// 不影响其他订阅者，更不会打断战斗流程。事件在游戏线程上触发，
/// 订阅者内可直接调用游戏 Cmd API。
/// </summary>
public static class SfEvents
{
    /// <summary>自定义效果即将执行。ctx 含卡牌/效果数据/目标/触发时机。
    /// 即使 kind 未注册也会触发（随后 AfterEffect 的 invoked=false）。
    /// 想拦截/替换效果请改用 SfEffects.Register 覆盖同名 kind。</summary>
    public static event Action<SfEffectContext>? BeforeEffect;

    /// <summary>自定义效果执行完毕。invoked=false = 该名字没有注册的处理器。</summary>
    public static event Action<SfEffectContext, bool>? AfterEffect;

    /// <summary>「一键获得卡」把一张卡成功加入本局主牌组后触发
    /// （entry = 卡牌 Entry；inCombat = 发放时是否在战斗中——true 时当前抽牌堆也有同款副本）。</summary>
    public static event Action<string, bool>? CardGranted;

    internal static void RaiseBeforeEffect(SfEffectContext ctx) =>
        Raise(BeforeEffect, ctx);

    internal static void RaiseAfterEffect(SfEffectContext ctx, bool invoked) =>
        Raise(AfterEffect, ctx, invoked);

    internal static void RaiseCardGranted(string entry, bool inCombat) =>
        Raise(CardGranted, entry, inCombat);

    private static void Raise<T>(Action<T>? ev, T arg)
    {
        if (ev == null)
        {
            return;
        }
        foreach (Action<T> h in ev.GetInvocationList())
        {
            try
            {
                h(arg);
            }
            catch (Exception e)
            {
                SfLog.Error("event subscriber failed: " + e.Message);
            }
        }
    }

    private static void Raise<T1, T2>(Action<T1, T2>? ev, T1 a, T2 b)
    {
        if (ev == null)
        {
            return;
        }
        foreach (Action<T1, T2> h in ev.GetInvocationList())
        {
            try
            {
                h(a, b);
            }
            catch (Exception e)
            {
                SfLog.Error("event subscriber failed: " + e.Message);
            }
        }
    }
}
