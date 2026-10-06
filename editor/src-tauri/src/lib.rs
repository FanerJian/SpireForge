mod custom_pools;
mod demo;
mod game;
mod game_catalog;
mod import;
mod model;
mod project;
mod publish;
mod update;
mod vanilla;
mod workshop;

use custom_pools::CustomPoolDef;
use game::EditorSettings;
use model::{CardDef, ProjectMeta};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;

/// 全局编辑器状态：当前项目根
pub struct AppState {
    pub project_root: Mutex<Option<String>>,
    pub settings: Mutex<EditorSettings>,
}

#[tauri::command]
fn detect_game_dir() -> Option<String> {
    game::detect_game_dir()
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> EditorSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn set_game_dir(state: State<AppState>, dir: String) -> Result<(), String> {
    if !game::validate_game_dir(&dir) {
        return Err(
            "目录中未找到 data_sts2_windows_x86_64/sts2.dll，请确认选择了游戏根目录".into(),
        );
    }
    let mut s = state.settings.lock().unwrap();
    s.game_dir = dir;
    game::save_settings(&s)
}

/// 登记到 Runtime 的拿卡清单（游戏内即时发放：入组 + 战斗中塞手牌）
#[tauri::command]
fn queue_card_grant(entries: Vec<String>) -> Result<game::GrantQueueResult, String> {
    game::queue_card_grant(entries)
}

/// 在自动分配的目录创建内置示例卡包（5 张演示卡 + 占位立绘）；path 省略时同 new_project 自动去重
#[tauri::command]
fn create_demo_project(path: Option<String>, state: State<AppState>) -> Result<String, String> {
    let path = match path {
        Some(p) if !p.trim().is_empty() => p,
        _ => project::auto_project_dir(&project::default_projects_root()?, "Demo")?,
    };
    demo::create_demo_project(&path)?;
    *state.project_root.lock().unwrap() = Some(path.clone());
    Ok(path)
}

/// 新建项目默认根目录（编辑器目录下 projects\；不可写时回落 Documents），前端展示去向用
#[tauri::command]
fn default_projects_root() -> Result<String, String> {
    project::default_projects_root().map(|p| p.to_string_lossy().into_owned())
}

/// 创建卡包项目。path 省略时自动放到编辑器目录 projects\ 下：
/// 文件夹与 pack_id 同名，重名自动加 _2/_3 后缀（用户无需选目录、无需改名）
#[tauri::command]
fn new_project(
    path: Option<String>,
    pack_id: String,
    name: String,
    author: String,
    state: State<AppState>,
) -> Result<String, String> {
    let path = match path {
        Some(p) if !p.trim().is_empty() => p,
        _ => project::auto_project_dir(&project::default_projects_root()?, &pack_id)?,
    };
    project::create_project(&path, &pack_id, &name, &author)?;
    *state.project_root.lock().unwrap() = Some(path.clone());
    Ok(path)
}

#[tauri::command]
fn open_project(
    path: String,
    state: State<AppState>,
) -> Result<(ProjectMeta, Vec<CardDef>), String> {
    let data = project::load_project(&path)?;
    *state.project_root.lock().unwrap() = Some(path);
    Ok(data)
}

fn require_root(state: &State<AppState>) -> Result<String, String> {
    state
        .project_root
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "尚未打开项目".into())
}

/// 当前项目 meta（前端发布后刷新元数据用）
#[tauri::command]
fn get_project_meta(state: State<AppState>) -> Result<ProjectMeta, String> {
    let root = require_root(&state)?;
    project::read_meta(&root)
}

#[tauri::command]
fn save_card(state: State<AppState>, card: CardDef) -> Result<(), String> {
    let root = require_root(&state)?;
    project::add_card(&root, &card)
}

/// 重命名卡牌（事务：新文件 → meta 原位替换 → 删旧文件；默认命名立绘跟随）。
/// 注意：改名会改变 Entry，已发布/安装过的卡会破坏存档引用，前端需先警告。
#[tauri::command]
fn rename_card(state: State<AppState>, old_id: String, new_id: String) -> Result<(), String> {
    let root = require_root(&state)?;
    project::rename_card(&root, &old_id, &new_id)
}

#[tauri::command]
fn delete_card(state: State<AppState>, id: String) -> Result<(), String> {
    let root = require_root(&state)?;
    project::remove_card(&root, &id)
}

#[tauri::command]
fn update_project_meta(state: State<AppState>, meta: ProjectMeta) -> Result<(), String> {
    let root = require_root(&state)?;
    project::write_meta(&root, &meta)
}

#[tauri::command]
fn read_game_pools(state: State<AppState>) -> Result<Vec<CustomPoolDef>, String> {
    let game_dir = state
        .settings
        .lock()
        .map_err(|_| "设置读取失败")?
        .game_dir
        .clone();
    custom_pools::read_game_pools(&game_dir)
}

#[tauri::command]
fn import_custom_pools(raw: String) -> Result<Vec<CustomPoolDef>, String> {
    custom_pools::parse_catalog(&raw)
}

/// 读取游戏内容目录（Runtime 导出的全部力量/怪物/卡牌，含 mod 内容）。
/// 文件不存在/损坏时报错，由前端静默降级为内置目录。
#[tauri::command]
fn read_game_catalog(state: State<AppState>) -> Result<game_catalog::RuntimeCatalog, String> {
    let game_dir = state
        .settings
        .lock()
        .map_err(|_| "设置读取失败")?
        .game_dir
        .clone();
    game_catalog::read_game_catalog(&game_dir)
}

#[tauri::command]
fn save_portrait(
    state: State<AppState>,
    id: String,
    ext: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let root = require_root(&state)?;
    project::save_portrait(&root, &id, &ext, &bytes)
}

#[tauri::command]
fn read_portrait(state: State<AppState>, rel: String) -> Result<Vec<u8>, String> {
    let root = require_root(&state)?;
    project::read_portrait_bytes(&root, &rel)
}

#[tauri::command]
fn import_card_json(state: State<AppState>, raw: String) -> Result<CardDef, String> {
    let root = require_root(&state)?;
    project::import_card_json(&root, &raw)
}

#[tauri::command]
fn export_card_json(state: State<AppState>, id: String) -> Result<String, String> {
    let root = require_root(&state)?;
    project::export_card_json(&root, &id)
}

/// 读取用户通过对话框选择的文本文件（导入卡牌 JSON 用）
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 写入用户通过对话框指定的文本文件（导出卡牌 JSON 用）
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// 卡牌 id 去重：与现有及本批已用 id 冲突时追加 _2/_3…
fn dedup_id(used: &mut HashSet<String>, base: &str) -> String {
    if !used.contains(base) {
        used.insert(base.to_string());
        return base.to_string();
    }
    let mut n = 2;
    loop {
        let cand = format!("{base}_{n}");
        if !used.contains(&cand) {
            used.insert(cand.clone());
            return cand;
        }
        n += 1;
    }
}

/// 导入他人制作的卡牌（原生格式完整保真；外来格式启发式映射并返回说明）
#[tauri::command]
fn import_card_any(state: State<AppState>, raw: String) -> Result<import::ImportReport, String> {
    let report = import::import_any(&raw)?;
    let root = require_root(&state)?;
    let meta = project::read_meta(&root)?;
    let mut used: HashSet<String> = meta.cards.iter().cloned().collect();
    let mut card = report.card;
    card.id = dedup_id(&mut used, &card.id);
    project::add_card(&root, &card)?;
    Ok(import::ImportReport { card, ..report })
}

/// 批量导入卡牌 JSON（数组 / {cards:[...]} / SpireForge 整包），逐张入库并自动去重 id
#[tauri::command]
fn import_cards_any(
    state: State<AppState>,
    raw: String,
) -> Result<Vec<import::ImportReport>, String> {
    let reports = import::import_many(&raw)?;
    let root = require_root(&state)?;
    let meta = project::read_meta(&root)?;
    let mut used: HashSet<String> = meta.cards.iter().cloned().collect();
    let mut out = Vec::new();
    for r in reports {
        let mut card = r.card;
        card.id = dedup_id(&mut used, &card.id);
        project::add_card(&root, &card)?;
        out.push(import::ImportReport { card, ..r });
    }
    Ok(out)
}

/// 从 .pck 卡包导入：解出 cards/*.json 与 images/ 立绘；立绘按卡牌最终 id
/// 落盘到 assets/cards/（导入→再打包不再丢图），找不到图的卡清空 portrait 并说明
#[tauri::command]
fn import_pack_pck(
    state: State<AppState>,
    path: String,
) -> Result<import::PckImportResult, String> {
    let result = import::import_pck(&path)?;
    let root = require_root(&state)?;
    let meta = project::read_meta(&root)?;
    let mut used: HashSet<String> = meta.cards.iter().cloned().collect();
    let mut imported = Vec::new();
    for r in result.imported {
        let mut r = r;
        let mut card = r.card;
        card.id = dedup_id(&mut used, &card.id);
        if !card.portrait.is_empty() {
            // 包内 portrait 是 PCK 内路径（images/cards/x.png），按最后一段文件名匹配解出的图
            let fname = card
                .portrait
                .rsplit('/')
                .next()
                .unwrap_or_default()
                .to_string();
            card.portrait = match result.images.iter().find(|i| i.file_name == fname) {
                Some(img) => {
                    let ext = fname.rsplit('.').next().unwrap_or("png").to_string();
                    match project::save_portrait(&root, &card.id, &ext, &img.data) {
                        Ok(rel) => rel,
                        Err(e) => {
                            r.notes
                                .push(format!("立绘 {fname} 落盘失败（{e}），已移除引用"));
                            String::new()
                        }
                    }
                }
                None => {
                    r.notes.push(format!("包内未找到立绘 {fname}，已移除引用"));
                    String::new()
                }
            };
        }
        project::add_card(&root, &card)?;
        imported.push(import::ImportReport { card, ..r });
    }
    Ok(import::PckImportResult {
        imported,
        errors: result.errors,
        images: vec![],
    })
}

/// 原版卡牌目录（导入原版卡用）
#[tauri::command]
fn vanilla_catalog() -> serde_json::Value {
    vanilla::catalog().clone()
}

/// 确保内置 ModUploader 已释放；未设置上传器路径时自动指向内置副本
#[tauri::command]
fn ensure_bundled_uploader(state: State<AppState>) -> Result<String, String> {
    let base = game::data_dir()
        .ok_or("无法定位应用数据目录")?
        .to_string_lossy()
        .into_owned();
    let exe = workshop::ensure_bundled_uploader(&base)?;
    let mut s = state.settings.lock().unwrap();
    let need = match &s.uploader_path {
        Some(p) => !std::path::Path::new(p).exists(),
        None => true,
    };
    if need {
        s.uploader_path = Some(exe.clone());
        game::save_settings(&s)?;
    }
    Ok(exe)
}

/// 设置 ModUploader.exe 路径
#[tauri::command]
fn set_uploader_path(state: State<AppState>, path: String) -> Result<(), String> {
    let mut s = state.settings.lock().unwrap();
    s.uploader_path = if path.is_empty() { None } else { Some(path) };
    game::save_settings(&s)
}

/// 把本次构建版本记入 project.json（发布面板的版本号默认值，避免更新时忘改）
fn touch_last_version(root: &str, meta: &ProjectMeta, version: &str) -> Result<(), String> {
    if meta.last_version.as_deref() == Some(version) {
        return Ok(());
    }
    let mut m = meta.clone();
    m.last_version = Some(version.to_string());
    project::write_meta(root, &m)
}

/// 构建卡包到指定目录（不安装）
#[tauri::command]
fn build_pack(state: State<AppState>, out_dir: String, version: String) -> Result<String, String> {
    let root = require_root(&state)?;
    let (meta, cards) = project::load_project(&root)?;
    let dir = publish::build_pack(
        &root,
        &out_dir,
        &meta.pack_id,
        &meta.name,
        &meta.author,
        &meta.description,
        &version,
        &cards,
    )?;
    touch_last_version(&root, &meta, &version)?;
    Ok(dir.to_string_lossy().into_owned())
}

/// install_to_game 的结果（game_running=true 时前端提示需重启游戏生效——PCK 是游戏启动时挂载的，运行中覆盖安装不会热加载）
#[derive(serde::Serialize)]
pub struct InstallResult {
    pub dir: String,
    pub game_running: bool,
}

/// 检测/安装内置 Runtime 前置 mod 到游戏 mods（幂等、防降级、游戏锁文件时返回 locked）
#[tauri::command]
fn ensure_runtime(state: State<AppState>) -> Result<game::RuntimeEnsure, String> {
    let game_dir = state.settings.lock().unwrap().game_dir.clone();
    if game_dir.is_empty() {
        return Err("尚未配置游戏目录".into());
    }
    game::ensure_bundled_runtime(&game_dir)
}

/// 一键安装到游戏 mods 目录
#[tauri::command]
fn install_to_game(state: State<AppState>, version: String) -> Result<InstallResult, String> {
    let root = require_root(&state)?;
    let game_dir = state.settings.lock().unwrap().game_dir.clone();
    if game_dir.is_empty() {
        return Err("尚未配置游戏目录".into());
    }
    // 前置 mod 兜底：缺失/过期时自动装（游戏运行中锁文件则保持现版本，不阻断装包）
    let _ = game::ensure_bundled_runtime(&game_dir);
    let (meta, cards) = project::load_project(&root)?;
    if cards.is_empty() {
        return Err("卡包中没有卡牌".into());
    }
    let dir = publish::install_to_game(
        &game_dir,
        &root,
        &meta.pack_id,
        &meta.name,
        &meta.author,
        &meta.description,
        &version,
        &cards,
    )?;
    touch_last_version(&root, &meta, &version)?;
    Ok(InstallResult {
        dir,
        game_running: game::game_process_running(),
    })
}

/// 发布前预检：Entry 冲突 / vanilla_id 重复 / 空 custom handler / 缺失文案等
#[tauri::command]
fn validate_project(state: State<AppState>) -> Result<Vec<String>, String> {
    let root = require_root(&state)?;
    let (meta, cards) = project::load_project(&root)?;
    Ok(publish::preflight_with_pools(
        &meta.pack_id,
        &cards,
        &meta.custom_pools,
    ))
}

/// 生成工坊上传工作区（dependencies 按 meta.runtime_workshop_id 写入；
/// meta.workshop_id 恢复 mod_id.txt，防换目录误发新条目）
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn prepare_workshop(
    state: State<AppState>,
    out_dir: String,
    version: String,
    visibility: String,
    change_note: String,
) -> Result<String, String> {
    let root = require_root(&state)?;
    let (meta, cards) = project::load_project(&root)?;
    if cards.is_empty() {
        return Err("卡包中没有卡牌".into());
    }
    let ws = workshop::prepare_workspace(
        &out_dir,
        &root,
        &meta,
        &version,
        &visibility,
        &change_note,
        &cards,
    )?;
    touch_last_version(&root, &meta, &version)?;
    Ok(ws)
}

/// 调用官方 ModUploader 上传；成功后把 mod_id.txt 回写进项目 meta
#[tauri::command]
fn publish_workshop(state: State<AppState>, workspace: String) -> Result<String, String> {    let uploader = state
        .settings
        .lock()
        .unwrap()
        .uploader_path
        .clone()
        .ok_or("尚未设置 ModUploader.exe 路径（设置 → 工坊上传器）")?;
    let log = workshop::run_uploader(&uploader, &workspace)?;
    if let Some(root) = state.project_root.lock().unwrap().clone() {
        if let Some(id) = workshop::read_workshop_id(&workspace) {
            if let Ok(mut meta) = project::read_meta(&root) {
                if meta.workshop_id != Some(id) {
                    meta.workshop_id = Some(id);
                    let _ = project::write_meta(&root, &meta);
                }
            }
        }
    }
    Ok(log)
}

// ---- 自动更新（实现在 update.rs；此处为命令薄包装，与项目惯例一致）----

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<update::UpdateCheck>, String> {
    update::check_update(app).await
}

#[tauri::command]
async fn download_update(
    app: tauri::AppHandle,
    urls: Vec<String>,
    sha256: String,
    size: u64,
) -> Result<String, String> {
    update::download_update(app, urls, sha256, size).await
}

#[tauri::command]
fn apply_update(app: tauri::AppHandle, path: String) -> Result<bool, String> {
    update::apply_update(app, path)
}

#[tauri::command]
fn open_release_page(app: tauri::AppHandle) -> Result<(), String> {
    update::open_release_page(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            project_root: Mutex::new(None),
            settings: Mutex::new(game::load_settings()),
        })
        .setup(|_app| {
            // 上一轮自动更新的 editor.exe.old 残留清理（删不掉留给下次启动）
            update::cleanup_old_update();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_game_dir,
            get_settings,
            set_game_dir,
            check_update,
            download_update,
            apply_update,
            open_release_page,
            ensure_runtime,
            queue_card_grant,
            create_demo_project,
            new_project,
            default_projects_root,
            open_project,
            get_project_meta,
            save_card,
            rename_card,
            delete_card,
            update_project_meta,
            read_game_pools,
            import_custom_pools,
            read_game_catalog,
            save_portrait,
            read_portrait,
            import_card_json,
            export_card_json,
            read_text_file,
            write_text_file,
            build_pack,
            install_to_game,
            import_card_any,
            import_cards_any,
            import_pack_pck,
            validate_project,
            vanilla_catalog,
            ensure_bundled_uploader,
            set_uploader_path,
            prepare_workshop,
            publish_workshop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
