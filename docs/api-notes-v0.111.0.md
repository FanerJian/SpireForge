# StS2 API 速查笔记（反编译自本机游戏 v0.111.0，sts2.dll）

> 来源：`tools/sts2-decompiled/`（ILSpy 全量反编译，与游戏版本一一对应）。
> 游戏更新后重跑 `tools/` 下的提取脚本并比对本文件。
> 本文件是 runtime mod 与效果目录的权威依据。

## 1. 关键枚举

### CardType（MegaCrit.Sts2.Core.Entities.Cards）
`None, Attack, Skill, Power, Status, Curse, Quest` — 五类卡全部原生支持。

### CardRarity
`None, Basic, Common, Uncommon, Rare, Ancient, Event, Token, Status, Curse, Quest`

### TargetType
`None, Self, AnyEnemy, AllEnemies, RandomEnemy, AnyPlayer, AnyAlly, AllAllies, TargetedNoCreature, Osty`

### ValueProp（位标志，MegaCrit.Sts2.Core.ValueProps）
`Unblockable=2, Unpowered=4, Move=8, SkipHurtAnim=0x10`

### CardMultiplayerConstraint
`None, MultiplayerOnly, SingleplayerOnly`

### PileType
`None, Draw, Hand, Discard, Exhaust, Play, Deck`

## 2. CardModel 要点（MegaCrit.Sts2.Core.Models.CardModel，2295 行）

- 构造：`protected CardModel(int canonicalEnergyCost, CardType type, CardRarity rarity, TargetType targetType, bool shouldShowInCardLibrary = true)`
- 卡牌 ID：由**类型名**派生。`Entry = StringHelper.Slugify(type.Name)`（PascalCase→大写蛇形，去特殊字符）；`Category = Slugify(基类类名去"_MODEL")`（CardModel→"CARD"）；完整 ID = `CARD.<ENTRY>`
- 本地化：`LocString("cards", Id.Entry + ".title"/".description")`，表名 `cards`，键如 `MY_CARD.title`
- 关键虚成员：
  - `protected virtual int CanonicalEnergyCost`（ctor 传入）
  - `protected virtual IEnumerable<DynamicVar> CanonicalVars`
  - `protected virtual Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)`
  - `protected virtual void OnUpgrade()`
  - `public virtual string PortraitPath`（默认走卡图集 `res://images/atlases/card_atlas.sprites/<pool>/<entry>.tres`，mod 覆盖为自定义 PNG）
  - `public virtual CardPoolModel Pool`（getter 按 `pool.AllCardIds.Contains(Id)` 在 AllCardPools 中查找，缓存到 _pool）
  - `public virtual IEnumerable<CardKeyword> CanonicalKeywords`
  - `protected virtual HashSet<CardTag> CanonicalTags`
  - `public virtual int MaxUpgradeLevel`（默认 1）
  - `public virtual CardMultiplayerConstraint MultiplayerConstraint`
  - `public virtual bool GainsBlock`（原版 Defend 系卡覆写为 true）
- 每卡数值访问：`base.DynamicVars.Block/.Damage/.Cards`（`DynamicVarSet`，键名为变量名）
- 升级数值：`base.DynamicVars.Block.UpgradeValueBy(3m)`

### 原版最小模板（DefendIronclad，逐字）
```csharp
public sealed class DefendIronclad : CardModel
{
    public override bool GainsBlock => true;
    protected override HashSet<CardTag> CanonicalTags => new HashSet<CardTag> { CardTag.Defend };
    protected override IEnumerable<DynamicVar> CanonicalVars =>
        new List<DynamicVar>(new BlockVar(5m, ValueProp.Move));

    public DefendIronclad() : base(1, CardType.Skill, CardRarity.Basic, TargetType.Self) { }

    protected override async Task OnPlay(PlayerChoiceContext choiceContext, CardPlay cardPlay)
    {
        await CreatureCmd.GainBlock(base.Owner.Creature, base.DynamicVars.Block, cardPlay);
    }

    protected override void OnUpgrade()
    {
        base.DynamicVars.Block.UpgradeValueBy(3m);
    }
}
```

## 3. DynamicVar 家族（MegaCrit.Sts2.Core.Localization.DynamicVars）

- `DamageVar(decimal damage, ValueProp props)` / `(string name, decimal, ValueProp)`
- `BlockVar(decimal block, ValueProp props)` / 同上
- `CardsVar(int cards)`
- 另有 `CalculatedDamageVar / CalculatedBlockVar / EnergyVar / GoldVar / ForgeVar / ExtraDamageVar / BoolVar` 等（效果目录扩展用）
- `UpgradeValueBy(decimal)` 增量升级

## 4. Cmd 命令层（MegaCrit.Sts2.Core.Commands，效果=await 命令）

20 个命令类：CardCmd, CardPileCmd, CardSelectCmd, Cmd, CreatureCmd, DamageCmd, ForgeCmd, MapCmd, OrbCmd, OstyCmd, PlayerCmd, PotionCmd, PowerCmd, RelicCmd, RelicSelectCmd, RewardsCmd, SfxCmd, TalkCmd, ThinkCmd, VfxCmd

已验证签名（效果目录核心条目）：
- `CreatureCmd.Damage(PlayerChoiceContext, Creature target, DamageVar, CardModel cardSource, CardPlay?)`
- `CreatureCmd.Damage(PlayerChoiceContext, Creature target, decimal amount, ValueProp props, CardModel? cardSource, CardPlay?)`
- `CreatureCmd.GainBlock(Creature creature, BlockVar blockVar, CardPlay?, bool fast=false)` → Task<decimal>
- `CreatureCmd.GainBlock(Creature, decimal amount, ValueProp, CardPlay?, bool)` 
- `CreatureCmd.Heal(Creature, decimal amount, bool playAnim=true)`
- `CreatureCmd.Kill(Creature, bool force=false)`
- `CreatureCmd.LoseBlock(PlayerChoiceContext, Creature target, decimal amount, Creature? remover)`
- `CreatureCmd.GainMaxHp(Creature, decimal)` / `LoseMaxHp(...)` / `SetCurrentHp(...)`
- `DamageCmd.Attack(decimal damagePerHit)` → `AttackCommand` 流式：`.FromCard(this).Targeting(cardPlay.Target).Execute(choiceContext)`
- `CardPileCmd.Draw(PlayerChoiceContext, DynamicVarSet/cards, Owner)`（抽牌）/ `CardPileCmd.Add(card, PileType)` 
- 其余类的方法清单待 M2 用提取脚本全量生成 → `schema/effects.json`

## 5. Mod 加载时序（关键！）

`OneTimeInitialization`:
1. `ExecuteVeryEarly()` → **`ModManager.Initialize(...)`**（发现 `<exe目录>/mods` 下的 mod，加载 DLL/PCK，调用 `[ModInitializer]` 方法；无初始器则 Harmony.PatchAll）
2. `ExecuteEssential()` → `LocManager.Initialize()` → `ModelDb.Init()`（实例化全部模型）→ `ModelIdSerializationCache.Init()` → `ModelDb.InitIds()`（给 _contentById 里所有实例赋 ModelId）
3. `ExecuteDeferred()` → `ModelDb.Preload()`（预计算 AllCards/Pool/立绘等）

**结论：mod 初始化器运行于 ModelDb.Init 之前 → 必须在初始化器中完成：动态类型生成 + `ModelDb.Inject(type)` + `ModHelper.AddModelToPool(poolType, modelType)`。池冻结发生在池首次被消费时（`ConcatModelsFromMods` 置 isFrozen）——初始化器阶段必然未冻结。**

## 6. Mod 注入 API（官方明确支持 mod 使用）

- `ModelDb.Inject(Type)` — 公开，注释 "Should only be used in tests and mods"。要求类型有公开无参构造（`Activator.CreateInstance`）
- `ModelDb.Remove(Type)`、`ModelDb.Contains(Type)`
- `ModHelper.AddModelToPool(Type poolType, Type modelType)` — 非泛型重载存在，可直接传运行时生成的 Type
- `ModHelper.SubscribeForRunStateHooks / SubscribeForCombatStateHooks`（事件钩子订阅）
- 模型发现：`ReflectionHelper._modTypes` 来自 `ModManager.GetLoadedMods() → m.assemblies → a.GetTypes()`——**动态程序集不会被扫描**，所以 Emit 类型必须走 Inject

## 7. 卡池（ModelDb 内置共享池）

`ColorlessCardPool, CurseCardPool, DeprecatedCardPool, EventCardPool, QuestCardPool, StatusCardPool, TokenCardPool` + 5 角色（Ironclad/Silent/Regent/Necrobinder/Defect）各自 `CardPool`
- 角色池决定卡框颜色/能量球色/图鉴分组
- 诅咒→CurseCardPool，状态→StatusCardPool

## 8. mod 三件套与清单

- 路径：`<游戏exe目录>/mods/<ModId>/`，递归发现
- 清单：`<id>.json`（现行契约；兼容旧 `mod_manifest.json`，另有可选字段 `pck_name`、`min_game_version`）
- 字段：id/name/author/description/version/has_pck/has_dll/dependencies/affects_gameplay
- 游戏内置 0Harmony.dll（同目录），GodotSharp.dll、sts2.dll 在 `data_sts2_windows_x86_64/`

## 9. 调试

- 游戏内 `~` 开控制台，`card <CARD_ID>` 获得卡
- mod 加载日志：Godot 日志（user://logs，即 %APPDATA%/Godot/app_userdata/Slay The Spire 2/logs/）

## 10. 对 SpireForge Runtime 的设计结论（含实测补充）

1. Runtime mod 内置一个解释器基类 `SfCard : CardModel`：override `CanonicalVars`/`OnPlay`/`OnUpgrade`/`PortraitPath`/`MultiplayerConstraint`/`CanonicalKeywords`，全部行为按**类型名派生的 Entry** 查内存注册表（从各卡包 JSON 加载）
2. 每张卡在初始化器里 Reflection.Emit 一个空壳类型（自定义 IL 构造器向 base 传 cost/type/rarity/target），→ `ModelDb.Inject` + `ModHelper.AddModelToPool`
3. 用户卡包 = PCK（cards/*.json + images/*.png + localization/<lang>/cards.json），`has_dll:false`，`dependencies: ["SpireForgeRuntime"]`
4. 类型命名规则：`<PackId驼峰><CardId驼峰>`（如 `DarkpackMyStrike`）→ Entry=`DARKPACK_MY_STRIKE`，天然防跨包冲突

### 10.1 实测补充：注册时序与动态程序集（2026-10 验证，必读）

以下结论在装了 16+ mod（含 BaseLib/RitsuLib）的环境下实测得出，已固化进 Runtime 实现：

1. **`ReflectionHelper.ModTypes` 是惰性缓存**：在 mod 初始化器（Load）阶段创建动态类型后，
   若缓存已在此之前建立，`ModelDb.Init` 不会扫描到动态类型 → 必须 `ModelDb.Inject`。
   但若缓存建立更晚（含动态程序集），Init 会自行实例化 → Inject 就重复。
   **解法：Init 前缀只 Emit 建类型；Init 后缀用 `ModelDb.Contains` 判幂等再 Inject。**
2. **其他框架会重入 `ModelDb.Init`**：实测 RitsuLib 以 `ModelDb.Init_Patch10(Type[])` 形式
   用预计算清单重入 —— 时序不可假设，幂等注册是唯一稳的姿势。
3. **动态程序集有两个身份**：`AssemblyBuilder`（AssociateAssemblyWithMod 收到的）与
   `type.Assembly`（运行时对象）**引用不同**。`AssemblyInfo.ModMap` 必须同时注册两者
   （运行时对象经"定义标记类型 → 读 .Assembly"捕获），否则 ContentSorter 报
   "not associated with any mod"（影响多人内容排序）。
4. **`AssemblyInfo.Init` 早于 `ModelDb.Init`**（同在 ExecuteEssential）：动态程序集需在
   Load 阶段先 `EnsureAssembly()`（创建+关联），类型可稍后定义（ModMap 是程序集级映射）。
5. **原始 PNG 需自研 ResourceFormatLoader**：导出版 Godot 无 .png 加载器；
   `_RecognizePath` **必须限定包命名空间**（`res://<modId>/`），否则拦截游戏
   `res://images/atlases/*.png` 导致 UI 图集加载失败（实测）。接口签名逐条对照游戏
   自带 `AtlasResourceLoader`（`_Load/_Exists/_RecognizePath/_GetResourceType/_GetRecognizedExtensions/_HandlesType/_GetDependencies`）。
6. **`Godot.NET.Sdk` 是硬性要求**：引擎 GDVIRTUAL 回调的 C# 分发代码由 Godot 源生成器注入；
   用 `Microsoft.NET.Sdk` 时 `ResourceFormatLoader` 覆写永远不会被引擎调用（loader 注册成功
   但 `_RecognizePath` 从不触发 —— 实测踩坑）。
7. **`StringHelper.Slugify` 的 `\G` 语义**：连续大写逐字母拆分（`SFDeepPack`→`S_F_DEEP_PACK`）。
   Rust/JS 无 `\G`，用 `([A-Za-z0-9])([A-Z])` 收敛循环等价实现（已有跨语言测试断言）。
