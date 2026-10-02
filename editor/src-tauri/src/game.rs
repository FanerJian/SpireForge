//! Steam / 游戏目录自动检测 + 编辑器设置持久化。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const GAME_DIR_NAME: &str = "Slay the Spire 2";

/// 从 Steam libraryfolders.vdf 解析库目录
fn steam_libraries(steam_root: &str) -> Vec<String> {
    let vdf = PathBuf::from(steam_root).join("steamapps/libraryfolders.vdf");
    let mut libs = vec![steam_root.to_string()];
    if let Ok(text) = fs::read_to_string(&vdf) {
        for line in text.lines() {
            let line = line.trim();
            if let Some(rest) = line.strip_suffix('"') {
                if let Some(idx) = rest.rfind("\"path\"") {
                    // "path"      "D:\steam"  → 提取最后一个引号内的值
                    let val_part = rest[idx + 6..].trim();
                    if let Some(v) = val_part.strip_prefix('"') {
                        libs.push(v.replace("\\\\", "\\"));
                    }
                }
            }
        }
    }
    libs
}

fn game_in(lib: &str) -> Option<String> {
    let p = PathBuf::from(lib)
        .join("steamapps/common")
        .join(GAME_DIR_NAME);
    let dll = p.join("data_sts2_windows_x86_64/sts2.dll");
    if dll.exists() {
        Some(p.to_string_lossy().replace('/', "\\"))
    } else {
        None
    }
}

/// 常见路径 + vdf 扫描；找不到返回 None（用户可手动指定）
pub fn detect_game_dir() -> Option<String> {
    let mut steam_roots: Vec<String> = vec![
        "C:/Program Files (x86)/Steam".into(),
        "C:/Program Files/Steam".into(),
        "D:/Steam".into(),
        "D:/steam".into(),
        "E:/Steam".into(),
        "E:/steam".into(),
    ];
    if let Ok(v) = std::env::var("ProgramFiles(x86)") {
        steam_roots.insert(0, format!("{v}/Steam"));
    }
    for root in &steam_roots {
        if !PathBuf::from(root).exists() {
            continue;
        }
        for lib in steam_libraries(root) {
            if let Some(g) = game_in(&lib) {
                return Some(g);
            }
        }
    }
    None
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct EditorSettings {
    pub game_dir: String,
    /// runtime mod 已部署的版本标记
    pub runtime_version: Option<String>,
    /// ModUploader.exe 的路径（M5 用）
    pub uploader_path: Option<String>,
}

pub fn settings_path() -> Option<PathBuf> {
    let base = dirs_data_dir()?;
    Some(base.join("settings.json"))
}

/// 应用数据目录（内置上传器等附属文件的释放位置）
pub fn data_dir() -> Option<PathBuf> {
    dirs_data_dir()
}

fn dirs_data_dir() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    Some(PathBuf::from(appdata).join("com.spireforge.editor"))
}

pub fn load_settings() -> EditorSettings {
    settings_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_settings(settings: &EditorSettings) -> Result<(), String> {
    let p = settings_path().ok_or("无法定位设置目录")?;
    fs::create_dir_all(p.parent().unwrap()).map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    crate::project::atomic_write(&p, raw.as_bytes())
}

/// 校验游戏目录（sts2.dll 存在）
pub fn validate_game_dir(dir: &str) -> bool {
    PathBuf::from(dir)
        .join("data_sts2_windows_x86_64/sts2.dll")
        .exists()
}

/// 「一键在游戏中获得卡」：把 Entry 清单合并写入 Runtime mod 目录的 sf_grant.json，
/// Runtime 在下一场战斗开始（首次抽牌前）消费一次——战斗中加入抽牌堆，
/// 非战斗加入牌组，然后删除文件。返回 (登记总数, 本次新增数) 文案。
pub fn queue_card_grant(entries: Vec<String>) -> Result<String, String> {
    let settings = load_settings();
    if settings.game_dir.is_empty() {
        return Err("未配置游戏目录".into());
    }
    let runtime_dir = PathBuf::from(&settings.game_dir)
        .join("mods")
        .join("SpireForgeRuntime");
    if !runtime_dir.is_dir() {
        return Err("游戏 mods 里还没有 SpireForgeRuntime，请先在发布面板「一键安装到游戏」".into());
    }
    let path = runtime_dir.join("sf_grant.json");

    // 合并已有清单（保留顺序、去重）
    let mut merged: Vec<String> = Vec::new();
    if let Ok(raw) = fs::read_to_string(&path) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(arr) = v.get("entries").and_then(|e| e.as_array()) {
                for e in arr {
                    if let Some(s) = e.as_str() {
                        if !s.is_empty() {
                            merged.push(s.to_string());
                        }
                    }
                }
            }
        }
    }
    let mut added = 0usize;
    for e in entries {
        let e = e.trim().to_uppercase();
        if !e.is_empty() && !merged.contains(&e) {
            merged.push(e);
            added += 1;
        }
    }
    let payload = serde_json::json!({ "entries": merged });
    let tmp = runtime_dir.join("sf_grant.json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    // Windows rename 覆盖已有文件会失败，先删旧文件
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(format!(
        "已登记 {} 张卡（本次新增 {}）",
        merged.len(),
        added
    ))
}
