//! 恢复已有 .bak 与删除快照。先完整校验候选内容，再修改项目。
use crate::model::{CardDef, ProjectMeta, FORMAT_VERSION};
use crate::project;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(serde::Serialize)]
pub struct BackupEntry {
    pub key: String,
    pub kind: String,
    pub card_id: Option<String>,
    pub name: String,
    pub modified_at: Option<u64>,
    pub error: Option<String>,
}

fn backup_path(root: &str, key: &str) -> Result<PathBuf, String> {
    if key != "project.json.bak" {
        let file = key.strip_prefix("cards/").ok_or("非法备份标识")?;
        let id = file.strip_suffix(".json.bak")
            .or_else(|| file.strip_suffix(".json.deleted")).ok_or("非法备份标识")?;
        project::validate_card_id(id)?;
    }
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let path = fs::canonicalize(root.join(key)).map_err(|e| e.to_string())?;
    if !path.starts_with(&root) || !path.is_file() { return Err("备份不在当前项目内".into()); }
    Ok(path)
}

fn read_card(root: &str, key: &str) -> Result<CardDef, String> {
    let raw = fs::read(backup_path(root, key)?).map_err(|e| e.to_string())?;
    let card: CardDef = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    project::validate_card_id(&card.id)?;
    let expected = format!("cards/{}.json.", card.id);
    if !key.starts_with(&expected) { return Err("备份文件名与卡牌标识不一致".into()); }
    if card.format_version > FORMAT_VERSION { return Err("备份来自更新版本的编辑器，请先升级".into()); }
    for rel in [&card.portrait, card.portrait_original.as_deref().unwrap_or("")] {
        if !rel.is_empty() { project::validate_rel_path(rel)?; }
    }
    Ok(card)
}

fn read_meta(root: &str) -> Result<ProjectMeta, String> {
    let raw = fs::read(backup_path(root, "project.json.bak")?).map_err(|e| e.to_string())?;
    let meta: ProjectMeta = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    if meta.format_version > FORMAT_VERSION { return Err("备份来自更新版本的编辑器，请先升级".into()); }
    project::validate_pack_id(&meta.pack_id)?;
    crate::custom_pools::validate_pools(&meta.custom_pools)?;
    let mut ids = std::collections::HashSet::new();
    for id in &meta.cards {
        project::validate_card_id(id)?;
        if !ids.insert(id) { return Err(format!("备份中卡牌标识重复：{id}")); }
    }
    Ok(meta)
}

// 项目索引恢复只补缺失卡牌，不把现有卡牌内容回退。
fn project_plan(root: &str, meta: &ProjectMeta) -> Result<Vec<CardDef>, String> {
    let mut missing = vec![];
    for id in &meta.cards {
        let path = Path::new(root).join("cards").join(format!("{id}.json"));
        if path.exists() {
            let card = project::read_card(root, id)?;
            if card.id != *id { return Err(format!("卡牌文件与索引标识不一致：{id}")); }
        } else {
            let card = read_card(root, &format!("cards/{id}.json.deleted"))
                .or_else(|_| read_card(root, &format!("cards/{id}.json.bak")))
                .map_err(|_| format!("索引引用的卡牌 {id} 缺失，且没有可用备份"))?;
            missing.push(card);
        }
    }
    Ok(missing)
}

pub fn list(root: &str) -> Result<Vec<BackupEntry>, String> {
    let mut keys = vec![];
    if Path::new(root).join("project.json.bak").is_file() { keys.push("project.json.bak".to_string()); }
    let dir = Path::new(root).join("cards");
    if dir.exists() {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let file = entry.file_name().to_string_lossy().into_owned();
            if file.ends_with(".json.bak") || file.ends_with(".json.deleted") { keys.push(format!("cards/{file}")); }
        }
    }
    let mut result = vec![];
    for key in keys {
        let is_project = key == "project.json.bak";
        let mut card_id = None;
        let parsed = if is_project {
            read_meta(root).and_then(|meta| { project_plan(root, &meta)?; Ok(meta.name) })
        } else {
            read_card(root, &key).map(|card| {
                card_id = Some(card.id.clone());
                if card.name.zhs.is_empty() { card.id } else { card.name.zhs }
            })
        };
        let modified_at = backup_path(root, &key).ok().and_then(|p| fs::metadata(p).ok())
            .and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs());
        let (name, error) = match parsed { Ok(name) => (name, None), Err(e) => (key.clone(), Some(e)) };
        result.push(BackupEntry { kind: if is_project { "project" } else if key.ends_with(".deleted") { "deleted" } else { "card" }.into(), key, card_id, name, modified_at, error });
    }
    result.sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then(a.key.cmp(&b.key)));
    Ok(result)
}

pub fn restore(root: &str, key: &str) -> Result<(ProjectMeta, Vec<CardDef>), String> {
    // 未通过校验的备份不能写入。读取候选必须在 atomic_write 轮换 .bak 之前完成。
    if key == "project.json.bak" {
        let meta = read_meta(root)?;
        let missing = project_plan(root, &meta)?;
        for card in missing { project::write_card(root, &card)?; }
        project::write_meta(root, &meta)?;
    } else {
        let card = read_card(root, key)?;
        let mut meta = project::read_meta(root)?;
        // 先确认其余索引可读取，避免恢复完成后界面无法打开。
        for id in &meta.cards { if id != &card.id { project::read_card(root, id)?; } }
        project::write_card(root, &card)?;
        if !meta.cards.contains(&card.id) {
            meta.cards.push(card.id.clone());
            project::write_meta(root, &meta)?;
        }
    }
    project::load_project(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn root(name: &str) -> String {
        let p = std::env::temp_dir().join(format!("sf_recovery_{name}"));
        let _ = fs::remove_dir_all(&p);
        let root = p.to_string_lossy().into_owned();
        project::create_project(&root, "TestPack", "Test", "").unwrap();
        root
    }
    #[test]
    fn deleted_snapshot_survives_reopen_and_restores_portrait_reference() {
        let root = root("deleted");
        let card = CardDef { id: "a".into(), portrait: "assets/cards/a.png".into(), ..Default::default() };
        project::save_portrait(&root, "a", "png", b"portrait").unwrap();
        project::add_card(&root, &card).unwrap();
        project::remove_card(&root, "a").unwrap();
        assert!(project::load_project(&root).unwrap().1.is_empty());
        assert!(list(&root).unwrap().iter().any(|b| b.kind == "deleted" && b.error.is_none()));
        let (_, cards) = restore(&root, "cards/a.json.deleted").unwrap();
        assert_eq!(cards[0].portrait, card.portrait);
        assert_eq!(project::read_portrait_bytes(&root, &cards[0].portrait).unwrap(), b"portrait");
    }
    #[test]
    fn card_backup_swaps_current_content_and_rejects_invalid_candidates() {
        let root = root("card");
        let mut card = CardDef { id: "a".into(), cost: 1, ..Default::default() };
        project::add_card(&root, &card).unwrap();
        card.cost = 5; project::write_card(&root, &card).unwrap();
        assert_eq!(restore(&root, "cards/a.json.bak").unwrap().1[0].cost, 1);
        assert_eq!(project::read_card(&root, "a").unwrap().cost, 1);
        assert_eq!(restore(&root, "cards/a.json.bak").unwrap().1[0].cost, 5);
        assert!(restore(&root, "cards/../../project.json.bak").is_err());
        fs::write(Path::new(&root).join("cards/a.json.bak"), b"broken").unwrap();
        assert!(restore(&root, "cards/a.json.bak").is_err());
        assert_eq!(project::read_card(&root, "a").unwrap().cost, 5);
    }
    #[test]
    fn project_backup_recovers_deleted_index_and_missing_cards() {
        let root = root("index");
        project::add_card(&root, &CardDef { id: "a".into(), ..Default::default() }).unwrap();
        project::remove_card(&root, "a").unwrap();
        let (meta, cards) = restore(&root, "project.json.bak").unwrap();
        assert_eq!(meta.cards, vec!["a"]); assert_eq!(cards[0].id, "a");
    }
    #[test]
    fn project_backup_remains_accessible_when_current_metadata_is_corrupt() {
        let root = root("corrupt_meta");
        let mut meta = project::read_meta(&root).unwrap();
        meta.name = "Updated".into(); project::write_meta(&root, &meta).unwrap();
        fs::write(project::meta_path(&root), b"broken metadata").unwrap();
        assert!(project::load_project(&root).is_err());
        assert!(list(&root).unwrap().iter().any(|b| b.kind == "project" && b.error.is_none()));
        assert_eq!(restore(&root, "project.json.bak").unwrap().0.name, "Test");
    }
    #[test]
    fn unavailable_snapshot_does_not_delete_the_card_and_occupied_id_is_not_overwritten() {
        let root = root("failure");
        let card = CardDef { id: "a".into(), cost: 9, ..Default::default() };
        project::add_card(&root, &card).unwrap();
        fs::create_dir_all(Path::new(&root).join("cards/a.json.deleted.tmp")).unwrap();
        assert!(project::remove_card(&root, "a").is_err());
        assert_eq!(project::load_project(&root).unwrap().1[0].cost, 9);
        let other = CardDef { id: "a".into(), cost: 1, ..Default::default() };
        assert!(project::restore_deleted_card(&root, &other, 0).is_err());
        assert_eq!(project::read_card(&root, "a").unwrap().cost, 9);
    }
}
