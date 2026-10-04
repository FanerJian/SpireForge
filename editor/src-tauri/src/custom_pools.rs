use crate::model::CardDef;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

const MAX_CATALOG_BYTES: usize = 2 * 1024 * 1024;
const MAX_POOLS: usize = 512;

pub fn active_pool_keys(card: &CardDef) -> Vec<&str> {
    if card
        .vanilla_id
        .as_deref()
        .map_or(false, |v| !v.trim().is_empty())
    {
        return Vec::new();
    }
    if card.pools.is_empty() {
        vec![card.pool.as_str()]
    } else {
        card.pools.iter().map(String::as_str).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustomPoolDef {
    pub key: String,
    pub label: String,
    pub mod_id: String,
    pub type_name: String,
    #[serde(default)]
    pub workshop_id: Option<String>,
}

#[derive(Deserialize)]
struct PoolCatalog {
    format_version: u32,
    pools: Vec<CustomPoolDef>,
}

pub fn validate_pool(pool: &CustomPoolDef) -> Result<(), String> {
    let valid_mod = !pool.mod_id.is_empty()
        && pool.mod_id.len() <= 128
        && pool
            .mod_id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c));
    if !valid_mod || pool.mod_id.eq_ignore_ascii_case("SpireForgeRuntime") {
        return Err(format!(
            "Mod ID 无效或保留给 SpireForgeRuntime：{}",
            pool.mod_id
        ));
    }
    let valid_type = !pool.type_name.is_empty()
        && pool.type_name.len() <= 512
        && pool.type_name.split(|c| c == '.' || c == '+').all(|part| {
            let mut bytes = part.bytes();
            matches!(bytes.next(), Some(c) if c.is_ascii_alphabetic() || c == b'_')
                && bytes.all(|c| c.is_ascii_alphanumeric() || c == b'_')
        });
    if !valid_type {
        return Err(format!("卡池类名无效：{}", pool.type_name));
    }
    let expected = format!("mod:{}:{}", pool.mod_id, pool.type_name);
    if pool.key != expected {
        return Err(format!("卡池 key 必须为 {expected}"));
    }
    let label = pool.label.trim();
    if label.is_empty() || label.chars().count() > 128 {
        return Err("卡池名称需为 1–128 个字符".into());
    }
    if let Some(id) = &pool.workshop_id {
        if id.parse::<u64>().map_or(true, |n| n == 0) {
            return Err("工坊 ID 必须为大于 0 的整数".into());
        }
    }
    Ok(())
}

pub fn validate_pools(pools: &[CustomPoolDef]) -> Result<(), String> {
    if pools.len() > MAX_POOLS {
        return Err(format!("自定义卡池最多 {MAX_POOLS} 个"));
    }
    let mut identities = HashSet::new();
    for pool in pools {
        validate_pool(pool)?;
        let identity = format!("{}:{}", pool.mod_id, pool.type_name);
        if !identities.insert(identity) {
            return Err(format!("重复或冲突的自定义卡池：{}", pool.key));
        }
    }
    Ok(())
}

pub fn parse_catalog(raw: &str) -> Result<Vec<CustomPoolDef>, String> {
    if raw.len() > MAX_CATALOG_BYTES {
        return Err("角色卡池配置文件超过 2 MB".into());
    }
    let mut catalog: PoolCatalog =
        serde_json::from_str(raw).map_err(|e| format!("角色卡池配置 JSON 格式错误：{e}"))?;
    if catalog.format_version != 1 {
        return Err(format!(
            "不支持的角色卡池配置版本：{}",
            catalog.format_version
        ));
    }
    validate_pools(&catalog.pools)?;
    for pool in &mut catalog.pools {
        pool.label = pool.label.trim().to_string();
    }
    Ok(catalog.pools)
}

pub fn read_game_pools(game_dir: &str) -> Result<Vec<CustomPoolDef>, String> {
    if game_dir.is_empty() {
        return Err("请先在设置中选择游戏目录".into());
    }
    let path = PathBuf::from(game_dir)
        .join("mods")
        .join("SpireForgeRuntime")
        .join("spireforge-pools.json");
    let metadata = fs::metadata(&path).map_err(|_| "未找到角色卡池配置。请启用 SpireForgeRuntime 和角色 Mod，然后重启游戏并进入主菜单后再读取。".to_string())?;
    if metadata.len() as usize > MAX_CATALOG_BYTES {
        return Err("角色卡池配置文件超过 2 MB".into());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取角色卡池配置失败：{e}"))?;
    parse_catalog(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn def(label: &str, ty: &str) -> CustomPoolDef {
        CustomPoolDef {
            key: format!("mod:Example.Mod:{ty}"),
            label: label.into(),
            mod_id: "Example.Mod".into(),
            type_name: ty.into(),
            workshop_id: None,
        }
    }
    #[test]
    fn rejects_malformed_and_reserved_identity() {
        assert!(validate_pool(&def("", "Example.Pool")).is_err());
        let mut p = def("名字", "Example.Pool, Assembly");
        assert!(validate_pool(&p).is_err());
        for ty in [".Pool", "Pool..Nested", "Pool+", "123Pool", "Pool.9Nested"] {
            assert!(validate_pool(&def("池", ty)).is_err(), "{ty}");
        }
        p = def("名字", "Example.Pool");
        p.mod_id = "SpireForgeRuntime".into();
        assert!(validate_pool(&p).is_err());
        p = def("名字", "Example.Pool");
        p.workshop_id = Some("000".into());
        assert!(validate_pool(&p).is_err());
        assert_eq!(parse_catalog(r#"{"format_version":1,"pools":[{"key":"mod:Example.Mod:Example.Pool","label":"  池名  ","mod_id":"Example.Mod","type_name":"Example.Pool"}]}"#).unwrap()[0].label, "池名");
    }
    #[test]
    fn rejects_duplicate_identity_in_catalog() {
        assert!(validate_pools(&[def("A", "Pool"), def("B", "Pool")]).is_err());
    }
}
