using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using HarmonyLib;
using MegaCrit.Sts2.Core.Commands;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Helpers;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Models.CardPools;
using MegaCrit.Sts2.Core.ValueProps;

namespace SpireForge.Runtime;

/// <summary>
/// SpireForge Runtime 入口。
///
/// 注册时序（经实测验证，兼容 BaseLib/RitsuLib 等会重排 ModelDb.Init 的环境）：
///  1. Load（VeryEarly）：安装 Harmony 钩子；连接动态程序集。
///  2. ModelDb.Init 前缀：扫描全部卡包 JSON + Emit 全部卡牌类型（只建类型，不注册）。
///  3. ModelDb.Init 后缀：对每张卡做幂等注册 —— 若 Init 的类型清单已包含则跳过 Inject，
///     否则显式 Inject；随后加入卡池。此刻清单已定稿且池尚未冻结（冻结发生在首次访问），
///     紧随其后的 InitIds 会为新注入的模型赋 ID。
///  4. ExecuteEssential 后缀：自检（DEBUG 标记存在时做完整卡池校验）。
/// </summary>
[ModInitializer("Load")]
public static class RuntimeEntry
{
    private const string LogTag = "SPIREFORGE";
    public const string ModId = "SpireForgeRuntime";
    private const string HarmonyId = "com.spireforge.runtime";

    /// <summary>Entry → 具体类型（含编译类型与 Emit 类型）</summary>
    private static readonly Dictionary<string, Type> CardTypes = new();

    /// <summary>Entry → 目标卡池列表（多池卡注册进全部池；首池为自检对照的主池）</summary>
    private static readonly Dictionary<string, List<Type>> CardPoolList = new();

    public static void Load()
    {
        Log.Info($"{LogTag}: runtime initializing");
        Emit.EmitCardFactory.ModId = ModId;
        // 关键时序：动态程序集必须在 AssemblyInfo.Init（ExecuteEssential 早期）之前创建并关联，
        // 否则 ContentSorter 判定其类型"未关联任何 mod"（多人内容排序不稳）
        Emit.EmitCardFactory.EnsureAssembly();
        // 原始 PNG 加载器（卡面立绘不经 Godot 导入管线）
        SfPngLoader.Instance = new SfPngLoader();
        Godot.ResourceLoader.AddResourceFormatLoader(SfPngLoader.Instance, true);
        RegisterDemoEffects();

        var harmony = new Harmony(HarmonyId);
        harmony.Patch(
            typeof(ModelDb).GetMethod(nameof(ModelDb.Init), BindingFlags.Public | BindingFlags.Static),
            prefix: new HarmonyMethod(typeof(RuntimeEntry), nameof(OnModelDbInitPre)),
            postfix: new HarmonyMethod(typeof(RuntimeEntry), nameof(OnModelDbInitPost)));
        harmony.Patch(
            typeof(OneTimeInitialization).GetMethod(
                nameof(OneTimeInitialization.ExecuteEssential),
                BindingFlags.Public | BindingFlags.Static),
            postfix: new HarmonyMethod(typeof(RuntimeEntry), nameof(AfterEssentialInit)));
        // 动态程序集的运行时对象必须进入 ModMap（ContentSorter 在 ModelIdSerializationCache.Init
        // 里按 type.Assembly 引用查找；该引用与 AssemblyBuilder 不同）
        harmony.Patch(
            typeof(AssemblyInfo).GetMethod(nameof(AssemblyInfo.Init), BindingFlags.Public | BindingFlags.Static),
            postfix: new HarmonyMethod(typeof(RuntimeEntry), nameof(AfterAssemblyInfoInit)));
        // 「一键在游戏中获得卡」：每场战斗开始（首次抽牌前）消费编辑器写的 sf_grant.json
        harmony.Patch(
            typeof(MegaCrit.Sts2.Core.Hooks.Hook).GetMethod(
                nameof(MegaCrit.Sts2.Core.Hooks.Hook.BeforeCombatStart),
                BindingFlags.Public | BindingFlags.Static),
            postfix: new HarmonyMethod(typeof(RuntimeEntry), nameof(AfterBeforeCombatStart)));
        // 示例卡包「咔咔」：生成邪教徒时把显示名改成咔咔（Title getter 后缀 + loc 词条注入）
        SfKaka.Install(harmony);
        // 拿卡登记只在同一次游戏会话内有效：清掉上个会话遗留的清单
        SfGrant.ClearStaleQueue();

        Log.Info($"{LogTag}: hooks installed");
    }

    /// <summary>AssemblyInfo.Init 后置：把动态程序集的运行时对象补进 ModMap。</summary>
    private static void AfterAssemblyInfoInit()    {
        try
        {
            var map = AssemblyInfo.ModMap;
            var ourMod = ModManager.Mods.FirstOrDefault(m => m.manifest?.id == ModId);
            if (map == null || ourMod == null)
            {
                return;
            }
            foreach (var asm in ourMod.assemblies)
            {
                map[asm] = ourMod;
            }
            var rt = Emit.EmitCardFactory.RuntimeAssembly;
            if (rt != null)
            {
                map[rt] = ourMod;
            }
        }
        catch (System.Exception e)
        {
            Log.Error($"{LogTag}: AfterAssemblyInfoInit failed: {e}");
        }
    }

    /// <summary>每场战斗开始（首次抽牌前）：消费编辑器登记的「在游戏中获得卡」清单。</summary>
    private static void AfterBeforeCombatStart(MegaCrit.Sts2.Core.Runs.IRunState runState,
        MegaCrit.Sts2.Core.Combat.ICombatState? combatState)
    {
        SfGrant.ConsumeAtCombatStart(runState);
    }

    /// <summary>ModelDb.Init 前缀：扫描卡包 + 生成类型。不注册（注册统一在后缀，幂等）。</summary>
    private static void OnModelDbInitPre()
    {
        try
        {
            PackLoader.ScanAllMods();
            foreach (var (entry, def) in PackLoader.Defs)
            {
                // 多池支持：pools 非空时注册进全部列出池，回退单 pool 字段
                var pools = new List<Type>();
                var unknown = false;
                foreach (var poolName in def.PoolList)
                {
                    var poolType = PoolFor(poolName);
                    if (poolType == null)
                    {
                        Log.Error($"{LogTag}: unknown pool '{poolName}' for {entry}");
                        unknown = true;
                        break;
                    }
                    if (!pools.Contains(poolType))
                    {
                        pools.Add(poolType);
                    }
                }
                if (unknown || pools.Count == 0)
                {
                    continue;
                }
                string typeName = IdHelper.Pascal(PackLoader.PackOf[entry]) + IdHelper.Pascal(def.Id);
                var emitted = Emit.EmitCardFactory.Emit(
                    typeName, def.CostsX ? 1 : def.Cost, def.Type, def.RarityEnum, def.TargetEnum);
                string actualEntry = StringHelper.Slugify(emitted.Name);
                if (actualEntry != entry)
                {
                    Log.Error($"{LogTag}: entry mismatch: emitted '{actualEntry}' != '{entry}'");
                }
                CardTypes[entry] = emitted;
                CardPoolList[entry] = pools;
            }
        }
        catch (System.Exception e)
        {
            Log.Error($"{LogTag}: OnModelDbInitPre FAILED: {e}");
        }

        if (DebugChecksEnabled)
        {
            RegisterSpikeCards();
        }
    }

    /// <summary>ModelDb.Init 后缀：幂等注册（Inject 按需）+ 入池。</summary>
    private static void OnModelDbInitPost()
    {
        int injected = 0, scanned = 0, failed = 0;
        foreach (var (entry, type) in CardTypes)
        {
            try
            {
                if (ModelDb.Contains(type))
                {
                    scanned++;
                }
                else
                {
                    ModelDb.Inject(type);
                    injected++;
                }
                if (CardPoolList.TryGetValue(entry, out var pools))
                {
                    foreach (var poolType in pools)
                    {
                        ModHelper.AddModelToPool(poolType, type);
                    }
                }
            }
            catch (System.Exception e)
            {
                failed++;
                Log.Error($"{LogTag}: register {entry} FAILED: {e.Message}");
            }
        }
        Log.Info($"{LogTag}: registered {CardTypes.Count} card(s) (scanned={scanned} injected={injected} failed={failed})");
    }

    /// <summary>调试模式专用：回归测试卡（攻击/技能/诅咒/状态/抽牌 + 钩子/自定义效果）。
    /// 需在 mod 目录放置 SpireForgeRuntime.debug 文件才会加载。</summary>
    private static void RegisterSpikeCards()
    {
        RegisterDebugCustomEffect();

        var defs = new (string Entry, string TypeName, SpikeSfCardDef Def)[]
        {
            ("SF_SPIKE_STRIKE", null!, new SpikeSfCardDef
            {
                Cost = 1, Type = CardType.Attack, Rarity = CardRarity.Common, Target = TargetType.AnyEnemy,
                Pool = typeof(ColorlessCardPool), Damage = 6m, DamageUpgrade = 3m,
            }),
            ("SF_SPIKE_WARD", null!, new SpikeSfCardDef
            {
                Cost = 1, Type = CardType.Skill, Rarity = CardRarity.Common, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool), Block = 5m, BlockUpgrade = 3m,
            }),
            ("SF_SPIKE_HEX", "SfSpikeHex", new SpikeSfCardDef
            {
                Cost = -1, Type = CardType.Curse, Rarity = CardRarity.Curse, Target = TargetType.None,
                Pool = typeof(CurseCardPool), MaxUpgrade = 0, Keywords = [CardKeyword.Unplayable],
            }),
            ("SF_SPIKE_STUPOR", "SfSpikeStupor", new SpikeSfCardDef
            {
                Cost = -1, Type = CardType.Status, Rarity = CardRarity.Status, Target = TargetType.None,
                Pool = typeof(StatusCardPool), MaxUpgrade = 0, Keywords = [CardKeyword.Unplayable],
            }),
            ("SF_SPIKE_QUICKDRAW", "SfSpikeQuickdraw", new SpikeSfCardDef
            {
                Cost = 0, Type = CardType.Skill, Rarity = CardRarity.Uncommon, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool), Draw = 2,
            }),
            // ---- 扩展接口回归：自定义效果 + 生命周期钩子 ----
            ("SF_SPIKE_ECHO", "SfSpikeEcho", new SpikeSfCardDef
            {
                Cost = 1, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.AnyEnemy,
                Pool = typeof(ColorlessCardPool),
                Effects = [new SfEffect { KindName = "sf_test_echo", Amount = 2m,
                    Params = new() { ["note"] = System.Text.Json.JsonSerializer.SerializeToElement("hello-from-json") } }],
            }),
            // ---- 2026-10 扩充效果回归：施加增益/减益（反射解析 PowerModel）----
            ("SF_SPIKE_POWER", "SfSpikePower", new SpikeSfCardDef
            {
                Cost = 0, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.AnyEnemy,
                Pool = typeof(ColorlessCardPool),
                Effects =
                [
                    new SfEffect { KindName = "power", Amount = 2m,
                        Params = new() { ["power"] = System.Text.Json.JsonSerializer.SerializeToElement("Vulnerable") } },
                    new SfEffect { KindName = "power", Amount = 1m, Target = "self",
                        Params = new() { ["power"] = System.Text.Json.JsonSerializer.SerializeToElement("StrengthPower") } },
                ],
            }),
            // ---- 召唤敌人回归：summon 内建效果（怪物解析 + 指定 HP）----
            ("SF_SPIKE_SUMMON", "SfSpikeSummon", new SpikeSfCardDef
            {
                Cost = 1, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool),
                Effects = [new SfEffect
                {
                    KindName = "summon",
                    Params = new()
                    {
                        ["monster"] = System.Text.Json.JsonSerializer.SerializeToElement("DampCultist"),
                        ["hp"] = System.Text.Json.JsonSerializer.SerializeToElement(13m),
                    },
                }],
            }),
            ("SF_SPIKE_PYRE", "SfSpikePyre", new SpikeSfCardDef
            {
                Cost = 0, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool), Keywords = [CardKeyword.Exhaust],
                OnExhaust = [new SfEffect(SfEffectKind.Heal, 3m)],
            }),
            ("SF_SPIKE_TRIGGER", "SfSpikeTrigger", new SpikeSfCardDef
            {
                Cost = 1, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool),
                OnDiscard =
                [
                    new SfEffect(SfEffectKind.Block, 4m),
                    new SfEffect { KindName = "sf_test_echo", Amount = 2m, Target = "random_enemy",
                        Params = new() { ["note"] = System.Text.Json.JsonSerializer.SerializeToElement("from-on-discard") } },
                ],
            }),
            ("SF_SPIKE_INNATE", "SfSpikeInnate", new SpikeSfCardDef
            {
                Cost = 2, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool),
                OnEnterCombat = [new SfEffect(SfEffectKind.Block, 6m)],
            }),
            ("SF_SPIKE_OMEN", "SfSpikeOmen", new SpikeSfCardDef
            {
                Cost = 0, Type = CardType.Skill, Rarity = CardRarity.Token, Target = TargetType.Self,
                Pool = typeof(ColorlessCardPool), Keywords = [CardKeyword.Retain],
                OnTurnEndInHand = [new SfEffect(SfEffectKind.Draw, 1)],
            }),
        };

        foreach (var (entry, typeName, def) in defs)
        {
            SfCardBase.SpikeDefs[entry] = def;
            Type t;
            if (typeName == null)
            {
                // 编译类型（SfSpikeStrike / SfSpikeWard）
                t = entry == "SF_SPIKE_STRIKE" ? typeof(SfSpikeStrike) : typeof(SfSpikeWard);
            }
            else
            {
                t = Emit.EmitCardFactory.Emit(typeName, def.Cost, def.Type, def.Rarity, def.Target);
            }
            CardTypes[entry] = t;
            CardPoolList[entry] = [def.Pool];
        }
        Log.Info($"{LogTag}: spike cards enabled (debug mode)");
    }

    /// <summary>调试模式：注册演示自定义效果 sf_test_echo，验证 JSON→注册表→执行全链路。
    /// 真实用法见 docs/RUNTIME-MOD.md：其他 mod 引用 SpireForgeRuntime.dll 后调用
    /// SpireForge.Api.SfEffects.Register(kind, handler)。</summary>
    private static void RegisterDebugCustomEffect()
    {
        SpireForge.Api.SfEffects.Register("sf_test_echo", async ctx =>
        {
            var note = "";
            if (ctx.Effect.Params != null && ctx.Effect.Params.TryGetValue("note", out var n))
            {
                note = n.ToString() ?? "";
            }
            Log.Info($"{LogTag}: sf_test_echo card={ctx.Card.Id} trigger={ctx.Trigger} " +
                     $"amount={ctx.Effect.Amount} target={(ctx.Target != null ? "set" : "none")} note={note}");
            if (ctx.Target != null && ctx.Choice != null)
            {
                await CreatureCmd.Damage(ctx.Choice, ctx.Target, ctx.Effect.Amount, ValueProp.Move, ctx.Card, ctx.Play);
            }
        });
    }

    /// <summary>示例卡包的自定义效果处理器（随 Runtime 常驻注册，不要求调试模式）。
    /// demo_kaka = 「咔咔」：在对面召唤一只改名咔咔的邪教徒（见 SfKaka），自身获得 1 层仪式
    /// （每回合结束 +1 力量）—— 演示 SfEffects 注册表全链路，真实第三方扩展写法见 docs/RUNTIME-MOD.md。</summary>
    private static void RegisterDemoEffects()
    {
        SpireForge.Api.SfEffects.Register("demo_kaka", async ctx =>
        {
            var player = ctx.Card.Owner;
            var combatState = player.Creature.CombatState
                ?? MegaCrit.Sts2.Core.Combat.CombatManager.Instance.DebugOnlyGetState()
                ?? throw new InvalidOperationException("combat state unavailable");
            await SfKaka.SpawnKaka(combatState);
            await PowerCmd.Apply<MegaCrit.Sts2.Core.Models.Powers.RitualPower>(
                ctx.Choice ?? new MegaCrit.Sts2.Core.GameActions.Multiplayer.ThrowingPlayerChoiceContext(),
                player.Creature, 1m, null, ctx.Card, false);
        });
    }

    private static Type? PoolFor(string pool) => pool switch
    {
        "colorless" => typeof(ColorlessCardPool),
        "curse" => typeof(CurseCardPool),
        "status" => typeof(StatusCardPool),
        "ironclad" => typeof(IroncladCardPool),
        "silent" => typeof(SilentCardPool),
        "regent" => typeof(RegentCardPool),
        "necrobinder" => typeof(NecrobinderCardPool),
        "defect" => typeof(DefectCardPool),
        _ => null,
    };

    // ---- 自检（ExecuteEssential postfix：ModelDb 已 Init+InitIds）----

    private static void AfterEssentialInit()
    {
        // 原版卡覆盖（模板已构造、Id 已赋值；不受 DEBUG 开关限制——这是正式功能）
        SfVanillaOverride.ApplyAll();

        // 本地化与立绘验证（调试模式下也顺带验证卡包本地化）
        if (DebugChecksEnabled)
        {
            try
            {
                var loc = MegaCrit.Sts2.Core.Localization.LocString.GetIfExists("cards", "SF_SPIKE_STRIKE.title");
                Log.Info($"{LogTag}: LOC SF_SPIKE_STRIKE.title = {(loc != null ? loc.GetRawText() : "<missing>")}");
            }
            catch (System.Exception e)
            {
                Log.Error($"{LogTag}: LOC check failed: {e}");
            }

            foreach (var (entry, def) in PackLoader.Defs)
            {
                if (string.IsNullOrEmpty(def.Portrait))
                {
                    continue;
                }
                string path = $"res://{PackLoader.PackOf[entry]}/{def.Portrait}";
                try
                {
                    bool fileVisible = Godot.FileAccess.FileExists(path);
                    bool exists = Godot.ResourceLoader.Exists(path);
                    Godot.Texture2D? tex = null;
                    try
                    {
                        tex = Godot.ResourceLoader.Load<Godot.Texture2D>(path);
                    }
                    catch (System.Exception)
                    {
                        // 加载失败仅记录，不抛出
                    }
                    Log.Info($"{LogTag}: PORTRAIT {entry} {path} fileVisible={fileVisible} exists={exists} " +
                             $"loaded={(tex != null ? $"OK {tex.GetWidth()}x{tex.GetHeight()}" : "FAILED")}");
                }
                catch (System.Exception e)
                {
                    Log.Error($"{LogTag}: PORTRAIT {entry} check failed: {e.Message}");
                }
            }

            FixModMap();

            foreach (var (entry, type) in CardTypes)
            {
                Check(entry, type);
            }
        }
    }

    private static void FixModMap()
    {
        try
        {
            var map = AssemblyInfo.ModMap;
            var ourMod = ModManager.Mods.FirstOrDefault(m => m.manifest?.id == ModId);
            if (map == null || ourMod == null)
            {
                Log.Info($"{LogTag}: FixModMap: map={(map != null)} mod={(ourMod != null)}");
                return;
            }
            foreach (var asm in ourMod.assemblies)
            {
                map[asm] = ourMod;
            }
            // 诊断：动态程序集与 type.Assembly 的引用关系
            foreach (var (entry, type) in CardTypes)
            {
                var ta = type.Assembly;
                Log.Info($"{LogTag}: DIAG {entry} typeAsm={ta.GetName().Name} " +
                         $"refEqBuilder={ReferenceEquals(ta, Emit.EmitCardFactory.CurrentAssembly)} " +
                         $"inMapByType={map.ContainsKey(ta)} inMapByBuilder={map.ContainsKey(Emit.EmitCardFactory.CurrentAssembly!)}");
                break;
            }
        }
        catch (System.Exception e)
        {
            Log.Error($"{LogTag}: FixModMap failed: {e}");
        }
    }

    private static void Check(string entry, Type t)
    {
        try
        {
            if (!ModelDb.Contains(t))
            {
                Log.Error($"{LogTag}: FAIL {entry} not in ModelDb");
                return;
            }
            var card = ModelDb.GetById<CardModel>(ModelDb.GetId(t));
            var pool = card.Pool;
            bool pooled = CardPoolList.TryGetValue(entry, out var pts) && pts.Contains(pool.GetType());
            Log.Info($"{LogTag}: PASS {entry} | type={card.Type} rarity={card.Rarity} " +
                     $"cost={card.EnergyCost.Canonical} target={card.TargetType} pool={pool.GetType().Name}(ok={pooled})");
        }
        catch (System.Exception e)
        {
            Log.Error($"{LogTag}: FAIL {entry}: {e.Message}");
        }
    }

    /// <summary>调试模式：mod 目录下存在 SpireForgeRuntime.debug 文件时启用
    /// （加载回归测试卡 + 完整自检 + sf_hooktest 命令）。</summary>
    public static bool DebugChecksEnabled =>
        Godot.FileAccess.FileExists("res://SpireForgeRuntime.debug")
        || System.IO.File.Exists(System.IO.Path.Combine(
            System.IO.Path.GetDirectoryName(typeof(RuntimeEntry).Assembly.Location) ?? "",
            "SpireForgeRuntime.debug"));
}
