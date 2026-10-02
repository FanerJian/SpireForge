using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using HarmonyLib;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.Monsters;

namespace SpireForge.Runtime;

/// <summary>
/// 示例卡包「咔咔」：战斗中在敌方一侧生成一只潮湿邪教徒，显示名改为「咔咔」。
/// 改名原理：向 monsters 本地化表注入词条 + MonsterModel.Title getter 的 Harmony 后缀
/// 按实例替换（只对这里生成并标记的实例生效，正常遭遇的邪教徒不受影响）。
/// 标记存 ConditionalWeakTable：不阻止 GC，语言切换后在读取时重新注入词条。
/// </summary>
public static class SfKaka
{
    private const string LocKey = "SF_KAKA_NAME";

    private static readonly ConditionalWeakTable<MonsterModel, object?> Marked = new();

    public static void Install(Harmony harmony)
    {
        var getter = typeof(MonsterModel).GetProperty(nameof(MonsterModel.Title))?.GetGetMethod();
        if (getter != null)
        {
            harmony.Patch(getter, postfix: new HarmonyMethod(typeof(SfKaka), nameof(TitlePostfix)));
        }
    }

    /// <summary>注入咔咔显示名词条（幂等；语言切换后表会重载，靠 Title 读取路径再次兜底）。</summary>
    private static void EnsureLoc()
    {
        try
        {
            var name = LocManager.Instance.Language == "eng" ? "Kaka" : "咔咔";
            LocManager.Instance.GetTable("monsters").MergeWith(new Dictionary<string, string> { [LocKey] = name });
        }
        catch (System.Exception e)
        {
            MegaCrit.Sts2.Core.Logging.Log.Error($"SPIREFORGE: kaka loc inject failed: {e.Message}");
        }
    }

    private static void TitlePostfix(MonsterModel __instance, ref LocString __result)
    {
        if (Marked.TryGetValue(__instance, out _))
        {
            EnsureLoc();
            __result = new LocString("monsters", LocKey);
        }
    }

    /// <summary>生成一只改名「咔咔」的潮湿邪教徒（保留原版吟唱/暗击 AI，血量压到 13 方便 demo 收掉）。</summary>
    public static async Task<Creature> SpawnKaka(ICombatState combatState)
    {
        EnsureLoc();
        var model = ModelDb.Monster<DampCultist>().ToMutable();
        Marked.Add(model, null); // 先标记再入战：血条/初次渲染就要用新名字
        var creature = await CreatureCmd.Add(model, combatState);
        await CreatureCmd.SetMaxAndCurrentHp(creature, 13m);
        return creature;
    }
}
