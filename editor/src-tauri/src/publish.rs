//! 打包与安装：项目 → 卡包 PCK + mod.json → 游戏 mods 目录。
//!
//! PCK 格式与 tools/pcktool 完全一致（format v2，已在游戏内实测通过）。
//! 生成物：
//!   <out>/<PackId>/<PackId>.json        清单（has_dll:false，依赖 SpireForgeRuntime）
//!   <out>/<PackId>/<PackId>.pck         卡包（cards/*.json + images/** + localization/**）
//!
//! 注：每文件 16 字节 MD5 是 Godot PCK 格式规范的一部分（加载校验标记），非安全用途。

use crate::model::{CardDef, EffectDef};
use crate::project::{atomic_write, validate_pack_id};
use serde_json::json;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

fn w_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}
fn w_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

/// 打包为 PCK format v2（绝对偏移、无加密；Godot 4.5.1 加载器兼容）。
pub fn write_pck(out: &Path, files: &BTreeMap<String, Vec<u8>>) -> Result<(), String> {
    let mut buf: Vec<u8> = Vec::with_capacity(1 << 20);
    buf.extend_from_slice(b"GDPC");
    w_u32(&mut buf, 2); // format version
    w_u32(&mut buf, 4); // engine major
    w_u32(&mut buf, 5); // engine minor
    w_u32(&mut buf, 1); // engine patch
    w_u32(&mut buf, 0); // pack_flags
    w_u64(&mut buf, 0); // file_base
    for _ in 0..16 {
        w_u32(&mut buf, 0); // reserved
    }
    w_u32(&mut buf, files.len() as u32);

    let mut slots = Vec::with_capacity(files.len());
    for (path, data) in files {
        let p = path.as_bytes();
        w_u32(&mut buf, p.len() as u32);
        buf.extend_from_slice(p);
        slots.push(buf.len());
        w_u64(&mut buf, 0); // offset 占位
        w_u64(&mut buf, data.len() as u64);
        buf.extend_from_slice(&md5::compute(data).0);
        w_u32(&mut buf, 0); // flags
    }
    for ((_, data), slot) in files.iter().zip(&slots) {
        while buf.len() % 16 != 0 {
            buf.push(0);
        }
        let pos = buf.len() as u64;
        buf.extend_from_slice(data);
        buf[*slot..*slot + 8].copy_from_slice(&pos.to_le_bytes());
    }
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    atomic_write(out, &buf)
}

/// 卡牌 id → Entry（必须与游戏 StringHelper.Slugify 完全一致）。
///
/// 游戏实现（反编译自 sts2.dll，v0.111.0）：
///   text = Regex("([A-Za-z0-9]|\\G(?!^))([A-Z])").Replace(txt.Trim(), "$1_$2")
///   input = Regex("\\s+").Replace(text.ToUpperInvariant(), "_")
///   return Regex("[^A-Z0-9_]").Replace(input, "")
/// Rust regex 不支持 \G（前次匹配末位续接）；等价做法：以
///   ([A-Za-z0-9])([A-Z]) → "$1_$2"
/// 反复替换至收敛（每轮吞掉重叠的相邻大写对），结果与 \G 语义一致。
pub fn slugify(txt: &str) -> String {
    let mut s = txt.trim().to_string();
    loop {
        // 注意：Rust regex 的 "$1_" 会被解析成组名 "1_"，必须用 ${1} 显式界定
        let next = camel_rx().replace_all(&s, "${1}_${2}").into_owned();
        if next == s {
            break;
        }
        s = next;
    }
    let upper = s.to_uppercase();
    let spaced = ws_rx().replace_all(&upper, "_");
    special_rx().replace_all(&spaced, "").into_owned()
}

fn camel_rx() -> &'static regex::Regex {
    use std::sync::OnceLock;
    static RX: OnceLock<regex::Regex> = OnceLock::new();
    RX.get_or_init(|| regex::Regex::new("([A-Za-z0-9])([A-Z])").unwrap())
}
fn ws_rx() -> &'static regex::Regex {
    use std::sync::OnceLock;
    static RX: OnceLock<regex::Regex> = OnceLock::new();
    RX.get_or_init(|| regex::Regex::new(r"\s+").unwrap())
}
fn special_rx() -> &'static regex::Regex {
    use std::sync::OnceLock;
    static RX: OnceLock<regex::Regex> = OnceLock::new();
    RX.get_or_init(|| regex::Regex::new("[^A-Z0-9_]").unwrap())
}

/// snake/camel → Pascal（等价 runtime IdHelper.Pascal：按 _-. 空格 分词后各段首字母大写）
pub fn pascal(s: &str) -> String {
    s.split(|c| c == '_' || c == '-' || c == ' ' || c == '.')
        .filter(|p| !p.is_empty())
        .map(|p| {
            let mut ch = p.chars();
            match ch.next() {
                Some(first) => first.to_uppercase().collect::<String>() + ch.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

pub fn card_entry(pack_id: &str, card_id: &str) -> String {
    slugify(&format!("{}{}", pascal(pack_id), pascal(card_id)))
}

/// 语言代码（与游戏本地化目录一致）
const LANGS: [&str; 2] = ["eng", "zhs"];

/// 构建卡包文件集合：res://<PackId>/{cards,images,localization}
pub fn build_pack_files(
    root: &str,
    pack_id: &str,
    cards: &[CardDef],
) -> Result<BTreeMap<String, Vec<u8>>, String> {
    let mut files: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    let mut loc: BTreeMap<&str, serde_json::Map<String, serde_json::Value>> = BTreeMap::new();
    for l in LANGS {
        loc.insert(l, serde_json::Map::new());
    }

    for card in cards {
        // 原版卡覆盖：本地化键 = 原版 Entry（如 BASH.title），游戏合并本地化时覆盖原版文案。
        // 原版 Entry 已是游戏的最终 Slugify 形态，不能再过 slugify（BASH 会被拆成 B_A_S_H），
        // 只做大写规范化 + 剔除非法字符。
        let entry = match card.vanilla_id.as_deref() {
            Some(v) if !v.trim().is_empty() => v
                .trim()
                .to_uppercase()
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
                .collect(),
            _ => card_entry(pack_id, &card.id),
        };

        // 立绘：项目相对路径 → PCK 内路径 images/cards/<文件名>
        // （卡包 JSON 里存的必须是 PCK 内路径，runtime 以 res://<packId>/<portrait> 解析）
        let mut packed_card = card.clone();
        // 未裁剪原图只在编辑器项目里有意义，不进卡包
        packed_card.portrait_original = None;
        if !card.portrait.is_empty() {
            let src = PathBuf::from(root).join(&card.portrait);
            if src.exists() {
                let bytes = fs::read(&src).map_err(|e| e.to_string())?;
                let fname = src
                    .file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| format!("{}.png", card.id));
                packed_card.portrait = format!("images/cards/{fname}");
                files.insert(format!("res://{pack_id}/images/cards/{fname}"), bytes);
            } else {
                packed_card.portrait = String::new();
            }
        }

        // 卡牌定义（不含本地化文本；文本进 localization 表）
        let raw = serde_json::to_vec_pretty(&packed_card).map_err(|e| e.to_string())?;
        files.insert(format!("res://{pack_id}/cards/{}.json", card.id), raw);

        // 本地化
        let name_map = [
            ("title", &card.name),
            ("description", &card.description),
            ("flavor", &card.flavor),
        ];
        for l in LANGS {
            let table = loc.get_mut(l).unwrap();
            for (suffix, text) in &name_map {
                let v = match l {
                    "eng" => &text.eng,
                    _ => &text.zhs,
                };
                if !v.is_empty() {
                    table.insert(format!("{entry}.{suffix}"), json!(v));
                }
            }
        }

        // 立绘
        // （已在上方打包时改写为 PCK 内路径并写入文件）
    }

    for (lang, table) in loc {
        if table.is_empty() {
            continue;
        }
        let raw = serde_json::to_vec_pretty(&serde_json::Value::Object(table))
            .map_err(|e| e.to_string())?;
        files.insert(
            format!("res://{pack_id}/localization/{lang}/cards.json"),
            raw,
        );
    }
    Ok(files)
}

/// 清单：<PackId>/<PackId>.json
pub fn build_manifest(
    pack_id: &str,
    name: &str,
    author: &str,
    description: &str,
    version: &str,
) -> String {
    build_manifest_for_cards(pack_id, name, author, description, version, &[])
}

fn mod_ids_used(cards: &[CardDef]) -> Vec<String> {
    let mut ids = std::collections::BTreeSet::new();
    for card in cards {
        for pool in crate::custom_pools::active_pool_keys(card) {
            if let Some(rest) = pool.strip_prefix("mod:") {
                if let Some((mod_id, type_name)) = rest.split_once(':') {
                    if !mod_id.is_empty() && !type_name.is_empty() && mod_id != "SpireForgeRuntime"
                    {
                        ids.insert(mod_id.to_string());
                    }
                }
            }
        }
    }
    ids.into_iter().collect()
}

pub fn build_manifest_for_cards(
    pack_id: &str,
    name: &str,
    author: &str,
    description: &str,
    version: &str,
    cards: &[CardDef],
) -> String {
    let dependencies: Vec<serde_json::Value> = std::iter::once("SpireForgeRuntime".to_string())
        .chain(mod_ids_used(cards))
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .map(|id| json!({"id": id, "min_version": null}))
        .collect();
    serde_json::to_string_pretty(&json!({
        "id": pack_id,
        "name": name,
        "author": author,
        "description": description,
        "version": version,
        "has_pck": true,
        "has_dll": false,
        "dependencies": dependencies,
        "affects_gameplay": true
    }))
    .unwrap_or_default()
}

/// 构建卡包到指定输出目录（用于"导出卡包"与"安装到游戏"共用）
pub fn build_pack(
    root: &str,
    out_dir: &str,
    pack_id: &str,
    name: &str,
    author: &str,
    description: &str,
    version: &str,
    cards: &[CardDef],
) -> Result<PathBuf, String> {
    validate_pack_id(pack_id)?;
    let files = build_pack_files(root, pack_id, cards)?;
    let pack_dir = PathBuf::from(out_dir).join(pack_id);
    fs::create_dir_all(&pack_dir).map_err(|e| e.to_string())?;
    write_pck(&pack_dir.join(format!("{pack_id}.pck")), &files)?;
    atomic_write(
        &pack_dir.join(format!("{pack_id}.json")),
        build_manifest_for_cards(pack_id, name, author, description, version, cards).as_bytes(),
    )?;
    Ok(pack_dir)
}

/// 发布前预检：返回问题清单（空 = 通过）。只提示不阻断——
/// 重复 Entry / 重复 vanilla_id 这类问题 Runtime 端是"先到先得"，
/// 不该等进游戏后才从日志里发现。
pub fn preflight(pack_id: &str, cards: &[CardDef]) -> Vec<String> {
    preflight_with_pools(pack_id, cards, &[])
}

pub fn preflight_with_pools(
    pack_id: &str,
    cards: &[CardDef],
    pools: &[crate::custom_pools::CustomPoolDef],
) -> Vec<String> {
    let mut issues = Vec::new();

    let declared: HashMap<&str, &crate::custom_pools::CustomPoolDef> =
        pools.iter().map(|p| (p.key.as_str(), p)).collect();
    let mut used = std::collections::BTreeSet::new();
    for card in cards {
        for pool in crate::custom_pools::active_pool_keys(card) {
            if pool.starts_with("mod:") {
                used.insert(pool);
                if !declared.contains_key(pool) {
                    issues.push(format!(
                        "卡牌 {} 使用了未声明的自定义卡池：{}",
                        card.id, pool
                    ));
                }
            }
        }
    }
    for key in used {
        if let Some(pool) = declared.get(key) {
            if pool.workshop_id.as_deref().unwrap_or("").is_empty() {
                issues.push(format!(
                    "自定义卡池 {} 未填写工坊 ID；请手动添加准确的依赖 ID",
                    pool.label
                ));
            }
        }
    }

    let mut ids: HashSet<&str> = HashSet::new();
    for c in cards {
        if !ids.insert(c.id.as_str()) {
            issues.push(format!("卡牌 id 重复: {}", c.id));
        }
    }

    // Entry 冲突（非原版覆盖卡）：不同 id 派生出相同 Entry 时游戏只会保留一个
    let mut entries: HashMap<String, &str> = HashMap::new();
    for c in cards {
        let vanilla = c
            .vanilla_id
            .as_deref()
            .map_or(false, |v| !v.trim().is_empty());
        if vanilla {
            continue;
        }
        let e = card_entry(pack_id, &c.id);
        if let Some(prev) = entries.insert(e.clone(), c.id.as_str()) {
            issues.push(format!(
                "Entry 冲突 {e}：「{prev}」与「{}」派生相同 Entry，游戏内只会保留一个",
                c.id
            ));
        }
    }

    // 原版覆盖重复（大小写规范化后）：Runtime 端先到先得，后到的报错被丢弃
    let mut vanilla: HashMap<String, &str> = HashMap::new();
    for c in cards {
        if let Some(v) = c.vanilla_id.as_deref() {
            let v = v.trim().to_uppercase();
            if v.is_empty() {
                continue;
            }
            if let Some(prev) = vanilla.insert(v.clone(), c.id.as_str()) {
                issues.push(format!(
                    "原版覆盖重复 {v}：「{prev}」与「{}」都覆盖同一张原版卡，只有第一个生效",
                    c.id
                ));
            }
        }
    }

    for c in cards {
        // 效果引用完整性：主效果与全部钩子列表一起查（空引用运行时只会静默跳过）
        let effect_lists = c
            .effects
            .iter()
            .chain(c.on_draw.iter())
            .chain(c.on_discard.iter())
            .chain(c.on_exhaust.iter())
            .chain(c.on_enter_combat.iter())
            .chain(c.on_turn_end_in_hand.iter());
        for fx in effect_lists {
            check_effect_refs(&c.id, fx, &mut issues);
        }
        if c.on_enter_combat
            .iter()
            .any(|fx| matches!(fx, EffectDef::Damage { .. } | EffectDef::Draw { .. }))
        {
            issues.push(format!(
                "卡 {} 的「战斗开始时」钩子含伤害/抽牌（该上下文无目标选择，Runtime 会跳过这两类）",
                c.id
            ));
        }
        if c.name.zhs.is_empty() && c.name.eng.is_empty() {
            issues.push(format!("卡 {} 没有任何名称文本", c.id));
        } else if c.name.zhs.is_empty() {
            issues.push(format!("卡 {} 缺少中文名称（中文玩家会看到空标题）", c.id));
        }
    }
    issues
}

/// 单条效果的引用完整性（递归进 delayed 内嵌清单）；issues 由调用方收集
fn check_effect_refs(card_id: &str, fx: &EffectDef, issues: &mut Vec<String>) {
    match fx {
        EffectDef::Custom { handler, .. } if handler.trim().is_empty() => {
            issues.push(format!(
                "卡 {card_id} 的自定义效果未填处理器名（运行时会被跳过）"
            ));
        }
        EffectDef::Power { power, .. } if power.trim().is_empty() => {
            issues.push(format!("卡 {card_id} 的施加效果未填力量名（运行时会跳过）"));
        }
        EffectDef::Spawn { card_entry, .. } if card_entry.trim().is_empty() => {
            issues.push(format!(
                "卡 {card_id} 的生成效果未填卡牌 Entry（运行时会跳过）"
            ));
        }
        EffectDef::Summon { monster, .. } if monster.trim().is_empty() => {
            issues.push(format!("卡 {card_id} 的召唤效果未填怪物名（运行时会跳过）"));
        }
        EffectDef::Vfx { vfx, .. } if vfx.trim().is_empty() => {
            issues.push(format!("卡 {card_id} 的播放特效未填特效名（运行时会跳过）"));
        }
        EffectDef::Delayed { turns, effects, .. } => {
            if *turns < 1 {
                issues.push(format!(
                    "卡 {card_id} 的延迟效果持续回合数小于 1（不会触发）"
                ));
            }
            if effects.is_empty() {
                issues.push(format!(
                    "卡 {card_id} 的延迟效果没有内嵌效果（不会触发）"
                ));
            }
            for inner in effects {
                check_effect_refs(card_id, inner, issues);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod custom_pool_tests {
    use super::*;
    #[test]
    fn manifest_declares_only_used_custom_mods_and_deduplicates_runtime() {
        let mut card = CardDef::default();
        card.pool = "mod:Stale:Stale.Pool".into();
        card.pools = vec![
            "mod:HeroMod:Hero.Pool".into(),
            "mod:Other:Other.Pool".into(),
        ];
        let mut override_card = CardDef::default();
        override_card.pool = "mod:Override:Override.Pool".into();
        override_card.vanilla_id = Some("Vanilla.Entry".into());
        let manifest: serde_json::Value = serde_json::from_str(&build_manifest_for_cards(
            "Pack",
            "n",
            "a",
            "d",
            "1",
            &[card, override_card],
        ))
        .unwrap();
        let ids: Vec<&str> = manifest["dependencies"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, vec!["HeroMod", "Other", "SpireForgeRuntime"]);
        assert!(manifest["dependencies"]
            .as_array()
            .unwrap()
            .iter()
            .all(|d| d["min_version"].is_null()));
    }
}

/// 安装到游戏 mods 目录
pub fn install_to_game(
    game_dir: &str,
    root: &str,
    pack_id: &str,
    name: &str,
    author: &str,
    description: &str,
    version: &str,
    cards: &[CardDef],
) -> Result<String, String> {
    let mods = PathBuf::from(game_dir).join("mods");
    if !mods.exists() {
        fs::create_dir_all(&mods).map_err(|e| e.to_string())?;
    }
    let pack_dir = build_pack(
        root,
        &mods.to_string_lossy(),
        pack_id,
        name,
        author,
        description,
        version,
        cards,
    )?;
    Ok(pack_dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entry_derivation_matches_game() {
        // 全部对照游戏内实测值（v0.111.0，runtime 日志确认）
        assert_eq!(card_entry("MyPack", "pack_strike"), "MY_PACK_PACK_STRIKE");
        assert_eq!(
            card_entry("SpireForgeTestPack", "pack_strike"),
            "SPIRE_FORGE_TEST_PACK_PACK_STRIKE"
        );
        // 连续大写（游戏 \G 语义）：SFDeepPack → S_F_DEEP_PACK（游戏日志实测）
        assert_eq!(
            card_entry("SFDeepPack", "pack_strike"),
            "S_F_DEEP_PACK_PACK_STRIKE"
        );
        assert_eq!(card_entry("darkpack", "myStrike"), "DARKPACK_MY_STRIKE");
    }

    #[test]
    fn slugify_edge_cases() {
        assert_eq!(slugify("SFDeepPackPackStrike"), "S_F_DEEP_PACK_PACK_STRIKE");
        assert_eq!(slugify("abc"), "ABC");
        // 连字符处无字母边界（前字符非 alnum，不插下划线）；空白转下划线，其余特殊字符剔除
        assert_eq!(slugify("My-Card Name"), "MYCARD_NAME");
        assert_eq!(slugify("My Card"), "MY_CARD");
    }

    #[test]
    fn pck_header_is_v2() {
        let mut files = BTreeMap::new();
        files.insert("res://X/a.txt".to_string(), b"hello".to_vec());
        let dir = std::env::temp_dir().join("sf_pck_test");
        let _ = fs::create_dir_all(&dir);
        let out = dir.join("t.pck");
        write_pck(&out, &files).unwrap();
        let bytes = fs::read(&out).unwrap();
        assert_eq!(&bytes[0..4], b"GDPC");
        assert_eq!(u32::from_le_bytes(bytes[4..8].try_into().unwrap()), 2);
    }

    #[test]
    fn vanilla_override_card_serializes_and_localizes() {
        use crate::model::{CardDef, LocText};
        use std::collections::BTreeMap;
        use std::fs;

        // 覆盖卡：vanilla_id 指向原版 BASH；stats/upgrade_stats 可选携带
        let mut card = CardDef {
            id: "bash_tweak".into(),
            name: LocText {
                eng: "Bash+".into(),
                zhs: "痛击改".into(),
            },
            ..CardDef::default()
        };
        card.vanilla_id = Some("BASH".into());
        let mut stats = BTreeMap::new();
        stats.insert("Damage".to_string(), 10.0);
        card.stats = Some(stats);
        let dir = std::env::temp_dir().join("sf_vanilla_test_proj");
        let _ = fs::create_dir_all(&dir);
        let files = build_pack_files(dir.to_str().unwrap(), "TweakPack", &[card.clone()]).unwrap();

        // 卡牌 JSON 带 vanilla_id + stats；无立绘
        let card_json = &files["res://TweakPack/cards/bash_tweak.json"];
        let v: serde_json::Value = serde_json::from_slice(card_json).unwrap();
        assert_eq!(v["vanilla_id"], "BASH");
        assert_eq!(v["stats"]["Damage"], 10.0);

        // 本地化键 = 原版 Entry（游戏合并时覆盖原版文案）
        let zhs = &files["res://TweakPack/localization/zhs/cards.json"];
        let z: serde_json::Value = serde_json::from_slice(zhs).unwrap();
        assert!(
            z.get("BASH.title").is_some(),
            "loc key must be vanilla entry: {z:?}"
        );

        // 往返一致
        let ser = serde_json::to_value(&card).unwrap();
        let back: CardDef = serde_json::from_value(ser).unwrap();
        assert_eq!(back.vanilla_id.as_deref(), Some("BASH"));
        assert_eq!(back.stats.as_ref().unwrap()["Damage"], 10.0);
    }

    #[test]
    fn custom_effect_and_hooks_serialize() {
        use crate::model::{CardDef, EffectDef, LocText};
        use serde_json::json;

        let mut card = CardDef {
            id: "echo".into(),
            name: LocText {
                eng: "Echo".into(),
                zhs: "回声".into(),
            },
            ..CardDef::default()
        };
        card.effects.push(EffectDef::Custom {
            handler: "my_pack_storm".into(),
            amount: Some(2.0),
            target: None,
            params: Some(serde_json::from_value(json!({ "note": "hi", "n": 3 })).unwrap()),
        });
        card.on_discard.push(EffectDef::Block {
            amount: 4.0,
            props: vec![],
            upgrade_amount: 0.0,
        });
        card.on_turn_end_in_hand.push(EffectDef::Draw { amount: 1, upgrade_amount: 0.0 });
        // 关键钩子字段必须是游戏侧蛇形命名，空钩子不序列化
        let v = serde_json::to_value(&card).unwrap();
        let obj = v.as_object().unwrap();
        assert!(obj.contains_key("on_discard") && obj.contains_key("on_turn_end_in_hand"));
        assert!(!obj.contains_key("on_draw") && !obj.contains_key("on_exhaust"));
        let fx = &obj["effects"][0];
        assert_eq!(fx["kind"], "custom");
        assert_eq!(fx["handler"], "my_pack_storm");
        assert_eq!(fx["params"]["note"], "hi");
        assert_eq!(obj["on_discard"][0]["kind"], "block");
        // 往返一致
        let back: CardDef = serde_json::from_value(v).unwrap();
        assert_eq!(back.on_discard.len(), 1);
        assert!(
            matches!(&back.effects[0], EffectDef::Custom { handler, amount: Some(a), .. }
            if handler == "my_pack_storm" && *a == 2.0)
        );
    }

    #[test]
    fn expanded_effect_kinds_and_pools_serialize() {
        use crate::model::{CardDef, EffectDef, LocText};

        let mut card = CardDef {
            id: "kitchen_sink".into(),
            name: LocText {
                eng: "Kitchen Sink".into(),
                zhs: "水槽".into(),
            },
            ..CardDef::default()
        };
        card.effects = vec![
            EffectDef::Damage {
                amount: 8.0,
                props: vec!["Move".into()],
                target: None,
                vfx: Some("attack_blunt".into()),
                sfx: Some("blunt_attack.mp3".into()),
                attacker_vfx: None,
                hit_count: Some(2.0),
                upgrade_amount: 0.0,
            },
            EffectDef::Vfx { vfx: "vfx/vfx_chain".into(), target: Some("screen".into()) },
            EffectDef::Discard { amount: 1.0, upgrade_amount: 0.0 },
            EffectDef::Exhaust { amount: 2.0, upgrade_amount: 0.0 },
            EffectDef::Gold { amount: 10.0, upgrade_amount: 0.0 },
            EffectDef::LoseHp { amount: 3.0, upgrade_amount: 2.0 },
            EffectDef::MaxHp { amount: 4.0, upgrade_amount: 0.0 },
            EffectDef::Power {
                amount: 2.0,
                power: "Vulnerable".into(),
                target: None,
                upgrade_amount: 0.0,
            },
            EffectDef::Spawn {
                amount: 2,
                card_entry: "BASH".into(),
                pile: Some("draw".into()),
                upgrade_amount: 0.0,
            },
            EffectDef::Summon {
                amount: 1,
                monster: "DampCultist".into(),
                hp: Some(13.0),
                upgrade_amount: 0.0,
            },
            EffectDef::Delayed {
                turns: 2,
                timing: Some("turn_end".into()),
                every_turn: false,
                effects: vec![EffectDef::Block {
                    amount: 4.0,
                    props: vec!["Move".into()],
                    upgrade_amount: 0.0,
                }],
            },
        ];
        card.pools = vec!["ironclad".into(), "silent".into()];
        let v = serde_json::to_value(&card).unwrap();

        // kind 蛇形命名与 Runtime 端 SfEffect.Kind 解析一致
        assert_eq!(v["effects"][2]["kind"], "discard");
        assert_eq!(v["effects"][5]["kind"], "lose_hp");
        assert_eq!(v["effects"][7]["kind"], "power");
        assert_eq!(v["effects"][7]["power"], "Vulnerable");
        assert!(
            v["effects"][5].get("target").is_none(),
            "target=None 不序列化（=打出目标）"
        );
        assert_eq!(v["effects"][8]["kind"], "spawn");
        assert_eq!(v["effects"][8]["card_entry"], "BASH");
        assert_eq!(v["effects"][8]["pile"], "draw");
        assert_eq!(v["effects"][9]["kind"], "summon");
        assert_eq!(v["effects"][9]["monster"], "DampCultist");
        assert_eq!(v["effects"][9]["hp"], json!(13.0));
        // damage 打击特效字段透传；vfx 种类（纯演出）
        assert_eq!(v["effects"][0]["kind"], "damage");
        assert_eq!(v["effects"][0]["vfx"], "attack_blunt");
        assert_eq!(v["effects"][0]["sfx"], "blunt_attack.mp3");
        assert_eq!(v["effects"][0]["hit_count"], json!(2.0));
        assert_eq!(v["effects"][1]["kind"], "vfx");
        assert_eq!(v["effects"][1]["vfx"], "vfx/vfx_chain");
        assert_eq!(v["effects"][1]["target"], "screen");
        // delayed：蛇形 kind + turns/timing/effects 透传（Runtime SfEffect 同名 JSON 字段）
        assert_eq!(v["effects"][10]["kind"], "delayed");
        assert_eq!(v["effects"][10]["turns"], json!(2));
        assert_eq!(v["effects"][10]["timing"], "turn_end");
        assert_eq!(v["effects"][10]["every_turn"], json!(false));
        assert_eq!(v["effects"][10]["effects"][0]["kind"], "block");
        // 多池
        assert_eq!(v["pools"], json!(["ironclad", "silent"]));
        // 单池卡不序列化 pools（向后兼容）
        let mut single = CardDef::default();
        single.id = "solo".into();
        let sv = serde_json::to_value(&single).unwrap();
        assert!(sv.get("pools").is_none(), "pools 为空时不序列化");
        // 往返一致
        let back: CardDef = serde_json::from_value(v).unwrap();
        assert_eq!(
            back.pools,
            vec!["ironclad".to_string(), "silent".to_string()]
        );
        assert!(matches!(
            &back.effects[0],
            EffectDef::Damage { vfx: Some(vfx), sfx: Some(sfx), hit_count: Some(2.0), .. }
            if vfx == "attack_blunt" && sfx == "blunt_attack.mp3"
        ));
        assert!(matches!(&back.effects[2], EffectDef::Discard { amount, .. } if *amount == 1.0));
        assert!(matches!(&back.effects[5], EffectDef::LoseHp { amount, upgrade_amount } if *amount == 3.0 && *upgrade_amount == 2.0));
        assert!(
            matches!(&back.effects[7], EffectDef::Power { power, .. } if power == "Vulnerable")
        );
        assert!(
            matches!(&back.effects[9], EffectDef::Summon { monster, hp: Some(h), .. } if monster == "DampCultist" && *h == 13.0)
        );
        assert!(matches!(
            &back.effects[10],
            EffectDef::Delayed { turns: 2, timing: Some(t), every_turn: false, effects }
            if t == "turn_end" && effects.len() == 1
        ));
        // 兼容旧卡包：every_turn/effects 全缺省（黑屏卡 card_1 的形态）必须照常解析
        let legacy_delayed: EffectDef =
            serde_json::from_value(json!({"kind": "delayed", "turns": 2, "timing": "turn_end"})).unwrap();
        assert!(matches!(
            legacy_delayed,
            EffectDef::Delayed { every_turn: true, effects, .. } if effects.is_empty()
        ));
    }

    #[test]
    fn legacy_card_without_hooks_parses() {
        use crate::model::CardDef;
        // 旧格式卡牌（无钩子字段、damage 无 target）必须照常反序列化
        let raw = r#"{
            "format_version": 1, "id": "old_card", "card_type": "Attack",
            "rarity": "Common", "target": "AnyEnemy", "cost": 1, "costs_x": false,
            "keywords": [], "pool": "colorless", "show_in_library": true,
            "multiplayer": "none", "max_upgrade_level": 1, "portrait": "",
            "name": {"eng": "Old", "zhs": "旧卡"},
            "description": {"eng": "", "zhs": ""},
            "flavor": {"eng": "", "zhs": ""},
            "effects": [{"kind": "damage", "amount": 6, "props": ["Move"]}],
            "upgrades": {"damage": 3, "block": 0, "draw": 0, "energy": 0, "heal": 0, "keywords": []}
        }"#;
        let card: CardDef = serde_json::from_str(raw).unwrap();
        assert_eq!(card.effects.len(), 1);
        assert!(card.on_discard.is_empty() && card.on_draw.is_empty());
    }

    #[test]
    fn effect_upgrade_amount_serializes() {
        use crate::model::EffectDef;
        use serde_json::json;
        // 非 0 增量照常序列化；0/缺省省略且反序列化为 0（旧卡包兼容）
        let v = serde_json::to_value(EffectDef::LoseHp { amount: 3.0, upgrade_amount: 2.0 }).unwrap();
        assert_eq!(v["upgrade_amount"], json!(2.0));
        let v = serde_json::to_value(EffectDef::LoseHp { amount: 3.0, upgrade_amount: 0.0 }).unwrap();
        assert!(v.get("upgrade_amount").is_none(), "0 增量不序列化");
        let back: EffectDef = serde_json::from_value(v).unwrap();
        assert!(matches!(&back, EffectDef::LoseHp { upgrade_amount: 0.0, .. }));
        // 旧卡包无 upgrade_amount 字段 → 缺省 0（升级走 upgrades.* 旧通道）
        let old: EffectDef =
            serde_json::from_str(r#"{"kind":"lose_hp","amount":3.0}"#).unwrap();
        assert!(matches!(&old, EffectDef::LoseHp { amount: 3.0, upgrade_amount: 0.0 }));
        // spawn 增量 = 每次升级多生成几张
        let v = serde_json::to_value(EffectDef::Spawn {
            amount: 1,
            card_entry: "BASH".into(),
            pile: Some("hand".into()),
            upgrade_amount: 1.0,
        })
        .unwrap();
        assert_eq!(v["upgrade_amount"], json!(1.0));
    }
}
