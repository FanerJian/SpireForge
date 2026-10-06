using System;
using System.Collections.Generic;
using Godot;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Nodes.Combat;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 无站位表遭遇的敌人排版。单行时复刻 NCombatRoom.PositionEnemies 的横向等距铺开算法
/// （交错行 + 间距压缩）；敌人太多单行放不下时——游戏原版只会打警告任其出屏
/// （「召唤太多挤到屏幕外」的根因）——改用官方玩家网格同款方案（PositionPlayersAndPets）：
/// ceil(√n) 列换行 + 行间垂直错位（行距最多 120px），行仍超宽时按 Visuals.Scale
/// 整行等比缩小兜底。失败只记日志，不阻断结算。
/// </summary>
internal static class SfSummonLayout
{
    private const float LeftFloor = 150f;
    private const float GapNormal = 70f;
    private const float GapMin = 5f;
    private const float ScaleMin = 0.5f;

    /// <summary>把当前全部敌人节点重新铺开（与战斗开始时的初始排版一致）。</summary>
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
            if (!TrySpreadSingleRow(nodes, usable))
            {
                SpreadGrid(nodes, usable);
            }
        }
        catch (Exception ex)
        {
            SfLog.Warn("summon layout failed: " + ex.Message);
        }
    }

    /// <summary>实占宽度：Bounds 不含节点缩放，乘上 Visuals.Scale（游戏对同类怪按生命
    /// 随机缩放，召唤时可能 ≠1）。</summary>
    private static float WidthOf(NCreature n) => n.Visuals.Bounds.Size.X * n.Visuals.Scale.X;

    /// <summary>游戏单行算法：放得下返回 true 并落位；放不下原样返回 false（调用方换网格）。</summary>
    private static bool TrySpreadSingleRow(List<NCreature> nodes, float usable)
    {
        var gap = GapNormal;
        var total = 0f;
        foreach (var n in nodes)
        {
            total += WidthOf(n);
        }
        var span = total + (nodes.Count - 1) * gap;
        var x = Math.Max((usable - span) * 0.5f, LeftFloor);
        var stagger = 0f;
        if (x + span > usable && nodes.Count > 1)
        {
            gap = Math.Max((usable - LeftFloor - total) / (nodes.Count - 1), GapMin);
            span = total + (nodes.Count - 1) * gap;
            x = (usable - span) * 0.5f;
            if (gap < 30f)
            {
                stagger = Mathf.Lerp(60f, 40f, (gap - GapMin) / 25f);
            }
        }
        if (x + span > usable + 0.5f)
        {
            return false;
        }
        var cursor = x;
        for (var i = 0; i < nodes.Count; i++)
        {
            var w = WidthOf(nodes[i]);
            nodes[i].Position = new Vector2(cursor + w * 0.5f, 200f - (i % 2 != 0 ? stagger : 0f));
            cursor += w + gap;
        }
        return true;
    }

    /// <summary>网格换行（官方玩家网格同款）：ceil(√n) 列、行间垂直错位 120/(rows-1)；
    /// 行内先压间距，仍超宽再按 Visuals.Scale 整行缩小（下限 ScaleMin）。</summary>
    private static void SpreadGrid(List<NCreature> nodes, float usable)
    {
        var cols = (int)Math.Ceiling(Math.Sqrt(nodes.Count));
        var rows = (int)Math.Ceiling(nodes.Count / (float)cols);
        var rowStep = rows > 1 ? 120f / (rows - 1) : 0f;
        var avail = usable - LeftFloor;
        for (var r = 0; r < rows; r++)
        {
            var start = r * cols;
            var count = Math.Min(cols, nodes.Count - start);
            if (count <= 0)
            {
                break;
            }
            var row = nodes.GetRange(start, count);
            var natural = 0f;
            foreach (var n in row)
            {
                natural += WidthOf(n);
            }
            var scale = natural + (count - 1) * GapMin > avail
                ? Math.Max((avail - (count - 1) * GapMin) / natural, ScaleMin)
                : 1f;
            var gap = count > 1
                ? Math.Min(GapNormal, Math.Max((avail - natural * scale) / (count - 1), GapMin))
                : 0f;
            var span = natural * scale + (count - 1) * gap;
            var cursor = Math.Max((usable - span) * 0.5f, LeftFloor);
            for (var i = 0; i < row.Count; i++)
            {
                var n = row[i];
                if (scale != 1f)
                {
                    n.Visuals.Scale = new Vector2(n.Visuals.Scale.X * scale, n.Visuals.Scale.Y * scale);
                }
                var w = WidthOf(n);
                n.Position = new Vector2(cursor + w * 0.5f, 200f - rowStep * r);
                cursor += w + gap;
            }
        }
    }
}
