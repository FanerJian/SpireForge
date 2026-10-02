# 架构说明

## 总览

```
┌────────────────────────────────────────────────────────────┐
│ SpireForge Editor（Tauri 2）                                │
│  React+TS+Tailwind（UI）  ←→  Rust 后端（IO/打包/安装）       │
│  项目目录 (.sfp)：project.json + cards/*.json + assets/*     │
└───────────────────────┬────────────────────────────────────┘
                        │ publish::build_pack
                        ▼
┌────────────────────────────────────────────────────────────┐
│ 用户卡包（纯数据，零编译产物）                                │
│   mods/<PackId>/<PackId>.json   清单 has_dll:false          │
│   mods/<PackId>/<PackId>.pck    Godot PCK v2                │
│     res://<PackId>/cards/*.json          卡牌定义            │
│     res://<PackId>/images/cards/*.png    立绘（原始 PNG！）   │
│     res://<PackId>/localization/<lang>/cards.json  文案      │
└───────────────────────┬────────────────────────────────────┘
                        │ 游戏内置 mod 加载器（自动挂载 PCK + 合并本地化）
                        ▼
┌────────────────────────────────────────────────────────────┐
│ SpireForge Runtime（C#/.NET 9 常驻 mod）                     │
│  1. PackageLoader 扫描全部卡包 JSON → 内存注册表             │
│  2. EmitCardFactory 为每张卡 Reflection.Emit 一个空壳类型    │
│  3. ModelDb.Init 后幂等注册（Inject + AddModelToPool）      │
│  4. SfCardBase.OnPlay 按效果清单顺序调用游戏 Cmd API 执行     │
│  5. SfPngLoader 让原始 PNG 可被游戏 ResourceLoader 加载      │
└────────────────────────────────────────────────────────────┘
```

## 数据流与单一数据源

**卡牌 JSON 是唯一契约**，三处实现必须一致：

| 关注点 | 编辑器 (Rust `model.rs`) | 编辑器 (TS `types.ts`) | Runtime (C# `SfCardDef`) |
|---|---|---|---|
| 字段（snake_case） | serde 结构体 | interface | JsonPropertyName |
| 枚举值（游戏名） | serde rename | 字符串字面量联合 | Enum.TryParse |
| Entry 派生 | `publish.rs::card_entry` | `types.ts::cardEntry` | `IdHelper.EntryOf` + 游戏 Slugify |

改动任一字段/枚举时，三处同步 + 跑 `tools/publish-test` 测试（含游戏实测值断言）。

## Entry 命名规则（三方一致的根源）

游戏 `StringHelper.Slugify`（反编译 v0.111.0）：
```
camel  = Regex("([A-Za-z0-9]|\G(?!^))([A-Z])").Replace(txt.Trim(), "$1_$2")
output = Regex("[^A-Z0-9_]").Replace(Regex("\s+").Replace(camel.ToUpper(), "_"), "")
```
Rust/JS 无 `\G`，用**收敛循环**（反复替换 `([A-Za-z0-9])([A-Z])` 直至稳定）等价实现。

卡牌类型名 = `Pascal(packId) + Pascal(cardId)` → Slugify → Entry。
例：`SFDeepPack` + `pack_strike` → 类型名 `SFDeepPackPackStrike` → Entry `S_F_DEEP_PACK_PACK_STRIKE`。
本地化键 = `<Entry>.title` / `.description` / `.flavor`。

## Runtime 注册时序（重要）

游戏启动阶段：`ExecuteVeryEarly`（加载 mod、调用初始化器）→ `ExecuteEssential`
（LocManager → **AssemblyInfo.Init** → **ModelDb.Init** → ModelDb.InitIds → ModelIdSerializationCache）→ `ExecuteDeferred`（Preload）。

Runtime 的 Harmony 挂钩点：

```
Load()（VeryEarly，mod 初始化器）
 ├─ EmitCardFactory.ModId = "SpireForgeRuntime"
 ├─ EmitCardFactory.EnsureAssembly()      ← 必须在 AssemblyInfo.Init 之前！
 │    （创建动态程序集 + AssociateAssemblyWithMod + 标记类型捕获运行时程序集）
 ├─ ResourceLoader.AddResourceFormatLoader(new SfPngLoader())
 └─ 安装 3 个 Harmony 补丁

ModelDb.Init 前缀（OnModelDbInitPre）
 ├─ PackLoader.ScanAllMods()              ← 此时所有 mod 的 PCK 已挂载、卡池未冻结
 ├─ 为每张卡 Emit 类型（只建类型，不注册）
 └─ 调试模式：注册 5 张回归测试卡

ModelDb.Init 后缀（OnModelDbInitPost）
 └─ 幂等注册：Contains ? 跳过 : Inject；随后 ModHelper.AddModelToPool

AssemblyInfo.Init 后缀（AfterAssemblyInfoInit）
 └─ 把动态程序集的"运行时对象"补进 ModMap
    （type.Assembly ≠ AssemblyBuilder，ContentSorter 用前者查表）

ExecuteEssential 后缀（AfterEssentialInit）
 └─ 调试模式下：本地化/立绘自检 + 全部卡牌 PASS 报告
```

**为什么用"前缀建类型 + 后缀注册"而不是直接 Inject**：
其他框架（实测 RitsuLib）会以**预计算的类型清单**重入 `ModelDb.Init`（`Init_Patch10`），
清单里是否包含我们的动态类型取决于时机。后缀注册用 `Contains` 判幂等，两种情形都正确。

## PCK 格式（自研打包器）

格式规范（Godot 4.5.1 `file_access_pack.cpp`）：**format v2**，
`"GDPC" + u32 ver=2 + u32×3 引擎版本 + u32 flags(0) + u64 file_base(0) + 64B 保留 + u32 文件数
+ 每文件[路径长度/路径/offset/size/md5[16]/flags] + 数据区（16 字节对齐）`。

实测证据：`tools/pcktool` 打出的 v2 包被游戏正常挂载（本地化合并成功、PNG 可读）。
每文件 MD5 是格式规范的一部分（Godot 的加载校验标记），非安全用途。

**原始 PNG 的加载链路**（为什么必须自研 loader）：
Godot 编辑器导出的 PCK 里 PNG 已转为 `.ctex` + `.remap`；导出版运行时没有 PNG 的
`ResourceFormatLoader`，所以 `res://<PackId>/xxx.png` 会 ERR_FILE_UNRECOGNIZED。
`SfPngLoader` 接管 `.png`：FileAccess 读字节 → 魔数嗅探（PNG/JPEG/WebP）→ Image 解码 →
`ImageTexture`。**只认领 `res://<packId>/` 命名空间内的路径**，否则会拦截游戏自身图集
（实测教训：不加命名空间过滤会破坏游戏 UI 图集加载）。

## 编辑器后端模块

| 模块 | 职责 | 关键点 |
|---|---|---|
| `model.rs` | 卡牌/项目数据模型 | 枚举名与游戏一致；`Self_` 变体 serde rename 为 `"Self"` |
| `project.rs` | 项目磁盘 IO | `<root>/project.json` + `cards/<id>.json`；id 校验（小写蛇形） |
| `publish.rs` | 打包与安装 | PCK v2 写入、Entry 派生（含测试）、立绘路径改写（项目相对→PCK 内）、清单生成 |
| `game.rs` | 游戏目录检测 | Steam 注册表 → libraryfolders.vdf → `data_sts2_windows_x86_64/sts2.dll` 校验 |

## 前端结构

- `lib/types.ts` — 数据模型镜像 + Entry 派生 + 中文标签表
- `lib/tauri.ts` — 全部后端命令的类型化封装
- `lib/store.ts` — zustand 全局状态（项目/卡牌/选中/脏标记/toast）
- `components/` — Welcome（项目向导）、CardLibrary（左）、PropertyPanel（右，4 个标签页）、
  CardPreview（中，官方规格卡面渲染 + BBCode/占位符解析）、PublishPanel（发布弹窗）
