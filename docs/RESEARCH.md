# 调研报告：现有方案、游戏 Mod 管线、结论

> 调研时间：2026-10-01 | 游戏版本基准：v0.111.0
> 本文档固化调研结论，避免接手者重复调研。

## 一、结论摘要

1. **不存在可直接复用的完整方案**：独立桌面 GUI + 从零建卡 + 打包/工坊闭环 = 空位
2. **官方没有数据驱动的卡牌格式**：卡牌是 C# `CardModel` 子类；但社区已验证"运行时从 JSON
   动态建卡"可行（Nexus #69 用 `created_cards.json`），SpireForge 采用的正是这条路线
3. **上传环节可完全自动化**：MegaCrit 官方开源了工坊上传 CLI（`sts2-mod-uploader`）
4. **官方不提供编辑器**（MegaCrit FAQ 确认），只提供 mod 加载器 + 工坊支持 + 主程序集 XML 文档

## 二、竞品清单（2026-10 现状）

### 独立/外部工具
| 名称 | 链接 | 形态 | 局限 |
|---|---|---|---|
| **STS2_Editor** | github.com/ForeverVirus/STS2_Editor | Godot+C# 独立编辑器，Graph 行为编辑、.sts2pack | **停更 6 个月、无开源协议**（不能复用代码）、不支持工坊 |
| STS2 Character Mod Creator | slay.spencerstiles.com | 网页 no-code，面向**角色** mod | 闭源、免费+Pro 分层 |
| Make Spire | sts2custom.shuimu.co.nz | 网页卡牌**设计器** | 只出图片/JSON 设计稿，不是可用 mod |
| sts2-mod-manager | github.com/MohamedSerhan/sts2-mod-manager | Tauri mod 管理器 | 非编辑器；其 Tauri+React+Rust 选型可参考 |
| sts2-CardArtEditor | github.com/2145057603/sts2-CardArtEditor | 游戏内卡面管理 | 只管美术 |

### 游戏内编辑器（闭源 mod 形态）
| 名称 | 链接 | 能力 | 局限 |
|---|---|---|---|
| Card editor and Card creator | nexusmods.com/slaythespire2/mods/69 | 游戏内改卡/建卡（`created_cards.json`） | 闭源、须开游戏 |
| DIYtheSpire | 工坊 3763317509 | 游戏内编辑**原版卡** | 不能建新卡、闭源 |
| DIY Cards | nexusmods.com/slaythespire2/mods/1442 | 游戏内建卡 | 闭源、刚起步 |

### 基础设施（SpireForge 的对接层）
| 名称 | 链接 | 用途 |
|---|---|---|
| BaseLib-StS2 | github.com/Alchyr/BaseLib-StS2 | 内容添加框架（448★，事实标准） |
| STS2-RitsuLib | github.com/BAKAOLC/STS2-RitsuLib | 框架库（实测与 SpireForge 共存兼容） |
| ModTemplate-StS2 | github.com/Alchyr/ModTemplate-StS2 | mod 模板（Godot.NET.Sdk 4.5.1 用法来源） |
| spire-codex | github.com/ptrlrd/spire-codex | 游戏数据 JSON（卡牌/关键词参考） |
| sts2-mod-uploader | github.com/MegaCrit/sts2-mod-uploader | **官方**工坊上传 CLI（M5 集成目标） |

## 三、StS2 Mod 管线要点（已实测验证）

- **三件套**：`mods/<Id>/` 下 `<Id>.json`（清单）+ `<Id>.dll`（可选）+ `<Id>.pck`（可选）
- **加载器**：游戏内置；`has_pck`/`has_dll` 声明载荷；`dependencies` 按序加载
- **卡牌**：C# 类（构造参数 = 费用/类型/稀有度/目标；`CanonicalVars` 数值；
  `OnPlay` 效果；`OnUpgrade` 升级）
- **注册**：`ModelDb.Inject(Type)`（官方注释明确允许 mod 使用）+ `ModHelper.AddModelToPool`
- **本地化**：`res://<modId>/localization/<lang>/*.json`，键 `<ENTRY>.title/.description`
- **工坊**：`ModUploader.exe upload -w <workspace>`；`workshop.json` 字段见官方 template；
  **tags 上传后不可修改**；预览图 <1MB
- **官方尺寸**：立绘 250×190（Ancient 250×351）
- **调试**：`~` 控制台 `card <ENTRY>` 获得卡牌；日志 `%APPDATA%/SlayTheSpire2/logs/`

## 四、SpireForge 的差异化定位（调研驱动的设计决策）

1. **纯数据卡包**：用户产出零编译物（JSON+PNG+PCK），游戏更新时只更新 Runtime——
   对比"导出时生成 DLL"方案，用户包永不失效
2. **独立 GUI + 工程化管理**：批量卡牌、双语、实时预览，优于游戏内编辑器
3. **完整闭环**：建卡 → 预览 → 打包 → 安装 → （M5）工坊上传
4. **兼容优先**：实测与 BaseLib/RitsuLib/16+ 工坊 mod 共存零错误

## 五、参考文档链接

- Mod 手册：https://fresh-milkshake.github.io/Modding-Tutorial/
- Reme 教程：https://tutorials.sts2modding.com
- 官方 FAQ：https://www.megacrit.com/faq/
- 官方 wiki（Modding Tutorials 页）：https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Modding_Tutorials
- BaseLib Wiki：https://alchyr.github.io/BaseLib-Wiki/
- Godot PCK 格式：godotengine/godot `core/io/file_access_pack.cpp`（v4.5 分支）
