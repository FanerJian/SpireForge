//! 项目磁盘 IO：<project>/project.json + cards/<id>.json + assets/cards/*

use crate::model::{CardDef, ProjectMeta, FORMAT_VERSION};
use std::fs;
use std::path::PathBuf;

pub fn meta_path(root: &str) -> PathBuf {
    PathBuf::from(root).join("project.json")
}

fn card_path(root: &str, id: &str) -> PathBuf {
    PathBuf::from(root).join("cards").join(format!("{id}.json"))
}

pub fn read_meta(root: &str) -> Result<ProjectMeta, String> {
    let raw = fs::read_to_string(meta_path(root)).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn create_project(root: &str, pack_id: &str, name: &str, author: &str) -> Result<(), String> {
    let root_dir = PathBuf::from(root);
    if root_dir.exists() && fs::read_dir(&root_dir).map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err("目标目录非空，请选择空目录".into());
    }
    fs::create_dir_all(root_dir.join("cards")).map_err(|e| e.to_string())?;
    fs::create_dir_all(root_dir.join("assets/cards")).map_err(|e| e.to_string())?;
    let meta = ProjectMeta {
        format_version: FORMAT_VERSION,
        pack_id: pack_id.into(),
        name: name.into(),
        author: author.into(),
        ..Default::default()
    };
    write_meta(root, &meta)
}

pub fn write_meta(root: &str, meta: &ProjectMeta) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(meta_path(root), raw).map_err(|e| e.to_string())
}

pub fn read_card(root: &str, id: &str) -> Result<CardDef, String> {
    let raw = fs::read_to_string(card_path(root, id)).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub fn write_card(root: &str, card: &CardDef) -> Result<(), String> {
    if card.id.is_empty() {
        return Err("卡牌 id 不能为空".into());
    }
    if !card
        .id
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err("卡牌 id 只能包含小写字母、数字和下划线".into());
    }
    fs::create_dir_all(PathBuf::from(root).join("cards")).map_err(|e| e.to_string())?;
    let raw = serde_json::to_string_pretty(card).map_err(|e| e.to_string())?;
    fs::write(card_path(root, &card.id), raw).map_err(|e| e.to_string())
}

pub fn delete_card(root: &str, id: &str) -> Result<(), String> {
    let p = card_path(root, id);
    if p.exists() {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 保存立绘到 assets/cards/<id>.png，返回相对路径
pub fn save_portrait(root: &str, id: &str, bytes: &[u8]) -> Result<String, String> {
    let rel = format!("assets/cards/{id}.png");
    let p = PathBuf::from(root).join(&rel);
    fs::create_dir_all(p.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&p, bytes).map_err(|e| e.to_string())?;
    Ok(rel)
}

pub fn read_portrait_bytes(root: &str, rel: &str) -> Result<Vec<u8>, String> {
    fs::read(PathBuf::from(root).join(rel)).map_err(|e| e.to_string())
}

/// 打开项目：读 meta + 全部卡牌
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
    write_card(root, card)?;
    let mut meta = read_meta(root)?;
    if !meta.cards.contains(&card.id) {
        meta.cards.push(card.id.clone());
        write_meta(root, &meta)?;
    }
    Ok(())
}

/// 删除卡：删文件 + 从 meta 移除
pub fn remove_card(root: &str, id: &str) -> Result<(), String> {
    delete_card(root, id)?;
    let mut meta = read_meta(root)?;
    meta.cards.retain(|c| c != id);
    write_meta(root, &meta)?;
    Ok(())
}

/// 导入卡 JSON（字符串）：校验 + 落盘；重名直接覆盖现有卡（编辑器层负责提示）
pub fn import_card_json(root: &str, raw: &str) -> Result<CardDef, String> {
    let card: CardDef = serde_json::from_str(raw).map_err(|e| format!("JSON 解析失败: {e}"))?;
    if card.format_version > FORMAT_VERSION {
        return Err(format!(
            "卡牌格式版本 {} 高于当前支持版本 {}，请升级编辑器",
            card.format_version, FORMAT_VERSION
        ));
    }
    add_card(root, &card)?;
    Ok(card)
}

pub fn export_card_json(root: &str, id: &str) -> Result<String, String> {
    let raw = fs::read_to_string(card_path(root, id)).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&v).map_err(|e| e.to_string())
}
