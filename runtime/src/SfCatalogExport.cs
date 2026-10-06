using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 游戏内容目录导出：把本次会话已加载的全部力量 / 怪物 / 卡牌（原版 + 所有已启用 mod）
/// 写到 Runtime 安装目录的 spireforge-catalog.json，供编辑器下拉框合并展示
/// （mod 角色的 buff、mod 怪物、mod 卡牌由此进入编辑器目录）。
/// 写出时机：①ExecuteEssential 后缀（ModelDb 已 Init+InitIds，与卡池目录导出同点）；
/// ②启动后延时重写一次——部分 mod 的本地化表合并较晚，延时可把标题/描述补全。
/// 两次写出都幂等（原子替换），后写者胜出。单条模型读取失败只跳过不中断。
/// 与 spireforge-pools.json 的区别：那份是编辑器要校验导入的"自定义卡池声明"，
/// 这份是纯展示用的只读快照，编辑器读不到时静默降级为内置目录。
/// </summary>
public static class SfCatalogExport
{
    /// <summary>每类条目上限（防异常 mod 把文件撑爆；正常全量 < 1MB）。</summary>
    private const int MaxPerKind = 4096;

    /// <summary>spireforge-catalog.json 路径（与 SpireForgeRuntime.dll 同目录）。</summary>
    public static string CatalogPath => Path.Combine(
        Path.GetDirectoryName(typeof(SfCatalogExport).Assembly.Location) ?? "",
        "spireforge-catalog.json");

    /// <summary>延时重写挂在 SceneTree 计时器上（主线程触发）。</summary>
    public static void InstallDeferred(Godot.SceneTree tree, double delaySeconds)
    {
        tree.CreateTimer(delaySeconds).Timeout += Export;
    }

    public static void Export()
    {
        string? tempPath = null;
        try
        {
            var powers = new List<object>();
            foreach (var p in ModelDb.AllPowers.Take(MaxPerKind))
            {
                try
                {
                    if (p.IsMock)
                    {
                        continue;
                    }
                    var cls = p.GetType().Name;
                    powers.Add(new
                    {
                        name = PowerDisplayName(cls),
                        entry = p.Id.Entry,
                        class_name = cls,
                        title = SafeText(() => TextOf(p.Title)),
                        description = SafeText(() => PowerDescription(p)),
                        type = p.Type.ToString().ToLowerInvariant(),
                        source = p.GetType().Assembly.GetName().Name ?? "",
                    });
                }
                catch (Exception e)
                {
                    SfLog.Warn("catalog: skip power: " + e.Message);
                }
            }

            var monsters = new List<object>();
            foreach (var m in ModelDb.Monsters.Take(MaxPerKind))
            {
                try
                {
                    if (m.IsMock)
                    {
                        continue;
                    }
                    int min = m.MinInitialHp;
                    int max = m.MaxInitialHp;
                    monsters.Add(new
                    {
                        name = m.GetType().Name,
                        entry = m.Id.Entry,
                        title = SafeText(() => TextOf(m.Title)),
                        hp = min == max ? min.ToString() : min + "-" + max,
                        source = m.GetType().Assembly.GetName().Name ?? "",
                    });
                }
                catch (Exception e)
                {
                    SfLog.Warn("catalog: skip monster: " + e.Message);
                }
            }

            var cards = new List<object>();
            foreach (var c in ModelDb.AllCards.Take(MaxPerKind))
            {
                try
                {
                    if (c.IsMock)
                    {
                        continue;
                    }
                    cards.Add(new
                    {
                        entry = c.Id.Entry,
                        title = SafeText(() => c.Title ?? ""),
                        type = c.Type.ToString().ToLowerInvariant(),
                        rarity = c.Rarity.ToString().ToLowerInvariant(),
                        source = c.GetType().Assembly.GetName().Name ?? "",
                    });
                }
                catch (Exception e)
                {
                    SfLog.Warn("catalog: skip card: " + e.Message);
                }
            }

            // 自定义效果注册表快照：本会话所有 mod（含 Runtime 内置）注册的处理器名。
            // 编辑器据此把"mod 的特效"列进自定义效果下拉（source 标徽章，Docs 补说明）。
            var customs = new List<object>();
            foreach (var kind in SfEffects.Kinds.OrderBy(k => k, StringComparer.OrdinalIgnoreCase).Take(MaxPerKind))
            {
                var doc = SfBuiltinEffects.Docs.TryGetValue(kind, out var d) ? d : ("", "");
                customs.Add(new
                {
                    name = kind,
                    source = SfEffects.SourceOf(kind),
                    desc_zh = doc.Item1,
                    desc_en = doc.Item2,
                });
            }

            // 视觉特效目录：游戏内置（VfxCmd consts + *Vfx 节点反射）+ mod 松散场景（mods/*/vfx/**.tscn）
            var vfx = new List<object>();
            var modsRoot = Path.GetDirectoryName(Path.GetDirectoryName(typeof(SfCatalogExport).Assembly.Location));
            foreach (var v in SfVfx.BuiltIn.Take(MaxPerKind))
            {
                vfx.Add(new { name = v.Name, path = v.Path, source = v.Source });
            }
            foreach (var v in SfVfx.ModScenes(modsRoot ?? "").Take(MaxPerKind))
            {
                vfx.Add(new { name = v.Name, path = v.Path, source = v.Source });
            }

            var catalog = new
            {
                format_version = 1,
                generated_at_utc = DateTime.UtcNow.ToString("O", System.Globalization.CultureInfo.InvariantCulture),
                language = LocManager.Instance?.Language ?? "",
                powers,
                monsters,
                cards,
                custom_effects = customs,
                vfx,
            };
            var options = new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower,
            };
            string json = System.Text.Json.JsonSerializer.Serialize(catalog, options);
            string targetPath = CatalogPath;
            tempPath = targetPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(tempPath, json, new System.Text.UTF8Encoding(false));
            File.Move(tempPath, targetPath, true);
            tempPath = null;
            SfLog.Info("catalog: exported " + powers.Count + " power(s), " + monsters.Count +
                       " monster(s), " + cards.Count + " card(s), " + customs.Count +
                       " custom effect(s), " + vfx.Count + " vfx to " + targetPath);
        }
        catch (Exception e)
        {
            SfLog.Error("catalog export failed: " + e.Message);
            if (tempPath != null)
            {
                try { File.Delete(tempPath); }
                catch (Exception) { }
            }
        }
    }

    /// <summary>SfPowerResolver 可解析名（类名去 Power 后缀，与编辑器目录约定一致）。</summary>
    private static string PowerDisplayName(string className)
    {
        return className.Length > 5 && className.EndsWith("Power", StringComparison.Ordinal)
            ? className[..^5]
            : className;
    }

    /// <summary>LocString → 文本：无词条返回空串（编辑器回落显示规范名）。</summary>
    private static string TextOf(LocString? ls)
    {
        if (ls == null || !ls.Exists())
        {
            return "";
        }
        return ls.GetRawText() ?? "";
    }

    /// <summary>力量描述：补齐模板变量后取格式化文本（与 DumbHoverTip 同配方），
    /// 失败回落原文。</summary>
    private static string PowerDescription(PowerModel p)
    {
        var ls = p.Description;
        if (ls == null || !ls.Exists())
        {
            return "";
        }
        try
        {
            ls.Add("Amount", 1m);
            ls.Add("singleStarIcon", "");
            ls.Add("energyPrefix", "");
            return ls.GetFormattedText() ?? "";
        }
        catch (Exception)
        {
            return ls.GetRawText() ?? "";
        }
    }

    private static string SafeText(Func<string> read)
    {
        try
        {
            return read() ?? "";
        }
        catch (Exception)
        {
            return "";
        }
    }
}
