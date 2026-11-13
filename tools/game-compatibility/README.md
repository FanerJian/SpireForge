# 游戏程序集兼容性检查

从仓库根目录运行，需要 .NET 9 SDK 与 Node.js。

```powershell
node tools/game-compatibility/run.mjs --game-dir "E:\SteamLibrary\steamapps\common\Slay the Spire 2" --output "D:\spireforge\work\compatibility\api-report.json"
```

检查器通过 SDK 自带的 `MetadataLoadContext` 读取程序集元数据。检查范围包括以下内容。

- `release_info.json` 版本及 Steam 本机安装分支、Build ID。
- `sts2.dll`、`0Harmony.dll`、`GodotSharp.dll` 的版本、字节数、修改时间与 SHA-256。
- Runtime 使用的 24 项 Harmony 目标、生命周期参数名、私有字段与反射方法约定。
- 实际原版卡池、主要命令方法签名、枚举及 Blitz/Dread 类型清单。

输出目录由 `--output` 指定，并校验位于游戏目录之外。构建、中间文件、日志与临时文件统一写入项目 `work/compatibility/probe-*`。检查器使用本地 SDK，依赖来源设为本次创建的空目录。

退出码 `0` 表示列出的接口约定全部匹配，`1` 表示接口差异，`2` 表示输入或运行环境错误。游戏内启动、卡牌注册、战斗效果与模式验证由游戏验收记录覆盖。

更新 Runtime 的反射挂钩时，同步更新 `Program.cs` 中的预期签名。完整 Runtime 构建方法见 [构建指南](../../docs/BUILD.md)。
