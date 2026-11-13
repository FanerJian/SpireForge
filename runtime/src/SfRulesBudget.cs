using System;
using System.Threading;

namespace SpireForge.Runtime;

/// <summary>同一次规则结算与同步触发的状态共用动作额度。</summary>
public sealed class SfRulesBudget
{
    public const int MaxDepth = 8;
    public const int MaxNodes = 256;
    public const int MaxRepeat = 100;
    public const int MaxActions = 512;

    private static readonly AsyncLocal<SfRulesBudget?> Active = new();
    private int _spent;
    internal int Depth { get; set; }

    public static SfRulesBudget? Current => Active.Value;
    public int Spent => _spent;

    public void Spend()
    {
        if (++_spent > MaxActions)
            throw new InvalidOperationException("sf_rules: execution exceeds the 512 action budget");
    }

    internal static IDisposable Enter(SfRulesBudget budget)
    {
        var previous = Active.Value;
        Active.Value = budget;
        return new Scope(() => Active.Value = previous);
    }

    private sealed class Scope(Action dispose) : IDisposable
    {
        public void Dispose() => dispose();
    }
}
