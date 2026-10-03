//! 原版卡牌目录（构建期内嵌 schema/vanilla-catalog.json）。
//! 数据由 tools/extract-vanilla-catalog.mjs 从 spire-codex 社区数据生成（v0.111.0，577 张），
//! 供"导入原版卡"选卡与预填。游戏版本更新后重跑提取脚本即可刷新。

use std::sync::OnceLock;

const CATALOG_RAW: &str = include_str!("../../../schema/vanilla-catalog.json");

pub fn catalog() -> &'static serde_json::Value {
    static CATALOG: OnceLock<serde_json::Value> = OnceLock::new();
    CATALOG.get_or_init(|| serde_json::from_str(CATALOG_RAW).unwrap_or(serde_json::Value::Null))
}

/// 内嵌原版目录的全部 Entry（发放预检用：原版卡不在 mods 里，凭此放行）。
pub fn vanilla_entries() -> std::collections::HashSet<String> {
    catalog()
        .get("cards")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|c| c.get("entry").and_then(|x| x.as_str()).map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}
