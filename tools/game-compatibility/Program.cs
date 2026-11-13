using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

if (args.Length == 0 || args.Contains("--help"))
{
    Console.WriteLine("Usage: GameCompatibility --game-dir <directory> --output <report.json>");
    return 0;
}

try
{
    var options = ParseOptions(args);
    var gameDirectory = Path.GetFullPath(Required(options, "--game-dir"));
    var output = Path.GetFullPath(Required(options, "--output"));
    if (output.Equals(gameDirectory, StringComparison.OrdinalIgnoreCase)
        || output.StartsWith(Path.TrimEndingDirectorySeparator(gameDirectory) + Path.DirectorySeparatorChar,
            StringComparison.OrdinalIgnoreCase))
        throw new ArgumentException("Report output must be outside the game directory.");

    var dataDirectory = Path.Combine(gameDirectory, "data_sts2_windows_x86_64");
    var gameAssembly = Path.Combine(dataDirectory, "sts2.dll");
    var runtimeDirectory = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
    var assemblyPaths = Directory.GetFiles(runtimeDirectory, "*.dll")
        .Concat(Directory.GetFiles(dataDirectory, "*.dll"))
        .DistinctBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase);
    using var context = new MetadataLoadContext(new PathAssemblyResolver(assemblyPaths));
    var game = context.LoadFromAssemblyPath(gameAssembly);
    var checks = new List<ApiCheck>();

    const string models = "MegaCrit.Sts2.Core.Models.";
    const string commands = "MegaCrit.Sts2.Core.Commands.";
    const string choice = "MegaCrit.Sts2.Core.GameActions.Multiplayer.PlayerChoiceContext";
    const string card = models + "CardModel";
    const string creature = "MegaCrit.Sts2.Core.Entities.Creatures.Creature";
    const string play = "MegaCrit.Sts2.Core.Entities.Cards.CardPlay";
    const BindingFlags allMembers = BindingFlags.Public | BindingFlags.NonPublic
        | BindingFlags.Static | BindingFlags.Instance;

    Type TypeOf(string name) => game.GetType(name, throwOnError: true)!;

    void Method(string typeName, string name, string returns, params string[] parameters)
    {
        var methods = TypeOf(typeName).GetMethods(allMembers).Where(m => m.Name == name).ToArray();
        var passed = methods.Length == 1 && NameOf(methods[0].ReturnType) == returns
            && methods[0].GetParameters().Select(Parameter).SequenceEqual(parameters);
        checks.Add(new(typeName + "." + name, passed,
            returns + " (" + string.Join(", ", parameters) + ")",
            methods.Select(Signature).ToArray()));
    }

    void Field(string typeName, string name, string expectedType)
    {
        var field = TypeOf(typeName).GetField(name, allMembers);
        checks.Add(new(typeName + "." + name, field != null && NameOf(field.FieldType) == expectedType,
            expectedType, field == null ? [] : [NameOf(field.FieldType)]));
    }

    Method(models + "ModelDb", "Init", "System.Void", "System.Type[] injectedModelTypes");
    Method("MegaCrit.Sts2.Core.Modding.AssemblyInfo", "Init", "System.Void");
    Method("MegaCrit.Sts2.Core.Helpers.OneTimeInitialization", "ExecuteEssential", "System.Void");
    Method("MegaCrit.Sts2.Core.Hooks.Hook", "BeforeCombatStart", "System.Threading.Tasks.Task",
        "MegaCrit.Sts2.Core.Runs.IRunState runState", "MegaCrit.Sts2.Core.Combat.ICombatState combatState");
    Method(card, "OnPlay", "System.Threading.Tasks.Task", choice + " choiceContext", play + " cardPlay");
    Method(card, "OnUpgrade", "System.Void");
    Method(card, "OnTurnEndInHand", "System.Threading.Tasks.Task", choice + " choiceContext");
    Method(models + "AbstractModel", "AfterCardDrawn", "System.Threading.Tasks.Task",
        choice + " choiceContext", card + " card", "System.Boolean fromHandDraw");
    Method(models + "AbstractModel", "AfterCardDiscarded", "System.Threading.Tasks.Task",
        choice + " choiceContext", card + " card");
    Method(models + "AbstractModel", "AfterCardExhausted", "System.Threading.Tasks.Task",
        choice + " choiceContext", card + " card", "System.Boolean causedByEthereal");
    Method(models + "AbstractModel", "BeforeCombatStart", "System.Threading.Tasks.Task");
    Method(card, "get_HasTurnEndInHandEffect", "System.Boolean");
    Method(card, "get_PortraitPath", "System.String");
    Method(models + "MonsterModel", "get_Title", "MegaCrit.Sts2.Core.Localization.LocString");
    Method(models + "PowerModel", "get_Icon", "Godot.Texture2D");
    Method(models + "PowerModel", "get_BigIcon", "Godot.Texture2D");

    Field(card, "_energyCost", "MegaCrit.Sts2.Core.Entities.Cards.CardEnergyCost");
    Field(card, "_keywords", "System.Collections.Generic.HashSet`1<MegaCrit.Sts2.Core.Entities.Cards.CardKeyword>");
    Field(card, "_dynamicVars", "MegaCrit.Sts2.Core.Localization.DynamicVars.DynamicVarSet");
    foreach (var (name, typeName) in new[]
    {
        ("CanonicalEnergyCost", "System.Int32"), ("Type", "MegaCrit.Sts2.Core.Entities.Cards.CardType"),
        ("Rarity", "MegaCrit.Sts2.Core.Entities.Cards.CardRarity"),
        ("TargetType", "MegaCrit.Sts2.Core.Entities.Cards.TargetType")
    })
        Field(card, "<" + name + ">k__BackingField", typeName);

    var apply = TypeOf(commands + "PowerCmd").GetMethods(BindingFlags.Public | BindingFlags.Static)
        .Where(m => m.Name == "Apply" && m.IsGenericMethodDefinition && m.GetParameters().Length == 6
            && NameOf(m.GetParameters()[1].ParameterType) == creature).ToArray();
    var applyParameters = new[] { choice + " choiceContext", creature + " target", "System.Decimal amount",
        creature + " applier", card + " cardSource", "System.Boolean silent" };
    checks.Add(new(commands + "PowerCmd.Apply<T> (single target)", apply.Length == 1
        && apply[0].GetParameters().Select(Parameter).SequenceEqual(applyParameters),
        "(" + string.Join(", ", applyParameters) + ")", apply.Select(Signature).ToArray()));

    var allTypes = game.GetTypes();
    var poolType = TypeOf(models + "CardPoolModel");
    var pools = allTypes.Where(t => poolType.IsAssignableFrom(t) && !t.IsAbstract && !t.IsGenericType)
        .Select(t => t.FullName).Order().ToArray();
    var commandTypes = new[] { "CreatureCmd", "DamageCmd", "CardCmd", "CardPileCmd", "PlayerCmd" }
        .Select(name => TypeOf(commands + name))
        .Append(TypeOf(commands + "Builders.AttackCommand"));
    var commandApi = commandTypes.ToDictionary(t => t.FullName!, t => t
        .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly)
        .Select(Signature).Order().ToArray());
    var enums = new[] { "CardType", "CardRarity", "TargetType", "CardKeyword" }
        .Select(name => TypeOf("MegaCrit.Sts2.Core.Entities.Cards." + name))
        .Append(TypeOf("MegaCrit.Sts2.Core.ValueProps.ValueProp"))
        .ToDictionary(t => t.FullName!, t => t.GetFields(BindingFlags.Public | BindingFlags.Static)
            .Select(field => field.Name).ToArray());

    var releasePath = Path.Combine(gameDirectory, "release_info.json");
    using var release = File.Exists(releasePath) ? JsonDocument.Parse(File.ReadAllText(releasePath)) : null;
    var steamapps = Directory.GetParent(gameDirectory)?.Parent?.FullName;
    var manifestPath = steamapps == null ? "" : Path.Combine(steamapps, "appmanifest_2868840.acf");
    var manifest = File.Exists(manifestPath) ? File.ReadAllText(manifestPath) : "";
    string? ManifestValue(string name) => Regex.Match(manifest,
        "\"" + Regex.Escape(name) + "\"\\s+\"([^\"]*)\"").Groups[1] is { Success: true } match
        ? match.Value : null;

    var report = new
    {
        generatedAtUtc = DateTimeOffset.UtcNow,
        gameDirectory,
        releaseInfo = release?.RootElement.Clone(),
        steam = new { manifestPath, buildId = ManifestValue("buildid"), branch = ManifestValue("BetaKey"),
            lastUpdatedUnix = ManifestValue("LastUpdated") },
        assemblies = new[] { "sts2.dll", "0Harmony.dll", "GodotSharp.dll" }
            .Select(name => AssemblyInfo(Path.Combine(dataDirectory, name))).ToArray(),
        passed = checks.All(c => c.Passed),
        checks,
        cardPools = pools,
        gameModeTypes = allTypes.Where(t => t.Name.Contains("Blitz", StringComparison.OrdinalIgnoreCase)
                || t.Name.Contains("Dread", StringComparison.OrdinalIgnoreCase))
            .Select(t => t.FullName).Order().ToArray(),
        enums,
        commandApi,
        verificationScope = "Assembly metadata and reflection contracts. In-game validation is a separate verification stage."
    };
    Directory.CreateDirectory(Path.GetDirectoryName(output)!);
    File.WriteAllText(output, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
    Console.WriteLine($"API checks {checks.Count(c => c.Passed)}/{checks.Count}. Report {output}");
    foreach (var check in checks.Where(c => !c.Passed))
        Console.WriteLine($"MISMATCH {check.Member}\n  expected {check.Expected}\n  observed {string.Join(" | ", check.Observed)}");
    return report.passed ? 0 : 1;
}
catch (Exception error)
{
    Console.Error.WriteLine(error);
    return 2;
}

static Dictionary<string, string> ParseOptions(string[] arguments)
{
    if (arguments.Length % 2 != 0) throw new ArgumentException("Each option requires a value.");
    var result = new Dictionary<string, string>(StringComparer.Ordinal);
    for (var index = 0; index < arguments.Length; index += 2)
    {
        var name = arguments[index];
        if (name is not ("--game-dir" or "--output") || !result.TryAdd(name, arguments[index + 1]))
            throw new ArgumentException("Unknown or repeated option " + name);
    }
    return result;
}

static string Required(Dictionary<string, string> options, string name) =>
    options.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value)
        ? value : throw new ArgumentException("Missing option " + name);

static string NameOf(Type type)
{
    if (type.IsGenericType)
        return type.GetGenericTypeDefinition().FullName + "<" + string.Join(",", type.GetGenericArguments().Select(NameOf)) + ">";
    return type.FullName ?? type.Name;
}

static string Parameter(ParameterInfo parameter) => NameOf(parameter.ParameterType) + " " + parameter.Name;
static string Signature(MethodInfo method) => NameOf(method.ReturnType) + " " + method.Name
    + "(" + string.Join(", ", method.GetParameters().Select(Parameter)) + ")";

static object AssemblyInfo(string path)
{
    var file = new FileInfo(path);
    var version = FileVersionInfo.GetVersionInfo(path);
    using var stream = File.OpenRead(path);
    return new { path, bytes = file.Length, lastWriteTimeUtc = file.LastWriteTimeUtc,
        assemblyVersion = AssemblyName.GetAssemblyName(path).Version?.ToString(),
        fileVersion = version.FileVersion, productVersion = version.ProductVersion,
        sha256 = Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant() };
}

record ApiCheck(string Member, bool Passed, string Expected, string[] Observed);
