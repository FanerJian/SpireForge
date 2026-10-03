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

/// 「添加至卡组」：把 Entry 清单合并写入 Runtime mod 目录的 sf_grant.json，
/// Runtime 每帧轮询即时消费——战斗外只加入本局主牌组；战斗中额外塞一张到手牌。
/// 消费即删除文件。
/// **登记只在游戏会话内有效**：游戏进程未运行时拒绝登记（不搞「下次启动生效」）；
/// 就算排队后没来得及消费就退出游戏，Runtime 启动时也会清掉遗留清单。
/// 拿卡清单登记结果（total = 清单总条数，added = 本次新增；消息由前端按界面语言拼装）
#[derive(Serialize)]
pub struct GrantQueueResult {
    pub total: usize,
    pub added: usize,
}

/// 游戏进程是否正在运行（tasklist 查询；duct 启动、不经 shell、参数全字面量）。
pub fn game_process_running() -> bool {
    let mut cmd = duct::cmd(
        "tasklist",
        ["/FI", "IMAGENAME eq SlayTheSpire2.exe", "/FO", "CSV", "/NH"],
    );
    // GUI 进程里起控制台子进程会闪黑框：CREATE_NO_WINDOW 隐藏
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd = cmd.before_spawn(|c| {
            c.creation_flags(0x0800_0000);
            Ok(())
        });
    }
    cmd.read()
        .map(|out| out.to_lowercase().contains("slaythespire2.exe"))
        .unwrap_or(false)
}

/// 原版 Entry 规范化（与 publish.rs 覆盖卡 Entry 规则一致）：
/// 原版 Entry 已是游戏的最终 Slugify 形态，不能再过 slugify（BASH 会被拆成 B_A_S_H），
/// 只做大写规范化 + 剔除非法字符。
fn normalize_vanilla_entry(s: &str) -> String {
    s.trim()
        .to_uppercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

/// 已安装进游戏的卡牌 Entry 全集（发放预检用）：
/// mods/*/<Pack>.pck 里 cards/*.json 的 id 按 card_entry(pack_id, id) 派生——
/// 与 Runtime PackLoader 的 Entry 派生规则一致；带 vanilla_id 的覆盖卡按原版 Entry
/// 登记；并上内嵌原版目录（原版卡不在 mods）。
fn installed_card_entries(game_dir: &str) -> std::collections::HashSet<String> {
    let mut set = crate::vanilla::vanilla_entries();
    let mods_dir = std::path::Path::new(game_dir).join("mods");
    let Ok(rd) = std::fs::read_dir(&mods_dir) else {
        return set;
    };
    for dir in rd.flatten() {
        let stem = dir.file_name().to_string_lossy().into_owned();
        let pck = dir.path().join(format!("{stem}.pck"));
        if !pck.exists() {
            continue;
        }
        // 清单：同名 <Pack>.json 的 "id"（缺省用目录名）
        let mut pack_id = stem.clone();
        if let Ok(raw) = std::fs::read_to_string(dir.path().join(format!("{stem}.json"))) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(id) = v.get("id").and_then(|x| x.as_str()) {
                    pack_id = id.to_string();
                }
            }
        }
        let Ok(entries) = pcktool::read_entries(&pck) else {
            continue;
        };
        for (name, data) in entries {
            if !name.contains("/cards/") || !name.ends_with(".json") {
                continue;
            }
            let Ok(txt) = String::from_utf8(data) else {
                continue;
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) else {
                continue;
            };
            // 单卡对象或卡牌数组都认；每张卡单独取（id, vanilla_id）
            let cards_json: Vec<&serde_json::Value> = match v.as_array() {
                Some(arr) => arr.iter().collect(),
                None => vec![&v],
            };
            for c in cards_json {
                let Some(id) = c.get("id").and_then(|x| x.as_str()) else {
                    continue;
                };
                // 覆盖卡（带 vanilla_id）：Runtime 是就地修补原版模板，不会注册包内派生
                // Entry——可发放身份就是原版 Entry 本身
                let vid = c
                    .get("vanilla_id")
                    .and_then(|x| x.as_str())
                    .unwrap_or_default()
                    .trim();
                if vid.is_empty() {
                    set.insert(crate::publish::card_entry(&pack_id, id));
                } else {
                    set.insert(normalize_vanilla_entry(vid));
                }
            }
        }
    }
    set
}

pub fn queue_card_grant(entries: Vec<String>) -> Result<GrantQueueResult, String> {
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
    // 登记只在游戏会话内有效：游戏没开就直接拒绝，绝不跨会话补发
    if !game_process_running() {
        return Err("GAME_NOT_RUNNING".into());
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
    // 发放预检：Entry 必须已经装进游戏（Runtime 才注册得出），
    // 否则到战斗开始只会留下一条玩家看不见的 not found 日志
    let installed = installed_card_entries(&settings.game_dir);
    for e in &merged {
        if !installed.contains(e) {
            return Err(format!("CARD_NOT_INSTALLED:{e}"));
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
    Ok(GrantQueueResult {
        total: merged.len(),
        added,
    })
}
