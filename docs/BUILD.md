# 构建与测试指南

## 环境要求

| 组件 | 版本 | 用途 | 安装 |
|---|---|---|---|
| Node.js + pnpm | 20+ / 10+ | 编辑器前端 | nodejs.org / `npm i -g pnpm` |
| Rust (msvc) | stable | 编辑器后端 / pcktool | rustup.rs（默认工具链） |
| VS BuildTools | 2022 + **Windows SDK** | Rust MSVC 链接 | winget: `Microsoft.VisualStudio.2022.BuildTools`；SDK: `Microsoft.WindowsSDK.10.0.18362` |
| .NET SDK | 9.0 | Runtime mod 构建 | dotnet.microsoft.com |
| Godot.NET.Sdk | 4.5.1（NuGet 自动还原） | Runtime mod（源生成器必需） | 无需手动安装 |
| 《杀戮尖塔2》 | v0.111.0+ | 引用 sts2.dll / 游戏内测试 | Steam（建议安装在非 C 盘库以省空间） |

## 〇、Git 仓库与外部数据管理

项目根已初始化 git（主分支 `main`）。**不在仓库里的东西及恢复方式**：

| 排除项 | 原因 | 恢复 |
|---|---|---|
| `tools/sts2-decompiled/` | sts2.dll 反编译产物（版权物，禁止分发） | ILSpy 打开游戏目录 sts2_Data/Sts2.dll 反编译为完整程序集（电脑上需装游戏） |
| `tools/spire-codex/` | 社区数据仓库（本身是嵌套 git） | `git clone https://github.com/ptrlrd/spire-codex tools/spire-codex`（提取产物 `schema/vanilla-catalog.json` 已入库，不重跑脚本则不必 clone） |
| `**/target/`、`**/node_modules/` | 构建产物 | `pnpm install` / `cargo build` |
| `runtime/.godot/`、`editor/src-tauri/gen/` | Godot/Tauri 自动生成 | 构建时生成 |
| `.mimosa/` | 安全钩子状态 | 运行时生成 |
| `tools/uploader/*.zip`、`_sandbox/` | 上传器原始 zip 与解压沙盒 | 见下 |

**内置上传器二进制**（`tools/uploader/ModUploader.exe`、`steam_api64.dll`、`steam_appid.txt`）
**直接入库**（clean clone 即可编译，`workshop.rs` 编译期 `include_bytes!` 引用它们），
完整性与版本记录见 `tools/uploader/SHA256SUMS`。换版本时：替换文件 → 重新生成
`sha256sum ... > tools/uploader/SHA256SUMS` → 提交（编辑器的版本戳会随字节数指纹自动重释放）。

**桌面快捷方式注意**：不要指向 `editor/src-tauri/target/release/editor.exe`
（`cargo clean` 即失效）；正式使用请装 MSI/NSIS 安装产物，target 目录仅用于开发。

## 一、编辑器

```bash
cd editor
pnpm install

# 开发模式（热重载）
pnpm tauri dev

# 发行版
pnpm tauri build                 # 完整（含 MSI 安装器）
pnpm tauri build --bundles msi   # 只出 MSI
# 独立可执行文件（无需安装器）：src-tauri/target/release/editor.exe
# MSI 安装器：src-tauri/target/release/bundle/msi/*.msi

# 仅前端类型检查 / 构建
npx tsc --noEmit && pnpm build
```

**发行产物说明**：
- `target/release/editor.exe`（~20MB，含内置上传器）可**直接双击运行**（依赖系统 WebView2，Win10/11 自带）
- **安装器**（`target/release/bundle/{msi,nsis}/`）：`tauri.conf.json` 已配 WiX `language: zh-CN` /
  NSIS 中英文——产品名含中文，默认 en-US codepage 1252 会导致 light.exe 报 LGHT0311，勿改回
- **安装器打包需要 GitHub 访问**：tauri-bundler 会从 GitHub 下载 WiX 3.14/NSIS 工具并缓存到
  `%LOCALAPPDATA%/tauri/`。内网/受限网络下打包会卡在下载（独立 exe 不受影响）。
  离线方案：在有网机器上打包一次，把 `%LOCALAPPDATA%/tauri/` 整个目录拷到同路径。
- **桌面快捷方式**：指向 `target/release/editor.exe` 的快捷方式在 `cargo clean` 后失效；
  正式使用装 MSI/NSIS 产物

**踩坑**：
- Git Bash 下 Rust 链接时 GNU `link` 会抢占 MSVC `link.exe`（报 `extra operand`）。
  在纯 MSVC 场景（Tauri 构建）不受影响；跑 GNU 工具链测试时用
  `rustup run stable-x86_64-pc-windows-gnu cargo ...`
- `pnpm tauri dev` 卡在 "beforeDevCommand" 失败 = 1420 端口被上次的 vite 残留占用：
  `netstat -ano | grep 1420` → `taskkill //PID <pid> //F`
- 重建发行版前需关闭正在运行的 editor.exe（Windows 锁定可执行文件）

## 二、Runtime mod

```bash
cd runtime
dotnet build -c Release
# 产物: .godot/mono/temp/bin/Release/SpireForgeRuntime.dll
```

**GameDir 配置**：csproj 中 `<GameDir>` 默认 `E:\SteamLibrary\steamapps\common\Slay the Spire 2`，
换机器时改这里或传 `/p:GameDir=...`。

**部署**：
```bash
# 复制到游戏 mods 目录（首次需自建目录）
cp .godot/mono/temp/bin/Release/SpireForgeRuntime.dll  "<游戏>/mods/SpireForgeRuntime/"
cp SpireForgeRuntime.json                              "<游戏>/mods/SpireForgeRuntime/"
# 调试模式（可选）：放一个空文件启用回归测试卡 + 完整自检
touch "<游戏>/mods/SpireForgeRuntime/SpireForgeRuntime.debug"
```

## 三、测试矩阵

| 层级 | 命令/操作 | 期望 |
|---|---|---|
| pcktool 解析器（含损坏输入回归） | `cd tools/pcktool && rustup run stable-x86_64-pc-windows-gnu cargo test` | 8 passed |
| 项目事务/打包/导入（GNU 宿主） | `cd tools/publish-test && rustup run stable-x86_64-pc-windows-gnu cargo test` | 15 passed（含 rename 事务、原子写、立绘保真、版本拒绝） |
| 同套测试（MSVC 直跑编辑器 crate） | `cd editor/src-tauri && cargo test` | 15 passed |
| 编辑器后端编译 | `cd editor/src-tauri && cargo check` | 0 error |
| 前端类型 | `cd editor && npx tsc --noEmit` | 0 error |
| 打包链路（无 GUI） | `cd tools/publish-test && rustup run ... cargo run --example build_pack -- ../testproject ../testproject-out SFDeepPack 测试 SpireForge 0.2.0` | 输出 .pck + 清单 |
| PCK 内容校验 | `tools/pcktool/target/release/pcktool.exe list <pck>` | 列出 cards/images/localization |
| **游戏内端到端** | 安装卡包 → 启动游戏 → 看日志 | `SPIREFORGE: PASS`（全卡）+ `\[ERROR\] SPIREFORGE` 计数为 0 |
| 视觉验证 | 启动编辑器 → 截图欢迎页/编辑页 | 深色 UI 正常渲染 |

**游戏内日志过滤**：
```bash
grep -a "SPIREFORGE" "$APPDATA/SlayTheSpire2/logs/godot.log"
# 关键行：loaded <ENTRY>（解析成功）/ injected+pooled（注册）/ PASS（最终状态）
# 错误行：FAIL 或 [ERROR] SPIREFORGE
```

## 四、发布清单（打新版本时逐项过）

- [ ] `tools/publish-test` 全部测试通过
- [ ] runtime 在最新游戏版本上零错误（含调试模式自检 PASS）
- [ ] 编辑器 `pnpm tauri build` 成功
- [ ] 更新 `docs/api-notes-<版本>.md`（如游戏有 API 变更）
- [ ] 更新 `RUNTIME-MOD.md` 的版本兼容性记录表
- [ ] Runtime 版本号（`SpireForgeRuntime.json` 的 version + csproj）
- [ ] （若发布 runtime 到工坊）用 ModUploader 更新条目

## 五、自动更新（应用内检查 + 多源下载）

编辑器内置更新器：启动 24h 一次静默检查 + 项目设置里手动「检查更新」。
清单 = 仓库内 `update/latest.json`（GitHub raw 直读，另附两个社区加速镜像源 ghfast.top /
gh-proxy.com 逐个回落）；载荷 = GitHub Release 上的裸 exe 资产，应用内下载后 SHA256
校验、原地换文件（旧文件落 `editor.exe.old`，下次启动清理）并自动重启。

**发新版时**（在发布清单之外多做两步）：

```bash
# 1. 用新编的 exe 重新生成清单（写入真实 sha256/大小/双语更新说明）
node tools/write-update-manifest.mjs editor/src-tauri/target/release/editor.exe <版本> "中文说明" "English notes"
# 2. GitHub Release 上除常规 zip 外，额外上传裸 exe 资产 SpireForge-editor-v<版本>.exe
#    （清单里的下载 URL 指向它），然后提交并推送 update/latest.json
```

要点：
- 清单里的 `urls` 是逐个回落的下载源（直链 + 镜像），改镜像站时重跑生成脚本即可
- exe 哈希写死在清单里做完整性校验；镜像只做转发，篡改会校验失败
- 发布构建必须带 `RUSTFLAGS='--remap-path-prefix=...'`（隐私要求见发布清单），
  清单生成脚本读的是 target 下的 exe，哈希以实际发布的那个文件为准
