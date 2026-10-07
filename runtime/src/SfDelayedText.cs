using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using MegaCrit.Sts2.Core.Models;

namespace SpireForge.Runtime;

/// <summary>延迟 Buff 的实例文本：升级值来自施加时的快照，剩余次数仍由游戏的 Amount 提供。</summary>
internal static class SfDelayedText
{
    public static string Name(Dictionary<string, string>? text, bool english) =>
        Localized(text, english) ?? (english ? "Delayed effect" : "延迟效果");

    public static string Description(Dictionary<string, string>? text, List<SfEffect> effects,
        string timing, string side, bool every, bool english)
    {
        var custom = Localized(text, english);
        if (custom != null)
        {
            var values = new Dictionary<string, string>();
            Collect(effects, "Effect", values);
            return Regex.Replace(custom, @"\{(Effect\d+(?:Effect\d+)*(?:Amount|Turns))\}",
                match => values.TryGetValue(match.Groups[1].Value, out var value) ? value : "?");
        }
        var end = timing != "turn_start";
        var sideZh = side == "enemy" ? "敌方" : side is "both" or "any" ? "双方" : "我方";
        var sideEn = side == "enemy" ? "enemy turns" : side is "both" or "any" ? "either side's turns" : "your turns";
        var when = english
            ? (every ? $"At the {(end ? "end" : "start")} of each matching turn ({sideEn}). Remaining: {{Amount}}."
                : $"At the {(end ? "end" : "start")} of the final matching turn ({sideEn}). Remaining: {{Amount}}.")
            : (every ? $"接下来 {{Amount}} 次{sideZh}回合{(end ? "结束" : "开始")}时："
                : $"第 {{Amount}} 次{sideZh}回合{(end ? "结束" : "开始")}时：");
        return when + "\n" + string.Join("\n", effects.Select(e => Sentence(e, english)).Where(s => s.Length > 0));
    }

    private static string? Localized(Dictionary<string, string>? text, bool english)
    {
        if (text == null) return null;
        return text.TryGetValue(english ? "eng" : "zhs", out var value) && !string.IsNullOrWhiteSpace(value) ? value : null;
    }

    private static string Number(decimal value) => value.ToString(CultureInfo.InvariantCulture);

    private static void Collect(List<SfEffect> effects, string prefix, Dictionary<string, string> values)
    {
        for (var i = 0; i < effects.Count; i++)
        {
            var e = effects[i];
            var path = prefix + (i + 1);
            values[path + "Amount"] = Number(e.Amount);
            values[path + "Turns"] = Number(e.Turns ?? e.Amount);
            if (e.Effects != null) Collect(e.Effects, path + "Effect", values);
        }
    }

    private static string Sentence(SfEffect e, bool english)
    {
        var n = Number(e.Amount);
        switch (e.Kind)
        {
            case SfEffectKind.Damage:
                var target = e.Target.Trim().ToLowerInvariant();
                var zhTarget = target == "self" ? "对自身" : target == "all_enemies" ? "对所有敌人" : "对随机敌人";
                var enTarget = target == "self" ? "yourself" : target == "all_enemies" ? "ALL enemies" : "a random enemy";
                var hits = System.Math.Max(1, (int)(e.DecimalParam("hit_count") ?? 1));
                return english ? $"Deal {n} damage to {enTarget}" + (hits > 1 ? $" {hits} times." : ".")
                    : $"{zhTarget}造成 {n} 点伤害" + (hits > 1 ? $"，共 {hits} 次。" : "。");
            case SfEffectKind.Block: return english ? $"Gain {n} Block." : $"获得 {n} 点格挡。";
            case SfEffectKind.Draw: return english ? $"Draw {n} card(s)." : $"抽 {n} 张牌。";
            case SfEffectKind.Energy: return english ? $"Gain {n} Energy." : $"获得 {n} 点能量。";
            case SfEffectKind.Heal: return english ? $"Heal {n} HP." : $"回复 {n} 点生命。";
            case SfEffectKind.LoseHp: return english ? $"Lose {n} HP." : $"失去 {n} 点生命。";
            case SfEffectKind.Gold: return english ? $"{(e.Amount >= 0 ? "Gain" : "Lose")} {Number(System.Math.Abs(e.Amount))} gold."
                : $"{(e.Amount >= 0 ? "获得" : "失去")} {Number(System.Math.Abs(e.Amount))} 金币。";
            case SfEffectKind.Power:
                var spec = e.StringParam("power");
                var name = spec;
                if (!english)
                {
                    try { var type = SfPowerResolver.Find(spec); if (type != null) name = ModelDb.DebugPower(type).Title.GetFormattedText(); }
                    catch { /* 名称解析失败时保留规范名。 */ }
                }
                var self = e.Target.Trim().Equals("self", System.StringComparison.OrdinalIgnoreCase);
                var all = e.Target.Trim().Equals("all_enemies", System.StringComparison.OrdinalIgnoreCase);
                return english ? (self ? $"Gain {n} {name}." : $"Apply {n} {name} to {(all ? "ALL enemies" : "a random enemy")}.")
                    : (self ? $"获得 {n} 层{name}。" : $"给予{(all ? "所有敌人" : "随机敌人")} {n} 层{name}。");
            case SfEffectKind.Orb:
                var orb = e.StringParam("orb").ToLowerInvariant();
                var orbZh = orb switch { "lightning" => "闪电", "frost" => "冰霜", "dark" => "黑暗", "plasma" => "等离子", "glass" => "玻璃", _ => "随机" };
                return english ? $"Channel {n} {(orb.Length == 0 ? "random" : orb)} orb(s)." : $"生成 {n} 个{orbZh}充能球。";
            case SfEffectKind.OrbSlot: return english ? $"{(e.Amount >= 0 ? "Gain" : "Lose")} {Number(System.Math.Abs(e.Amount))} orb slot(s)."
                : $"{(e.Amount >= 0 ? "获得" : "失去")} {Number(System.Math.Abs(e.Amount))} 个充能球栏位。";
            case SfEffectKind.Discard: return english ? $"Discard {n} random card(s)." : $"随机弃置 {n} 张手牌。";
            case SfEffectKind.Exhaust: return english ? $"Exhaust {n} random card(s)." : $"随机消耗 {n} 张手牌。";
            case SfEffectKind.MaxHp: return english ? $"Gain {n} Max HP." : $"生命上限 +{n}。";
            case SfEffectKind.Spawn: return english ? $"Put {n} {e.CardEntry} into your {e.Pile} pile." : $"生成 {n} 张「{e.CardEntry}」。";
            case SfEffectKind.Summon: return english ? $"Summon {n} {e.Monster}." : $"召唤 {n} 只「{e.Monster}」。";
            case SfEffectKind.Delayed:
                return Description(e.BuffDescription, e.Effects ?? [], e.Timing, e.Side, e.EveryTurn, english)
                    .Replace("{Amount}", Number(e.Turns ?? e.Amount));
            case SfEffectKind.Vfx: return "";
            default: return english ? $"[custom:{e.Handler}]" : $"【{e.Handler}】";
        }
    }
}
