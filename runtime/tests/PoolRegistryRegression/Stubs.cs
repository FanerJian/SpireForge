using System.Reflection;

namespace MegaCrit.Sts2.Core.Models
{
    public abstract class CardPoolModel { }
}

namespace MegaCrit.Sts2.Core.Models.CardPools
{
    public class ColorlessCardPool : CardPoolModel { }
    public class CurseCardPool : CardPoolModel { }
    public class StatusCardPool : CardPoolModel { }
    public class IroncladCardPool : CardPoolModel { }
    public class SilentCardPool : CardPoolModel { }
    public class RegentCardPool : CardPoolModel { }
    public class NecrobinderCardPool : CardPoolModel { }
    public class DefectCardPool : CardPoolModel { }
}

namespace MegaCrit.Sts2.Core.Logging
{
    public static class Log
    {
        public static void Warn(string message) => Console.WriteLine(message);
    }
}

namespace MegaCrit.Sts2.Core.Modding
{
    public sealed class Manifest
    {
        public string? id;
        public string? name;
    }
    public sealed class Mod
    {
        public Manifest? manifest;
        public ulong? workshopId;
        public List<Assembly> assemblies = [];
    }
    public static class ModManager
    {
        public static IEnumerable<Mod> GetLoadedMods() => [];
    }
}
