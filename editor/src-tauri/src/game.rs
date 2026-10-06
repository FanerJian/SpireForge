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

// ---- 内置 Runtime 前置 mod（自动安装，玩家零手动配置）----

/// 构建期内嵌 runtime/dist 产物（更新 Runtime 后重跑 `runtime/dist/刷新.cmd` 或手动覆盖+SHA256）
const BUNDLED_RUNTIME_DLL: &[u8] = include_bytes!("../../../runtime/dist/SpireForgeRuntime.dll");
const BUNDLED_RUNTIME_JSON: &[u8] = include_bytes!("../../../runtime/dist/SpireForgeRuntime.json");

/// Runtime mod 自动安装结果（前端按 action 拼 i18n 提示）
#[derive(Serialize)]
pub struct RuntimeEnsure {
    /// current = 已是最新；installed = 首次安装；updated = 升级；locked = 游戏锁文件暂缓
    pub action: String,
    pub version: String,
}

fn bundled_runtime_version() -> String {
    serde_json::from_slice::<serde_json::Value>(BUNDLED_RUNTIME_JSON)
        .ok()
        .and_then(|v| v.get("version").and_then(|x| x.as_str()).map(|s| s.to_string()))
        .unwrap_or_default()
}

fn manifest_version(raw: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|v| v.get("version").and_then(|x| x.as_str()).map(|s| s.to_string()))
}

/// 语义化版本比较（x.y.z 逐段数值，缺失段按 0）；任一侧无法解析时退回字符串相等
fn version_ge(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> Option<Vec<u64>> {
        s.split('.').map(|p| p.trim().parse::<u64>().ok()).collect()
    };
    match (parse(a), parse(b)) {
        (Some(x), Some(y)) => {
            let n = x.len().max(y.len());
            for i in 0..n {
                let (a1, b1) = (
                    x.get(i).copied().unwrap_or(0),
                    y.get(i).copied().unwrap_or(0),
                );
                if a1 != b1 {
                    return a1 > b1;
                }
            }
            true
        }
        _ => a == b,
    }
}

/// 检测/安装入口：幂等 + 记录版本标记到设置
pub fn ensure_bundled_runtime(game_dir: &str) -> Result<RuntimeEnsure, String> {
    let r = ensure_bundled_runtime_into(game_dir)?;
    if matches!(r.action.as_str(), "current" | "installed" | "updated") {
        mark_runtime_version(&r.version);
    }
    Ok(r)
}

/// 核心安装逻辑（无设置副作用，可测）：
/// 目标已是最新 → 不动；现有版本比内置新（如工坊装了更新版）→ 不降级；
/// 游戏运行中 DLL 被锁 → 跳过写入（旧版仍可用，返回 locked，下次再升）。
/// 先写 DLL 后写 manifest：中途失败不会出现"json 说新版、dll 是旧版"的错位。
fn ensure_bundled_runtime_into(game_dir: &str) -> Result<RuntimeEnsure, String> {
    let dir = PathBuf::from(game_dir).join("mods").join("SpireForgeRuntime");
    let json_path = dir.join("SpireForgeRuntime.json");
    let dll_path = dir.join("SpireForgeRuntime.dll");
    let bundled = bundled_runtime_version();

    let existing = fs::read_to_string(&json_path).ok().and_then(|s| manifest_version(&s));
    if dll_path.exists()
        && existing.as_deref().map(|e| version_ge(e, &bundled)).unwrap_or(false)
    {
        return Ok(RuntimeEnsure {
            action: "current".into(),
            version: existing.unwrap_or(bundled),
        });
    }

    fs::create_dir_all(&dir).map_err(|e| format!("创建 mods/SpireForgeRuntime 失败: {e}"))?;
    let action = if existing.is_some() { "updated" } else { "installed" };
    match fs::write(&dll_path, BUNDLED_RUNTIME_DLL) {
        Ok(()) => {
            fs::write(&json_path, BUNDLED_RUNTIME_JSON)
                .map_err(|e| format!("写入 SpireForgeRuntime.json 失败: {e}"))?;
            Ok(RuntimeEnsure { action: action.into(), version: bundled })
        }
        // 游戏运行中 DLL 被锁：保留现版本，退出游戏后下次启动编辑器自动补
        Err(_) if dll_path.exists() => Ok(RuntimeEnsure { action: "locked".into(), version: bundled }),
        Err(e) => Err(format!("写入 SpireForgeRuntime.dll 失败: {e}")),
    }
}

fn mark_runtime_version(v: &str) {
    let mut s = load_settings();
    if s.runtime_version.as_deref() != Some(v) {
        s.runtime_version = Some(v.to_string());
        let _ = save_settings(&s);
    }
}

#[cfg(test)]
mod runtime_tests {
    use super::*;

    #[test]
    fn ensure_installs_and_is_idempotent() {
        let g = std::env::temp_dir().join("sf_ensure_rt_test");
        let _ = std::fs::remove_dir_all(&g);
        std::fs::create_dir_all(&g).unwrap();
        // 首次安装：DLL 与 manifest 都落位
        let r1 = ensure_bundled_runtime_into(g.to_str().unwrap()).unwrap();
        assert_eq!(r1.action, "installed", "first run should install");
        let dll = g.join("mods/SpireForgeRuntime/SpireForgeRuntime.dll");
        assert!(dll.exists());
        assert_eq!(
            std::fs::read(&dll).unwrap().len(),
            BUNDLED_RUNTIME_DLL.len()
        );
        // 幂等：已是最新
        let r2 = ensure_bundled_runtime_into(g.to_str().unwrap()).unwrap();
        assert_eq!(r2.action, "current", "second run should be no-op");
        std::fs::remove_dir_all(&g).ok();
    }

    #[test]
    fn version_compare_segments() {
        assert!(version_ge("0.1.0", "0.1.0"));
        assert!(version_ge("0.2.0", "0.1.9"));
        assert!(!version_ge("0.1.0", "0.2.0"));
        assert!(version_ge("1.0", "0.9.9"));
        assert!(version_ge("0.1.0", "0.1"));
    }

    #[test]
    fn parses_mod_enable_list_with_bom_and_skips_garbage() {
        // 实测 settings.save 带 UTF-8 BOM；MyPack/Demo/SFDeepPack 曾全部 is_enabled=false
        let raw = "\u{feff}{\"mod_settings\":{\"mod_list\":[\
            {\"id\":\"SpireForgeRuntime\",\"is_enabled\":true,\"source\":\"mods_directory\"},\
            {\"id\":\"MyPack\",\"is_enabled\":false,\"source\":\"mods_directory\"},\
            {\"id\":\"Watcher\",\"is_enabled\":true,\"source\":\"steam_workshop\"}]}}";
        let m = parse_mod_enable_list(raw).unwrap();
        assert_eq!(m.get("MyPack"), Some(&false));
        assert_eq!(m.get("SpireForgeRuntime"), Some(&true));
        assert_eq!(m.get("Watcher"), Some(&true));
        assert_eq!(m.get("不存在的"), None);
        // 无 BOM 也能解析；坏结构 / 坏 JSON 一律 None（预检跳过）
        assert!(parse_mod_enable_list(raw.strip_prefix('\u{feff}').unwrap_or(raw)).is_some());
        assert!(parse_mod_enable_list("{\"mod_settings\":{}}").is_none());
        assert!(parse_mod_enable_list("not json").is_none());
    }
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
/// 同时返回 Entry → 包 ID 映射（原版目录条目无包，不入映射），供启用状态预检定位卡包。
fn installed_card_entries(
    game_dir: &str,
) -> (
    std::collections::HashSet<String>,
    std::collections::HashMap<String, String>,
) {
    let mut set = crate::vanilla::vanilla_entries();
    let mut pack_of: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mods_dir = std::path::Path::new(game_dir).join("mods");
    let Ok(rd) = std::fs::read_dir(&mods_dir) else {
        return (set, pack_of);
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
                let entry = if vid.is_empty() {
                    crate::publish::card_entry(&pack_id, id)
                } else {
                    normalize_vanilla_entry(vid)
                };
                set.insert(entry.clone());
                pack_of.insert(entry, pack_id.clone());
            }
        }
    }
    (set, pack_of)
}

/// 解析 settings.save 的 mod 启用表（纯函数，可测）。
/// 游戏写出的文件带 UTF-8 BOM（serde_json 不接受，需先剔除）；
/// 结构不对返回 None（预检跳过，绝不因猜不透的文件把发放拦死）。
fn parse_mod_enable_list(raw: &str) -> Option<std::collections::HashMap<String, bool>> {
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw);
    let v = serde_json::from_str::<serde_json::Value>(raw).ok()?;
    let list = v
        .get("mod_settings")?
        .get("mod_list")?
        .as_array()?;
    let mut out = std::collections::HashMap::new();
    for m in list {
        let Some(id) = m.get("id").and_then(|x| x.as_str()) else {
            continue;
        };
        let enabled = m.get("is_enabled").and_then(|x| x.as_bool()).unwrap_or(false);
        out.insert(id.to_string(), enabled);
    }
    Some(out)
}

/// 游戏 mod 启用状态（%APPDATA%\SlayTheSpire2\steam\<账号>\settings.save，
/// 多账号取最近修改的）。读不到/解析不了返回 None——跳过启用预检，
/// 让 Runtime 端的日志兜底（那里会留下 not found）。
fn game_mod_enabled() -> Option<std::collections::HashMap<String, bool>> {
    let appdata = std::env::var("APPDATA").ok()?;
    let root = std::path::Path::new(&appdata).join("SlayTheSpire2").join("steam");
    let rd = fs::read_dir(&root).ok()?;
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for dir in rd.flatten() {
        let p = dir.path().join("settings.save");
        if let Ok(meta) = fs::metadata(&p) {
            let mtime = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
            if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
                best = Some((mtime, p));
            }
        }
    }
    let (_, path) = best?;
    let raw = fs::read_to_string(&path).ok()?;
    parse_mod_enable_list(&raw)
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
    // 否则到战斗开始只会留下一条玩家看不见的 not found 日志；
    // 再查卡包 mod 在游戏里的启用状态——被禁用 = PCK 不挂载 = 注册不出，
    // 实测 MyPack 被禁时表现完全一致（godot.log: "Skipping loading mod ... disabled"）
    let (installed, pack_of) = installed_card_entries(&settings.game_dir);
    let mod_enabled = game_mod_enabled();
    for e in &merged {
        if !installed.contains(e) {
            return Err(format!("CARD_NOT_INSTALLED:{e}"));
        }
        if let Some(mod_enabled) = &mod_enabled {
            if let Some(pack) = pack_of.get(e) {
                match mod_enabled.get(pack) {
                    Some(false) => return Err(format!("GAME_MOD_DISABLED:{pack}")),
                    None => return Err(format!("GAME_MOD_NOT_DETECTED:{pack}")),
                    _ => {}
                }
            }
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
