// Controlled filesystem and game boundaries for the production pack scanner.
namespace Godot
{
    public sealed class FileAccess(string path) : IDisposable
    {
        public enum ModeFlags { Read }
        public static Dictionary<string, (ulong Length, string Text)> Files { get; } = [];
        public static Dictionary<string, int> OpenCounts { get; } = [];
        public static HashSet<string> TextReads { get; } = [];

        public static FileAccess Open(string path, ModeFlags mode)
        {
            var count = OpenCounts.GetValueOrDefault(path) + 1;
            OpenCounts[path] = count;
            // A repeated open terminates a broken scan so the regression fails promptly.
            if (count > 1) throw new InvalidOperationException("Repeated card file inspection");
            return new(path);
        }
        public ulong GetLength() => Files[path].Length;
        public string GetAsText()
        {
            TextReads.Add(path);
            return Files[path].Text;
        }
        public void Dispose() { }
    }

    public sealed class DirAccess(string path) : IDisposable
    {
        private readonly string[] names = FileAccess.Files.Keys
            .Where(key => key.StartsWith(path + "/", StringComparison.Ordinal))
            .Select(key => key[(path.Length + 1)..]).ToArray();
        private int next;
        public static bool DirExistsAbsolute(string path) => path == "res://TestPack/cards";
        public static DirAccess Open(string path) => new(path);
        public void ListDirBegin() => next = 0;
        public string GetNext() => next < names.Length ? names[next++] : "";
        public bool CurrentIsDir() => false;
        public void ListDirEnd() { }
        public void Dispose() { }
    }
}

namespace MegaCrit.Sts2.Core.Entities.Cards
{
    public enum CardType { Attack, Skill }
    public enum CardRarity { Common }
    public enum TargetType { AnyEnemy }
    public enum CardKeyword { Unplayable }
}

namespace MegaCrit.Sts2.Core.Modding
{
    public sealed class Manifest { public string id = "TestPack"; }
    public sealed class Mod { public Manifest manifest = new(); }
    public static class ModManager { public static IEnumerable<Mod> GetLoadedMods() => [new()]; }
}

namespace MegaCrit.Sts2.Core.Logging
{
    public static class Log
    {
        public static List<string> Errors { get; } = [];
        public static void Info(string message) { }
        public static void Warn(string message) { }
        public static void Error(string message) => Errors.Add(message);
    }
}

namespace MegaCrit.Sts2.Core.Helpers
{
    public static class StringHelper { public static string Slugify(string text) => text.ToUpperInvariant(); }
}

namespace SpireForge.Api
{
    public static class SfLog
    {
        public static void Info(string message) { }
        public static void Error(string message) => MegaCrit.Sts2.Core.Logging.Log.Error(message);
    }
}

namespace SpireForge.Runtime
{
    public static class SfPngLoader
    {
        public static void ResetNamespaces() { }
        public static void AllowNamespace(string modId) { }
    }
    public static class SfVanillaOverride { public static bool Collect(SfCardDef definition, string modId) => true; }
}
