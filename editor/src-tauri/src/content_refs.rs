//! Shared reference/dependency rules for save, export and Workshop. Identities survive offline edits.
use crate::{game_catalog::RuntimeCatalog, model::CardDef};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ContentDependency {
    pub mod_id: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub workshop_id: Option<String>,
}

pub fn reference_mod(value: &str) -> Option<&str> {
    let rest = value.strip_prefix("mod:").or_else(|| value.strip_prefix("effect:"))?;
    let (id, name) = rest.split_once(':')?;
    if id.is_empty() || name.is_empty() || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)) { return None; }
    if id == "SpireForgeRuntime" || id == "sts2" { None } else { Some(id) }
}

fn walk(value: &serde_json::Value, out: &mut BTreeSet<String>) {
    match value {
        serde_json::Value::String(s) => { if reference_mod(s).is_some() || s.starts_with("game:") { out.insert(s.clone()); } },
        serde_json::Value::Array(list) => for v in list { walk(v, out); },
        serde_json::Value::Object(map) => for v in map.values() { walk(v, out); },
        _ => (),
    }
}
pub fn references(card: &CardDef) -> BTreeSet<String> {
    let mut refs = BTreeSet::new();
    // Only behavior data and source references. Display text and saved dependency metadata are not references.
    for list in [&card.effects, &card.on_draw, &card.on_discard, &card.on_exhaust, &card.on_enter_combat, &card.on_turn_end_in_hand] {
        if let Ok(value) = serde_json::to_value(list) { walk(&value, &mut refs); }
    }
    if let Some(key) = &card.source_ref { refs.insert(key.clone()); }
    refs.extend(crate::custom_pools::active_pool_keys(card).into_iter().map(str::to_string));
    refs
}
pub fn mod_ids(card: &CardDef) -> BTreeSet<String> {
    references(card).iter().filter_map(|r| reference_mod(r).map(str::to_string)).collect()
}
pub fn enrich(card: &mut CardDef, catalog: Option<&RuntimeCatalog>) {
    let previous = card.content_dependencies.clone();
    card.content_dependencies = mod_ids(card).into_iter().map(|id| {
        let found = catalog.and_then(|c| c.mods.iter().find(|m| m.id == id));
        found.map(|m| ContentDependency { mod_id: id.clone(), version: m.version.clone(), workshop_id: m.workshop_id.clone() })
            .or_else(|| previous.iter().find(|p| p.mod_id == id).cloned())
            .unwrap_or(ContentDependency { mod_id: id, ..Default::default() })
    }).collect();
    if card.source_ref.is_some() || !card.content_dependencies.is_empty() { card.format_version = card.format_version.max(2); }
}
pub fn merge_known(card: &mut CardDef, known: &[ContentDependency]) {
    for dep in &mut card.content_dependencies {
        if let Some(old) = known.iter().find(|p| p.mod_id == dep.mod_id) {
            if dep.workshop_id.is_none() { dep.workshop_id = old.workshop_id.clone(); }
            if dep.version.is_empty() { dep.version = old.version.clone(); }
        }
    }
}

pub fn preflight(cards: &[CardDef], catalog: Option<&RuntimeCatalog>) -> Vec<crate::publish::ValidationIssue> {
    let mut issues = Vec::new();
    let available: BTreeSet<String> = catalog.map(|c| c.cards.iter().map(|m|m.identity.key.clone())
        .chain(c.powers.iter().map(|m|m.identity.key.clone()))
        .chain(c.monsters.iter().map(|m|m.identity.key.clone()))
        .chain(c.models.iter().map(|m|m.identity.key.clone()))
        .chain(c.custom_effects.iter().map(|m|m.name.clone())).collect()).unwrap_or_default();
    for card in cards {
        for reference in references(card) {
            if reference_mod(&reference).is_none() && !reference.starts_with("game:") { continue; }
            // Pools have a separate validation/catalog; this pass covers executable content.
            if crate::custom_pools::active_pool_keys(card).contains(&reference.as_str()) { continue; }
            if catalog.map_or(true, |c| c.format_version < 2) || !available.contains(&reference) {
                issues.push(crate::publish::ValidationIssue { card_id:card.id.clone(), tab:if card.source_ref.as_deref()==Some(&reference){"basic"}else{"effects"}.into(),
                    field:if card.source_ref.as_deref()==Some(&reference){"vanilla_id"}else{"effects"}.into(),
                    message:format!("卡 {} 的外部内容无法在当前游戏快照中核实：{}。请启用来源 Mod、重启游戏并刷新。",card.id,reference) });
            }
        }
        for dep in &card.content_dependencies {
            if dep.workshop_id.is_none() && mod_ids(card).contains(&dep.mod_id) {
                issues.push(crate::publish::ValidationIssue { card_id:card.id.clone(), tab:"effects".into(), field:"effects".into(),
                    message:format!("外部 Mod {} 未记录工坊 ID，订阅卡包时无法自动订阅此依赖。",dep.mod_id) });
            }
        }
    }
    issues
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nested_dependencies_survive_offline_and_drop_unused() {
        let mut card: CardDef = serde_json::from_value(serde_json::json!({"id":"x", "effects":[
            {"kind":"delayed", "turns":1,"effects":[{"kind":"power","power":"mod:Watcher:Watcher.Power","amount":1}]},
            {"kind":"custom","handler":"effect:Gambler:roll"}
        ]})).unwrap();
        card.content_dependencies.push(ContentDependency {mod_id:"Watcher".into(),workshop_id:Some("3747492505".into()),version:"1.5.10".into()});
        enrich(&mut card,None);
        assert_eq!(mod_ids(&card), BTreeSet::from(["Gambler".into(), "Watcher".into()]));
        assert_eq!(card.content_dependencies.iter().find(|d|d.mod_id=="Watcher").unwrap().workshop_id.as_deref(),Some("3747492505"));
        card.effects.clear(); enrich(&mut card,None);
        assert!(card.content_dependencies.is_empty());
    }
}
