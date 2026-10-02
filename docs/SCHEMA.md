# 卡牌 JSON Schema（v1）

> 编辑器、Runtime、导入导出共用的唯一契约。
> Rust 权威定义：`editor/src-tauri/src/model.rs`
> TS 镜像：`editor/src/lib/types.ts`
> Runtime 侧：`runtime/src/SfCardDef.cs`

## 项目结构（.sfp 项目目录）

```
<项目根>/
  project.json          项目元数据
  cards/<id>.json       每张卡一个文件（id 即文件名）
  assets/cards/*.png    立绘（编辑器上传时自动命名 <cardId>.png）
```

### project.json

```json
{
  "format_version": 1,
  "pack_id": "Darkpack",          // mod id（工坊目录名基础）；发布后不可改；^[A-Za-z][A-Za-z0-9_]{1,63}$，非 Windows 保留名
  "name": "暗黑卡包",
  "author": "YourName",
  "description": "描述（进工坊简介）",
  "cards": ["my_strike", "my_guard"],
  "workshop_id": null,            // 本卡包的工坊 id：首次上传成功后由 mod_id.txt 回填；重新生成工作区时据此恢复
  "last_version": "0.1.0",        // 上次安装/发布版本号（发布面板默认值）
  "runtime_workshop_id": null     // SpireForge Runtime 的工坊 id → 写入 workshop.json dependencies
}
```

写入安全：project.json / cards/*.json / 设置文件全部原子写（`.tmp` → 旧文件转 `.bak` → 改名到位）；
打开项目或导入时，`format_version` 高于编辑器支持版本的卡会被拒绝（防旧编辑器保存时静默删字段）。

## 卡牌定义（cards/<id>.json）

```json
{
  "format_version": 1,
  "id": "my_strike",              // 小写蛇形；Entry 的组成；发布后不可改
  "card_type": "Attack",          // Attack|Skill|Power|Status|Curse|Quest
  "rarity": "Common",             // Basic|Common|Uncommon|Rare|Ancient|Event|Token|Status|Curse|Quest
  "target": "AnyEnemy",           // None|Self|AnyEnemy|AllEnemies|RandomEnemy|AnyPlayer|AnyAlly|AllAllies|TargetedNoCreature|Osty
  "cost": 1,                      // 能量费用；-1=不可打出（诅咒/状态惯例）
  "costs_x": false,               // X 费卡
  "keywords": [],                 // 游戏 CardKeyword 名：Innate|Exhaust|Unplayable|Retain|Ethereal|...
  "pool": "colorless",            // colorless|curse|status|ironclad|silent|regent|necrobinder|defect
  "show_in_library": true,        // 是否进卡牌图鉴
  "multiplayer": "none",          // none|multiplayer_only|singleplayer_only
  "max_upgrade_level": 1,         // 0=不可升级（诅咒/状态）
  "portrait": "assets/cards/my_strike.png",
                                  // 项目相对路径；打包时自动改写为 images/cards/<文件名>
  "name":        { "zhs": "我的打击", "eng": "My Strike" },
  "description": { "zhs": "造成 {Damage} 点 [gold]伤害[/gold]。",
                   "eng": "Deal {Damage} [gold]damage[/gold]." },
  "flavor":      { "zhs": "", "eng": "" },
  "effects": [
    { "kind": "damage", "amount": 9, "props": ["Move"] }
  ],
  "upgrades": { "damage": 4, "block": 0, "draw": 0, "energy": 0, "keywords": [] },

  // ---- 以下为可选的原版卡覆盖字段（普通新建卡不需要）----
  "vanilla_id": "BASH",           // 非空 = 不新建卡牌，改写游戏原版 Entry=此值 的卡牌
  "stats": { "Damage": 10 },      // 原版数值覆盖：键=原版 DynamicVar 名，值=覆盖后数值
  "upgrade_stats": { "damage": 2 }// 原版升级增量：替换原版 OnUpgrade，按变量名增量
}
```

## 原版卡覆盖（vanilla_id）

带 `vanilla_id` 的定义**不注册新卡牌**，而是改写 ModelDb 中的原版卡模板（实例经 ToMutable
克隆继承，对所有存档/战斗生效）：

| 字段 | 语义 |
|---|---|
| `vanilla_id` | 原版 Entry（如 `BASH`/`SEVEN_STARS`；已是最终 Slugify 形态，**不要再套 slugify**） |
| `cost` / `costs_x` / `card_type` / `rarity` / `target` | 写模板构造期后备字段；X 费=替换 `_energyCost`（原版 X 费卡惯例 `CanonicalEnergyCost=0 + CostsX`） |
| `stats` | 按 `DynamicVar.Name` 改模板变量 BaseValue（名称不区分大小写，如 Damage/Block/Vulnerable） |
| `upgrade_stats` | Harmony 前缀替换原版 `OnUpgrade`，按变量名做增量 |
| `effects` 非空 | Harmony 前缀**整体替换**原版 `OnPlay`（解释器与新建卡共用；注意是替换不是追加——只改数值就留空） |
| `name`/`description`/`flavor` | 打包时本地化键取 `{vanilla_id}.title/.description`，游戏 `LocTable.MergeWith` 覆盖原版文案 |

Runtime 应用时机：`OneTimeInitialization.ExecuteEssential` 后缀（模板就绪、Id 已赋值）。
日志：`SPIREFORGE: vanilla override BASH applied: ...`。
编辑器入口：卡牌库「原版卡」（内置 577 张原版目录，`tools/extract-vanilla-catalog.mjs` 生成）。

## 字段细则

### pool（卡池）→ 游戏类
| 值 | 游戏卡池 | 用途 |
|---|---|---|
| `colorless` | ColorlessCardPool | 通用卡（**建议 mod 卡默认**） |
| `curse` | CurseCardPool | 诅咒（配合 card_type=Curse） |
| `status` | StatusCardPool | 状态牌（配合 card_type=Status） |
| `ironclad`/`silent`/`regent`/`necrobinder`/`defect` | 各角色池 | 角色专属（决定卡框颜色/能量色） |

**多池卡**：`pools: ["ironclad", "silent", ...]` 非空时本卡注册进列出的全部角色卡池
（铁甲和沉默都能在奖励里抽到）；为空时只有 `pool` 单池。主池 = 数组首项。
"新建角色/职业"需要游戏角色选择界面支持，纯数据 mod 做不到，暂不支持。

### effects（效果清单，按顺序执行）
| kind | 参数 | 游戏 API | 说明 |
|---|---|---|---|
| `damage` | `amount: number`, `props: string[]`, `target?` | `CreatureCmd.Damage` | props：`Move`(受 buff 修正——伤害吃力量、格挡吃敏捷，默认) / `Unpowered`(不受 buff 加成) / `Unblockable`(不可格挡)，可组合 |
| `block` | `amount`, `props` | `CreatureCmd.GainBlock` | props 同上 |
| `draw` | `amount: number` | `CardPileCmd.Draw` | |
| `energy` | `amount: number` | `PlayerCmd.GainEnergy` | |
| `heal` | `amount: number` | `CreatureCmd.Heal` | 回复自身生命 |
| `discard` | `amount: number` | `CardCmd.Discard` | 随机弃 N 张手牌（CombatCardSelection RNG）；需选择上下文 |
| `exhaust` | `amount: number` | `CardCmd.Exhaust` | 随机消耗 N 张手牌；需选择上下文 |
| `gold` | `amount: number` | `PlayerCmd.GainGold/LoseGold` | 负数 = 失去金币 |
| `lose_hp` | `amount: number` | `CreatureCmd.Damage`（Unblockable\|Unpowered、无来源） | 自身失去生命；需选择上下文 |
| `max_hp` | `amount: number` | `CreatureCmd.GainMaxHp` | 生命上限 +N（正数） |
| `power` | `amount`, `power: string`, `target?` | `PowerCmd.Apply<T>`（反射解析） | 施加增益/减益，见下 |
| `spawn` | `amount`, `card_entry: string`, `pile?` | `CardPileCmd.AddGeneratedCardToCombat` | 生成卡牌，见下 |
| `custom` | `handler: string`, `amount?`, `target?`, `params?` | 由处理器定义 | 见下方「自定义效果」 |

`damage.target` 只在钩子上下文生效（打出时永远以玩家指定目标为准）：
`random_enemy`（默认，游戏 CombatTargets RNG 与 Tingsha 同款）/ `self` / `all_enemies`。

**power（施加增益/减益）**：
- `power` = 力量名：`Vulnerable` / `Weak` / `Poison` / `Strength` / `Focus` 等——
  Runtime 按名字在全部已加载程序集里找 `PowerModel` 子类（完整类名或去掉 `Power` 后缀，
  不区分大小写），因此第三方 mod 自定义的力量同样可用
- `target`：缺省 = 打出目标（钩子时随机敌人）；`self` = 给自己上（Strength/Focus 等增益用）；
  `all_enemies` = 全体敌人
- 需要玩家选择上下文（on_enter_combat 不可用）

**spawn（生成卡牌）**：
- `card_entry` = 目标卡的 Entry（自定义卡 `SF_包ID_卡ID` 或原版 `BASH`），按 ToMutable 克隆
- `pile`：`draw`（默认）/ `hand` / `discard`
- 不需要选择上下文（on_enter_combat 可用）

### 自定义效果（custom —— 第三方扩展接口）

内建种类之外的任何 `kind` 名都会被 Runtime 当作自定义效果，执行时转交
`SpireForge.Api.SfEffects` 注册表（详见 [RUNTIME-MOD.md](./RUNTIME-MOD.md#扩展接口其他-mod-如何接入)）：

```json
{ "kind": "my_pack_storm", "amount": 2,
  "target": "random_enemy",
  "params": { "apply": "weak", "stacks": 2 } }
```

- `handler`（即 kind 名）：由某个已加载 mod 调用 `SfEffects.Register(kind, handler)` 注册，
  大小写不敏感；未注册时打出会记录 `[ERROR] SPIREFORGE: unregistered custom effect`，不影响其他效果
- `amount`：可选数值，语义由处理器自解释（透传）
- `target`：钩子上下文的取敌方式（同 damage）；打出时处理器收到的 `ctx.Target` = 玩家指定目标
- `params`：任意 JSON 对象，原样透传给处理器
- **不参与升级变量与占位符**：数值写死在 JSON 与描述文本里（或由处理器自行处理升级）

### 生命周期钩子（自作用触发效果清单）

卡牌对象可选五个钩子字段，值为效果清单（结构同 `effects`），仅在**该事件发生在本卡上**时执行：

| 字段 | 触发时机 | 上下文限制 |
|---|---|---|
| `on_draw` | 此牌被抽到时（含开局起手抽牌） | 全部效果 |
| `on_discard` | 此牌被弃置时 | 全部效果 |
| `on_exhaust` | 此牌被消耗时（含 Ethereal 消耗） | 全部效果 |
| `on_enter_combat` | 战斗开始此牌进入战斗时（在抽牌堆中也触发） | 仅 `block`/`heal`/`energy`/`custom`（游戏该钩子不带选择上下文） |
| `on_turn_end_in_hand` | 回合结束时若此牌在手中（配合 `Retain` 关键词） | 全部效果 |

```json
{
  "id": "echo_guard",
  "on_discard": [ { "kind": "block", "amount": 4 } ],
  "on_exhaust": [ { "kind": "heal", "amount": 3 } ]
}
```

- 钩子效果使用**字面数值**：不绑定 DynamicVar、不吃 `upgrades` 增量、描述无占位符；
  数值变化需作者手动同步描述文本
- 钩子中的 `damage`/`custom` 通过 `target` 字段取敌（默认随机敌人）
- 空清单字段编辑器/打包器会省略，不写入卡牌 JSON

扩展新 kind 的步骤见 [HANDOVER.md §五](./HANDOVER.md#五效果目录当前--扩展路径)。

### 数值占位符（描述文本内）
- `{Damage}` `{Block}` `{Cards}` `{Energy}` `{Heal}` — 渲染为该效果的数值（**红色加粗**）
- `{Damage:diff()}` — 升级对比展示（官方风格 `9+4`）
- `[gold]…[/gold]` `[red]…[/red]` `[unplayable]…[/unplayable]` — BBCode 着色

变量名必须与效果 kind 对应（damage→Damage、block→Block、draw→Cards、energy→Energy、heal→Heal），
否则游戏内显示为原文。**编辑器预览会即时校验**（未匹配变量显示为 `{xxx}` 原样）。

### upgrades（升级增量）
- 与效果种类对应的增量：`damage`/`block`/`draw`/`energy`/`heal`（0 = 升级不变）
- `keywords`：升级后追加的关键词（如 `["Innate"]`）
- `max_upgrade_level`：>1 为多级升级（游戏默认 1 级；多级需描述用 `:diff()` 表达所有档位）

### 立绘规格
- 官方尺寸：普通卡 **250×190**，Ancient 卡 **250×351**；高清惯例 1000×760+
- 格式：PNG（推荐）/ JPEG / WebP（Runtime 按魔数嗅探，不依赖扩展名）
- 任意尺寸均可（游戏按比例缩放），编辑器预览按 550×418 显示
- 未提供立绘时游戏显示官方占位图（`MissingPortraitPath`）

### 多语言
- 目录：`res://<packId>/localization/<lang>/cards.json`（扁平键值表）
- 语言代码与游戏一致：`eng` `zhs`（编辑器目前支持中/英；扩展只需加语言代码到
  `publish.rs::LANGS` 与 `model.rs::LocText`）
- 键：`<Entry>.title` / `<Entry>.description` / `<Entry>.flavor`
- 缺语言的项回退游戏机制；建议至少填中英双语

## 幂等性/兼容性约定

- 读取方（Runtime/导入器）遇到**未知字段应忽略**、未知枚举值回退默认；
  `format_version` 高于支持版本时编辑器拒载并提示升级
- `id` 与 `pack_id` 一旦发布不得改名（Entry 派生自二者，改名破坏存档/工坊引用）
- 同包内 id 唯一；跨包不冲突（Entry 含 packId 前缀）
