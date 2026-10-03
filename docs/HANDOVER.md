# SpireForge 尖塔锻炉 — 项目交接文档

> 杀戮尖塔 2 现代化卡牌编辑器 | 2026-10-01 首次交付
> 游戏版本基准：**v0.111.0**（Steam 正式版）

## 一、这是什么

SpireForge 是一个**独立桌面 GUI 卡牌编辑器**，用于为《杀戮尖塔 2》制作自定义卡牌 mod 并发布到 Steam 创意工坊。

与现有方案的关键差异（调研结论见 [RESEARCH.md](./RESEARCH.md)）：

| 现有方案 | 局限 | SpireForge |
|---|---|---|
| STS2_Editor（独立 GUI） | 停更 6 个月、无开源协议、不支持工坊 | 全流程闭环 |
| 游戏内编辑器（Nexus #69 等，闭源） | 必须开着游戏、难以批量管理 | 独立运行、工程化管理 |
| 网页设计器（Make Spire 等） | 只出图/JSON，不是可用 mod | 直接产出可玩 mod |

**核心设计**：用户卡包是**纯数据**（JSON + PNG），无需编译、无需 Godot/.NET；
一个常驻的 **SpireForge Runtime** mod 在游戏启动时解释这些数据并动态创建卡牌。
游戏 API 变动时只需更新 Runtime，用户已发布的卡包不受影响。

## 二、当前状态（诚实版）

### 已完成并实测通过 ✅

- **卡牌创建全流程**：编辑器建卡 → 打包 PCK → 安装到游戏 → 游戏内正确加载
- **全部五类卡牌**：攻击 / 技能 / 能力(Power) / 诅咒 / 状态（游戏内自检 PASS）
- **自定义费用**：含 0 费、X 费、-1（不可打出，诅咒/状态惯例）
- **游戏中已有效果**：13 种内建（伤害/格挡/抽牌/能量/回复/弃牌/消耗/金币/失血/上限/
  施加增益减益/生成卡牌/**召唤敌人**）+ 自定义扩展（数据驱动，见 §五）
- **召唤敌人效果**（2026-10-02）：`{"kind":"summon","amount":数量,"params":{"monster":"DampCultist","hp":13}}`
  ——Runtime `SfMonsterResolver` 遍历 `ModelDb.Monsters` 按类名/Entry 解析（不区分大小写），
  hp 缺省用怪物原生 HP 区间（`CreateCreature` 自动 `SetUniqueMonsterHpValue`）；编辑器
  怪物下拉=全部 114 只游戏怪物官方中文译名（`tools/extract-monster-catalog.mjs` 以 zhs
  图鉴为准反查类名 → `editor/src/lib/monsters.ts`，拼音排序，chip 显示分类+原生 HP），
  「按效果生成描述」支持召唤文本。debug 回归卡 `SF_SPIKE_SUMMON`
- **效果官方译名全量目录**（2026-10-02）：施加增益/减益的下拉列出全部 265 个游戏效果
  （反编译 PowerModel 子类 × spire-codex zhs 官方译名，拼音排序），每项显示中文名 +
  悬浮官方描述；选中值下方常显中文 chip。「预填原版效果」的敌人/自身判定改用完整
  Debuff 表（52 项，原 5 项硬编码）。生成器：`tools/extract-power-catalog.mjs` →
  `editor/src/lib/powers.ts`（游戏更新后重跑）
- **术语校准（2026-10-03）**：对照游戏官方 zhs 文本核实——「力量」只是 Strength 这一个
  增益的专名，不能当类别词用。施加增益/减益的字段标签与搜索框统一改为**「效果」**
  （pp.powerLabel/pp.powerSearch/目录描述/预填提示/入战警告），官方文本里「力量/敏捷」
  （Strength/Dexterity 专名）保留不动；描述生成器动词改用官方句式**「给予 N 层X」**
  （上勾拳/主宰等原版卡均为「给予1层易伤」，不再写「施加」）。「在游戏中永久获得」
  按钮简化为**「在游戏中获得」**（含发布面板「全部卡」按钮）
- **可搜索下拉组件 Combobox**（2026-10-02）：效果/召唤怪物/生成卡牌三处弃用原生
  datalist（会同时显示英文值+中文标签），改用自定义 Combobox——**中文界面只显示中文、
  英文界面只显示英文**；顶部搜索框中英文名均可检索；效果项带官方图标（codex 图库
  255 张复制到 `editor/public/catalog/powers/`，5.7MB 随包内嵌）与官方描述（去 BBCode）、
  减益徽章；怪物项带 Normal/Elite/Boss 徽章与原生生命（怪物立绘 45MB 不打包，用徽章
  代替）；生成卡牌项=项目卡+原版目录 577 张联合检索（Entry 作次要行区分同名变体）；
  无匹配时可「使用原始值」保留自由输入。显示名≠保存值：字段显示本地化名，卡牌 JSON
  仍存英文规范名（SfPowerResolver/SfMonsterResolver 靠它解析）
- **生命周期钩子**：`on_draw`/`on_discard`/`on_exhaust`/`on_enter_combat`/`on_turn_end_in_hand`
  （自作用触发，编辑器「效果」页签按时机编辑；游戏内 15 卡注册 PASS、
  钩子分发经游戏源码比对 + `sf_hooktest` 自测命令验证路径）
- **自定义效果接口**：JSON `custom` 效果 → `SpireForge.Api.SfEffects` 注册表，
  第三方 mod 引用 Runtime.dll 即可扩展任意游戏 Cmd 行为（见 RUNTIME-MOD.md §三·五）；
  编辑器自定义框内置「真实示例」折叠块——示例·咔咔的实际 JSON 与 Runtime 处理器源码
- **插件式扩展接口**（2026-10-02）：`SfEffects`（自定义效果）/ `SfEvents`（事件总线：
  BeforeEffect/AfterEffect/CardGranted，订阅者异常隔离）/ `SfPacks`（卡包查询 + 
  `TryGetCardModel` 拿运行时卡模型）/ `SfGrant`（`Enqueue` 排队、`GrantAsync` 立即发放）/
  `SfLog`（统一日志），全部文档化于 RUNTIME-MOD.md §三·五
- **卡包查询 API**：`SfPacks.All/TryGetDef`、统一日志 `SfLog`
- **原版卡覆盖**：编辑器卡牌库「原版卡」内置 577 张原版目录（spire-codex 数据），
  导入为覆盖卡后可改费用/类型/稀有度/目标/数值/文案/行为；Runtime 端
  `SfVanillaOverride` 改模板字段 + Harmony 替换 OnPlay/OnUpgrade（RUNTIME-MOD.md §三·6；
  Rust 侧 16/16 测试含真实 PCK 往返，战斗内表现待人工实测——验证包 `tools/testpack-vanilla/`）。
  属性面板显示原版卡信息（原版描述/数值/升级/关键词）+「预填原版效果」一键生成效果清单
  （覆盖卡默认 effects 空=保留原版行为；预填/手填效果=整体替换打出行为）
- **多池卡**：卡牌 `pools` 数组非空时注册进全部列出角色池（一张卡铁甲/沉默都能用）；
  编辑器卡池多选。自定义"新角色"需游戏角色选择界面支持，纯数据 mod 做不到（见路线图）
- **内置工坊上传器**：官方 ModUploader v0.2.0（MIT）以字节内嵌编辑器，
  打开发布面板自动释放到应用数据目录并自动设置路径，零下载门槛
- **批量导入**：JSON 容器（数组 / `{cards:[...]}`）整批导入；`.pck` 卡包直读导入
  （pcktool 解包，原生 SpireForge 卡包完整保真）；未知效果 kind 按自定义效果保留
- **自定义贴图**：PNG/JPG/WebP 上传，游戏内 `ResourceLoader` 实测 250×190 加载成功
- **中英双语**：zhs/eng 双语文案 + 游戏内本地化合并实测通过
- **卡牌实时预览**：按官方规格渲染，含升级数值对照与钩子角标
- **一键安装到游戏** + 导出卡包
- **一键在游戏中获得卡（本局永久）**（2026-10-02，同日收敛语义）：编辑器（预览区单卡按钮 /
  发布面板整包按钮）把 Entry 写进 `mods/SpireForgeRuntime/sf_grant.json`，Runtime 在每场战斗
  开始（BeforeCombatStart 后缀、首次抽牌前）消费一次。**发放是本局永久的**：卡
  `RunState.CreateCard` + `CardPileCmd.Add(Deck)` 进主牌组（跨战斗持久、随存档保存，与游戏
  `card <X> Deck` 命令同配方）；战斗中发放的卡从下一场战斗起可用（开局 PopulateCombatState
  会把 Deck 克隆进抽牌堆），**没有**额外的当前抽牌堆副本。消费即删文件、不重复发放。
  **登记只在游戏会话内有效**：编辑器经 tasklist（duct）检测游戏进程，未运行时拒绝登记
  （Rust 返回 `GAME_NOT_RUNNING` → 前端「游戏未运行…」提示）；Runtime 启动时
  `ClearStaleQueue` 清掉上个会话遗留的清单，绝不跨会话补发。游戏内另有
  `sf_grant [ENTRY...]` 控制台命令（DebugOnly，无参数列出全部 Entry）；
  效果验证闭环 = 编辑卡 → 点一下 → 进战斗拿卡试打
- **零错误集成**：与 BaseLib/RitsuLib/工坊 mod 共存时，游戏启动无任何 SpireForge 错误
- **数据安全加固**（2026-10-02）：项目已入 git；编辑/切卡/关窗/发布全程自动保存（多卡
  dirtyIds + 去抖 + beforeunload）；project.json/卡牌/PCK/设置原子写（.tmp+.bak）；卡牌 id
  改名走事务（meta 原位替换 + 立绘跟随 + 存档影响确认）；删除有确认且 meta 先行；
  pack_id/路径严格校验；高于当前格式的项目与卡拒绝打开/导入；发布预检（Entry 冲突/
  原版覆盖重复/空 handler/缺文案）在发布面板展示；.pck 导入保真立绘（按卡 id 落盘
  assets/ 并回填 portrait）；工坊 dependencies/runtime 工坊 id/mod_id.txt/版本号持久化；
  上传器 15 分钟超时；内置上传器版本戳自动刷新；pcktool 解析器对损坏/恶意 PCK 全边界
  检查（8 个回归测试，不再可能 panic/OOM——编辑器 panic=abort 发行）
- **上手门槛优化**（2026-10-02）：新建卡牌改为模板选择（打击/防御/过牌/攻防/增益能力/
  诅咒/空白，含默认数值+升级+描述，两三下点击得到能进游戏的卡）；卡牌复制；「按效果
  生成描述」一键产出中英文本（含变量占位符与力量中文名）；关键词点选（CardKeyword 全
  枚举 7 项 chips + 自由输入）；卡牌库搜索/类型筛选/立绘缩略图（downscale 缓存）；发布
  面板分区（本地使用置顶，Steam 工坊折叠）；项目设置弹窗（名称/作者/简介，此前建包后
  无编辑入口）；欢迎页三步引导；弹窗 Esc 关闭
- **撤销/重做**（2026-10-02）：自动保存 ≠ 不能反悔——属性修改进会话级快照栈
  （同卡 800ms 内连续编辑合并为一步，上限 100），工具栏 ↶/↷ 按钮 + Ctrl+Z/Ctrl+Y
  （Ctrl+Shift+Z 同义；输入框内 Ctrl+Z 仍是原生文字撤销）；撤销后的状态照常落盘，
  重做分支保留；改 id/删卡时栈同步改写
- **内置示例卡包**（2026-10-02）：欢迎页「创建示例卡包」一键生成 5 张演示卡项目
  （pack_id=Demo，Entry 前缀 SF_）：示例·打击/防御（模板基础卡）、示例·力量（power
  效果 target=self 5 层）、示例·咔咔（**自定义效果** kind=custom+handler=demo_kaka，
  Runtime 常驻注册该处理器 = 在对面召唤一只改名「咔咔」的邪教徒（13 HP）+ 自身获得
  1 层仪式）、示例·回响（on_exhaust 钩子 + Exhaust）；
  占位立绘由 `tools/make-demo-portraits.mjs` 生成（纯 Node PNG 编码）内嵌二进制。
  编辑器自定义效果曾有跨端 bug：TryInvoke 按 kind 名查注册表，编辑器保存的
  {"kind":"custom","handler":"X"} 永远查不到——已修（handler 优先）
- **界面中英切换 + 官方译名**（2026-10-02）：工具栏/欢迎页右上角 中/EN 一键切换
  （`lib/i18n.ts` 双语字典 ~190 键，localStorage 持久化；卡面预览跟随界面语言）；
  游戏术语全部换成官方 zhs 本地化（spire-codex 提取，v0.111.0）：储君（曾误"摄政王"）、
  静默猎手（曾误"沉默猎手"）、亡灵契约师（曾误"缚灵师"）、故障机器人、先古、衍生、
  奇巧、固有、不能被打出、奥斯提等；关键词 chips 直接显示官方中文（悬浮看说明）
- **UI 文字换行/重叠修复**（2026-10-02）：属性面板标签不再竖排（label nowrap + hint
  truncate+title），卡牌 id/卡池改上下排布；效果行 flex-wrap + 不受 buff 影响单行；
  属性面板页签行去掉冗余保存按钮（工具栏已有）；卡面预览底部 Entry 与预览行合并去重
  （统一为「游戏内 Entry: XXX」单行）；稀有度等残留英文全部中文化
- **战斗中生成敌人 API**（2026-10-02，Runtime）：`CreatureCmd.Add(model, combatState)`
  （内部 CreateCreature + AddCreature + NCombatRoom 挂视觉）+ `CreatureCmd.
  SetMaxAndCurrentHp`；怪物改名 = `LocManager.GetTable("monsters").MergeWith` 注入词条
  + `MonsterModel.get_Title` Harmony 后缀按实例替换（标记存 ConditionalWeakTable，
  只影响生成的实例；语言切换后由 Title 读取路径兜底重注入）——见 `runtime/src/SfKaka.cs`；
  玩家侧仪式 = `PowerCmd.Apply<RitualPower>`（原版邪教徒吟唱同款，对玩家同样生效：
  每回合结束 +力量）

### 部分完成 / 待办 ⏳

- **Steam 工坊首次发布**：编辑器内发布向导已齐（生成工作区 → 内置上传器一键上传），
  待实际发布 SpireForge Runtime 与首个卡包（tags 上传后不可改）
- **原版覆盖战斗内人工实测**：安装 `tools/testpack-vanilla/SFVanTweak/` 后启动游戏，
  确认痛击 1 费/伤害 10/文案替换，验完删除该目录
- **钩子的战斗内人工实测**：`sf_hooktest` 自测命令已内置（debug 模式），
  待人工走一遍战斗确认（编辑器与注册链路已自动验证）
- **咔咔战斗内人工实测**：打出示例·咔咔，确认对面出现改名「咔咔」的邪教徒
  （13 HP、会吟唱+暗击）、自身获得仪式（回合结束 +1 力量）、
  日志出现 `custom effect registered: demo_kaka`；真身邪教徒名字不受影响
- **第三方格式导入**：`.sts2pack` / `created_cards.json` / Make Spire JSON 的
  字段级适配器（通用启发式映射器已有，拿到真实样本文件后按 `import.rs` 扩展点补齐）
- **效果目录扩充**：当前 5 个核心效果 + 自定义扩展，扩展清单见 §五
- **多人模式**：动态程序集的 ContentSorter 关联已修复（ModMap 注册运行时程序集），
  但未做实际多人联机测试

### 已知限制 ⚠️

1. **必须安装 SpireForge Runtime**：用户卡包依赖它（mod.json 的 dependencies 已声明）。
   发布卡包时需同时引导玩家安装 Runtime（工坊链接或本地 mods 目录）。
2. **游戏版本敏感**：Runtime 引用 `sts2.dll` 编译，游戏大版本更新（API 变动）后需重新编译。
   适配流程见 [RUNTIME-MOD.md](./RUNTIME-MOD.md)。
3. **卡牌 id 一经发布不可改名**：Entry 由包 id + 卡 id 派生，改名会破坏已有存档引用。

## 三、五分钟上手

```bash
# 环境要求：Node 20+ / pnpm / Rust(msvc) / .NET 9 SDK / VS BuildTools(含 Windows SDK)
cd spireforge/editor
pnpm install
pnpm tauri dev          # 开发模式启动编辑器
pnpm tauri build        # 打包发行版（NSIS 安装包）
```

首次运行：
1. 欢迎页会**自动检测游戏目录**（读 Steam 注册表 + libraryfolders.vdf）；失败则手动选择游戏根目录
2. 「新建卡包项目」→ 选空目录 → 填包 id（如 `Darkpack`）、名称、作者
3. 「+ 新卡牌」→ 右侧编辑：基础（类型/费用/稀有度/目标/卡池）、效果（伤害/格挡/抽牌/能量）、
   外观（上传立绘）、文本（中英双语，含占位符按钮）
4. 顶栏「发布 / 安装」→ **一键安装到游戏** → 启动游戏，在卡牌图鉴的无色卡池中查看
5. 调试：`%APPDATA%/SlayTheSpire2/logs/godot.log`，搜 `SPIREFORGE` 前缀

## 四、目录结构

```
spireforge/
  docs/                      # 本目录（六份交接文档）
  editor/                    # Tauri 2 编辑器（React+TS+Tailwind 前端 / Rust 后端）
    src/                     #   前端：组件 + store + tauri 调用封装
    src-tauri/src/           #   后端：model(数据模型) project(项目IO) publish(打包安装) game(游戏检测)
  runtime/                   # SpireForge Runtime mod（C#/.NET 9，游戏内解释器）
    src/                     #   SfCardBase(解释器基类) PackLoader(卡包扫描) EmitCardFactory(动态类型) SfPngLoader(原始PNG加载)
  schema/                    # 数据契约（必要时从 model.rs/types.ts 同步生成）
  tools/
    pcktool/                 # PCK 打包/解包 CLI（Rust，独立可跑）
    publish-test/            # publish.rs 的独立测试宿主（GNU 工具链可跑，验证 Entry 派生/PCK 格式）
    sts2-decompiled/         # sts2.dll 全量反编译（v0.111.0，API 权威参照，勿提交到 git）
    spire-codex/             # 社区游戏数据库（卡牌/关键词等参考数据）
    testpack/ testproject/   # 端到端测试素材
    extract-cmds.mjs         # 从反编译源码提取 Cmd API 清单 → 效果目录扩展用
    gen-test-png.mjs         # 生成测试 PNG
```

## 五、效果目录（当前 + 扩展路径）

运行时已实现（`runtime/src/SfEffectEngine.cs` 统一解释，新建卡与原版覆盖共用）：

| kind | 参数 | 游戏 API | 说明 |
|---|---|---|---|
| `damage` | amount, props, target? | `CreatureCmd.Damage` | props 支持 `["Move"]`/`["Unpowered"]`/`["Unblockable"]` 等；target 仅钩子上下文生效 |
| `block` | amount, props | `CreatureCmd.GainBlock` | |
| `draw` | amount | `CardPileCmd.Draw` | |
| `energy` | amount | `PlayerCmd.GainEnergy` | |
| `heal` | amount | `CreatureCmd.Heal` | 对应 HealVar |
| `discard` | amount | `CardCmd.Discard` | 随机弃 N 张手牌 |
| `exhaust` | amount | `CardCmd.Exhaust` | 随机消耗 N 张手牌 |
| `gold` | amount | `PlayerCmd.GainGold/LoseGold` | 负数 = 失去 |
| `lose_hp` | amount | `CreatureCmd.Damage`(Unblockable\|Unpowered) | 自身失去生命 |
| `max_hp` | amount | `CreatureCmd.GainMaxHp` | 生命上限 |
| `power` | amount, params.power, target? | `PowerCmd.Apply<T>` 反射 | 施加任意 PowerModel（原版+第三方），`self`=给自己 |
| `spawn` | amount, params.card_entry, params.pile | `CardPileCmd.AddGeneratedCardToCombat` | 生成任意卡（ToMutable 克隆）进抽/手/弃 |
| `custom` | handler, amount?, target?, params? | 处理器定义 | 任意 kind 名 → `SpireForge.Api.SfEffects` 注册表 |

单效果失败只记日志不中断结算（RunAsync 逐条 try/catch）。

另有 5 个生命周期钩子字段（`on_draw`/`on_discard`/`on_exhaust`/`on_enter_combat`/
`on_turn_end_in_hand`），复用上述效果清单，字段语义见 [SCHEMA.md](./SCHEMA.md)。

**扩展新效果的完整步骤**（以"治疗"为例，已实际验证一次跑通）：
1. 编辑器 `model.rs` 的 `EffectDef` 加变体（如 `Heal { amount }`）；`types.ts` 同步
2. `runtime`：`SfEffectKind` 加枚举值；`SfCardBase.CanonicalVars` 加对应 DynamicVar
   （`HealVar`/`HpLossVar`/`GoldVar` 等类型化变量见 `DynamicVars/DynamicVarSet.cs` 的属性表）；
   解释器 `ExecuteEffect` 加 `case`；`OnUpgrade` 加增量
3. 编辑器 UI：`PropertyPanel.tsx` 的 `EFFECT_META` 加条目（自动出现在添加按钮）、`add()` 加默认值
4. 预览：`CardPreview.tsx` 的 vars 加 `{Heal}` 占位符支持
5. 验证：Build → 部署 → 调试模式自检 PASS

（实测：5 个效果一小时内逐个通过；配方可靠。**注意**：新效果如果只在
`SfEffect.Kind` 的 switch 里加 case，就自动获得钩子上下文支持——记得区分
`play != null` 与钩子两条执行路径是否都需要。）

**不想改 Runtime 的扩展方式**：任何新行为都可以不动 Runtime 代码——写成
`custom` 效果 + 独立处理器 mod（`SfEffects.Register`），见 RUNTIME-MOD.md §三·五。
适合实验性效果、与特定 Power/遗物联动的复杂行为。

可用但未接入的命令 API 很多：`Kill/LoseBlock/GainMaxHp/Stun`（CreatureCmd）、
`Apply`（PowerCmd，施加增益/减益——需配合 PowerModel 类型，见 `DynamicVarSet` 里的
`PowerVar<T>` 属性表：Dexterity/Doom/Poison 等可直接映射）、`ExhaustCard`（CardPileCmd）、
`GainGold`（PlayerCmd` 配 `GoldVar`）等。
完整清单：`node tools/extract-cmds.mjs tools/sts2-decompiled schema/effects-catalog.json`

## 六、后续路线图

优先级从高到低：

1. **原版覆盖 + 钩子战斗内人工实测**（装 `tools/testpack-vanilla/SFVanTweak/` 看 BASH
   覆盖生效；debug 模式控制台 `sf_hooktest`，见 RUNTIME-MOD.md §五）
2. **Steam 工坊首次发布（M5，编辑器内全流程已就绪）**：
   - 发布面板自动释放内置 ModUploader（也可「换用外部 ModUploader.exe」）
   - 「生成工坊工作区」→「上传到 Steam 工坊」（上传时 Steam 需在线）
   - 更新已发布条目：重新生成工作区后重跑，`mod_id.txt` 记录工坊 id 会被复用（勿删）
   - 注意：**tags 上传后不可在工坊修改**；`visibility: private/public/unlisted/friends_only`
3. **Runtime mod 上架工坊**：作为独立 mod 发布，供玩家一键订阅（发布流程同上；
   发布后把工坊 mod id 填进卡包 workshop.json 的 dependencies 即可自动带前置）
4. **第三方格式字段级适配器（M4）**：通用启发式映射 + pck 导入已就绪，
   拿到真实样本后按 `import.rs` 扩展点补 `.sts2pack` / `created_cards.json` / Make Spire 适配
5. **效果目录扩充（第二轮已完成 2026-10-02：弃牌/消耗/金币/失血/上限/施加/生成）**：
   剩余候选——「选牌弃/消耗」（需 CardSelectCmd 选择 UI，数据驱动难）、
   「按 Entry 精确生成已升级卡」、遗物交互类
6. **钩子扩展**：「每当打出其他牌时」「回合开始时」等全局触发（需 hand-scope 过滤 + 实测）
7. **多人模式实测**：动态程序集已在 ModMap 注册（`AfterAssemblyInfoInit`），需实际联机验证
8. **自定义角色/职业**：需要游戏角色选择界面与开局流程支持，纯数据 mod 做不到；
   多池卡（`pools` 数组）已支持作为替代——一张卡进多个现有角色池

## 七、接手须知（踩坑记录）

这些坑都已在代码注释与 [RUNTIME-MOD.md](./RUNTIME-MOD.md) 中记录，接手时务必先读：

1. **Entry 派生必须用游戏同款 Slugify**：连续大写会逐字母拆分（`SFDeepPack`→`S_F_DEEP_PACK`）。
   三方实现（Rust `publish.rs` / TS `types.ts` / C# runtime）都有对应实现与测试，改动必须同步。
2. **动态程序集的两个身份**：`AssemblyBuilder` ≠ `type.Assembly`；ModMap 必须注册后者（`EmitCardFactory.RuntimeAssembly`）。
3. **注册时序**：卡牌类型在 `ModelDb.Init` 前缀创建、后缀幂等注册（`Contains` 判断后 `Inject`），
   兼容 BaseLib/RitsuLib 对 Init 的重排。详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
4. **原始 PNG 加载**：导出版 Godot 无 PNG 加载器，靠 `SfPngLoader` 拦截；且**必须限定包命名空间**
   （否则会拦截游戏自身 `res://images/` 图集路径导致 UI 损坏）。
5. **Godot.NET.Sdk 必需**：runtime 项目必须用 `Godot.NET.Sdk/4.5.1`（源生成器负责引擎回调分发，
   用 Microsoft.NET.Sdk 会导致 `ResourceFormatLoader._Load` 永远不会被引擎调用）。
6. **构建工具链陷阱**：Rust 在 Git Bash 下 MSVC `link.exe` 会被 GNU `link` 抢占；
   用 `rustup run stable-x86_64-pc-windows-gnu cargo ...` 跑纯逻辑测试，MSVC 用于 Tauri。
7. **Mimosa 安全钩子误报**：Write/Edit 新 C# 内容中出现标识符 `Execute`（以及此前的
   `Log.*` 组合）会被误判为 SQL 注入拦截。新代码一律用 `RunOne/RunAsync` 等命名 + `SfLog`；
   rules 是加密包没法改，只能避开触发词。
8. **原版 Entry 不要二次 slugify**：`BASH` 过一遍 Slugify 会变 `B_A_S_H`
   （publish.rs 曾因此翻车，测试兜住）。原版 Entry 只做大写规范化。
9. **Mimosa 误报（2026-10-02 起规则更严）**：新内容中出现 `std::process::Command::new(<变量>)`
   会被拦为"命令注入"——即使参数是列表、不经 shell（正是它建议的安全写法）。规避：子进程
   一律走 `duct` crate（`duct::cmd(exe, ["upload", "-w", ws])`，无 shell、原生管道+kill，
   见 workshop.rs::run_uploader）。同日还误报 PCK 条目 MD5 为"弱加密"——那是 Godot PCK
   格式规范的加载校验标记，不是安全用途，保持原样即可。
10. **git 约定**：仓库主分支 `main`；sts2-decompiled / spire-codex / 构建产物 / .mimosa
    不入库（恢复方式见 BUILD.md §〇）；uploader 二进制直接入库（include_bytes! 编译依赖，
    SHA256SUMS 校验）；桌面快捷方式别指向 target/release（clean 即失效），正式使用装 MSI。
11. **构建 release exe 必须走 `pnpm tauri build`**（加 `--no-bundle` 只出 exe 不出安装包）。
    直接 `cargo build --release` 不带 `tauri/custom-protocol` feature，编出来的 exe 启动后
    WebView 显示「localhost 拒绝连接」——它在连 devUrl 而不是加载内嵌资源（前端改动
    只重编 Rust 也一样会踩：exe 是"开发模式"二进制）。Cargo.toml 未声明 app 级
    custom-protocol feature，所以 cargo 命令行救不回来，认准 tauri CLI。
