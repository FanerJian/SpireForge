using System.Text.Json;
using MegaCrit.Sts2.Core.Localization;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>Versioned snapshot of registered models; discovery never instantiates Mod classes.</summary>
public static class SfCatalogExport
{
    private const int MaxPerKind = 4096;
    public static string CatalogPath => Path.Combine(Path.GetDirectoryName(typeof(SfCatalogExport).Assembly.Location) ?? "", "spireforge-catalog.json");
    public static void InstallDeferred(Godot.SceneTree tree, double delaySeconds) => tree.CreateTimer(delaySeconds).Timeout += Export;

    public static void Export()
    {
        string? tempPath = null;
        try
        {
            SfContentRegistry.Refresh();
            var issues = new List<string>();
            List<Dictionary<string, object?>> Read<T>(Func<T, Dictionary<string, object?>> read) where T : AbstractModel
            {
                var result = new List<Dictionary<string, object?>>();
                foreach (var model in SfContentRegistry.Models.OfType<T>())
                {
                    if (model.IsMock) continue;
                    if (result.Count >= MaxPerKind) { issues.Add(typeof(T).Name + ": catalog limit reached"); break; }
                    try
                    {
                        var data = Identity(model);
                        foreach (var pair in read(model)) data[pair.Key] = pair.Value;
                        result.Add(data);
                    }
                    catch (Exception e)
                    {
                        issues.Add(model.GetType().FullName + ": " + e.Message);
                        var data = Identity(model);
                        data["name"] = model.GetType().Name; data["title"] = model.GetType().Name;
                        data["capabilities"] = new[] { "inspect" };
                        result.Add(data);
                    }
                }
                return result;
            }

            var powers = Read<PowerModel>(p => new()
            {
                ["name"] = p.GetType().Name.EndsWith("Power", StringComparison.Ordinal) ? p.GetType().Name[..^5] : p.GetType().Name,
                ["title"] = Text(p.Title), ["description"] = Text(p.Description),
                ["type"] = p.Type.ToString().ToLowerInvariant(), ["capabilities"] = new[] { "reference", "apply_amount" },
            });
            var monsters = Read<MonsterModel>(m => new()
            {
                ["name"] = m.GetType().Name, ["title"] = Text(m.Title),
                ["hp"] = m.MinInitialHp == m.MaxInitialHp ? m.MinInitialHp.ToString() : m.MinInitialHp + "-" + m.MaxInitialHp,
                ["capabilities"] = new[] { "reference", "instance_hp" },
            });
            var cards = Read<CardModel>(c => new()
            {
                ["title"] = Safe(() => c.Title), ["description"] = Text(c.Description),
                ["type"] = c.Type.ToString(), ["rarity"] = c.Rarity.ToString(), ["target"] = c.TargetType.ToString(),
                ["cost"] = c.EnergyCost.Canonical, ["costs_x"] = c.EnergyCost.CostsX,
                ["keywords"] = c.Keywords.Select(k => k.ToString()).ToArray(),
                ["vars"] = c.DynamicVars.ToDictionary(v => v.Key, v => v.Value.BaseValue),
                ["pool"] = Safe(() => PoolKey(c.Pool)),
                ["capabilities"] = new[] { "reference", "override_fields", "preserve_behavior" },
            });
            var other = new List<Dictionary<string, object?>>();
            foreach (var model in SfContentRegistry.Models.Where(m => m is not CardModel and not PowerModel and not MonsterModel).Take(MaxPerKind))
            {
                if (model.IsMock) continue;
                var data = Identity(model);
                data["kind"] = ModelDb.GetCategory(model.GetType());
                data["name"] = model.GetType().Name;
                data["title"] = Safe(() => Display(model.GetType().GetProperty("Title")?.GetValue(model)));
                data["capabilities"] = new[] { "inspect" };
                other.Add(data);
            }
            var customs = SfEffects.Kinds.OrderBy(k => k, StringComparer.OrdinalIgnoreCase).Take(MaxPerKind).Select(kind =>
            {
                var doc = SfBuiltinEffects.Docs.TryGetValue(kind, out var d) ? d : ("", "");
                var descriptor = SfEffects.Describe(kind);
                return new { name = kind, source = SfEffects.SourceOf(kind), mod_id = descriptor?.ModId ?? "",
                    title = descriptor?.Title ?? kind, desc_zh = descriptor?.Description ?? doc.Item1, desc_en = doc.Item2,
                    parameters = descriptor?.Parameters ?? [], allowed_triggers = descriptor?.AllowedTriggers ?? [],
                    required_character = descriptor?.RequiredCharacter ?? "" };
            }).ToArray();
            var modsRoot = Path.GetDirectoryName(Path.GetDirectoryName(typeof(SfCatalogExport).Assembly.Location)) ?? "";
            var vfx = SfVfx.BuiltIn.Concat(SfVfx.ModScenes(modsRoot)).Take(MaxPerKind)
                .Select(v => new { name = v.Name, path = v.Path, source = v.Source }).ToArray();
            var catalog = new
            {
                format_version = 2, runtime_version = "0.1.16", game_version = typeof(ModelDb).Assembly.GetName().Version?.ToString() ?? "",
                session_id = SfContentRegistry.SessionId, generated_at_utc = DateTime.UtcNow.ToString("O"),
                language = LocManager.Instance?.Language ?? "", mods = SfContentRegistry.Mods,
                powers, monsters, cards, models = other, custom_effects = customs, vfx, issues,
            };
            var options = new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
            var json = JsonSerializer.Serialize(catalog, options);
            tempPath = CatalogPath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(tempPath, json, new System.Text.UTF8Encoding(false));
            File.Move(tempPath, CatalogPath, true);
            tempPath = null;
            SfLog.Info($"catalog: exported {powers.Count} powers, {monsters.Count} monsters, {cards.Count} cards, {other.Count} other models; {issues.Count} issue(s)");
        }
        catch (Exception e)
        {
            SfLog.Error("catalog export failed: " + e);
            if (tempPath != null) { try { File.Delete(tempPath); } catch (Exception) { } }
        }
    }

    private static Dictionary<string, object?> Identity(AbstractModel model)
    {
        var type = model.GetType(); var mod = SfContentRegistry.Owner(type);
        return new() { ["key"] = SfContentRegistry.Key(type), ["entry"] = model.Id.Entry, ["model_id"] = model.Id.ToString(),
            ["class_name"] = type.Name, ["type_name"] = type.FullName ?? "", ["source"] = type.Assembly.GetName().Name ?? "",
            ["mod_id"] = mod?.Id ?? (type.Assembly == typeof(ModelDb).Assembly ? "sts2" : ""),
            ["mod_name"] = mod?.Name ?? "", ["mod_version"] = mod?.Version ?? "", ["workshop_id"] = mod?.WorkshopId };
    }
    private static string PoolKey(CardPoolModel pool)
    {
        if (pool.GetType().Assembly != typeof(ModelDb).Assembly) return SfContentRegistry.Key(pool.GetType());
        return pool.GetType().Name.Replace("CardPool", "", StringComparison.Ordinal).ToLowerInvariant();
    }
    private static string Display(object? value) => value is LocString loc ? Text(loc) : value?.ToString() ?? "";
    private static string Text(LocString? value) => Safe(() => value != null && value.Exists() ? value.GetRawText() ?? "" : "");
    private static string Safe(Func<string> read) { try { return read(); } catch (Exception) { return ""; } }
}
