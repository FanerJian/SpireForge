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
  "runtime_workshop_id": null,    // SpireForge Runtime 的工坊 id → 写入 workshop.json dependencies
  "custom_pools": []              // 导入的第三方角色卡池配置，旧项目缺省为空
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
  "cost": 1,                      // 能量费用；负数=不可打出（Runtime 自动补 Unplayable 关键字，
                                  // 原版语义：Burn 等是 -1 费 + Unplayable，只有费用游戏仍能打出）
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
| 钩子字段非空 | **覆盖卡也生效**（2026-10-06 起）：`on_draw`/`on_discard`/`on_exhaust`/`on_enter_combat`/`on_turn_end_in_hand` 非空时 Harmony 前缀拦截对应卡片事件（沿继承链补 most-derived 声明方法），**整体替换**原版同名行为；钩子效果一律字面数值（不绑变量）。`on_turn_end_in_hand` 同时把门控属性 `HasTurnEndInHandEffect` 后缀改为 true |
| `name`/`description`/`flavor` | 打包时本地化键取 `{vanilla_id}.title/.description`，游戏 `LocTable.MergeWith` 覆盖原版文案 |
| `portrait` | **覆盖卡也生效**（2026-10-03 起）：打包进 `images/cards/`，Runtime 以 `res://{包id}/{portrait}` Harmony 后缀改写原版模板的 `PortraitPath`/`BetaPortraitPath`（按 Entry 查表，先古卡同一加载路径；Beta 立绘一并替换为同一张图） |

Runtime 应用时机：`OneTimeInitialization.ExecuteEssential` 后缀（模板就绪、Id 已赋值）。
日志：`SPIREFORGE: vanilla override BASH applied: ... portrait=res://{包id}/images/cards/x.png`（无立绘为 `-`）；
启动期 PORTRAIT 自检同样覆盖覆盖卡（debug 文件在时）。
编辑器入口：卡牌库「原版卡」（内置 577 张原版目录，`tools/extract-vanilla-catalog.mjs` 生成）。

## 字段细则

### pool（卡池）→ 游戏类
| 值 | 游戏卡池 | 用途 |
|---|---|---|
| `colorless` | ColorlessCardPool | 通用卡（**建议 mod 卡默认**） |
| `curse` | CurseCardPool | 诅咒（配合 card_type=Curse） |
| `status` | StatusCardPool | 状态牌（配合 card_type=Status） |
| `ironclad`/`silent`/`regent`/`necrobinder`/`defect` | 各角色池 | 角色专属（决定卡框颜色/能量色） |
| `mod:<mod_id>:<type_name>` | 已加载角色 Mod 的具体 CardPoolModel 子类 | 第三方角色卡池，区分大小写 |

**多池卡**：`pools: ["ironclad", "silent", ...]` 非空时本卡注册进列出的全部角色卡池
（铁甲和沉默都能在奖励里抽到）；为空时只有 `pool` 单池。主池 = 数组首项。
第三方池的显示名称、Mod ID、完整类名和可选工坊 ID 保存在项目 `custom_pools` 中。
Runtime 在游戏初始化完成后导出 `spireforge-pools.json`，编辑器可读取并导入；也支持
导入相同格式的 JSON 或手动添加。具体流程和格式见 [CUSTOM-POOLS.md](CUSTOM-POOLS.md)。
角色本体仍需要对应角色 Mod；尖塔锻炉的纯数据卡包不负责创建角色或实现其专属机制。

**mod 内容目录**：Runtime 还会在同目录导出 `spireforge-catalog.json`——本次会话
ModelDb 里的全部力量/怪物/卡牌（原版 + 所有已启用 mod），含官方译名、描述（游戏
当前语言）、增减益类型与来源程序集。编辑器读取后与内置目录合并：mod 角色的 buff、
mod 怪物、mod 卡牌会出现在效果下拉框中并带 `MOD` 徽章；文件缺失时静默降级为内置
目录。装/换 mod 后重启游戏进一次主菜单即可刷新。

### effects（效果清单，按顺序执行）
每个内建数值效果可带可选字段 **`upgrade_amount: number`**（升级增量；0/缺省 = 不变，
其中 damage/block/draw/energy/heal 缺省时回落 `upgrades.*` 旧通道）。升级时 Runtime 对
该效果绑定的变量 `UpgradeValueBy(增量)`，打出时按变量取实际数值——**全部内建种类的
数值都可升级**（含 lose_hp/spawn/summon 等）。同种类多条效果各自独立建变量
（`Damage`/`Damage2`/…），增量互不影响。

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
| `spawn` | `amount`, `card_entry: string`, `pile?` | `ICombatState.CreateCard` + `CardPileCmd.AddGeneratedCardToCombat` | 生成卡牌，见下 |
| `summon` | `amount`, `monster: string`, `hp?` | `CreatureCmd.Add`（随机遭遇站位落位） | 召唤敌人，见下 |
| `delayed` | `turns: number`, `timing?`, `side?`, `every_turn?`, `effects: SfEffect[]` | `SfDelayedPower`（承载力量） | 延迟效果，见下 |
| `vfx` | `vfx: string`, `target?`, `source?`, `sfx?` | `VfxCmd`（内置）或直接实例化（res:// 场景） | 播放视觉特效/音效（纯演出），见下 |
| `custom` | `handler: string`, `amount?`, `target?`, `params?` | 由处理器定义 | 见下方「自定义效果」 |

`damage.target` 只在钩子上下文生效（打出时永远以玩家指定目标为准）：
`random_enemy`（默认，游戏 CombatTargets RNG 与 Tingsha 同款）/ `self` / `all_enemies`。

**damage 动画演出（2026-10-06 起）**：可选 `vfx`（打击特效）/ `sfx`（打击音效）/
`attacker_vfx`（攻击者侧特效，如投掷物）/ `hit_count`（多段）。打出时整体走游戏原生
`DamageCmd.Attack` 编排（与原版攻击卡同款：攻击者前摇动画 + 打击特效），钩子触发与原版
Tingsha 同款直结、仅显式请求特效/多段时才编排；`Unblockable` 等 AttackCommand 表达不了的
props 自动回落直结 + 特效另补。`sfx` 以 `event:` 开头走 FMOD 事件，其余按音频文件名
（如 `blunt_attack.mp3`）临时播放。`hit_count > 1` 时总伤害 = 数值 × 段数（升级加的是每段）。

**vfx（播放视觉特效）**：`vfx` = 特效 spec——友好名（`attack_slash`/`attack_blunt`/
`cross_heal`/`lightning`/`coin_explosion_regular`…，目录见 `spireforge-catalog.json` 的
`vfx` 段）、`vfx/vfx_x` 内路径、或 `res://<modId>/vfx/x.tscn` 完整路径（mod 自带特效）。
`target`：`random_enemy`（默认）/ `all_enemies`（敌人阵营中心一次）/ `self` /
`side_enemy` / `side_player` / `screen`。`source`（2026-10-06 起）= 播放来源：
缺省按 `target` 定位；`self` = 这张卡的使用者（玩家）；填怪物类名/Entry（如
`DampCultist`）= 场上该怪的全部活体（可多只，逐只播放）。`sfx` = 同步音效，
`event:` 开头走 FMOD、其余按音频文件播放（与 damage 打击音效同款双通道）。
目录 = VfxCmd consts + 游戏程序集里全部
`*Vfx` 节点类（反射，随游戏更新自动扩展）+ mods/*/{vfx} 松散场景。纯演出不改数值，
卡面描述不生成对应文本。

**power（施加增益/减益）**：
- `power` = 力量名：`Vulnerable` / `Weak` / `Poison` / `Strength` / `Focus` 等——
  Runtime 按名字在全部已加载程序集里找 `PowerModel` 子类（完整类名或去掉 `Power` 后缀，
  不区分大小写），因此第三方 mod 自定义的力量同样可用
- `target`：缺省 = 打出目标（钩子时随机敌人）；`self` = 给自己上（Strength/Focus 等增益用）；
  `all_enemies` = 全体敌人
- 需要玩家选择上下文（on_enter_combat 不可用）

**spawn（生成卡牌）**：
- `card_entry` = 目标卡的 Entry（自定义卡 `SF_包ID_卡ID` 或原版 `BASH`；含第三方 mod 卡），
  经 `ICombatState.CreateCard` 正规生成（登记 Owner 进战斗状态，与 ForgeCmd/DualWield 同配方）
- `pile`：`draw`（默认）/ `hand` / `discard`
- 不需要选择上下文（on_enter_combat 可用）

**summon（召唤敌人）**：
- `monster` = 怪物类名或 Entry（`DampCultist` / `DAMP_CULTIST`，含 mod 怪物）；`hp` = 指定生命
  （缺省按怪物原生 HP 区间随机，受怪物 HP 缩放规则影响）
- **落位**：从当前遭遇战的站位表（`Encounter.Slots`，场景 Marker2D 名单）里**随机挑一个
  空位**（与游戏 Fabricator/LivingFog 召唤同源）；没有空位时随机复用既有站位。
  连站位表都没有时（绝大多数遭遇 `Slots` 为空），召唤完成后按游戏
  `NCombatRoom.PositionEnemies` 同款算法把当前全部敌人横向等距重新铺开
  （2026-10-06 修复：此前无人给中途召唤的怪定位，多只全部叠在同一默认位置）
- 不需要选择上下文（on_enter_combat 可用）

**delayed（延迟效果 —— 打出后下几回合）**：
- `turns` = 持续回合数（>=1）；`timing` = `turn_end`（默认）/ `turn_start`；
  `side`（2026-10-06 起）= 触发哪一方的回合时机：`player`（缺省，我方——历史行为）/
  `enemy`（敌方）/ `both`（双方都触发）；`every_turn` = `true`（缺省，每回合触发）/
  `false`（等 N 回合后仅在最后一次时机触发一次）；
  `effects` = 内嵌效果清单（语法与打出效果一致，目标语义同钩子：`self`/`random_enemy`/`all_enemies`，
  可再嵌套 delayed）
- Runtime 把内嵌清单挂在隐藏承载力量 `SfDelayedPower` 上（玩家可见图标显示剩余回合数，
  `InstanceType=Instanced` 重复打出各建各的实例互不叠加），每回合触发后减层、到 0 自动移除；
  `every_turn=false` 时其余回合只静默减层，最后一层（Amount==1）的那次时机才执行内嵌清单
- **打出当回合不触发也不减层**（"下 N 回合"从下一回合起算，与卡面文案一致）
- 内嵌效果走字面数值，不参与升级变量/描述占位符；战斗结束未消耗完的回合自动消失
- 不需要选择上下文（调度时可无 ctx；触发时用回合钩子的上下文，因此内嵌 damage 可用）

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

#### Runtime 内置处理器（无需写 mod）

Runtime 常驻注册三个可组合处理器，编辑器的自定义效果下拉直接可选（`custom_effects` 目录段同步导出全部已注册名）：

| handler | 行为 | params |
|---|---|---|
| `sf_repeat` | 内嵌清单重复执行 `amount` 次（缺省 1） | `{ "effects": [效果…] }` |
| `sf_random` | 内嵌清单随机挑 `pick` 条执行（缺省 1，互不重复） | `{ "pick": 2, "effects": [效果…] }` |
| `sf_cond` | `when` 条件全部成立才执行内嵌清单（缺省无条件） | `{ "when": [{…}], "effects": [效果…] }` |

`when` 条件对象（数组 = AND）：`hp_below`/`hp_above`（绝对生命）、`hp_pct_below`/`hp_pct_above`（0-100）、
`hand_at_least`/`hand_at_most`（手牌数）、`enemies_at_least`（可攻击敌人数）；
未知/非法条件按不成立处理。内嵌清单一律**字面数值**（不绑卡牌变量，与 delayed 内嵌同规则），
目标语义同钩子（`self`/`random_enemy`/`all_enemies`）。

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
- `{LoseHp}` `{MaxHp}` `{Discard}` `{Exhaust}` — 扩充种类的数值变量（2026-10 起，升级后自动更新）
- `{Damage:diff()}` — 升级对比展示（官方风格 `9+4`）
- `[gold]…[/gold]` `[red]…[/red]` `[unplayable]…[/unplayable]` — BBCode 着色

变量名与效果 kind 对应（damage→Damage、block→Block、draw→Cards、energy→Energy、
heal→Heal、lose_hp→LoseHp、max_hp→MaxHp、discard→Discard、exhaust→Exhaust）；
**同种类多条效果**第二条起加序号后缀（`Damage2`/`Damage3`…，与 Runtime `SfVarNaming`
同规则），否则游戏建卡时 DynamicVarSet 重复键直接抛异常。
gold/spawn/summon 的描述带得失/去向措辞，编辑器生成字面数值（变量仍存在可升级，
升级后需手改描述）。**编辑器预览会即时校验**（未匹配变量显示为 `{xxx}` 原样）。

### upgrades（升级增量，旧五通道）
- 仅 `damage`/`block`/`draw`/`energy`/`heal`（0 = 升级不变），作为旧卡包兼容通道保留：
  效果未单独写 `upgrade_amount` 时，该种类第一条效果沿用此通道
- 新做法：直接在效果上写 `upgrade_amount`（全种类支持、每条效果独立）
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
