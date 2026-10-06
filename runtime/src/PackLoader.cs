using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Godot;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Modding;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>
/// 扫描全部已加载 mod 的 res://&lt;modid&gt;/cards/*.json，解析卡牌定义。
/// 在 ModelDb.Init 之前调用（此时所有 mod 的 PCK 已挂载、卡池尚未冻结）。
/// </summary>
public static class PackLoader
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
    };

    /// <summary>Entry（= 类型名 Slugify）→ 定义</summary>
    public static readonly Dictionary<string, SfCardDef> Defs = new();

    /// <summary>Entry → 所属 packId（用于立绘 res 路径与日志）</summary>
    public static readonly Dictionary<string, string> PackOf = new();

    public static void ScanAllMods()
    {
        Defs.Clear();
        PackOf.Clear();
        SfPngLoader.ResetNamespaces();
        var seen = new HashSet<string>();
        foreach (var mod in ModManager.GetLoadedMods())
        {
            var modId = mod.manifest?.id;
            if (string.IsNullOrEmpty(modId) || modId == "SpireForgeRuntime")
            {
                continue;
            }
            ScanMod(modId, seen);
        }
        Log.Info($"SPIREFORGE: pack scan complete, {Defs.Count} card definition(s) loaded");
    }

    private static void ScanMod(string modId, HashSet<string> seen)
    {
        string cardsDir = $"res://{modId}/cards";
        if (!DirAccess.DirExistsAbsolute(cardsDir))
        {
            return;
        }
        using var dir = DirAccess.Open(cardsDir);
        if (dir == null)
        {
            Log.Warn($"SPIREFORGE: cannot open {cardsDir}");
            return;
        }
        dir.ListDirBegin();
        string name = dir.GetNext();
        while (!string.IsNullOrEmpty(name))
        {
            if (!dir.CurrentIsDir() && name.EndsWith(".json"))
            {
                string path = $"{cardsDir}/{name}";
                try
                {
                    using var f = Godot.FileAccess.Open(path, Godot.FileAccess.ModeFlags.Read);
                    var raw = f.GetAsText();
                    var def = JsonSerializer.Deserialize<SfCardDef>(raw, JsonOpts);
                    if (def == null || string.IsNullOrWhiteSpace(def.Id))
                    {
                        Log.Error($"SPIREFORGE: invalid card json {path}");
                    }
                    else if (!string.IsNullOrWhiteSpace(def.VanillaId))
                    {
                        // 原版卡覆盖：不 Emit、不入池，交给 SfVanillaOverride 在 ModelDb 就绪后应用
                        // （modId 一并带上：覆盖卡不进 PackOf，立绘 res:// 路径要用它拼接）；
                        // 纯覆盖包的命名空间必须放行 PNG 加载，否则立绘加载器拒认 → 立绘空白
                        SfPngLoader.AllowNamespace(modId);
                        if (SfVanillaOverride.Collect(def, modId))
                        {
                            SfLog.Info("vanilla override queued: " + def.VanillaId + " <- " + name);
                        }
                        else
                        {
                            SfLog.Error("duplicate vanilla override for " + def.VanillaId + " (" + name + "), first wins");
                        }
                    }
                    else
                    {
                        string entry = IdHelper.EntryOf(modId, def.Id);
                        if (!seen.Add(entry))
                        {
                            Log.Error($"SPIREFORGE: duplicate card entry {entry} ({path})");
                        }
                        else
                        {
                            Defs[entry] = def;
                            PackOf[entry] = modId;
                            Log.Info($"SPIREFORGE: loaded {entry} <- {path}");
                        }
                    }
                }
                catch (System.Exception e)
                {
                    Log.Error($"SPIREFORGE: failed to parse {path}: {e.Message}");
                }
            }
            name = dir.GetNext();
        }
        dir.ListDirEnd();
    }
}

/// <summary>Entry 派生规则（与编辑器 types.ts 中 cardEntry 完全一致）。</summary>
public static class IdHelper
{
    /// <summary>PascalCase → 大写蛇形，等价于游戏 StringHelper.Slugify（用于类型名）</summary>
    public static string Snake(string typeName) =>
        MegaCrit.Sts2.Core.Helpers.StringHelper.Slugify(typeName);

    /// <summary>packId + cardId → Entry：SNAKE(Pascal(packId) + Pascal(cardId))</summary>
    public static string EntryOf(string packId, string cardId)
    {
        string typeName = Pascal(packId) + Pascal(cardId);
        return Snake(typeName);
    }

    public static string EntryOfTypeName(string typeName) => Snake(typeName);

    /// <summary>snake/camel → Pascal</summary>
    public static string Pascal(string s)
    {
        var parts = s.Split(['_', '-', ' ', '.'], System.StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts.Select(p =>
            p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p[1..]));
    }
}
