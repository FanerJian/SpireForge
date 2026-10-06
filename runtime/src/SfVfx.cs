using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Godot;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Helpers;
using MegaCrit.Sts2.Core.Nodes;
using MegaCrit.Sts2.Core.Nodes.Rooms;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 游戏内视觉特效（VFX）的解析、目录与播放。特效 spec 三种写法：
///   1. 友好名（attack_slash / attack_blunt / cross_heal / lightning / coin_explosion_regular …）
///   2. 内路径（vfx/vfx_attack_slash —— VfxCmd 约定，游戏会加 res://scenes/ 前缀）
///   3. res://… 完整路径（mod 自带特效场景，如 res://MyMod/vfx/my_fx.tscn）
/// 内置目录 = VfxCmd 的 const 内路径 + 游戏程序集里全部带 static scenePath 的 *Vfx 节点类
/// （反射枚举，游戏更新自动带上新特效）；mod 特效目录 = 扫描 mods/*/{vfx} 下的松散 .tscn。
/// 播放：内置/内路径走 VfxCmd（官方定位与容器管理），res://scenes/ 之外的路径按同款配方
/// 直接实例化（VfxCmd 内部固定加 res://scenes/ 前缀，够不到 mod 目录）。
/// </summary>
public static class SfVfx
{
    private const string ScenesPrefix = "res://scenes/";

    /// <summary>解析后的特效条目（目录导出与编辑器下拉共用）。</summary>
    public sealed record VfxEntry(string Name, string Path, string Source);

    private static List<VfxEntry>? _builtIn;

    /// <summary>游戏内置特效目录（友好名 + VfxCmd 内路径；惰性构建，反射随游戏更新自动扩展）。</summary>
    public static IReadOnlyList<VfxEntry> BuiltIn
    {
        get
        {
            if (_builtIn != null)
            {
                return _builtIn;
            }
            var list = new List<VfxEntry>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            // VfxCmd 里的 const 内路径（vfx/vfx_attack_blunt 等）
            foreach (var f in typeof(VfxCmd).GetFields(BindingFlags.Public | BindingFlags.Static)
                         .Where(f => f.FieldType == typeof(string) && f.IsLiteral))
            {
                AddEntry(list, seen, (string)f.GetRawConstantValue()!, "sts2");
            }
            // 游戏程序集里全部带 static string scenePath 的 *Vfx 节点类
            foreach (var t in typeof(VfxCmd).Assembly.GetTypes())
            {
                if (!t.Name.EndsWith("Vfx", StringComparison.Ordinal))
                {
                    continue;
                }
                try
                {
                    var member = t.GetField("scenePath", BindingFlags.Public | BindingFlags.Static)
                                 ?? (MemberInfo?)t.GetProperty("scenePath", BindingFlags.Public | BindingFlags.Static);
                    var value = member is FieldInfo fi ? fi.GetValue(null)
                        : member is PropertyInfo pi ? pi.GetValue(null) : null;
                    if (value is string s && s.StartsWith(ScenesPrefix, StringComparison.Ordinal))
                    {
                        AddEntry(list, seen, InnerOf(s), "sts2");
                    }
                }
                catch (Exception)
                {
                    // 单个类型反射失败只跳过
                }
            }
            _builtIn = list;
            return list;
        }
    }

    private static void AddEntry(List<VfxEntry> list, HashSet<string> seen, string innerPath, string source)
    {
        if (string.IsNullOrWhiteSpace(innerPath) || !seen.Add(innerPath))
        {
            return;
        }
        var name = innerPath;
        if (name.StartsWith("vfx/", StringComparison.Ordinal))
        {
            name = name[4..];
        }
        if (name.StartsWith("vfx_", StringComparison.Ordinal))
        {
            name = name[4..];
        }
        list.Add(new VfxEntry(name, innerPath, source));
    }

    /// <summary>扫描 mods 根目录下各 mod 的松散特效场景（&lt;mod&gt;/vfx/**.tscn）。</summary>
    public static List<VfxEntry> ModScenes(string modsRoot)
    {
        var list = new List<VfxEntry>();
        try
        {
            if (string.IsNullOrEmpty(modsRoot) || !System.IO.Directory.Exists(modsRoot))
            {
                return list;
            }
            foreach (var modDir in System.IO.Directory.GetDirectories(modsRoot))
            {
                var modId = System.IO.Path.GetFileName(modDir);
                var vfxDir = System.IO.Path.Combine(modDir, "vfx");
                if (!System.IO.Directory.Exists(vfxDir))
                {
                    continue;
                }
                foreach (var file in System.IO.Directory.EnumerateFiles(vfxDir, "*.tscn", System.IO.SearchOption.AllDirectories))
                {
                    var rel = file[(modDir.Length + 1)..].Replace('\\', '/');
                    var name = rel["vfx/".Length..];
                    if (name.EndsWith(".tscn", StringComparison.Ordinal))
                    {
                        name = name[..^5];
                    }
                    list.Add(new VfxEntry(modId + "/" + name, "res://" + modId + "/" + rel, modId));
                }
            }
        }
        catch (Exception e)
        {
            SfLog.Warn("vfx catalog: mod scene scan failed: " + e.Message);
        }
        return list;
    }

    /// <summary>res://scenes/vfx/vfx_x.tscn → 内路径 vfx/vfx_x（VfxCmd 入参形态）。</summary>
    private static string InnerOf(string resPath)
    {
        var inner = resPath[ScenesPrefix.Length..];
        return inner.EndsWith(".tscn", StringComparison.Ordinal) ? inner[..^5] : inner;
    }

    /// <summary>spec → 可加载场景路径（res://…，含 .tscn）。找不到返回 null（调用方记日志跳过）。</summary>
    public static string? Resolve(string spec)
    {
        var s = (spec ?? "").Trim();
        if (s.Length == 0)
        {
            return null;
        }
        if (s.StartsWith("res://", StringComparison.Ordinal))
        {
            var p = s.EndsWith(".tscn", StringComparison.Ordinal) ? s : s + ".tscn";
            return ResourceLoader.Exists(p) ? p : null;
        }
        if (s.StartsWith("vfx/", StringComparison.Ordinal))
        {
            var p = ScenesPrefix + s + ".tscn";
            if (ResourceLoader.Exists(p))
            {
                return p;
            }
        }
        var guesses = new[]
        {
            ScenesPrefix + "vfx/vfx_" + s + ".tscn",
            ScenesPrefix + "vfx/" + s + ".tscn",
            ScenesPrefix + s + ".tscn",
        };
        foreach (var g in guesses)
        {
            if (ResourceLoader.Exists(g))
            {
                return g;
            }
        }
        return null;
    }

    /// <summary>在生物身上播放特效（受击位）。spec 解析失败记日志跳过，不阻断结算。</summary>
    public static void PlayOnCreature(Creature target, string spec)
    {
        if (target == null || target.IsDead)
        {
            return;
        }
        var path = Resolve(spec);
        if (path == null)
        {
            SfLog.Warn("vfx not found: " + spec);
            return;
        }
        if (path.StartsWith(ScenesPrefix, StringComparison.Ordinal))
        {
            // 官方路径交回 VfxCmd：容器与定位由官方代码管理
            VfxCmd.PlayOnCreatureCenter(target, InnerOf(path));
            return;
        }
        var node = target.GetCreatureNode();
        if (node == null)
        {
            return; // 无视觉节点（非战斗/图鉴外）时无法定位，放弃演出
        }
        Spawn(path, target.GetVfxContainer(), node.VfxSpawnPosition);
    }

    /// <summary>在阵营中心播放（side = Enemy/Player）。</summary>
    public static void PlayOnSide(CombatSide side, string spec, ICombatState combatState)
    {
        var path = Resolve(spec);
        if (path == null)
        {
            SfLog.Warn("vfx not found: " + spec);
            return;
        }
        if (path.StartsWith(ScenesPrefix, StringComparison.Ordinal))
        {
            VfxCmd.PlayOnSide(side, InnerOf(path), combatState);
            return;
        }
        var pos = VfxCmd.GetSideCenter(side, combatState);
        if (pos.HasValue)
        {
            Spawn(path, NCombatRoom.Instance?.CombatVfxContainer, pos.Value);
        }
    }

    /// <summary>全屏播放（需要战斗房间/施放者的容器；都没有则忽略）。</summary>
    public static void PlayFullScreen(string spec, Creature? spawner)
    {
        var path = Resolve(spec);
        if (path == null)
        {
            SfLog.Warn("vfx not found: " + spec);
            return;
        }
        if (path.StartsWith(ScenesPrefix, StringComparison.Ordinal))
        {
            VfxCmd.PlayFullScreenInCombat(InnerOf(path), spawner);
            return;
        }
        var container = spawner?.GetVfxContainer() ?? NCombatRoom.Instance?.CombatVfxContainer;
        if (container == null)
        {
            return;
        }
        Spawn(path, container, NGame.Instance.GetViewportRect().Size * 0.5f);
    }

    /// <summary>与 VfxCmd.PlayVfx 同配方直接实例化（用于 res://scenes/ 之外的 mod 场景）。</summary>
    private static void Spawn(string scenePath, Control? container, Vector2 position)
    {
        try
        {
            var packed = ResourceLoader.Load<PackedScene>(scenePath);
            if (packed == null)
            {
                SfLog.Warn("vfx scene failed to load: " + scenePath);
                return;
            }
            var node = packed.Instantiate<Node2D>();
            container?.AddChildSafely(node);
            if (node != null)
            {
                node.GlobalPosition = position;
            }
        }
        catch (Exception e)
        {
            SfLog.Warn("vfx play failed (" + scenePath + "): " + e.Message);
        }
    }
}
