//! Steam 创意工坊发布：生成 ModUploader 工作区并调用官方上传器。
//!
//! 官方工具：MegaCrit/sts2-mod-uploader（ModUploader.exe）
//! 流程：workspace 文件夹 = content/（= mods 目录里的卡包文件）+ workshop.json + image.png(<1MB)
//! 更新已发布条目：替换 content/ 后重跑（mod_id.txt 记录的工坊 id 会被复用）。
//!
//! 工坊 id 持久化：首次上传成功后 mod_id.txt 回写到 ProjectMeta.workshop_id；
//! 重新生成工作区时若 mod_id.txt 不存在会从 meta 恢复——换导出目录也不会误发新条目。
//!
//! 注意（官方文档）：工坊 tags 在上传后无法修改；建议首次就填好或留空。
//!
//! 子进程说明：上传器经 duct（参数列表、不经 shell）启动，stdout/stderr
//! 由 duct 在后台线程收集；run_uploader 带 15 分钟超时，超时 kill 子进程。

use crate::model::{CardDef, ProjectMeta};
use crate::project::atomic_write;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

// ---- 内置 ModUploader（MegaCrit/sts2-mod-uploader v0.2.0，MIT 协议，可再分发）----
// 以字节内嵌进编辑器，首次使用时释放到应用数据目录，用户无需单独下载。
const UPLOADER_EXE: &[u8] = include_bytes!("../../../tools/uploader/ModUploader.exe");
const STEAM_API_DLL: &[u8] = include_bytes!("../../../tools/uploader/steam_api64.dll");
const STEAM_APPID: &[u8] = include_bytes!("../../../tools/uploader/steam_appid.txt");

const UPLOADER_NOTICE: &[u8] = b"\
ModUploader v0.2.0 - bundled with SpireForge editor
Source: github.com/MegaCrit/sts2-mod-uploader (MIT License, (c) MegaCrit)
steam_api64.dll / steam_appid.txt: Steamworks redistributables from the
uploader's official release zip. Do not redistribute outside of mod tooling.
";

/// 上传超时：Steam 卡住时不能让发布面板永久 busy
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// 确保内置上传器已释放到应用数据目录，返回 ModUploader.exe 路径。
/// 用版本戳判断是否需要重释放（升级编辑器内置版本后自动刷新，老用户不会一直用旧版）。
pub fn ensure_bundled_uploader(base_dir: &str) -> Result<String, String> {
    let dir = PathBuf::from(base_dir).join("uploader");
    let exe = dir.join("ModUploader.exe");
    let stamp = dir.join(".bundled_version");
    // 内置内容变化（换版本）时重写；stamp 内容 = 版本 + 内嵌文件字节数指纹
    let fingerprint = format!("v0.2.0 exe={} dll={}\n", UPLOADER_EXE.len(), STEAM_API_DLL.len());
    let needs_extract = match fs::read_to_string(&stamp) {
        Ok(s) => s != fingerprint,
        Err(_) => !exe.exists(), // 无 stamp 但 exe 在：视为用户手工放置，不覆盖
    };
    if needs_extract {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(&exe, UPLOADER_EXE).map_err(|e| e.to_string())?;
        fs::write(dir.join("steam_api64.dll"), STEAM_API_DLL).map_err(|e| e.to_string())?;
        fs::write(dir.join("steam_appid.txt"), STEAM_APPID).map_err(|e| e.to_string())?;
        fs::write(dir.join("NOTICE.txt"), UPLOADER_NOTICE).map_err(|e| e.to_string())?;
        fs::write(&stamp, fingerprint).map_err(|e| e.to_string())?;
    }
    Ok(exe.to_string_lossy().into_owned())
}

/// 生成上传工作区，返回 workspace 路径。
/// image.png：优先取第一张有立绘的卡；否则生成 1×1 透明 PNG 占位（提示用户替换）。
#[allow(clippy::too_many_arguments)]
pub fn prepare_workspace(
    out_root: &str,
    root: &str,
    meta: &ProjectMeta,
    version: &str,
    visibility: &str,
    change_note: &str,
    cards: &[CardDef],
) -> Result<String, String> {
    let pack_id = meta.pack_id.as_str();
    let ws = PathBuf::from(out_root).join(format!("{pack_id}_workshop"));
    let content = ws.join("content");
    fs::create_dir_all(&content).map_err(|e| e.to_string())?;

    // content/ = 卡包产物（json + pck），不带外层目录
    let pack_dir = crate::publish::build_pack(
        root,
        out_root,
        pack_id,
        &meta.name,
        &meta.author,
        &meta.description,
        version,
        cards,
    )?;
    for entry in fs::read_dir(&pack_dir).map_err(|e| e.to_string())? {
        let e = entry.map_err(|er| er.to_string())?;
        fs::copy(e.path(), content.join(e.file_name())).map_err(|er| er.to_string())?;
    }

    // workshop.json（字段名对齐官方 template）
    // dependencies：SpireForge Runtime 的工坊 id（项目设置里配置），
    // 玩家订阅卡包时 Steam 自动安装 Runtime——不写的话卡包加载会失败。
    let dependencies: Vec<String> = meta
        .runtime_workshop_id
        .map(|id| vec![id.to_string()])
        .unwrap_or_default();
    let visibility_norm = match visibility {
        "public" | "private" | "unlisted" | "friends_only" => visibility,
        _ => "private",
    };
    let ws_json = json!({
        "title": meta.name,
        "description": meta.description,
        "visibility": visibility_norm,
        "changeNote": if change_note.is_empty() { "None" } else { change_note },
        "tags": [],           // 上传后不可改，默认留空最稳
        "dependencies": dependencies,
        "contentDescriptors": []
    });
    atomic_write(
        &ws.join("workshop.json"),
        serde_json::to_string_pretty(&ws_json).unwrap_or_default().as_bytes(),
    )?;

    // 工坊 id 持久化：已发布过（meta.workshop_id）而工作区是新目录时恢复 mod_id.txt，
    // 避免换导出目录后误发布成新条目
    if let Some(id) = meta.workshop_id {
        let mod_id_path = ws.join("mod_id.txt");
        if !mod_id_path.exists() {
            fs::write(&mod_id_path, id.to_string()).map_err(|e| e.to_string())?;
        }
    }

    // image.png：取第一张卡的立绘；无则写 1×1 透明 PNG 占位
    let mut wrote_preview = false;
    for card in cards {
        if !card.portrait.is_empty() {
            let src = PathBuf::from(root).join(&card.portrait);
            if src.exists() {
                fs::copy(&src, ws.join("image.png")).map_err(|e| e.to_string())?;
                wrote_preview = true;
                break;
            }
        }
    }
    if !wrote_preview {
        fs::write(ws.join("image.png"), TINY_PNG).map_err(|e| e.to_string())?;
    }
    // 工坊限制：预览图 < 1MB
    if let Ok(meta) = fs::metadata(ws.join("image.png")) {
        if meta.len() > 1_000_000 {
            return Err(format!(
                "预览图 image.png 超过 1MB（{} 字节），Steam 后端会拒绝；请换更小的立绘",
                meta.len()
            ));
        }
    }

    Ok(ws.to_string_lossy().into_owned())
}

/// 调用官方 ModUploader 上传工作区。返回上传器输出。
/// duct 负责管道收集；这里做 15 分钟超时守护，超时 kill 子进程。
pub fn run_uploader(uploader: &str, workspace: &str) -> Result<String, String> {
    let exe = PathBuf::from(uploader);
    if !exe.exists() {
        return Err(format!("未找到 ModUploader.exe：{uploader}\n请从 github.com/MegaCrit/sts2-mod-uploader 下载并设置路径"));
    }
    let workdir = exe.parent().unwrap_or(Path::new(".")).to_path_buf();
    let handle = duct::cmd(exe, ["upload", "-w", workspace])
        .dir(workdir)
        .start()
        .map_err(|e| format!("启动上传器失败: {e}"))?;

    let deadline = Instant::now() + UPLOAD_TIMEOUT;
    let output = loop {
        match handle.try_wait() {
            Ok(Some(out)) => break out,
            Ok(None) if Instant::now() >= deadline => {
                let _ = handle.kill();
                let _ = handle.wait();
                return Err("上传超时（15 分钟）：请确认 Steam 客户端在线后重试".to_string());
            }
            Ok(None) => thread::sleep(Duration::from_millis(500)),
            Err(e) => return Err(format!("等待上传器失败: {e}")),
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let log = if stderr.trim().is_empty() { stdout } else { format!("{stdout}\n{stderr}") };
    if !output.status.success() {
        return Err(format!("上传失败（退出码 {:?}）:\n{log}", output.status.code()));
    }
    Ok(log)
}

/// 从工作区读取 mod_id.txt（首次上传后由 ModUploader 生成）
pub fn read_workshop_id(workspace: &str) -> Option<u64> {
    let raw = fs::read_to_string(PathBuf::from(workspace).join("mod_id.txt")).ok()?;
    raw.trim().parse::<u64>().ok()
}

/// 1×1 透明 PNG（占位预览图）
pub const TINY_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];
