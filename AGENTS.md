# 项目开发规范

## 入口与范围

- 先读 `docs/INDEX.md`、`docs/ARCHITECTURE.md`，按改动范围查阅相关模块文档。
- React/TypeScript 负责编辑交互与状态，Rust 负责磁盘、导入、校验与发布，C# Runtime 负责游戏 API 和效果执行。共享契约是卡牌 JSON。
- 修改前检查 `git status --short`，保护现有工作与用户卡包。产物、日志及试验文件放项目 `work/`；发布产物放 `release/`。
- 提交、推送、工坊发布和实际游戏部署按用户明确请求执行。验证工具只运行本地检查。

## 数据一致性

- 字段与枚举变更同步审查 `editor/src/lib/types.ts`、`editor/src-tauri/src/model.rs`、`runtime/src/SfCardDef.cs` 与 `docs/SCHEMA.md`。
- 项目切换和修改磁盘的跨命令流程使用状态层事务。导入使用 `runProjectMutation`，回调从 `useStore.getState()` 取得最新状态，底层直接调用 API，避免嵌套事务。
- 保存失败保留 dirty 数据；部分导入失败后重读磁盘，使已写入内容可见。项目 ID、卡牌 ID、资源路径和输入大小在 Rust 边界校验。
- 图片请求绑定项目路径，缓存键包含项目、资源路径和修订号。组件订阅所需状态，图片读取与文字输入分开。
- Runtime 组合效果沿用原触发上下文，X 费只在入口展开；注册扩展时处理器与描述元数据保持一致。
- 可视化规则遵守 `docs/RULES.md`，前端示例与 Rust/C# 共享 `schema/rules-v1.examples.json`。项目状态按引用闭包进入卡牌快照；多目标规则执行一次，伤害/状态继承集合，计数器和抽牌保持一次结算。

## 扩展与界面

- 优先复用已有模块与项目内 UI 原语，保持 `docs/UI.md` 的视觉和简洁双语文案。
- 目录、枚举和行为复用既有数据源；新增抽象须服务于实际复用或隔离边界。
- 按需加载编辑面板和低频弹窗。业务模块独立于展示组件；新增导入格式在转换边界处理。
- 当前 Rust 同步命令在主线程执行。迁移耗时任务时一并设计后台线程、项目会话标识和事务互斥，遵循 [Tauri 命令文档](https://v2.tauri.app/develop/calling-rust/)。

## 验证与交付

- 统一入口：`node tools/verify.mjs`；局部用 `--scope frontend|backend|runtime`。
- 前端 `editor/scripts/check-*.cjs` 与 Runtime `runtime/tests/*/*.csproj` 自动加入验证清单。修复数据损坏、并发和效果执行问题时增加能复现故障的回归。
- 验证日志、命令与退出状态保存在 `work/verification/`。完整 Runtime 构建另按 `docs/BUILD.md` 配置真实游戏程序集。
- 视觉和游戏内战斗验证单独记录环境与覆盖范围。收尾说明改动、检查结果和后续事项，更新相关文档。

## 游戏更新适配

- 游戏升级先运行 `tools/game-compatibility/run.mjs` 记录本机版本、分支、哈希和关键接口，再以真实程序集构建Runtime。检查器输出限项目工作目录。
- 新增原版卡池走 `SfPoolRegistry` 的 `mod:sts2:<类型>` 动态路径；既有池键保持兼容。当前目录优先，内置目录提供离线回落。
- 新增或修改反射挂钩时同步更新工具签名；目录刷新、编译、元数据检查与游戏实战分别记录验收范围。
