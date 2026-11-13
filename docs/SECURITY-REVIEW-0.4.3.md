# 0.4.3 发布安全审查

日期：2026-11-13。Editor 0.4.3，Runtime 0.2.2，Windows x64。

## 已处理

| 项目 | 处理 |
|---|---|
| 更新来源与安装授权 | 官方 HTTPS 清单；后端重新校验下载参数；限制重定向、大小和版本；一次性安装记录及安装前 SHA-256 复验 |
| 更新文件替换 | 同目录独占临时文件，拒绝链接与重解析点，串行操作，替换失败恢复原程序 |
| 项目外图片写入 | 逐级核对实际目录归属，覆盖 Windows junction 与已有目标文件 |
| 过大 JSON | 导入与 Runtime 单卡读取限 16 MiB；异常卡记录诊断后继续枚举 |
| 旧版重复效果 | 空效果直接完成，单次重复至多 100，共享 512 动作预算 |
| 页面加载 | 生产 CSP 限定本地脚本，阻止外部和任意内联脚本；保留图片、样式及 Tauri IPC 所需能力 |
| 依赖 | 升级 Vite、source-map-js、rustls、rustls-webpki、rustix、tokio 与 async-executor |
| 发布内容 | 排除本地缓存、日志、环境文件和凭据文件；补充 Lit 许可；重新生成安装包与校验值 |

## 检查结果

- Gitleaks 8.30.1：扫描全部本地可达 Git 历史与待发布工作区。初次命中为公开 `steam_api64.dll` 的 SHA-256，已核对上游原文件，并以精确校验值列入配置；复扫凭据命中为 0。
- npm 官方审计：7 条漏洞通告处理后为 0。RustSec：编辑器锁文件 5 条漏洞通告处理后为 0；另外两个工具锁文件为 0。
- Rust 锁文件保留 5 条跨平台维护/健全性提示，涉及 `proc-macro-error`、`zbus_names`、`zvariant`、`zvariant_derive`、`glib`。Windows x64 依赖树均为空；后续 Linux 构建需复查。
- NuGet 官方源检查完成，Runtime 项目报告的漏洞包为 0。游戏程序集作为本机外部依赖进行版本与接口核对。
- 前端 11 项、后端 3 个测试组、Runtime 6 个回归项目通过。更新器 16 项测试覆盖参数篡改、文件篡改、链接、并发、单次授权和替换回滚。
- 生产前端在 Chrome 中完成 7 项 CSP 与编辑检查。使用隔离的 Tauri 接口数据，正常流程策略违规为 0，两次脚本注入探针均触发拦截。
- Runtime 使用 v0.113.0 的真实游戏程序集构建；Windows 发布构建核对版本、前端资源、Runtime 嵌入内容与 SHA-256。
- 内置 ModUploader、Steam API DLL 和 App ID 文件与官方 v0.2.0 发布 ZIP 逐字节一致，ZIP 摘要同时与 GitHub Release 元数据一致。

## 范围与后续

本次覆盖源码、依赖锁文件、完整本地 Git 历史、发布文件清单和重点攻击输入。证据存于本地 `work/security/` 与 `work/verification/`。游戏内战斗、新模式、运行中 EXE 的自动更新和 Steam 工坊实际上传另行验收。

文件符号链接的附加测试遇到 Windows 权限 1314；真实 junction 拒绝测试完整执行。原生构建保留既有的空值分析与未使用函数提示。

素材解码的像素预算属于后续加固项，当前建议使用可信图片与卡包。自定义 DLL 和 `res://` 场景按已加载 Mod 的权限运行。第三方上传器的许可核实事项见[第三方声明](../THIRD-PARTY-NOTICES.md)。

## 复查

从 [Gitleaks 官方发布](https://github.com/gitleaks/gitleaks/releases) 和 [RustSec 官方发布](https://github.com/RustSec/rustsec/releases) 获取工具并校验摘要，然后运行：

```powershell
node tools/release-audit.mjs --gitleaks <gitleaks.exe路径>
pnpm --dir editor audit --registry=https://registry.npmjs.org
cargo audit --file editor/src-tauri/Cargo.lock
cargo audit --file tools/pcktool/Cargo.lock
cargo audit --file tools/publish-test/Cargo.lock
node tools/verify.mjs
```

发布扫描器只导出候选文件并生成脱敏报告，报告中的依赖、二进制与游戏验收范围分别记录。CSP 配置依据 [Tauri 安全文档](https://v2.tauri.app/security/csp/)。
