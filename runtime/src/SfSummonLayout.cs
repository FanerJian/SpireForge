using System;
using System.Collections.Generic;
using Godot;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Nodes.Combat;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 无站位表遭遇的敌人排版：复刻 NCombatRoom.PositionEnemies 的横向等距铺开算法
/// （交错行 + 间距压缩）。游戏只在战斗开始时对初始敌人调用一次排版；中途召唤、
/// 且当前遭遇没有站位表（Encounter.Slots 绝大多数为空）时没有任何代码给新怪定位，
/// 全部叠在容器默认位置——「召唤五只怪在同一位置」的根因。失败只记日志，不阻断结算。
/// </summary>
internal static class SfSummonLayout
{
    /// <summary>把当前全部敌人节点按游戏同款算法重新铺开（与战斗开始时的初始排版一致）。</summary>
    public static void SpreadEnemies(ICombatState combat)
    {
        try
        {
            var nodes = new List<NCreature>();
            foreach (var c in combat.Enemies)
            {
                var n = c?.GetCreatureNode();
                if (n != null)
                {
                    nodes.Add(n);
                }
            }
            if (nodes.Count == 0)
            {
                return;
            }
            var scaling = combat.Encounter?.GetCameraScaling() ?? 1f;
            var usable = 960f / scaling;
            var gap = 70f;
            var total = 0f;
            foreach (var n in nodes)
            {
                total += n.Visuals.Bounds.Size.X;
            }
            var span = total + (nodes.Count - 1) * gap;
            var x = Math.Max((usable - span) * 0.5f, 150f);
            var stagger = 0f;
            if (x + span > usable && nodes.Count > 1)
            {
                gap = Math.Max((usable - 150f - total) / (nodes.Count - 1), 5f);
                span = total + (nodes.Count - 1) * gap;
                x = (usable - span) * 0.5f;
                if (gap < 30f)
                {
                    stagger = Mathf.Lerp(60f, 40f, (gap - 5f) / 25f);
                }
            }
            for (var i = 0; i < nodes.Count; i++)
            {
                var w = nodes[i].Visuals.Bounds.Size.X;
                nodes[i].Position = new Vector2(x + w * 0.5f, 200f - (i % 2 != 0 ? stagger : 0f));
                x += w + gap;
            }
        }
        catch (Exception ex)
        {
            SfLog.Warn("summon layout failed: " + ex.Message);
        }
    }
}
