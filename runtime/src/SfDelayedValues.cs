using System.Collections.Generic;
using System.Linq;

namespace SpireForge.Runtime;

/// <summary>延迟数值独立于打出变量；施加时冻结升级值，嵌套延迟不重复升级。</summary>
internal static class SfDelayedValues
{
    internal readonly record struct Value(string Name, decimal Base, decimal Delta, bool IsTurns);

    public static void Upgrade(MegaCrit.Sts2.Core.Models.CardModel card, SfCardDef def)
    {
        foreach (var value in CardValues(def))
        {
            if (value.Delta != 0 && card.DynamicVars.TryGetValue(value.Name, out var variable))
                variable.UpgradeValueBy(value.IsTurns
                    ? System.Math.Max(1, variable.BaseValue + value.Delta) - variable.BaseValue
                    : value.Delta);
        }
    }

    public static SfEffect Resolve(SfEffect effect, int level)
    {
        var copy = effect.Copy();
        if (effect.Kind == SfEffectKind.Delayed)
        {
            copy.Turns = System.Math.Max(1, (int)(effect.DecimalParam("turns") ?? effect.Amount) + effect.UpgradeTurns * level);
            copy.UpgradeTurns = 0;
            if (effect.Params?.ContainsKey("turns") == true)
            {
                copy.Params = new(effect.Params);
                copy.Params.Remove("turns");
            }
        }
        else
        {
            copy.Amount = effect.Amount + effect.UpgradeAmount * level;
        }
        copy.UpgradeAmount = 0;
        copy.Effects = effect.Effects?.Select(e => Resolve(e, level)).ToList();
        return copy;
    }

    public static IEnumerable<Value> CardValues(SfCardDef def)
    {
        foreach (var (list, prefix) in new[] {
            (def.Effects, "DelayedPlay"), (def.OnDraw, "DelayedOnDraw"),
            (def.OnDiscard, "DelayedOnDiscard"), (def.OnExhaust, "DelayedOnExhaust"),
            (def.OnEnterCombat, "DelayedOnEnterCombat"), (def.OnTurnEndInHand, "DelayedOnTurnEndInHand") })
        {
            foreach (var value in Values(list, prefix, false)) yield return value;
        }
    }

    private static IEnumerable<Value> Values(List<SfEffect> effects, string prefix, bool nested)
    {
        for (var i = 0; i < effects.Count; i++)
        {
            var effect = effects[i];
            var path = prefix + (i + 1);
            if (effect.Kind == SfEffectKind.Delayed)
            {
                yield return new Value(path + "Turns", System.Math.Max(1, (int)(effect.DecimalParam("turns") ?? effect.Amount)), effect.UpgradeTurns, true);
                foreach (var value in Values(effect.Effects ?? [], path + "Effect", true)) yield return value;
            }
            else if (nested && effect.Kind is not (SfEffectKind.Custom or SfEffectKind.Vfx))
                yield return new Value(path + "Amount", effect.Amount, effect.UpgradeAmount, false);
        }
    }
}
