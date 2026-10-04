# 第三方组件与内容声明（Third-Party Notices）

本仓库与发布物中包含/引用的第三方内容如下。本项目为免费的开源社区工具。

## MegaCrit/sts2-mod-uploader（ModUploader）

- 用途：Steam 创意工坊上传器，以二进制内嵌于编辑器（`tools/uploader/`，运行时自动释放）。
- 来源：官方仓库 <https://github.com/MegaCrit/sts2-mod-uploader>，本地内嵌版本为 v0.2.0。
- 完整性：仓库中的 `tools/uploader/SHA256SUMS` 记录了本地 `ModUploader.exe`、`steam_api64.dll` 和
  `steam_appid.txt` 副本的 SHA-256；哈希只用于核对文件是否一致，不证明许可或分发授权。
- 许可与分发：上游 v0.2.0 发布包和源码未附可核实的许可文本；此前标注为 MIT 的说法未经证实，
  该二进制及相关文件的分发授权仍待核实。不得将本说明理解为上游授予了分发许可。

## Spire Codex（spire-codex）

- 用途：原版卡牌目录（`schema/vanilla-catalog.json`，经 `tools/extract-vanilla-catalog.mjs` 提取）、
  力量/怪物目录与力量图标（`editor/src/lib/powers.ts`、`editor/public/catalog/powers/`，
  经 `tools/extract-power-catalog.mjs` / `tools/extract-monster-catalog.mjs` 提取）。
- 许可：PolyForm Noncommercial 1.0.0，条款全文：
  <https://polyformproject.org/licenses/noncommercial/1.0.0>
  仓库：<https://github.com/ptrlrd/spire-codex>
- **Required Notice: Copyright © 2025-present Peter Lord and Spire Codex contributors.**
- 义务声明：因上述内容的存在，本项目及其分发物**仅限非商业用途**。若未来需要商业化，
  须先移除全部 Spire Codex 派生内容或另行取得权利人授权。
- 说明：其中原版卡牌名称/描述等游戏文本的版权归 Mega Crit 所有。

## 运行时引用（不分发）

- 游戏《Slay the Spire 2》的程序集（`sts2.dll`、`0Harmony.dll`、GodotSharp 等）在构建与运行时
  从用户本机的游戏安装目录引用，**不在仓库或发布物中**；游戏资产版权归 Mega Crit。
- Rust / npm 依赖均为宽松许可（MIT/Apache-2.0/BSD 等），完整清单见 `Cargo.lock` 与
  `pnpm-lock.yaml`。

## 商标

《Slay the Spire》《杀戮尖塔》及相关名称归 Mega Crit 所有。本项目为非官方社区工具，
与 Mega Crit 无关，也不受其背书。
