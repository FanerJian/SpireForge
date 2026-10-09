using System.Reflection;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

public sealed record SfContentMod(string Id, string Name, string Version, string? WorkshopId);

/// <summary>Canonical registered models only. Never constructs third-party types to discover content.</summary>
public static class SfContentRegistry
{
    private static AbstractModel[] models = [];
    private static readonly Dictionary<Assembly, List<SfContentMod>> owners = new();
    private static readonly Dictionary<string, List<AbstractModel>> exact = new(StringComparer.Ordinal);
    public static IReadOnlyList<AbstractModel> Models => models;
    public static IReadOnlyList<SfContentMod> Mods { get; private set; } = [];
    public static string SessionId { get; } = Guid.NewGuid().ToString("N");

    public static void Refresh()
    {
        owners.Clear();
        exact.Clear();
        var mods = new List<SfContentMod>();
        foreach (var mod in ModManager.GetLoadedMods())
        {
            if (string.IsNullOrEmpty(mod.manifest?.id)) continue;
            var info = new SfContentMod(mod.manifest.id, mod.manifest.name ?? mod.manifest.id,
                mod.manifest.version ?? mod.version?.ToString() ?? "", mod.workshopId?.ToString(System.Globalization.CultureInfo.InvariantCulture));
            mods.Add(info);
            foreach (var assembly in mod.assemblies.Distinct())
            {
                if (!owners.TryGetValue(assembly, out var list)) owners[assembly] = list = [];
                list.Add(info);
            }
        }
        Mods = mods.OrderBy(m => m.Id, StringComparer.Ordinal).ToArray();
        models = ModelDb.All.ToArray();
        foreach (var model in models)
        {
            var key = Key(model.GetType());
            if (key.Length == 0) continue;
            if (!exact.TryGetValue(key, out var list)) exact[key] = list = [];
            list.Add(model);
        }
    }

    public static SfContentMod? Owner(Type type)
    {
        // Reflection.Emit's AssemblyBuilder and Type.Assembly have different object identities.
        // JSON cards belong to their actual pack, rather than the shared runtime assembly.
        if (typeof(SfCardBase).IsAssignableFrom(type)
            && PackLoader.PackOf.TryGetValue(ModelDb.GetId(type).Entry, out var packId))
        {
            var matches = Mods.Where(m => m.Id == packId).ToArray();
            if (matches.Length == 1) return matches[0];
        }
        if (type.Assembly == Emit.EmitCardFactory.RuntimeAssembly)
        {
            var runtime = Mods.Where(m => m.Id == "SpireForgeRuntime").ToArray();
            if (runtime.Length == 1) return runtime[0];
        }
        return owners.TryGetValue(type.Assembly, out var list)
            && list.Count == 1 && Mods.Count(m => m.Id == list[0].Id) == 1 ? list[0] : null;
    }

    public static string Key(Type type)
    {
        if (type.Assembly == typeof(ModelDb).Assembly) return "game:" + type.FullName;
        var mod = Owner(type);
        return mod == null ? "" : $"mod:{mod.Id}:{type.FullName}";
    }

    public static bool IsExact(string value) => value.StartsWith("mod:", StringComparison.Ordinal)
        || value.StartsWith("game:", StringComparison.Ordinal);

    public static T? Find<T>(string value) where T : AbstractModel
    {
        if (models.Length == 0) Refresh();
        value = value.Trim();
        if (IsExact(value))
        {
            if (exact.TryGetValue(value, out var matches) && matches.Count == 1 && matches[0] is T found) return found;
            SfLog.Error("content reference unavailable or ambiguous: " + value);
            return null;
        }
        // Legacy aliases remain usable only when unambiguous. Exact game names take precedence
        // so an unrelated Mod cannot change the behavior of an existing vanilla card pack.
        var candidates = models.OfType<T>().Where(m => AliasMatches(m, value)).ToArray();
        var vanilla = candidates.Where(m => m.GetType().Assembly == typeof(ModelDb).Assembly).ToArray();
        if (vanilla.Length == 1) return vanilla[0];
        if (candidates.Length == 1) return candidates[0];
        if (candidates.Length > 1) SfLog.Error("ambiguous legacy content name; select a qualified reference: " + value);
        return null;
    }

    private static bool AliasMatches(AbstractModel model, string value)
    {
        var type = model.GetType();
        var name = type.Name;
        var shortName = model is PowerModel && name.EndsWith("Power", StringComparison.Ordinal) ? name[..^5]
            : model is OrbModel && name.EndsWith("Orb", StringComparison.Ordinal) ? name[..^3] : name;
        return new[] { name, shortName, type.FullName ?? "", model.Id.Entry, model.Id.ToString() }
            .Any(alias => string.Equals(alias, value, StringComparison.OrdinalIgnoreCase));
    }
}
