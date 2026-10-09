using System.Reflection;
using System.Text.Json;
using MegaCrit.Sts2.Core.Entities.Creatures;
using MegaCrit.Sts2.Core.Entities.Players;
using MegaCrit.Sts2.Core.GameActions.Multiplayer;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Models;
using SpireForge.Api;

namespace SpireForge.Runtime;

/// <summary>Opt-in declarative adapters for public async commands in loaded Mods.
/// New integrations may ship spireforge-actions.json without rebuilding this runtime.</summary>
public static class SfModActions
{
    private sealed record Manifest(int FormatVersion, ActionDef[] Actions);
    private sealed record ActionDef(string Name, string Title, string Description, string TypeName, string Method,
        SfEffectParameter[] Parameters, string[]? AllowedTriggers = null, string? RequiredCharacter = null);
    private static readonly JsonSerializerOptions Options = new()
        { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, PropertyNameCaseInsensitive = true };
    private static readonly HashSet<string> Loaded = new(StringComparer.Ordinal);

    public static void RegisterLoaded()
    {
        foreach (var mod in ModManager.GetLoadedMods())
        {
            var id = mod.manifest?.id;
            if (string.IsNullOrEmpty(id) || !Loaded.Add(id)) continue;
            var path = Path.Combine(mod.path, "spireforge-actions.json");
            if (File.Exists(path))
            {
                try
                {
                    if (new FileInfo(path).Length > 1024 * 1024) throw new InvalidDataException("Action manifest exceeds 1 MB");
                    var manifest = JsonSerializer.Deserialize<Manifest>(File.ReadAllText(path), Options);
                    if (manifest?.FormatVersion != 1 || manifest.Actions == null || manifest.Actions.Length > 256)
                        throw new InvalidDataException("Unsupported action manifest");
                    foreach (var action in manifest.Actions)
                    {
                        try { Register(mod, action); } catch (Exception e) { SfLog.Warn($"adapter {id}/{action.Name}: {e.Message}"); }
                    }
                }
                catch (Exception e) { SfLog.Warn($"adapter {id}: {e.Message}"); }
            }
            if (id == "Watcher")
            {
                foreach (var (name, title, method) in new[] {
                    ("enter_wrath", "进入愤怒", "EnterWrath"), ("enter_calm", "进入平静", "EnterCalm"),
                    ("enter_divinity", "进入神格", "EnterDivinity"), ("exit_stance", "退出姿态", "ExitStance") })
                {
                    if (SfEffects.IsRegistered($"effect:Watcher:{name}")) continue;
                    try { Register(mod, new(name, title, "调用观者 Mod 的原生姿态命令。", "Watcher.Code.Commands.StanceCmd", method,
                        [], null, "Watcher.Code.Character.Watcher")); }
                    catch (Exception e) { SfLog.Warn($"Watcher adapter {name}: {e.Message}"); }
                }
            }
        }
    }

    private static void Register(Mod mod, ActionDef action)
    {
        var types = mod.assemblies.Select(a => a.GetType(action.TypeName, false)).OfType<Type>().Distinct().ToArray();
        if (types.Length != 1) throw new InvalidOperationException("Command type is unavailable or ambiguous: " + action.TypeName);
        var methods = types[0].GetMethods(BindingFlags.Public | BindingFlags.Static)
            .Where(m => m.Name == action.Method && !m.ContainsGenericParameters && typeof(Task).IsAssignableFrom(m.ReturnType)).ToArray();
        if (methods.Length != 1) throw new InvalidOperationException("A single public async command is required: " + action.Method);
        var method = methods[0];
        var parameters = action.Parameters ?? [];
        if (parameters.Select(p => p.Name).Distinct().Count() != parameters.Length) throw new InvalidDataException("Duplicate action parameters");
        foreach (var argument in method.GetParameters())
        {
            if (IsContext(argument.ParameterType)) continue;
            var parameter = parameters.SingleOrDefault(p => p.Name == argument.Name);
            if (parameter == null || !IsValue(argument.ParameterType))
                throw new InvalidOperationException("Unsupported command argument: " + argument.Name);
        }
        var descriptor = new SfEffectDescriptor(mod.manifest!.id!, action.Name, action.Title, action.Description,
            parameters, action.AllowedTriggers, action.RequiredCharacter);
        SfEffects.Register(descriptor, async ctx =>
        {
            var args = method.GetParameters().Select(p => Argument(p, parameters, ctx)).ToArray();
            await (Task)(method.Invoke(null, args) ?? throw new InvalidOperationException("Command returned no Task"));
        });
    }

    private static bool IsContext(Type type) => type == typeof(PlayerChoiceContext) || type == typeof(Player)
        || type == typeof(CardModel) || type == typeof(Creature);
    private static bool IsValue(Type type) => type == typeof(string) || type == typeof(bool) || type == typeof(int)
        || type == typeof(float) || type == typeof(double) || type == typeof(decimal) || type.IsEnum;
    private static object? Argument(ParameterInfo argument, SfEffectParameter[] parameters, SfEffectContext ctx)
    {
        var type = argument.ParameterType;
        if (type == typeof(PlayerChoiceContext)) return ctx.Choice ?? new BlockingPlayerChoiceContext();
        if (type == typeof(Player)) return ctx.Card.Owner;
        if (type == typeof(CardModel)) return ctx.Card;
        if (type == typeof(Creature)) return ctx.Target ?? ctx.Card.Owner.Creature;
        var spec = parameters.Single(p => p.Name == argument.Name);
        var value = ctx.Effect.Params?.TryGetValue(spec.Name, out var supplied) == true ? ctx.Effect.Params[spec.Name]
            : JsonSerializer.SerializeToElement(spec.Default);
        if (type.IsEnum) return Enum.Parse(type, value.GetString() ?? "", false);
        return JsonSerializer.Deserialize(value.GetRawText(), type, Options);
    }
}
