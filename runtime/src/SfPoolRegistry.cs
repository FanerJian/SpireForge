using System.Reflection;
using System.Runtime.Loader;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Models;

namespace SpireForge.Runtime;

/// <summary>Loaded mod information needed to resolve and describe third-party card pools.</summary>
public sealed record SfPoolMod(string Id, string Name, string? WorkshopId, IReadOnlyList<Type> Types);

/// <summary>Stable data contract used by editor integrations; workshop IDs stay strings to avoid JS precision loss.</summary>
public sealed record SfPoolCatalogEntry(
    string Key,
    string Label,
    string ModId,
    string TypeName,
    string? WorkshopId);

/// <summary>
/// Exact resolver for mod-defined card pools. The pure overloads make the matching rules usable in a stub harness
/// without reading assemblies from disk or invoking any constructors.
/// </summary>
public static class SfPoolRegistry
{
    private const string LogTag = "SPIREFORGE";
    private static readonly Dictionary<string, List<SfPoolMod>> ModsById = new(StringComparer.Ordinal);
    private static readonly Dictionary<string, List<(SfPoolMod Mod, Type Type)>> PoolsByKey = new(StringComparer.Ordinal);

    public static void Refresh()
    {
        var mods = new List<SfPoolMod>();
        foreach (var mod in ModManager.GetLoadedMods())
        {
            string? id = mod.manifest?.id;
            if (string.IsNullOrEmpty(id))
                continue;

            var types = new List<Type>();
            foreach (Assembly assembly in mod.assemblies)
            {
                try
                {
                    types.AddRange(assembly.GetTypes());
                }
                catch (ReflectionTypeLoadException e)
                {
                    types.AddRange(e.Types.OfType<Type>());
                    Log.Warn($"{LogTag}: some types in mod '{id}' could not be loaded while scanning card pools");
                }
                catch (Exception e)
                {
                    Log.Warn($"{LogTag}: could not scan assembly '{assembly.FullName}' for mod '{id}' card pools: {e.Message}");
                }
            }

            mods.Add(new SfPoolMod(
                id,
                mod.manifest?.name ?? id,
                mod.workshopId?.ToString(System.Globalization.CultureInfo.InvariantCulture),
                types));
        }

        Refresh(mods);
    }

    /// <summary>Refresh from already loaded type metadata; no scanning or model construction occurs here.</summary>
    public static void Refresh(IEnumerable<SfPoolMod> mods)
    {
        ModsById.Clear();
        PoolsByKey.Clear();

        foreach (SfPoolMod mod in mods)
        {
            if (string.IsNullOrEmpty(mod.Id))
                continue;
            if (!ModsById.TryGetValue(mod.Id, out var sameId))
                ModsById[mod.Id] = sameId = new List<SfPoolMod>();
            sameId.Add(mod);

            foreach (Type type in mod.Types.Distinct())
            {
                string? fullName = type.FullName;
                if (string.IsNullOrEmpty(fullName))
                    continue;
                string key = KeyOf(mod.Id, fullName);
                if (!PoolsByKey.TryGetValue(key, out var matches))
                    PoolsByKey[key] = matches = new List<(SfPoolMod, Type)>();
                matches.Add((mod, type));
            }
        }
    }

    public static Type? Resolve(string key, out string? failure)
    {
        failure = null;
        if (!TryParseKey(key, out string modId, out string typeName))
        {
            failure = "expected mod:<mod_id>:<Namespace.TypeName>";
            return null;
        }
        if (!ModsById.TryGetValue(modId, out var mods))
        {
            failure = $"loaded mod '{modId}' was not found";
            return null;
        }
        if (mods.Count != 1)
        {
            failure = $"loaded mod id '{modId}' is ambiguous";
            return null;
        }

        string fullKey = KeyOf(modId, typeName);
        if (!PoolsByKey.TryGetValue(fullKey, out var candidates) || candidates.Count == 0)
        {
            failure = $"type '{typeName}' was not found in mod '{modId}' assemblies";
            return null;
        }
        if (candidates.Count != 1)
        {
            failure = $"type '{typeName}' is ambiguous in mod '{modId}' assemblies";
            return null;
        }
        if (!IsSupportedPoolType(candidates[0].Type))
        {
            failure = $"type '{typeName}' is not a concrete non-generic CardPoolModel";
            return null;
        }
        return candidates[0].Type;
    }

    public static Type? Resolve(string key) => Resolve(key, out _);

    public static bool TryGetModForPool(Type type, out SfPoolMod? mod)
    {
        mod = null;
        string? fullName = type.FullName;
        if (string.IsNullOrEmpty(fullName)) return false;

        var matches = PoolsByKey.Values
            .SelectMany(items => items)
            .Where(item => item.Type == type)
            .ToArray();
        if (matches.Length != 1 || !ModsById.TryGetValue(matches[0].Mod.Id, out var sameId) || sameId.Count != 1)
            return false;
        mod = matches[0].Mod;
        return true;
    }

    public static IReadOnlyList<string> LoadedModIds => ModsById
        .Select(pair => pair.Key)
        .OrderBy(id => id, StringComparer.Ordinal)
        .ToArray();

    public static string KeyOf(string modId, string typeName) => $"mod:{modId}:{typeName}";

    public static bool TryParseKey(string? key, out string modId, out string typeName)
    {
        modId = "";
        typeName = "";
        if (key == null || !key.StartsWith("mod:", StringComparison.Ordinal)) return false;
        int split = key.IndexOf(':', 4);
        if (split <= 4 || split == key.Length - 1) return false;
        modId = key[4..split];
        typeName = key[(split + 1)..];
        return IsValidModId(modId) && IsValidTypeName(typeName);
    }

    private static bool IsValidModId(string value) =>
        value.Length is > 0 and <= 128 &&
        value.All(c => char.IsAsciiLetterOrDigit(c) || c is '_' or '.' or '-');

    private static bool IsValidTypeName(string value) =>
        value.Length is > 0 and <= 512 &&
        value.Split('.', '+').All(segment => segment.Length > 0 &&
            (char.IsAsciiLetter(segment[0]) || segment[0] == '_') &&
            segment.All(c => char.IsAsciiLetterOrDigit(c) || c == '_'));

    private static bool IsSupportedPoolType(Type type) =>
        type.IsClass && !type.IsAbstract && !type.IsGenericType && !type.ContainsGenericParameters &&
        typeof(CardPoolModel).IsAssignableFrom(type);
}
