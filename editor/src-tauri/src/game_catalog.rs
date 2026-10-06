//! 游戏内容目录（spireforge-catalog.json）读取：
//! Runtime 在游戏初始化后把全部已加载的力量/怪物/卡牌（原版 + mod）导出到
//! `mods/SpireForgeRuntime/spireforge-catalog.json`，编辑器读取后与内置目录
//! 合并——mod 角色的 buff、mod 怪物、mod 卡牌由此进入效果下拉框。
//! 纯展示用快照：文件缺失/损坏由前端静默降级为内置目录，这里只做格式把关。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_CATALOG_BYTES: usize = 4 * 1024 * 1024;
const MAX_PER_KIND: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimePower {
    pub name: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default, rename = "class_name")]
    pub class_name: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default, rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeMonster {
    pub name: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub hp: String,
    #[serde(default)]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeCard {
    pub entry: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub rarity: String,
    #[serde(default)]
    pub source: String,
}

/// 自定义效果处理器（SfEffects 注册表快照：Runtime 内置 + 全部 mod 注册的）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeCustomEffect {
    pub name: String,
    #[serde(default)]
    pub source: String,
    #[serde(default, rename = "desc_zh")]
    pub desc_zh: String,
    #[serde(default, rename = "desc_en")]
    pub desc_en: String,
}

/// 发给前端的目录（format_version 校验通过后不再外传）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeCatalog {
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub generated_at_utc: String,
    #[serde(default)]
    pub powers: Vec<RuntimePower>,
    #[serde(default)]
    pub monsters: Vec<RuntimeMonster>,
    #[serde(default)]
    pub cards: Vec<RuntimeCard>,
    #[serde(default, rename = "custom_effects")]
    pub custom_effects: Vec<RuntimeCustomEffect>,
}

#[derive(Deserialize)]
struct CatalogFile {
    format_version: u32,
    #[serde(default)]
    language: String,
    #[serde(default)]
    generated_at_utc: String,
    #[serde(default)]
    powers: Vec<RuntimePower>,
    #[serde(default)]
    monsters: Vec<RuntimeMonster>,
    #[serde(default)]
    cards: Vec<RuntimeCard>,
    #[serde(default, rename = "custom_effects")]
    custom_effects: Vec<RuntimeCustomEffect>,
}

/// 宽容解析：词条缺文本给空串即可（前端回落显示规范名），只对版本与规模把关。
pub fn parse_catalog(raw: &str) -> Result<RuntimeCatalog, String> {
    if raw.len() > MAX_CATALOG_BYTES {
        return Err("游戏内容目录文件超过 4 MB".into());
    }
    let file: CatalogFile =
        serde_json::from_str(raw).map_err(|e| format!("游戏内容目录 JSON 格式错误：{e}"))?;
    if file.format_version != 1 {
        return Err(format!(
            "不支持的游戏内容目录版本：{}（请更新 SpireForgeRuntime）",
            file.format_version
        ));
    }
    let mut catalog = RuntimeCatalog {
        language: file.language,
        generated_at_utc: file.generated_at_utc,
        powers: file.powers,
        monsters: file.monsters,
        cards: file.cards,
        custom_effects: file.custom_effects,
    };
    // 条目规模限制：异常 mod 不至于把前端下拉撑爆
    catalog.powers.truncate(MAX_PER_KIND);
    catalog.monsters.truncate(MAX_PER_KIND);
    catalog.cards.truncate(MAX_PER_KIND);
    catalog.custom_effects.truncate(MAX_PER_KIND);
    // 规范名兜底：力量缺 name 时用 class_name/entry，其余缺 entry 用 name；处理器名去空白
    for p in &mut catalog.powers {
        if p.name.is_empty() {
            p.name = if p.class_name.is_empty() { p.entry.clone() } else { p.class_name.clone() };
        }
    }
    for m in &mut catalog.monsters {
        if m.name.is_empty() {
            m.name = if m.entry.is_empty() { m.title.clone() } else { m.entry.clone() };
        }
    }
    for c in &mut catalog.cards {
        c.entry = c.entry.trim().to_string();
    }
    catalog.cards.retain(|c| !c.entry.is_empty());
    for h in &mut catalog.custom_effects {
        h.name = h.name.trim().to_string();
    }
    catalog.custom_effects.retain(|h| !h.name.is_empty());
    Ok(catalog)
}

pub fn read_game_catalog(game_dir: &str) -> Result<RuntimeCatalog, String> {
    if game_dir.is_empty() {
        return Err("请先在设置中选择游戏目录".into());
    }
    let path = PathBuf::from(game_dir)
        .join("mods")
        .join("SpireForgeRuntime")
        .join("spireforge-catalog.json");
    let metadata = fs::metadata(&path).map_err(|_| {
        "未找到游戏内容目录。请启用 SpireForgeRuntime，重启游戏并进入主菜单后再读取。".to_string()
    })?;
    if metadata.len() as usize > MAX_CATALOG_BYTES {
        return Err("游戏内容目录文件超过 4 MB".into());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("读取游戏内容目录失败：{e}"))?;
    parse_catalog(&raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_and_fills_defaults() {
        let cat = parse_catalog(
            r#"{"format_version":1,"language":"zhs","powers":[{"name":"MyBuff","class_name":"MyBuffPower","type":"buff"}]}"#,
        )
        .unwrap();
        assert_eq!(cat.language, "zhs");
        assert_eq!(cat.powers[0].name, "MyBuff");
        assert_eq!(cat.powers[0].kind, "buff");
        assert!(cat.monsters.is_empty() && cat.cards.is_empty());
    }

    #[test]
    fn parses_custom_effects_and_trims_names() {
        let cat = parse_catalog(
            r#"{"format_version":1,"custom_effects":[
                {"name":"sf_repeat","source":"SpireForgeRuntime","desc_zh":"重复","desc_en":"repeat"},
                {"name":"  my_pack_storm  ","source":"MyMod"},
                {"name":""}
            ]}"#,
        )
        .unwrap();
        assert_eq!(cat.custom_effects.len(), 2);
        assert_eq!(cat.custom_effects[0].name, "sf_repeat");
        assert_eq!(cat.custom_effects[0].desc_zh, "重复");
        assert_eq!(cat.custom_effects[1].name, "my_pack_storm");
        assert_eq!(cat.custom_effects[1].desc_en, "");
    }

    #[test]
    fn rejects_unknown_version_and_bad_json_and_strips_cards() {
        assert!(parse_catalog(r#"{"format_version":2}"#).is_err());
        assert!(parse_catalog(r#"not json"#).is_err());
        let cat = parse_catalog(
            r#"{"format_version":1,"cards":[{"entry":"","title":"x"},{"entry":"M Y","title":"y"},{"entry":"OK_CARD"}]}"#,
        )
        .unwrap();
        // 空 Entry 剔除；带空格的 Entry 不清洗（游戏 Entry 不会有空格，保留原样由前端处理）
        assert_eq!(cat.cards.len(), 2);
        assert_eq!(cat.cards[0].entry, "M Y");
        assert_eq!(cat.cards[1].entry, "OK_CARD");
    }
}
