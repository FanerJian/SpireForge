# Tauri + React + Typescript

## 卡包列表

启动后在“我的卡包”中选择已有项目；编辑过程中使用工具栏“切换项目”返回列表。
列表自动读取默认 `projects` 目录的直接子目录，并兼容早期版本的程序同级 `projects` 目录。
从其他位置打开过的卡包会记录在默认项目目录下的 `.recent-projects.json` 中；卡包文件本身不受列表扫描影响。
记录最多保留 100 条。目录失效、项目元数据损坏或格式版本过高时，列表显示原因并禁用直接打开。
旧版本浏览器保存的上次打开路径也会显示在列表中；其他任意位置且从未登记的项目需要首次从“从其他位置打开卡包”加入。

切换、新建、发布和导出前会等待未保存修改落盘。保存失败时保留修改并中止后续操作；保存过程中继续输入的内容会继续保存。

验证保存行为：`node scripts/check-save-flow.cjs`。验证后端发现与历史记录：在 `src-tauri` 下执行 `cargo test --lib`。

## 撤销、恢复与发布检查

改名后，撤销和重做保持当前卡牌标识及立绘引用。删除可在本次会话中撤销；`cards/*.json.deleted` 保留删除快照，重启后可通过工具栏“备份恢复”恢复。
“备份恢复”同时列出已有卡牌 `.bak` 和项目索引 `.bak`。项目无法打开时，可从卡包列表进入恢复。项目索引恢复设置和卡牌清单，并补回缺失卡牌，已有卡牌内容不回退。恢复会清空会话历史；无效备份禁用恢复按钮。

发布检查中的问题可直接定位到卡牌、页签和字段。工坊工作区在项目内容或发布配置变化后失效，需重新生成；上传前后端再次核对源文件与生成内容。验证期间不执行 Steam 上传。

回归检查：`node scripts/check-editor-history.cjs`；后端磁盘恢复、检查定位与上传一致性：`cargo test --lib`。

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 效果回归检查

在 `editor` 目录运行 `pnpm check:effects`，验证中英文描述、触发时机、延迟内层、目标、升级变量命名、重复生成与手写描述确认。

在仓库根目录运行 `dotnet run --project runtime/tests/DelayedRegression -c Release`，验证真实延迟调度类的开始／结束时机、触发方、倒计时及同回合门控。该检查控制游戏命令边界，不替代游戏内战斗验证。
