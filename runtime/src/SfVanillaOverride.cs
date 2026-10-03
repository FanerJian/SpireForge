using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using HarmonyLib;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Localization.DynamicVars;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 原版卡牌覆盖：把卡包 JSON 中带 vanilla_id 的定义应用到 ModelDb 里的原版模板。
/// 应用点为 AfterEssentialInit（模板已构造、Id 已赋值、池已冻结也无妨——我们不碰池）。
///
/// 机制（全部在模板级，实例经 ToMutable 克隆继承）：
///  - 费用/类型/稀有度/目标：写 CardModel 构造期自动属性的后备字段；
///    X 费（CostsX）直接替换 _energyCost（HasEnergyCostX 是表达式属性，无后备字段可写）；
///  - 数值 stats：按 DynamicVar.Name 写模板 DynamicVars.BaseValue（公开 setter，无可变性断言）；
///  - 行为 effects：Harmony 前缀替换该卡的 OnPlay（ref Task __result 跳过原实现），
///    转交 SfEffectEngine —— 与新建卡共用同一解释器；
///  - 升级 upgrade_stats：Harmony 前缀替换 OnUpgrade，按变量名做增量；
///  - 名称/描述：走卡包本地化文件（键 = vanilla_id.title / vanilla_id.description，
///    游戏 LocTable.MergeWith 后加载覆盖原版键），Runtime 侧无需处理。
///
/// 已知限制：effects/upgrade_stats 采用"整体替换"语义（不是追加）；
/// 与其他 mod 对同一张原版卡的 Harmony 补丁共存时，先后顺序未定义。
/// </summary>
public static class SfVanillaOverride
{
    private const string HarmonyId = "com.spireforge.runtime.vanilla";

    /// <summary>PackLoader 扫描期收集（ModelDb.Init 前），ApplyAll 时消费。
    /// modId 随定义一起记录：覆盖卡不进 PackLoader.PackOf，立绘 res:// 路径要用它拼接。</summary>
    private static readonly List<(SfCardDef Def, string ModId)> Pending = new();

    /// <summary>entry → 生效中的覆盖定义（Harmony 前缀查表）。</summary>
    private static readonly Dictionary<string, SfCardDef> Active = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>entry → 所属包 id（仅记录带自定义立绘的覆盖，PortraitPostfix 与自检用）。</summary>
    private static readonly Dictionary<string, string> PackOfVanilla = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>已生效的覆盖定义（vanillaId → 定义 + 所属包 id），供启动期立绘自检枚举。</summary>
    public static IEnumerable<(string VanillaId, SfCardDef Def, string ModId)> Applied =>
        Active.Select(kv => (kv.Key, kv.Value, PackOfVanilla.TryGetValue(kv.Key, out var m) ? m : ""));

    /// <summary>收集一个覆盖定义。同一 vanilla_id 重复时返回 false（先到先得）。</summary>
    public static bool Collect(SfCardDef def, string modId)
    {
        if (Pending.Any(p => string.Equals(p.Def.VanillaId, def.VanillaId, StringComparison.OrdinalIgnoreCase)))
        {
            return false;
        }
        Pending.Add((def, modId));
        return true;
    }

    /// <summary>应用全部覆盖（幂等：调用一次；AfterEssentialInit 里挂）。</summary>
    public static void ApplyAll()
    {
        if (Pending.Count == 0)
        {
            return;
        }
        var harmony = new Harmony(HarmonyId);
        int ok = 0;
        foreach (var (def, modId) in Pending)
        {
            if (Apply(harmony, def, modId))
            {
                ok++;
            }
        }
        SfLog.Info("vanilla overrides applied " + ok + "/" + Pending.Count);
        Pending.Clear();
    }

    private static bool Apply(Harmony harmony, SfCardDef def, string modId)
    {
        string vid = (def.VanillaId ?? "").Trim();
        if (vid.Length == 0)
        {
            return false;
        }
        var template = ModelDb.AllCards.FirstOrDefault(c => c.Id.Entry == vid);
        if (template == null)
        {
            SfLog.Error("vanilla override: card " + vid + " not found in ModelDb");
            return false;
        }

        try
        {
            SetCost(template, def);
            SetBacking(template, "<Type>k__BackingField", def.Type);
            SetBacking(template, "<Rarity>k__BackingField", def.RarityEnum);
            SetBacking(template, "<TargetType>k__BackingField", def.TargetEnum);
            if (def.Stats is { Count: > 0 })
            {
                ApplyVars(template, def.Stats, absolute: true);
            }
        }
        catch (Exception e)
        {
            SfLog.Error("vanilla override " + vid + " field apply failed: " + e.Message);
            return false;
        }

        // 查表先于补丁填充：getter 后缀一挂就可能被游戏代码读到，届时表必须已就绪
        Active[vid] = def;
        if (!string.IsNullOrEmpty(def.Portrait))
        {
            PackOfVanilla[vid] = modId;
        }

        if (def.Effects is { Count: > 0 })
        {
            var onPlay = AccessTools.DeclaredMethod(template.GetType(), "OnPlay");
            if (onPlay == null)
            {
                SfLog.Error("vanilla override " + vid + ": no declared OnPlay, effects skipped");
            }
            else
            {
                harmony.Patch(onPlay, prefix: new HarmonyMethod(typeof(SfVanillaOverride), nameof(PlayPrefix)));
            }
        }
        if (def.UpgradeStats is { Count: > 0 })
        {
            var onUpgrade = AccessTools.DeclaredMethod(template.GetType(), "OnUpgrade");
            if (onUpgrade == null)
            {
                SfLog.Error("vanilla override " + vid + ": no declared OnUpgrade, upgrade_stats skipped");
            }
            else
            {
                harmony.Patch(onUpgrade, prefix: new HarmonyMethod(typeof(SfVanillaOverride), nameof(UpgradePrefix)));
            }
        }
        if (!string.IsNullOrEmpty(def.Portrait))
        {
            HookPortrait(harmony, template);
        }

        SfLog.Info("vanilla override " + vid + " applied: cost=" +
                   (def.CostsX ? "X" : def.Cost.ToString()) + " type=" + def.CardType +
                   " rarity=" + def.Rarity + " target=" + def.Target +
                   " stats=" + (def.Stats?.Count ?? 0) + " effects=" + def.Effects.Count +
                   " upgrade=" + (def.UpgradeStats?.Count ?? 0) +
                   " portrait=" + (string.IsNullOrEmpty(def.Portrait)
                       ? "-"
                       : "res://" + modId + "/" + def.Portrait));
        return true;
    }

    /// <summary>已补丁过的立绘 getter（多张覆盖卡常共用 CardModel 的基类实现，只补一次）。</summary>
    private static readonly HashSet<MethodBase> PortraitPatched = new();

    /// <summary>把覆盖卡的自定义立绘接到原版模板上。PortraitPath/BetaPortraitPath 是计算型
    /// 虚属性（无后备字段可写），纹理由 ResourceLoader 按返回路径现场加载——用后缀改写返回值。
    /// 各卡实际执行的 getter 可能是基类实现，也可能被卡类重写（如 Wither 按升级形态取图），
    /// 因此沿继承链取 most-derived 的声明 getter 去重后补丁；后缀按 Id.Entry 查表，
    /// 仅命中"本 mod 覆盖且带立绘"的卡，其余实例原样返回。</summary>
    private static void HookPortrait(Harmony harmony, CardModel template)
    {
        foreach (var prop in new[] { "PortraitPath", "BetaPortraitPath" })
        {
            var getter = DeclaredGetter(template.GetType(), prop);
            if (getter == null || !PortraitPatched.Add(getter))
            {
                continue;
            }
            harmony.Patch(getter, postfix: new HarmonyMethod(typeof(SfVanillaOverride), nameof(PortraitPostfix)));
        }
    }

    /// <summary>沿继承链找属性 getter 的**声明**实现。Harmony 只接受声明处方法：
    /// Type.GetProperty 返回的继承属性（ReflectedType=派生类）会被拒绝
    /// （"You can only patch implemented methods/constructors"，实测启动即炸）。</summary>
    private static MethodInfo? DeclaredGetter(Type type, string prop)
    {
        for (var cur = type; cur != null && typeof(CardModel).IsAssignableFrom(cur); cur = cur.BaseType)
        {
            var p = cur.GetProperty(prop,
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.DeclaredOnly);
            var g = p?.GetGetMethod(true);
            if (g != null)
            {
                return g;
            }
        }
        return null;
    }

    /// <summary>PortraitPath/BetaPortraitPath 后缀：覆盖卡返回包内立绘，其余不动。</summary>
    private static void PortraitPostfix(ref string __result, CardModel __instance)
    {
        var entry = __instance?.Id?.Entry;
        if (string.IsNullOrEmpty(entry))
        {
            return;
        }
        if (Active.TryGetValue(entry, out var def)
            && !string.IsNullOrEmpty(def.Portrait)
            && PackOfVanilla.TryGetValue(entry, out var modId))
        {
            __result = "res://" + modId + "/" + def.Portrait;
        }
    }

    /// <summary>费用覆盖。原版 X 费卡惯例：CanonicalEnergyCost=0 + CostsX（见 Cascade）。</summary>
    private static void SetCost(CardModel template, SfCardDef def)
    {
        var ecField = AccessTools.Field(typeof(CardModel), "_energyCost");
        if (def.CostsX)
        {
            ecField.SetValue(template, new CardEnergyCost(template, 0, true));
            return;
        }
        AccessTools.Field(typeof(CardModel), "<CanonicalEnergyCost>k__BackingField")
            ?.SetValue(template, def.Cost);
        // 模板的 EnergyCost 可能已被游戏代码惰性创建（属性 getter 缓存）——一并替换
        if (ecField.GetValue(template) != null)
        {
            ecField.SetValue(template, new CardEnergyCost(template, def.Cost, false));
        }
    }

    private static void SetBacking(CardModel template, string fieldName, object value)
    {
        AccessTools.Field(typeof(CardModel), fieldName)?.SetValue(template, value);
    }

    /// <summary>按 DynamicVar.Name 匹配并改值。absolute=true 设 BaseValue，否则 UpgradeValueBy 增量。</summary>
    private static void ApplyVars(CardModel card, Dictionary<string, decimal> map, bool absolute)
    {
        var set = card.DynamicVars;
        if (set == null || map.Count == 0)
        {
            return;
        }
        // DynamicVarSet 本质是字典（带 this[string] 索引器）——反射枚举属性时
        // 无参 GetValue 打到索引器会抛 Parameter count mismatch，直接枚举键值对
        var byName = new Dictionary<string, DynamicVar>(StringComparer.OrdinalIgnoreCase);
        foreach (var kv in set)
        {
            byName[kv.Key] = kv.Value;
        }
        foreach (var (name, val) in map)
        {
            if (byName.TryGetValue(name, out var v))
            {
                if (absolute)
                {
                    v.BaseValue = val;
                }
                else
                {
                    v.UpgradeValueBy(val);
                }
            }
            else
            {
                SfLog.Warn("vanilla override " + card.Id.Entry + ": var " + name + " not found, skipped");
            }
        }
    }

    /// <summary>OnPlay 替换前缀：返回 false 跳过原实现，效果清单转交 SfEffectEngine。</summary>
    private static bool PlayPrefix(
        ref Task __result, CardModel __instance, PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        if (!Active.TryGetValue(__instance.Id.Entry, out var def) || def.Effects.Count == 0)
        {
            return true;
        }
        __result = SfEffectEngine.RunAsync(__instance, def.Effects, choiceContext, cardPlay, "play");
        return false;
    }

    /// <summary>OnUpgrade 替换前缀：按 upgrade_stats 增量改本实例的变量。</summary>
    private static bool UpgradePrefix(CardModel __instance)
    {
        if (Active.TryGetValue(__instance.Id.Entry, out var def) && def.UpgradeStats is { Count: > 0 })
        {
            ApplyVars(__instance, def.UpgradeStats, absolute: false);
        }
        return false;
    }
}
