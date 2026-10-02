# Runtime Mod 设计与游戏版本适配

> SpireForge Runtime 是常驻 mod（`mods/SpireForgeRuntime/`），负责在游戏内
> 解释用户卡包的数据并动态创建卡牌。本文档面向接手维护者。

## 一、构建

```bash
cd spireforge/runtime
dotnet build -c Release
# 产物: .godot/mono/temp/bin/Release/SpireForgeRuntime.dll
# 部署: 复制 DLL 到 <游戏>/mods/SpireForgeRuntime/（清单 SpireForgeRuntime.json 一起）
```

**必须使用 `Godot.NET.Sdk/4.5.1`**（csproj 已配置）。改用 Microsoft.NET.Sdk 会导致
Godot 源生成器缺失 → 引擎回调（`ResourceFormatLoader._Load` 等 GDVIRTUAL）永远不被调用
（实测踩坑：loader 注册成功但从不被调度）。

依赖引用（`GameDir` 属性可覆盖，默认 `E:\SteamLibrary\...`）：
- `sts2.dll`（游戏主程序集，全 API 来源）
- `0Harmony.dll`（随游戏分发）

## 二、源码结构

| 文件 | 职责 |
|---|---|
| `RuntimeEntry.cs` | 入口（`[ModInitializer]`）：Harmony 挂钩、注册时序、自检 |
| `PackLoader.cs` | 扫描 `res://<modId>/cards/*.json` → `SfCardDef` 注册表；`IdHelper`（Entry 派生）；`vanilla_id` 定义分流到 SfVanillaOverride |
| `SfCardDef.cs` | 卡牌定义（JSON 反序列化 + 游戏枚举解析） |
| `SfCardBase.cs` | 解释器基类：`CanonicalVars`（数值变量）/`OnPlay`（效果分派）/生命周期钩子/`OnUpgrade`/`PortraitPath` |
| `SfEffectEngine.cs` | 静态效果解释器：SfCardBase 与原版卡覆盖（Harmony 前缀）共用同一执行逻辑 |
| `SfVanillaOverride.cs` | 原版卡覆盖：改模板费用/类型/稀有度/目标/数值 + Harmony 替换 OnPlay/OnUpgrade |
| `SfEffects.cs` | 对外扩展 API（`SpireForge.Api`）：自定义效果注册表、卡包查询、日志 |
| `SfEvents.cs` | 对外扩展 API：生命周期事件总线（BeforeEffect/AfterEffect/CardGranted，订阅者异常隔离） |
| `SfGrant.cs` | 「一键在游戏中获得卡」文件桥：sf_grant.json 排队、**永久**发放（主牌组 + 战斗中抽牌堆副本） |
| `SfGrantConsoleCmd.cs` | 控制台命令 `sf_grant`（列出/永久拿卡，调试模式） |
| `SfKaka.cs` | 战斗中生成敌人 + 实例级改名（ConditionalWeakTable 标记 + Title getter 后缀 + loc 词条注入） |
| `SfHookTestCmd.cs` | 调试自测控制台命令 `sf_hooktest`（自动验证钩子/自定义效果，debug 模式） |
| `EmitCardFactory.cs` | Reflection.Emit 生成卡牌空壳类型（每卡一个类型，ModelId 之必需） |
| `SfPngLoader.cs` | 原始 PNG/JPEG/WebP 的 ResourceFormatLoader（命名空间隔离） |
| `SpikeCards.cs` | 调试模式回归测试卡（需 `SpireForgeRuntime.debug` 文件启用） |

## 三、关键设计决策（含实测依据）

### 1. 动态类型（Reflection.Emit）而非模型扫描
ModelDb 的 ModelId 派生自**类型名**，因此"一卡一类型"是硬性要求。用户卡包不编译，
Runtime 用 `AssemblyBuilder` 为每张卡生成空壳类型，构造器 IL 直接传
cost/type/rarity/target 常量（与原版卡的编译模式等价）。

### 2. 注册时序：前缀建类型 + 后缀幂等注册
见 [ARCHITECTURE.md](./ARCHITECTURE.md#runtime-注册时序重要)。核心动机：
其他 mod 框架（实测 RitsuLib 的 `ModelDb.Init_Patch10`）会以预计算清单重入 Init；
后缀注册用 `ModelDb.Contains` 判幂等，无需假设谁先谁后。

### 3. 动态程序集双身份
`AssemblyBuilder`（构建器）与 `type.Assembly`（运行时对象）**引用不同**。
`AssociateAssemblyWithMod` 注册构建器（进 `mod.assemblies`，AssemblyInfo.Init 收集）；
ContentSorter 用 `type.Assembly` 查 `AssemblyInfo.ModMap`，因此必须额外注册运行时对象
（`EmitCardFactory.RuntimeAssembly`，由标记类型的 `.Assembly` 捕获）。
两个都注册后，"not associated with any mod" 告警清零（实测）。

### 4. 卡池冻结
`ModHelper.AddModelToPool` 必须在池首次被消费前调用（否则抛 `InvalidOperationException`）。
池冻结发生在首次访问 `AllCardIds`/`AllCards`。Runtime 的注册发生在 `ModelDb.Init` 后缀，
早于 `Preload`（ExecuteDeferred）与任何游戏逻辑 ✓。**注意：游戏自身的任何代码
（包括其他 mod）若在 Init 之前访问了某个池，该池就冻结了** —— 目前实测无此情况；
若未来出现"pool is frozen"错误，需把注册提前到 `ModelDb.Init` 前缀的池访问之前。

### 5. 效果解释执行
解释器在静态类 `SfEffectEngine`（2026-10 自 SfCardBase 抽出）：新建卡（SfCardBase.OnPlay）
与**原版卡覆盖**（SfVanillaOverride 的 Harmony 前缀）共用同一套执行逻辑。
`SfCardBase.OnPlay` 按 `SfCardDef.Effects` 顺序 `await` 对应 Cmd API。
数值走 `CanonicalVars`（DamageVar/BlockVar/CardsVar/EnergyVar），升级走
`DynamicVars.X.UpgradeValueBy`，与描述占位符 `{Damage}` 自动联动。
生命周期钩子（`on_draw`/`on_discard`/`on_exhaust`/`on_enter_combat`/`on_turn_end_in_hand`）
共用同一解释器，override `AbstractModel.AfterCardXxx` / `CardModel.OnTurnEndInHand`
并以 `card == this` 自作用过滤；钩子里取敌用
`Owner.RunState.Rng.CombatTargets.NextItem(CombatState.HittableEnemies)`
（与游戏 Tingsha 遗物完全同款）。游戏的 `AfterCardEnteredCombat` 分发不带
`PlayerChoiceContext`，因此该钩子仅支持 block/heal/energy/custom。

### 6. 原版卡覆盖（SfVanillaOverride）
游戏自带 `0Harmony.dll`（`data_sts2_windows_x86_64/`，BaseLib 等框架 mod 同样引用它），
Runtime 直接 `new Harmony("com.spireforge.runtime.vanilla")` 打补丁。依据（反编译 v0.111.0）：
- 实例化唯一通道是 `CombatState.CreateCard → canonicalCard.ToMutable()`（存档加载同样走
  `SaveUtil.CardOrDeprecated(save.Id).ToMutable()`），`ToMutable` 的 `DeepCloneFields`
  克隆模板**当前值**（`_dynamicVars`、`_energyCost`）——改模板即改所有未来实例；
- `CardModel.Type/Rarity/TargetType/CanonicalEnergyCost` 是构造期 get-only 自动属性
  （原版子类只传 ctor 参数），用 `AccessTools.Field("<X>k__BackingField")` 写回；
- `DynamicVar.BaseValue` 有公开 setter（仅钳制 999999999），模板上直接改无断言；
- `HasEnergyCostX` 是表达式属性**无后备字段**，X 费只能替换 `_energyCost` 字段
  （原版 X 费卡惯例：`base(0,...)` + CostsX，见 Cascade）；
- 行为替换：Harmony 前缀 `ref Task __result` + return false 跳过原 `OnPlay`
  （Harmony 对 async 方法打补丁作用于外层同步方法，该模式官方支持）；
- 文案覆盖：`LocTable.MergeWith` 是纯字典覆盖，mod 本地化后加载即覆盖原版键
  （`{vanilla_id}.title/.description`），Runtime 侧无需干预。
已知限制：effects/upgrade_stats 是整体替换语义；与其他 mod 对同一原版卡的补丁顺序未定义；
多人模式未验证。覆盖验证包：`tools/testpack-vanilla/`（把 BASH 改 1 费/伤害 10，装进 mods
后开调试看 `SPIREFORGE: vanilla override BASH applied`，验完删除）。

### 7. 立绘加载
`SfPngLoader`：`_RecognizePath` 只认 `res://<PackOf.Value>/` 命名空间内的 `.png`；
`_Load` 读字节 → 魔数嗅探（PNG `89 50 4E 47` / JPEG `FF D8 FF` / WebP `RIFF..WEBP`）→
`Image.LoadXxxFromBuffer` → `ImageTexture`。
**切勿**放宽命名空间过滤（会拦截游戏 `res://images/` 图集，实测会损坏 UI）。

## 三·五、扩展接口（其他 mod 如何接入）

SpireForgeRuntime 把 `SpireForge.Api` 命名空间作为公共 API 暴露（`SfEffects.cs` / `SfEvents.cs`）。
第三方 mod 在自己的 csproj 里直接引用 `<游戏>/mods/SpireForgeRuntime/SpireForgeRuntime.dll`
（或工坊版），即可使用五组接口：

| 接口 | 用途 |
|---|---|
| `SfEffects` | 注册/注销自定义效果处理器（卡包 JSON 里 `{"kind":"名"}` 即可调用） |
| `SfEvents` | 生命周期事件：`BeforeEffect` / `AfterEffect` / `CardGranted` |
| `SfPacks` | 查询已加载卡包：`All` / `PackOf` / `TryGetDef` / `TryGetCardModel` |
| `SfGrant` | 给玩家发卡：`Enqueue`（写清单，战斗开始时消费）/ `GrantAsync`（立即发放，**永久加入本局牌组**） |
| `SfLog` | 统一前缀日志（godot.log 过滤 `SPIREFORGE`） |

完整示例 mod：

```csharp
using SpireForge.Api;

[ModInitializer("Load")]
public static class MyMod
{
    public static void Load()
    {
        // 1) 自定义效果 —— 卡包 JSON 里即可写 {"kind":"mymod_storm","amount":2,"params":{...}}
        //    （编辑器保存的 {"kind":"custom","handler":"mymod_storm"} 等价）
        SfEffects.Register("mymod_storm", async ctx =>
        {
            // ctx.Card / ctx.Effect(含 Amount/Params) / ctx.Choice / ctx.Play / ctx.Trigger / ctx.Target
            // 这里可用整个游戏 Cmd API：DamageCmd/CreatureCmd/PowerCmd/RelicCmd/...
            if (ctx.Target != null && ctx.Choice != null)
                await MegaCrit.Sts2.Core.Commands.CreatureCmd.Damage(
                    ctx.Choice, ctx.Target, ctx.Effect.Amount,
                    MegaCrit.Sts2.Core.ValueProps.ValueProp.Move, ctx.Card, ctx.Play);
        });

        // 2) 生命周期事件（同步触发、逐订阅者异常隔离）
        SfEvents.AfterEffect += (ctx, invoked) =>
            SfLog.Info($"effect {ctx.Effect.KindName} on {ctx.Card.Id}: invoked={invoked}");
        SfEvents.CardGranted += (entry, inCombat) =>
            SfLog.Info($"card granted: {entry} (inCombat={inCombat})");

        // 3) 查询卡包 / 拿卡牌模型（SpireForge 新建卡与原版卡均可）
        foreach (var (entry, def) in SfPacks.All) { /* ... */ }
        if (SfPacks.TryGetCardModel("MY_PACK_MY_CARD", out var model))
        {
            // model 可 ToMutable() 后交给任意游戏 API
        }

        // 4) 给玩家发卡（永久加入本局主牌组；战斗中还会克隆进当前抽牌堆）
        SfGrant.Enqueue(["MY_PACK_MY_CARD", "BASH"]);   // 排队：下一场战斗开始时消费
        // 或立即发放（需要 RunManager 进行中）：
        // await SfGrant.GrantAsync(player, "MY_PACK_MY_CARD", inCombat: false);

        // 5) 日志
        SfLog.Info("hello from my mod");
    }
}
```

要点：
- **注册时机宽松**：效果在打出/触发时才查表，其他 mod 晚于卡包加载注册也生效
- `Trigger` 取值：`play` / `on_draw` / `on_discard` / `on_exhaust` / `on_enter_combat` / `on_turn_end_in_hand`
- 处理器抛异常会被捕获并记 `[ERROR] SPIREFORGE`，不会炸战斗流程；事件订阅者同理
- `SfGrant.GrantAsync` 的发放是**本局永久的**：先 `RunState.CreateCard` + `CardPileCmd.Add(Deck)`
  （与游戏 `card <X> Deck` 命令同配方），战斗中再 `CombatState.CloneCard` + `DeckVersion`
  回指克隆进当前抽牌堆（与开局 `PopulateCombatState` 同款）
- Runtime 侧错误路径全都有日志兜底（未注册 kind → `unregistered custom effect`）

**内置自测命令**（debug 模式）：游戏自动发现 mod 程序集里的 `AbstractConsoleCmd` 子类，
Runtime 提供了 `sf_hooktest` —— 战斗中执行即可自动验证
on_discard / on_draw / on_exhaust 钩子与自定义效果全链路（看日志 `SPIREFORGE: HOOKTEST`）；
`sf_grant [ENTRY ...]` 可直接永久拿卡（无参数列出全部 SpireForge Entry）。

## 四、游戏版本升级适配流程

游戏更新（尤其 `v0.111.0` 这类带 mod API 变更的）后：

```bash
# 1. 重新反编译新版 sts2.dll（版本对齐是权威性来源）
dotnet tool install -g ilspycmd    # 若未安装
ilspycmd -p -o tools/sts2-decompiled "<游戏>/data_sts2_windows_x86_64/sts2.dll"

# 2. 比对本手册与 docs/api-notes-v0.111.0.md 中的关键 API：
#    - 枚举成员（CardType/CardRarity/TargetType/ValueProp/CardKeyword）
#    - CardModel 虚成员签名（CanonicalVars/OnPlay/OnUpgrade/PortraitPath）
#    - Cmd 方法签名（CreatureCmd.Damage/GainBlock、CardPileCmd.Draw、PlayerCmd.GainEnergy）
#    - 注册机制（ModelDb.Inject/ModHelper.AddModelToPool/AssemblyInfo）
#    - ResourceFormatLoader 虚方法签名（对照游戏 AtlasResourceLoader 的 override 列表）

# 3. 重跑 Cmd 清单提取（效果目录扩展用）
node tools/extract-cmds.mjs tools/sts2-decompiled schema/effects-catalog.json

# 4. 重新构建 runtime（GameDir 指向新版本游戏）
cd runtime && dotnet build -c Release

# 5. 游戏内验证（必须！）
#    - 放置 SpireForgeRuntime.debug 文件 → 启动游戏 → 日志搜 SPIREFORGE: PASS
#    - 期望输出：所有卡牌 PASS、0 个 [ERROR] SPIREFORGE 行
```

**版本兼容性记录**（更新时追加）：

| Runtime 版本 | 游戏版本 | 备注 |
|---|---|---|
| 0.1.0 | v0.111.0 | 首发；6/6 卡牌 PASS、0 错误；与 BaseLib 448★/RitsuLib 0.6.3 共存验证 |

**建议**：发布时在 mod.json 声明 `min_game_version`（该字段游戏会读取并提示玩家）。

## 五、调试技巧

- **日志**：`%APPDATA%/SlayTheSpire2/logs/godot.log`，过滤 `SPIREFORGE`
- **游戏内控制台**：`` ` ``（反引号）/ `'` / `^` 打开（F11 全屏），`card <ENTRY>` 直接获得卡牌
  （如 `card S_F_DEEP_PACK_PACK_STRIKE`），支持 `card <ENTRY> Draw|Discard|Exhaust` 指定堆
- **调试模式**：在 `mods/SpireForgeRuntime/` 放置空文件 `SpireForgeRuntime.debug` → 启用
  10 张回归测试卡（攻击/技能/诅咒/状态/抽牌 + 钩子/自定义效果）+ 完整自检
  （含卡池校验、本地化/立绘验证）；**日常游玩记得删除该文件**，否则尖牌会混入无色卡池
- **钩子/自定义效果自测**（debug 模式）：
  1. 战斗中输入 `sf_hooktest` → 自动弃置/抽取/消耗尖牌，日志应出现
     `hook on_discard`/`sf_test_echo`/`hook on_draw`/`hook on_exhaust`
  2. 战斗前 `card SF_SPIKE_INNATE Draw` 再 `fight` → 进战后日志出现 `hook on_enter_combat`
  3. `card SF_SPIKE_OMEN` 后结束回合（牌带 Retain 留在手牌）→ 日志出现 `hook on_turn_end_in_hand`
- **卡牌不出现**：检查 ①日志有无 `loaded <ENTRY>`（JSON 解析）②`injected+pooled`（注册）
  ③`PASS`（最终状态）；卡池归属看 `pool=...`；描述空白看本地化键是否与 Entry 完全一致
- **改动效果后**：`dotnet build` → 复制 DLL → 重启游戏（DLL 被进程锁定时需先退出游戏）
