using System.Reflection;
using System.Reflection.Emit;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.CardPools;
using SpireForge.Runtime;

var assertions = 0;
void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    assertions++;
}

var legacyPools = new Dictionary<string, Type>
{
    ["colorless"] = typeof(ColorlessCardPool), ["curse"] = typeof(CurseCardPool),
    ["status"] = typeof(StatusCardPool), ["ironclad"] = typeof(IroncladCardPool),
    ["silent"] = typeof(SilentCardPool), ["regent"] = typeof(RegentCardPool),
    ["necrobinder"] = typeof(NecrobinderCardPool), ["defect"] = typeof(DefectCardPool),
};
foreach (var (key, type) in legacyPools)
{
    Check(SfPoolRegistry.Resolve(key) == type, "Legacy pool resolution " + key);
    Check(SfPoolRegistry.PoolKeyFor(type) == key, "Legacy pool export " + key);
    Check(SfPoolRegistry.IsLegacyPool(type), "Legacy pool identification " + key);
}

var future = typeof(FutureGameCardPool);
var futureKey = SfPoolRegistry.KeyOf(SfPoolRegistry.GameModId, future.FullName!);
SfPoolRegistry.Refresh([]);
Check(SfPoolRegistry.Resolve(futureKey) == future, "Additional game pool resolves without Mods");
Check(SfPoolRegistry.PoolKeyFor(future) == futureKey, "Additional game pool exports exact identity");
Check(!SfPoolRegistry.IsLegacyPool(future), "Additional game pool enters the dynamic catalog");
Check(SfPoolRegistry.TryGetModForPool(future, out var game) && game?.Id == "sts2"
    && game.WorkshopId == null, "Game identity has no Workshop dependency");
Check(SfPoolRegistry.Resolve(null) == null, "Null pool reports an unavailable identity");
Check(SfPoolRegistry.Resolve("mod:sts2:Missing.FuturePool", out var failure) == null
    && !string.IsNullOrEmpty(failure), "Newer game pool on older game reports an explanation");
Check(SfPoolRegistry.Resolve(SfPoolRegistry.KeyOf("sts2", typeof(AbstractGameCardPool).FullName!)) == null,
    "Abstract game pool rejected");
Check(SfPoolRegistry.Resolve(SfPoolRegistry.KeyOf("sts2", typeof(string).FullName!)) == null,
    "Game identity cannot resolve external framework types");

var modPool = ExternalPool("Example.Pools.MainPool");
var external = new SfPoolMod("Example", "Example", "1234", [modPool]);
var modKey = SfPoolRegistry.KeyOf("Example", modPool.FullName!);
SfPoolRegistry.Refresh([external]);
Check(SfPoolRegistry.Resolve(modKey) == modPool, "Third-party pool resolution");
Check(SfPoolRegistry.PoolKeyFor(modPool) == modKey, "Third-party export round trip");
Check(SfPoolRegistry.LoadedModIds.SequenceEqual(["Example"]), "Existing loaded Mod IDs stay stable");
Check(SfPoolRegistry.Resolve(futureKey) == future, "Game pool resolution coexists with Mod pools");

var spoof = new SfPoolMod("sts2", "Spoof", "9999", [modPool, ExternalPool(future.FullName!)]);
SfPoolRegistry.Refresh([external, spoof]);
Check(SfPoolRegistry.Resolve(futureKey) == future, "Game assembly identity overrides a spoofed Mod identity");
Check(SfPoolRegistry.Resolve(SfPoolRegistry.KeyOf("sts2", modPool.FullName!)) == null,
    "Reserved game identity rejects third-party pool types");
Check(SfPoolRegistry.LoadedModIds.SequenceEqual(["Example"]), "Reserved game identity is excluded from Mod IDs");

SfPoolRegistry.Refresh([external, external]);
Check(SfPoolRegistry.Resolve(modKey, out failure) == null && failure?.Contains("ambiguous") == true,
    "Duplicate Mod identities retain ambiguity checks");
var duplicatePool = ExternalPool(modPool.FullName!);
SfPoolRegistry.Refresh([external with { Types = [modPool, duplicatePool] }]);
Check(SfPoolRegistry.Resolve(modKey) == null, "Duplicate pool type names retain ambiguity checks");
SfPoolRegistry.Refresh([]);
Check(SfPoolRegistry.Resolve(modKey) == null, "Unavailable Mod pool stays unavailable");
Console.WriteLine($"PoolRegistryRegression PASS {assertions} assertions");

static Type ExternalPool(string fullName)
{
    var assembly = AssemblyBuilder.DefineDynamicAssembly(new AssemblyName("PoolRegression_" + Guid.NewGuid().ToString("N")),
        AssemblyBuilderAccess.Run);
    var module = assembly.DefineDynamicModule("Pools");
    return module.DefineType(fullName, TypeAttributes.Public | TypeAttributes.Class, typeof(CardPoolModel)).CreateType()!;
}

public class FutureGameCardPool : CardPoolModel { }
public abstract class AbstractGameCardPool : CardPoolModel { }
