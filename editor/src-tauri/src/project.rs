//! 项目磁盘 IO：<project>/project.json + cards/<id>.json + assets/cards/*
//!
//! 写入安全约定：
//! - 所有落盘走 atomic_write（临时文件 + .bak 备份 + 改名），崩溃不会留下半截文件
//! - meta（project.json）是全项目索引：删除卡先改 meta 再删文件——中途失败最多
//!   留下孤儿文件，绝不会出现 meta 引用不存在文件导致整个项目打不开
//! - pack_id / 卡牌 id / 立绘相对路径在拼接文件路径前一律校验（防路径逃逸）

use crate::model::{CardDef, ProjectMeta, FORMAT_VERSION};
use std::fs;
use std::path::{Component, Path, PathBuf};

pub fn meta_path(root: &str) -> PathBuf {
    PathBuf::from(root).join("project.json")
}

fn card_path(root: &str, id: &str) -> PathBuf {
    PathBuf::from(root).join("cards").join(format!("{id}.json"))
}

// ---- 写入安全 ----

/// 原子写盘：写 .tmp → 旧文件改名 .bak → .tmp 改名到位。
/// 任何一步失败都不会损坏原文件；.bak 保留上一版内容供手工恢复。
pub fn atomic_write(path: &Path, data: &[u8]) -> Result<(), String> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    let mut bak = path.as_os_str().to_owned();
    bak.push(".bak");
    let bak = PathBuf::from(bak);
    fs::write(&tmp, data).map_err(|e| format!("写入 {} 失败: {e}", tmp.display()))?;
    if path.exists() {
        fs::rename(path, &bak).map_err(|e| format!("备份 {} 失败: {e}", path.display()))?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        // Windows 提交失败时把原文件放回，保证项目仍可读取。
        if !path.exists() && bak.exists() {
            fs::copy(&bak, path).map_err(|restore| {
                format!("提交 {} 失败: {e}；还原失败: {restore}（原内容保留在 {}）", path.display(), bak.display())
            })?;
        }
        return Err(format!("提交 {} 失败: {e}", path.display()));
    }
    Ok(())
}

/// pack_id 校验：`^[A-Za-z][A-Za-z0-9_]{1,63}$`，且不是 Windows 保留设备名。
/// pack_id 会直接成为目录名（<out>/<pack_id>/）与工坊 mod id，必须严格限制。
pub fn validate_pack_id(id: &str) -> Result<(), String> {
    let mut chars = id.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() => {}
        _ => return Err("包 id 必须以字母开头".into()),
    }
    let rest_ok = chars.all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !rest_ok || id.len() < 2 || id.len() > 64 {
        return Err("包 id 只能包含字母、数字和下划线（2–64 位，字母开头）".into());
    }
    if is_device_name(id) {
        return Err(format!("包 id 不能使用 Windows 保留名 {id}"));
    }
    Ok(())
}

fn is_device_name(name: &str) -> bool {
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    RESERVED.iter().any(|r| r.eq_ignore_ascii_case(name))
}

/// 卡牌 id 校验（文件名基础）：小写字母/数字/下划线，非空 ≤64
pub fn validate_card_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 64 {
        return Err("卡牌 id 不能为空且不超过 64 字符".into());
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err("卡牌 id 只能包含小写字母、数字和下划线".into());
    }
    if is_device_name(id) {
        return Err(format!("卡牌 id 不能使用 Windows 保留名 {id}"));
    }
    Ok(())
}

/// 项目内相对路径校验：拒绝绝对路径、盘符、`..` 等任何目录逃逸成分
pub fn validate_rel_path(rel: &str) -> Result<(), String> {
    if rel.is_empty() {
        return Err("路径不能为空".into());
    }
    // Windows 的备用数据流、设备名与尾部别名会绕过普通路径成分检查。
    for part in rel.split(['/', '\\']) {
        if part.chars().any(|c| c.is_control() || "<>:\"|?*".contains(c))
            || part.ends_with(['.', ' '])
            || is_device_name(part.split('.').next().unwrap_or_default())
        {
            return Err(format!("路径包含非法文件名: {rel}"));
        }
    }
    let p = Path::new(rel);
    if p.is_absolute() {
        return Err(format!("路径必须是项目内相对路径: {rel}"));
    }
    for comp in p.components() {
        match comp {
            Component::Normal(_) => {}
            _ => return Err(format!("路径包含非法成分（只允许 相对路径/文件名）: {rel}")),
        }
    }
    Ok(())
}

// ---- 版本检查 ----

fn check_card_version(fmt: u32) -> Result<(), String> {
    if fmt > FORMAT_VERSION {
        return Err(format!(
            "卡牌格式版本 {fmt} 高于当前支持版本 {FORMAT_VERSION}，请升级编辑器后再打开（旧版编辑器保存会丢失新字段）"
        ));
    }
    Ok(())
}

// ---- 基础 IO ----

pub fn read_meta(root: &str) -> Result<ProjectMeta, String> {
    let raw = fs::read_to_string(meta_path(root)).map_err(|e| e.to_string())?;
    let meta: ProjectMeta = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if meta.format_version > FORMAT_VERSION {
        return Err(format!(
            "项目格式版本 {} 高于当前支持版本 {}，请升级编辑器后再打开",
            meta.format_version, FORMAT_VERSION
        ));
    }
    validate_meta_ids(&meta)?;
    crate::custom_pools::validate_pools(&meta.custom_pools)?;
    crate::rules::ensure_statuses(&meta.rule_statuses)?;
    crate::rules::ensure_templates(&meta.rule_templates)?;
    Ok(meta)
}

fn validate_meta_ids(meta: &ProjectMeta) -> Result<(), String> {
    validate_pack_id(&meta.pack_id)?;
    let mut ids = std::collections::HashSet::new();
    for id in &meta.cards {
        validate_card_id(id)?;
        if !ids.insert(id) {
            return Err(format!("项目索引中卡牌 id 重复: {id}"));
        }
    }
    Ok(())
}

/// 新建项目的默认根目录：编辑器 exe 同级的 projects\（便携约定，项目跟着编辑器走）。
/// 开发机构建（exe 在 target\release|debug 下）改放其上两级的 editor\ 目录——
/// cargo clean 会整目录删掉 target，用户项目不能跟着构建产物陪葬。
/// exe 目录不可写（如被放进 Program Files）时回落到 用户\Documents\SpireForge\projects。
pub fn default_projects_root() -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let mut base = dir.to_path_buf();
            let is_cargo_out = dir
                .file_name()
                .map(|n| n == "release" || n == "debug")
                .unwrap_or(false)
                && dir.parent().map(|p| p.file_name() == Some(std::ffi::OsStr::new("target"))).unwrap_or(false);
            if is_cargo_out {
                if let Some(editor_dir) = dir.parent().and_then(|t| t.parent()).and_then(|c| c.parent()) {
                    base = editor_dir.to_path_buf();
                }
            }
            let primary = base.join("projects");
            if fs::create_dir_all(&primary).is_ok() {
                return Ok(primary);
            }
        }
    }
    let home = std::env::var("USERPROFILE").map_err(|_| "无法定位用户目录".to_string())?;
    let fallback = PathBuf::from(home)
        .join("Documents")
        .join("SpireForge")
        .join("projects");
    fs::create_dir_all(&fallback).map_err(|e| format!("创建项目根目录失败: {e}"))?;
    Ok(fallback)
}

/// 在根目录下给 pack_id 分配不重名的项目文件夹：MyPack → MyPack、MyPack_2、MyPack_3…
/// 目录名只用于存储，包身份以 meta.pack_id 为准；validate_pack_id 顺带挡掉 Windows 保留名
pub fn auto_project_dir(root: &Path, pack_id: &str) -> Result<String, String> {
    validate_pack_id(pack_id)?;
    let mut n = 1;
    loop {
        let name = if n == 1 { pack_id.to_string() } else { format!("{pack_id}_{n}") };
        if !root.join(&name).exists() {
            return Ok(root.join(name).to_string_lossy().into_owned());
        }
        n += 1;
    }
}

pub fn create_project(root: &str, pack_id: &str, name: &str, author: &str) -> Result<(), String> {
    validate_pack_id(pack_id)?;
    let root_dir = PathBuf::from(root);
    if root_dir.exists()
        && fs::read_dir(&root_dir)
            .map(|mut d| d.next().is_some())
            .unwrap_or(false)
    {
        return Err("目标目录非空，请选择空目录".into());
    }
    fs::create_dir_all(root_dir.join("cards")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root_dir.join("assets/cards")).map_err(|e| e.to_string())?;
    let meta = ProjectMeta {
        format_version: FORMAT_VERSION,
        pack_id: pack_id.into(),
        name: name.into(),
        author: author.into(),
        // 卡包离不开 Runtime 前置：新项目默认依赖官方 Runtime，用户零填写
        runtime_workshop_id: Some(crate::model::OFFICIAL_RUNTIME_WORKSHOP_ID),
        ..Default::default()
    };
    write_meta(root, &meta)
}

pub fn write_meta(root: &str, meta: &ProjectMeta) -> Result<(), String> {
    validate_meta_ids(meta)?;
    crate::custom_pools::validate_pools(&meta.custom_pools)?;
    crate::rules::ensure_statuses(&meta.rule_statuses)?;
    crate::rules::ensure_templates(&meta.rule_templates)?;
    let mut meta = meta.clone();
    if !meta.rule_statuses.is_empty() || !meta.rule_templates.is_empty() { meta.format_version = meta.format_version.max(3); }
    let raw = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    atomic_write(&meta_path(root), raw.as_bytes())
}

pub fn read_card(root: &str, id: &str) -> Result<CardDef, String> {
    validate_card_id(id)?;
    let raw = fs::read_to_string(card_path(root, id)).map_err(|e| e.to_string())?;
    let card: CardDef = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if card.id != id {
        return Err(format!("卡牌文件名与内容 id 不一致: {id} / {}", card.id));
    }
    check_card_version(card.format_version)?;
    Ok(card)
}

pub fn write_card(root: &str, card: &CardDef) -> Result<(), String> {
    let statuses = if meta_path(root).exists() { read_meta(root)?.rule_statuses } else { vec![] };
    write_card_with_statuses(root, card, &statuses)
}

pub fn write_card_with_statuses(root: &str, card: &CardDef, statuses: &[serde_json::Value]) -> Result<(), String> {
    validate_card_id(&card.id)?;
    check_card_version(card.format_version)?;
    let mut card = card.clone();
    crate::rules::bind_statuses(&mut card, statuses)?;
    crate::content_refs::enrich(&mut card, None);
    fs::create_dir_all(PathBuf::from(root).join("cards")).map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(&card).map_err(|e| e.to_string())?;
    atomic_write(&card_path(root, &card.id), raw.as_bytes())
}

fn write_asset_bytes(root: &str, rel: &str, bytes: &[u8]) -> Result<(), String> {
    validate_rel_path(rel)?;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let relative = Path::new(rel);
    let mut parent = root.clone();
    // 每创建一级前，先确认上一级仍位于项目内，覆盖 assets 本身是链接的情况。
    for component in relative.parent().ok_or("资源路径缺少父目录")?.components() {
        parent.push(component);
        if !parent.exists() {
            fs::create_dir(&parent).map_err(|e| e.to_string())?;
        }
        parent = fs::canonicalize(&parent).map_err(|e| e.to_string())?;
        if !parent.starts_with(&root) {
            return Err(format!("资源目录位于项目目录之外: {rel}"));
        }
    }
    let path = parent.join(relative.file_name().ok_or("资源路径缺少文件名")?);
    // symlink_metadata 同时识别悬空链接，避免写入时跟随它在项目外创建文件。
    if fs::symlink_metadata(&path).is_ok() {
        let resolved = fs::canonicalize(&path).map_err(|e| e.to_string())?;
        if !resolved.starts_with(&root) {
            return Err(format!("资源文件位于项目目录之外: {rel}"));
        }
    }
    fs::write(path, bytes).map_err(|e| e.to_string())
}

/// 保存立绘到 assets/cards/<id>.<ext>，返回相对路径
pub fn save_portrait(root: &str, id: &str, ext: &str, bytes: &[u8]) -> Result<String, String> {
    validate_card_id(id)?;
    let ext = match ext.to_ascii_lowercase().as_str() {
        "png" => "png",
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        _ => "png",
    };
    let rel = format!("assets/cards/{id}.{ext}");
    write_asset_bytes(root, &rel, bytes)?;
    Ok(rel)
}

/// 保存延迟效果图标到 assets/powers/<name>.<ext>，返回相对路径
/// （name 由前端给卡 id + 时间戳拼出，避免嵌套延迟互覆；发布时改写为
/// PCK 内 images/powers/<文件名>，运行时经 SfPngLoader 加载）
pub fn save_effect_icon(root: &str, name: &str, ext: &str, bytes: &[u8]) -> Result<String, String> {
    validate_card_id(name)?;
    let ext = match ext.to_ascii_lowercase().as_str() {
        "png" => "png",
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        _ => "png",
    };
    let rel = format!("assets/powers/{name}.{ext}");
    write_asset_bytes(root, &rel, bytes)?;
    Ok(rel)
}

pub fn read_portrait_bytes(root: &str, rel: &str) -> Result<Vec<u8>, String> {
    validate_rel_path(rel)?;
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let path = fs::canonicalize(root.join(rel)).map_err(|e| e.to_string())?;
    if !path.starts_with(&root) {
        return Err(format!("文件位于项目目录之外: {rel}"));
    }
    fs::read(path).map_err(|e| e.to_string())
}

/// 打开项目：读 meta + 全部卡牌（版本不符的卡会让打开失败——静默降级比报错更危险）
pub fn load_project(root: &str) -> Result<(ProjectMeta, Vec<CardDef>), String> {
    let meta = read_meta(root)?;
    let mut cards = Vec::new();
    for id in &meta.cards {
        cards.push(read_card(root, id)?);
    }
    Ok((meta, cards))
}

/// 新建卡：写卡文件 + 登记到 meta（去重）
pub fn add_card(root: &str, card: &CardDef) -> Result<(), String> {
    let mut meta = read_meta(root)?;
    let mut card = card.clone();
    crate::rules::bind_statuses(&mut card, &meta.rule_statuses)?;
    crate::content_refs::enrich(&mut card, None);
    write_card_with_statuses(root, &card, &meta.rule_statuses)?;
    let changed = !meta.cards.contains(&card.id) || meta.format_version < card.format_version;
    if !meta.cards.contains(&card.id) { meta.cards.push(card.id.clone()); }
    meta.format_version = meta.format_version.max(card.format_version);
    if changed { write_meta(root, &meta)?; }
    Ok(())
}

/// 删除卡：先改 meta（项目索引），再删文件。
/// 第二步失败只留下孤儿文件，不会出现 meta 引用缺失文件导致项目打不开。
pub fn remove_card(root: &str, id: &str) -> Result<(), String> {
    validate_card_id(id)?;
    let mut meta = read_meta(root)?;
    if !meta.cards.contains(&id.to_string()) {
        return Ok(()); // 幂等
    }
    // 删除快照独立于自动保存的 .bak，关闭编辑器后仍可恢复；立绘不删除。
    let path = card_path(root, id);
    if path.exists() {
        // 原样保存：即便文件损坏，也不丢弃用户可手工修复的原内容。
        let snapshot = fs::read(&path).map_err(|e| e.to_string())?;
        atomic_write(&path.with_extension("json.deleted"), &snapshot)?;
    }
    meta.cards.retain(|c| c != id);
    write_meta(root, &meta)?;
    let _ = fs::remove_file(card_path(root, id)); // 失败仅留孤儿文件
    Ok(())
}

/// 恢复误删卡牌，保留原顺序。标识被新卡占用时拒绝覆盖。
pub fn restore_deleted_card(root: &str, card: &CardDef, index: usize) -> Result<(), String> {
    validate_card_id(&card.id)?;
    check_card_version(card.format_version)?;
    let mut meta = read_meta(root)?;
    if meta.cards.contains(&card.id) {
        return Err(format!("卡牌 id {} 已被占用，无法撤销删除", card.id));
    }
    write_card(root, card)?;
    meta.cards.insert(index.min(meta.cards.len()), card.id.clone());
    meta.format_version = meta.format_version.max(card.format_version);
    write_meta(root, &meta)
}

/// 重命名卡（事务）：新文件写入 → meta 原位替换（保持顺序）→ 删旧文件；
/// 默认命名的立绘（assets/cards/<旧id>.<ext>）同步改名。
/// Entry 随 id 改变：已发布/安装过的卡改名会破坏游戏内存档引用，调用方需先警告。
pub fn rename_card(root: &str, old_id: &str, new_id: &str) -> Result<(), String> {
    validate_card_id(old_id)?;
    validate_card_id(new_id)?;
    let mut meta = read_meta(root)?;
    if old_id == new_id {
        return Ok(());
    }
    if PathBuf::from(root)
        .join("cards")
        .join(format!("{new_id}.json"))
        .exists()
    {
        return Err(format!("卡牌 id {new_id} 已被占用"));
    }
    let mut card = read_card(root, old_id)?;

    // 立绘同步改名（仅默认命名 assets/cards/<id>.<ext>；未裁剪原图 <id>_original 同理）
    let prefix = format!("assets/cards/{old_id}.");
    if card.portrait.starts_with(&prefix) {
        let ext = card.portrait.trim_start_matches(&prefix).to_string();
        if !ext.contains('/') && !ext.contains('\\') {
            let new_rel = format!("assets/cards/{new_id}.{ext}");
            let from = PathBuf::from(root).join(&card.portrait);
            let to = PathBuf::from(root).join(&new_rel);
            if from.exists() && !to.exists() {
                // 保留旧路径，已有撤销快照、备份和共用立绘的其他卡仍可读取。
                fs::copy(&from, &to).map_err(|e| format!("立绘改名失败: {e}"))?;
                card.portrait = new_rel;
            }
        }
    }
    let orig_prefix = format!("assets/cards/{old_id}_original.");
    let orig_rel = card.portrait_original.clone().unwrap_or_default();
    if orig_rel.starts_with(&orig_prefix) {
        let ext = orig_rel.trim_start_matches(&orig_prefix).to_string();
        if !ext.contains('/') && !ext.contains('\\') {
            let new_rel = format!("assets/cards/{new_id}_original.{ext}");
            let from = PathBuf::from(root).join(&orig_rel);
            let to = PathBuf::from(root).join(&new_rel);
            if from.exists() && !to.exists() {
                fs::copy(&from, &to).map_err(|e| format!("立绘原图改名失败: {e}"))?;
                card.portrait_original = Some(new_rel);
            }
        }
    }

    card.id = new_id.to_string();
    write_card(root, &card)?;
    if let Some(pos) = meta.cards.iter().position(|c| c == old_id) {
        meta.cards[pos] = new_id.to_string();
    } else if !meta.cards.contains(&new_id.to_string()) {
        meta.cards.push(new_id.to_string());
    }
    write_meta(root, &meta)?;
    let _ = fs::remove_file(card_path(root, old_id));
    Ok(())
}

/// 导入卡 JSON（字符串）：校验 + 落盘；重名直接覆盖现有卡（编辑器层负责提示）
pub fn import_card_json(root: &str, raw: &str) -> Result<CardDef, String> {
    let card: CardDef = serde_json::from_str(raw).map_err(|e| format!("JSON 解析失败: {e}"))?;
    check_card_version(card.format_version)?;
    add_card(root, &card)?;
    read_card(root, &card.id)
}

pub fn export_card_json(root: &str, id: &str) -> Result<String, String> {
    let mut card = read_card(root, id)?;
    let meta = read_meta(root)?;
    crate::rules::bind_statuses(&mut card, &meta.rule_statuses)?;
    crate::rules::ensure_publish(&card)?;
    crate::content_refs::enrich(&mut card, None);
    serde_json::to_string_pretty(&card).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_root(name: &str) -> String {
        let d = std::env::temp_dir().join(format!("sf_proj_{name}"));
        let _ = fs::remove_dir_all(&d);
        d.to_string_lossy().into_owned()
    }

    fn sample_card(id: &str) -> CardDef {
        CardDef {
            id: id.into(),
            ..CardDef::default()
        }
    }

    #[test]
    fn atomic_write_leaves_bak() {
        let dir = std::env::temp_dir().join("sf_atomic_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("f.json");
        fs::write(&p, b"v1").unwrap();
        atomic_write(&p, b"v2").unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"v2");
        assert_eq!(fs::read(dir.join("f.json.bak")).unwrap(), b"v1");
        // 首次写入（无旧文件）也正常
        let q = dir.join("g.json");
        atomic_write(&q, b"new").unwrap();
        assert_eq!(fs::read(&q).unwrap(), b"new");
    }

    #[test]
    fn pack_id_validation() {
        assert!(validate_pack_id("Darkpack").is_ok());
        assert!(validate_pack_id("my_pack_2").is_ok());
        assert!(validate_pack_id("2pack").is_err()); // 数字开头
        assert!(validate_pack_id("bad name").is_err());
        assert!(validate_pack_id("../evil").is_err());
        assert!(validate_pack_id("con").is_err()); // Windows 保留名
        assert!(validate_pack_id("COM1").is_err());
        assert!(validate_pack_id("a").is_err()); // 太短
    }

    #[test]
    fn rel_path_validation_rejects_escape() {
        assert!(validate_rel_path("assets/cards/x.png").is_ok());
        for bad in [
            "../evil.png",
            "a/../../b",
            "C:\\abs\\x.png",
            "/abs/x.png",
            "a/../b",
            "",
            "assets/cards/a.png:stream",
            "assets/cards/CON.png",
            "assets/cards/trailing. ",
        ] {
            assert!(validate_rel_path(bad).is_err(), "{bad} must be rejected");
        }
    }

    #[test]
    fn asset_writes_create_project_directories_and_preserve_bytes() {
        let root = tmp_root("asset_writes");
        fs::create_dir_all(&root).unwrap();
        let portrait = save_portrait(&root, "card", "png", b"portrait").unwrap();
        let icon = save_effect_icon(&root, "icon", "webp", b"icon").unwrap();
        assert_eq!(read_portrait_bytes(&root, &portrait).unwrap(), b"portrait");
        assert_eq!(read_portrait_bytes(&root, &icon).unwrap(), b"icon");
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(any(windows, unix))]
    #[test]
    fn asset_writes_reject_linked_directories_outside_project() {
        let base = PathBuf::from(tmp_root("asset_directory_links"));
        for (index, relative) in ["assets", "assets/cards", "assets/powers"].iter().enumerate() {
            let root = base.join(format!("project_{index}"));
            let outside = base.join(format!("outside_{index}"));
            let link = root.join(relative);
            fs::create_dir_all(link.parent().unwrap()).unwrap();
            fs::create_dir_all(&outside).unwrap();
            fs::write(outside.join("card.png"), b"original").unwrap();
            #[cfg(windows)]
            {
                let output = std::process::Command::new("cmd")
                    .args(["/C", "mklink", "/J"])
                    .arg(link.to_string_lossy().replace('/', "\\"))
                    .arg(outside.to_string_lossy().replace('/', "\\"))
                    .output().unwrap();
                assert!(output.status.success(), "junction: {}", String::from_utf8_lossy(&output.stderr));
            }
            #[cfg(unix)]
            std::os::unix::fs::symlink(&outside, &link).unwrap();
            let root = root.to_str().unwrap();
            if *relative != "assets/powers" {
                assert!(save_portrait(root, "card", "png", b"changed").is_err());
            }
            if *relative != "assets/cards" {
                assert!(save_effect_icon(root, "card", "png", b"changed").is_err());
            }
            assert_eq!(fs::read(outside.join("card.png")).unwrap(), b"original");
            assert_eq!(fs::read_dir(&outside).unwrap().count(), 1);
            #[cfg(windows)]
            fs::remove_dir(link).unwrap();
            #[cfg(unix)]
            fs::remove_file(link).unwrap();
        }
        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn corrupt_index_and_mismatched_cards_are_rejected_before_mutation() {
        let root = tmp_root("invalid_index");
        create_project(&root, "TestPack", "T", "a").unwrap();
        add_card(&root, &sample_card("a")).unwrap();
        let original = fs::read(card_path(&root, "a")).unwrap();
        let mut meta = read_meta(&root).unwrap();
        meta.cards.push("../outside".into());
        fs::write(meta_path(&root), serde_json::to_vec(&meta).unwrap()).unwrap();
        assert!(load_project(&root).is_err());
        let mut changed = sample_card("a");
        changed.cost = 99;
        assert!(add_card(&root, &changed).is_err());
        assert_eq!(fs::read(card_path(&root, "a")).unwrap(), original);
        assert!(rename_card(&root, "a", "new").is_err());
        assert!(!card_path(&root, "new").exists());
        assert!(read_card(&root, "../outside").is_err());
        assert!(export_card_json(&root, "../outside").is_err());

        meta.cards = vec!["a".into(), "a".into()];
        assert!(write_meta(&root, &meta).is_err());
        fs::write(meta_path(&root), serde_json::to_vec(&meta).unwrap()).unwrap();
        assert!(read_meta(&root).is_err());
        meta.cards.truncate(1);
        write_meta(&root, &meta).unwrap();
        fs::write(card_path(&root, "a"), serde_json::to_vec(&sample_card("other")).unwrap()).unwrap();
        assert!(load_project(&root).is_err());
        assert!(rename_card(&root, "a", "new").is_err());
        assert!(validate_card_id("con").is_err());
        assert!(validate_card_id("lpt1").is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn auto_project_dir_dedups_and_validates() {
        let root = PathBuf::from(tmp_root("auto_dir"));
        fs::create_dir_all(&root).unwrap();
        let first = auto_project_dir(&root, "MyPack").unwrap();
        assert!(first.ends_with("MyPack"), "{first}");
        fs::create_dir_all(&first).unwrap();
        let second = auto_project_dir(&root, "MyPack").unwrap();
        assert!(second.ends_with("MyPack_2"), "{second}");
        // 非法 pack_id 直接拒绝，不会拼出奇怪目录名
        assert!(auto_project_dir(&root, "bad name").is_err());
        assert!(auto_project_dir(&root, "con").is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn custom_pool_metadata_round_trips_and_rejects_invalid_schema() {
        let root = tmp_root("custom_pools_roundtrip");
        create_project(&root, "Poolpack", "Pools", "Author").unwrap();
        let mut meta = read_meta(&root).unwrap();
        meta.custom_pools.push(crate::custom_pools::CustomPoolDef {
            key: "mod:HeroMod:Hero.Pool".into(),
            label: "英雄卡池".into(),
            mod_id: "HeroMod".into(),
            type_name: "Hero.Pool".into(),
            workshop_id: Some("123456".into()),
        });
        write_meta(&root, &meta).unwrap();
        assert_eq!(read_meta(&root).unwrap().custom_pools, meta.custom_pools);
        meta.custom_pools[0].key = "mod:Other:Hero.Pool".into();
        assert!(write_meta(&root, &meta).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rename_card_transaction() {
        let root = tmp_root("rename");
        create_project(&root, "TestPack", "T", "a").unwrap();
        let mut card = sample_card("old_id");
        card.portrait = "assets/cards/old_id.png".into();
        add_card(&root, &card).unwrap();
        fs::create_dir_all(PathBuf::from(&root).join("assets/cards")).unwrap();
        fs::write(PathBuf::from(&root).join("assets/cards/old_id.png"), b"png").unwrap();

        rename_card(&root, "old_id", "new_id").unwrap();

        // 新文件在、旧文件删、meta 原位替换保序、立绘跟随
        assert!(PathBuf::from(&root).join("cards/new_id.json").exists());
        assert!(!PathBuf::from(&root).join("cards/old_id.json").exists());
        let meta = read_meta(&root).unwrap();
        assert_eq!(meta.cards, vec!["new_id".to_string()]);
        let got = read_card(&root, "new_id").unwrap();
        assert_eq!(got.portrait, "assets/cards/new_id.png");
        assert!(PathBuf::from(&root)
            .join("assets/cards/new_id.png")
            .exists());
        assert!(PathBuf::from(&root)
            .join("assets/cards/old_id.png")
            .exists()); // 旧备份与共用立绘的卡牌仍可读取

        // 改名到已占用 id 必须拒绝
        add_card(&root, &sample_card("taken")).unwrap();
        assert!(rename_card(&root, "new_id", "taken").is_err());
    }

    #[test]
    fn remove_card_is_meta_first_and_idempotent() {
        let root = tmp_root("remove");
        create_project(&root, "TestPack", "T", "a").unwrap();
        add_card(&root, &sample_card("gone")).unwrap();
        // 手工删掉卡文件模拟不一致，remove 仍应成功（meta 清理 + 幂等）
        fs::remove_file(PathBuf::from(&root).join("cards/gone.json")).unwrap();
        remove_card(&root, "gone").unwrap();
        let meta = read_meta(&root).unwrap();
        assert!(meta.cards.is_empty());
        remove_card(&root, "gone").unwrap(); // 幂等
    }

    #[test]
    fn future_card_version_is_rejected_on_load() {
        let root = tmp_root("future");
        create_project(&root, "TestPack", "T", "a").unwrap();
        let mut card = sample_card("fut");
        card.format_version = FORMAT_VERSION + 1;
        let raw = serde_json::to_string_pretty(&card).unwrap();
        fs::write(PathBuf::from(&root).join("cards/fut.json"), raw).unwrap();
        let mut meta = read_meta(&root).unwrap();
        meta.cards.push("fut".into());
        write_meta(&root, &meta).unwrap();
        let err = load_project(&root).unwrap_err();
        assert!(err.contains("高于当前支持版本"), "{err}");
    }
}
