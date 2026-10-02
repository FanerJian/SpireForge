//! 导入他人制作的卡牌。
//!
//! 策略（务实版）：
//! 1. 自有格式（本 schema）直接解析 —— 完整保真
//! 2. 外来格式走**启发式字段映射**：兼容常见字段别名（name/title、cost/energy、
//!    type/cardType、description/text 等），尽力还原；映射结果通过 ImportReport 返回，
//!    编辑器向用户展示"哪些字段来自推断、哪些用了默认值"
//! 3. 已知第三方工具（STS2_Editor .sts2pack / Nexus #69 created_cards.json / Make Spire）
//!    的字段级适配器留作扩展点；在拿到真实样本文件后按同样接口补齐即可。

use crate::model::{CardDef, CardType, CardRarity, EffectDef, LocText, MultiplayerConstraint, TargetType};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub struct ImportReport {
    pub card: CardDef,
    /// 字段级说明（用户可见）
    pub notes: Vec<String>,
    /// 是否为原生 SpireForge 格式（完整保真）
    pub native: bool,
}

/// 从任意 JSON 文本导入一张卡。
pub fn import_any(raw: &str) -> Result<ImportReport, String> {
    let v: Value = serde_json::from_str(raw).map_err(|e| format!("JSON 解析失败: {e}"))?;

    // 1) 原生格式
    if v.get("card_type").is_some() && v.get("effects").is_some() {
        let card: CardDef = serde_json::from_value(v).map_err(|e| format!("SpireForge 格式校验失败: {e}"))?;
        return Ok(ImportReport { card, notes: vec!["SpireForge 原生格式，完整导入".into()], native: true });
    }

    // 2) 多个对象的容器（如 {"cards": [...]} / [...]）：取第一张并提示
    let obj = if let Some(arr) = v.as_array() {
        arr.first().cloned().ok_or("数组中没有任何卡牌")?
    } else if let Some(cards) = v.get("cards").and_then(|c| c.as_array()) {
        let mut notes = vec![format!("文件包含 {} 张卡，本次导入第一张（其余可用同法逐张导入）", cards.len())];
        let first = cards.first().cloned().ok_or("cards 数组为空")?;
        let mut r = import_object(first, &mut notes)?;
        r.notes.extend(notes);
        return Ok(ImportReport { card: r.card, notes: r.notes, native: false });
    } else {
        v.clone()
    };

    let mut notes = Vec::new();
    let r = import_object(obj, &mut notes)?;
    Ok(ImportReport { card: r.card, notes: r.notes, native: false })
}

/// PCK 卡包导入结果（imported = 成功入库的卡；errors = 逐文件解析失败信息）
#[derive(Debug, Clone, Serialize)]
pub struct PckImportResult {
    pub imported: Vec<ImportReport>,
    pub errors: Vec<String>,
}

/// 批量导入：容器（数组 / {cards:[...]}）逐张导入。
/// 原生条目完整保真；外来条目走启发式映射；单对象时退回 import_any。
pub fn import_many(raw: &str) -> Result<Vec<ImportReport>, String> {
    let v: Value = serde_json::from_str(raw).map_err(|e| format!("JSON 解析失败: {e}"))?;
    let items: Vec<Value> = if let Some(arr) = v.as_array() {
        arr.clone()
    } else if let Some(cards) = v.get("cards").and_then(|c| c.as_array()) {
        cards.clone()
    } else {
        return Ok(vec![import_any(raw)?]);
    };
    let mut out = Vec::new();
    for item in items {
        let mut notes = Vec::new();
        let native = item.get("card_type").is_some() && item.get("effects").is_some();
        let partial = if native {
            let card: CardDef = serde_json::from_value(item)
                .map_err(|e| format!("SpireForge 格式校验失败: {e}"))?;
            notes.push("SpireForge 原生格式，完整导入".into());
            Partial { card, notes }
        } else {
            import_object(item, &mut notes)?
        };
        out.push(ImportReport { card: partial.card, notes: partial.notes, native });
    }
    if out.is_empty() {
        return Err("容器中没有任何卡牌".into());
    }
    Ok(out)
}

/// 从 .pck 卡包文件导入：解出全部 cards/*.json 逐张导入（原生 SpireForge 卡包完整保真）。
pub fn import_pck(path: &str) -> Result<PckImportResult, String> {
    let entries = pcktool::read_entries(std::path::Path::new(path))
        .map_err(|e| format!("PCK 读取失败: {e}"))?;
    let mut imported = Vec::new();
    let mut errors = Vec::new();
    let mut found = 0;
    for (name, data) in entries {
        if !name.contains("/cards/") || !name.ends_with(".json") {
            continue;
        }
        found += 1;
        let raw = String::from_utf8_lossy(&data).into_owned();
        match import_many(&raw) {
            Ok(mut rs) => imported.append(&mut rs),
            Err(e) => errors.push(format!("{name}: {e}")),
        }
    }
    if found == 0 {
        return Err("PCK 中没有 cards/*.json —— 不是 SpireForge 卡包（或不含卡牌数据）".into());
    }
    Ok(PckImportResult { imported, errors })
}

struct Partial {
    card: CardDef,
    notes: Vec<String>,
}

fn import_object(v: Value, _outer_notes: &mut Vec<String>) -> Result<Partial, String> {
    if !v.is_object() {
        return Err("不是有效的卡牌对象".into());
    }
    let mut notes: Vec<String> = Vec::new();
    let mut card = CardDef::default();

    // id
    card.id = pick_str(&v, &["id", "cardId", "card_id", "key", "name_id"])
        .map(|s| sanitize_id(&s))
        .unwrap_or_else(|| "imported_card".into());
    if card.id == "imported_card" {
        notes.push("未找到 id 字段，已命名为 imported_card（请修改）".into());
    }

    // 名称 / 描述（多语言或纯字符串）
    fill_loc(&mut card.name, &v, &["name", "title", "cardName", "card_name", "displayName"]);
    fill_loc(&mut card.description, &v, &["description", "desc", "text", "cardText", "card_text"]);
    fill_loc(&mut card.flavor, &v, &["flavor", "flavour", "flavorText"]);
    if card.name.zhs.is_empty() && card.name.eng.is_empty() {
        notes.push("未找到名称字段，已留空".into());
    }

    // 费用
    if let Some(n) = pick_num(&v, &["cost", "energy", "energyCost", "energy_cost", "costEnergy"]) {
        card.cost = n as i64;
    }
    card.costs_x = pick_bool(&v, &["costs_x", "costX", "hasXCost", "xCost"]).unwrap_or(false);

    // 类型 / 稀有度 / 目标（字符串或数字枚举名）
    if let Some(s) = pick_str(&v, &["card_type", "type", "cardType", "kind"]) {
        card.card_type = parse_type(&s);
        if card.card_type == CardType::Attack && !s.eq_ignore_ascii_case("attack") && !s.eq_ignore_ascii_case("攻击") {
            notes.push(format!("类型 '{s}' 无法识别，已按攻击处理"));
        }
    }
    if let Some(s) = pick_str(&v, &["rarity", "cardRarity", "tier"]) {
        card.rarity = parse_rarity(&s);
    }
    if let Some(s) = pick_str(&v, &["target", "targetType", "target_type"]) {
        card.target = parse_target(&s);
    }

    // 数值 → 效果（amount 常见于 damage/block/draw 平铺字段）
    let mut effects: Vec<EffectDef> = Vec::new();
    if let Some(effs) = v.get("effects").and_then(|e| e.as_array()) {
        for e in effs {
            if let Some(kind) = e.get("kind").or_else(|| e.get("type")).and_then(|k| k.as_str()) {
                let amount = e.get("amount").or_else(|| e.get("value")).and_then(|a| a.as_f64()).unwrap_or(0.0);
                match kind.to_ascii_lowercase().as_str() {
                    "damage" => effects.push(EffectDef::Damage { amount, props: vec!["Move".into()], target: None }),
                    "block" => effects.push(EffectDef::Block { amount, props: vec!["Move".into()] }),
                    "draw" | "cards" => effects.push(EffectDef::Draw { amount: amount as i64 }),
                    "energy" => effects.push(EffectDef::Energy { amount }),
                    // 未知 kind 一律保留为自定义效果（Runtime 端转交 SfEffects 注册表）
                    other => {
                        let params = e.get("params").and_then(|p| p.as_object()).cloned();
                        let target = e.get("target").and_then(|t| t.as_str()).map(|s| s.to_string());
                        effects.push(EffectDef::Custom {
                            handler: other.to_string(),
                            amount: if amount != 0.0 { Some(amount) } else { None },
                            target,
                            params,
                        });
                        notes.push(format!("效果 '{other}' 按自定义效果导入（需要处理器 mod 注册 '{other}'）"));
                    }
                }
            }
        }
    } else {
        if let Some(n) = pick_num(&v, &["damage", "dmg"]) {
            effects.push(EffectDef::Damage { amount: n, props: vec!["Move".into()], target: None });
        }
        if let Some(n) = pick_num(&v, &["block", "blockAmount"]) {
            effects.push(EffectDef::Block { amount: n, props: vec!["Move".into()] });
        }
        if let Some(n) = pick_num(&v, &["draw", "drawCards", "cards"]) {
            effects.push(EffectDef::Draw { amount: n as i64 });
        }
        if !effects.is_empty() {
            notes.push("效果来自平铺字段推断（damage/block/draw），请核对".into());
        }
    }
    card.effects = effects;

    // 升级增量
    if let Some(u) = v.get("upgrades") {
        if let Some(n) = u.get("damage").and_then(|x| x.as_f64()) {
            card.upgrades.damage = n;
        }
        if let Some(n) = u.get("block").and_then(|x| x.as_f64()) {
            card.upgrades.block = n;
        }
        if let Some(n) = u.get("draw").and_then(|x| x.as_i64()) {
            card.upgrades.draw = n;
        }
    }

    // 诅咒/状态惯例修正
    if matches!(card.card_type, CardType::Curse | CardType::Status) {
        if card.cost >= 0 {
            card.cost = -1;
            notes.push("诅咒/状态卡费用已按惯例设为 -1".into());
        }
        card.pool = if card.card_type == CardType::Curse { "curse".into() } else { "status".into() };
    }

    // 关键词
    if let Some(kws) = v.get("keywords").and_then(|k| k.as_array()) {
        card.keywords = kws.iter().filter_map(|k| k.as_str().map(|s| s.to_string())).collect();
    }

    card.multiplayer = MultiplayerConstraint::None;
    notes.push("稀有度/目标等未识别字段使用了默认值，请在编辑器中核对".into());

    Ok(Partial { card, notes })
}

// ---- 字段拾取辅助 ----

fn pick_str(v: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = v.get(*k) {
            if let Some(s) = s.as_str() {
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
            // 多语言对象 {zhs, eng} 或 {zh, en}
            if let Some(o) = s.as_object() {
                for lang in ["zhs", "zh", "schinese", "eng", "en"] {
                    if let Some(t) = o.get(lang).and_then(|x| x.as_str()) {
                        if !t.is_empty() {
                            return Some(t.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

fn pick_num(v: &Value, keys: &[&str]) -> Option<f64> {
    for k in keys {
        if let Some(n) = v.get(*k) {
            if let Some(f) = n.as_f64() {
                return Some(f);
            }
            if let Some(s) = n.as_str() {
                if let Ok(f) = s.parse::<f64>() {
                    return Some(f);
                }
            }
        }
    }
    None
}

fn pick_bool(v: &Value, keys: &[&str]) -> Option<bool> {
    for k in keys {
        if let Some(b) = v.get(*k).and_then(|x| x.as_bool()) {
            return Some(b);
        }
    }
    None
}

fn fill_loc(loc: &mut LocText, v: &Value, keys: &[&str]) {
    for k in keys {
        if let Some(x) = v.get(*k) {
            if let Some(s) = x.as_str() {
                loc.zhs = s.to_string();
                loc.eng = s.to_string();
                return;
            }
            if let Some(o) = x.as_object() {
                if let Some(s) = o.get("zhs").or_else(|| o.get("zh")).and_then(|y| y.as_str()) {
                    loc.zhs = s.to_string();
                }
                if let Some(s) = o.get("eng").or_else(|| o.get("en")).and_then(|y| y.as_str()) {
                    loc.eng = s.to_string();
                }
                if !loc.zhs.is_empty() || !loc.eng.is_empty() {
                    return;
                }
            }
        }
    }
}

fn sanitize_id(s: &str) -> String {
    let lower = s.trim().to_ascii_lowercase();
    let mut out = String::new();
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    while out.contains("__") {
        out = out.replace("__", "_");
    }
    out.trim_matches('_').to_string()
}

fn parse_type(s: &str) -> CardType {
    match s.to_ascii_lowercase().as_str() {
        "skill" | "技能" => CardType::Skill,
        "power" | "能力" => CardType::Power,
        "status" | "状态" => CardType::Status,
        "curse" | "诅咒" => CardType::Curse,
        "quest" | "任务" => CardType::Quest,
        _ => CardType::Attack,
    }
}

fn parse_rarity(s: &str) -> CardRarity {
    match s.to_ascii_lowercase().as_str() {
        "basic" | "starter" => CardRarity::Basic,
        "uncommon" => CardRarity::Uncommon,
        "rare" => CardRarity::Rare,
        "ancient" => CardRarity::Ancient,
        "event" => CardRarity::Event,
        "token" => CardRarity::Token,
        "status" => CardRarity::Status,
        "curse" => CardRarity::Curse,
        "quest" => CardRarity::Quest,
        _ => CardRarity::Common,
    }
}

fn parse_target(s: &str) -> TargetType {
    match s.to_ascii_lowercase().as_str() {
        "none" => TargetType::None,
        "self" | "自身" => TargetType::Self_,
        "allenemies" | "all_enemies" | "all" | "aoe" => TargetType::AllEnemies,
        "randomenemy" | "random_enemy" => TargetType::RandomEnemy,
        "anyplayer" | "any_player" => TargetType::AnyPlayer,
        "anyally" | "any_ally" => TargetType::AnyAlly,
        "allallies" | "all_allies" => TargetType::AllAllies,
        _ => TargetType::AnyEnemy,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 用 tools/testpack-vanilla 的真实 PCK 做往返测试：
    /// 编辑器打出的覆盖卡包 → pcktool 读回 → import_pck 解析出覆盖卡。
    #[test]
    fn import_vanilla_tweak_pck_roundtrip() {
        let p = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../tools/testpack-vanilla/SFVanTweak/SFVanTweak.pck"
        );
        let r = import_pck(p).unwrap();
        assert_eq!(r.imported.len(), 1, "errors: {:?}", r.errors);
        assert!(r.errors.is_empty());
        let card = &r.imported[0].card;
        assert_eq!(card.vanilla_id.as_deref(), Some("BASH"));
        assert_eq!(card.stats.as_ref().unwrap()["Damage"], 10.0);
        assert_eq!(card.upgrade_stats.as_ref().unwrap()["damage"], 2.0);
        assert_eq!(card.cost, 1);
    }
}
