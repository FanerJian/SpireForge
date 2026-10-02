//! 示例卡包：内置 5 张演示卡（编辑器模板基础卡 / 力量 / 自定义效果「咔咔」/ 生命周期钩子）
//! + 占位立绘（tools/make-demo-portraits.mjs 生成，include_bytes! 编译期内嵌）。
//! 「咔咔」由 Runtime 常驻注册的 demo_kaka 处理器执行（易伤 2 + 虚弱 2），
//! 无需额外 handler mod —— 让新用户开箱即看到"数据卡 + 自定义效果"两种玩法。

use serde_json::json;

const DEMO_STRIKE_PNG: &[u8] = include_bytes!("../assets/demo/strike.png");
const DEMO_DEFEND_PNG: &[u8] = include_bytes!("../assets/demo/defend.png");
const DEMO_STRENGTH_PNG: &[u8] = include_bytes!("../assets/demo/strength.png");
const DEMO_KAKA_PNG: &[u8] = include_bytes!("../assets/demo/kaka.png");
const DEMO_ECHO_PNG: &[u8] = include_bytes!("../assets/demo/echo.png");

/// 在选定目录创建示例卡包项目（pack_id = Demo，Entry 前缀 SF_）。
pub fn create_demo_project(path: &str) -> Result<(), String> {
    crate::project::create_project(path, "Demo", "示例卡包", "SpireForge")?;
    for card in demo_cards()? {
        crate::project::add_card(path, &card)?;
    }
    for (id, png) in [
        ("strike", DEMO_STRIKE_PNG),
        ("defend", DEMO_DEFEND_PNG),
        ("strength", DEMO_STRENGTH_PNG),
        ("kaka", DEMO_KAKA_PNG),
        ("echo", DEMO_ECHO_PNG),
    ] {
        crate::project::save_portrait(path, id, "png", png)?;
    }
    Ok(())
}

/// 5 张演示卡定义（portrait 字段与 save_portrait 的落盘路径一致）
fn demo_cards() -> Result<Vec<crate::model::CardDef>, String> {
    let defs = vec![
        // ---- 编辑器模板基础卡 ----
        json!({
            "format_version": 1, "id": "strike", "card_type": "Attack", "rarity": "Common",
            "target": "AnyEnemy", "cost": 1, "costs_x": false, "keywords": [],
            "pool": "colorless", "show_in_library": true, "multiplayer": "none",
            "max_upgrade_level": 1, "portrait": "assets/cards/strike.png",
            "name": {"zhs": "示例·打击", "eng": "Demo Strike"},
            "description": {"zhs": "造成 {Damage} 点伤害。", "eng": "Deal {Damage} damage."},
            "flavor": {"zhs": "编辑器「打击式攻击」模板的最基础形态。", "eng": "The most basic attack template."},
            "effects": [{"kind": "damage", "amount": 6, "props": ["Move"]}],
            "upgrades": {"damage": 3, "block": 0, "draw": 0, "energy": 0, "heal": 0, "keywords": []}
        }),
        json!({
            "format_version": 1, "id": "defend", "card_type": "Skill", "rarity": "Common",
            "target": "Self", "cost": 1, "costs_x": false, "keywords": [],
            "pool": "colorless", "show_in_library": true, "multiplayer": "none",
            "max_upgrade_level": 1, "portrait": "assets/cards/defend.png",
            "name": {"zhs": "示例·防御", "eng": "Demo Defend"},
            "description": {"zhs": "获得 {Block} 点格挡。", "eng": "Gain {Block} Block."},
            "flavor": {"zhs": "格挡吃敏捷，不吃力量——所以勾「不受 buff 影响」时两者都失效。", "eng": "Block scales with Dexterity."},
            "effects": [{"kind": "block", "amount": 5, "props": ["Move"]}],
            "upgrades": {"damage": 0, "block": 3, "draw": 0, "energy": 0, "heal": 0, "keywords": []}
        }),
        // ---- 力量（标准 power 效果，target=self）----
        json!({
            "format_version": 1, "id": "strength", "card_type": "Power", "rarity": "Uncommon",
            "target": "Self", "cost": 1, "costs_x": false, "keywords": [],
            "pool": "colorless", "show_in_library": true, "multiplayer": "none",
            "max_upgrade_level": 1, "portrait": "assets/cards/strength.png",
            "name": {"zhs": "示例·力量", "eng": "Demo Strength"},
            "description": {"zhs": "获得 5 层力量。", "eng": "Gain 5 Strength."},
            "flavor": {"zhs": "「施加增益/减益」效果 + 目标选「自身」。", "eng": "A power effect targeted at self."},
            "effects": [{"kind": "power", "amount": 5, "power": "Strength", "target": "self"}],
            "upgrades": {"damage": 0, "block": 0, "draw": 0, "energy": 0, "heal": 0, "keywords": []}
        }),
        // ---- 自定义效果「咔咔」（Runtime 内置 demo_kaka 处理器：易伤 2 + 虚弱 2）----
        json!({
            "format_version": 1, "id": "kaka", "card_type": "Skill", "rarity": "Rare",
            "target": "AnyEnemy", "cost": 1, "costs_x": false, "keywords": [],
            "pool": "colorless", "show_in_library": true, "multiplayer": "none",
            "max_upgrade_level": 1, "portrait": "assets/cards/kaka.png",
            "name": {"zhs": "示例·咔咔", "eng": "Demo Kaka"},
            "description": {"zhs": "咔咔！给敌人加一个咔咔：易伤 2 与虚弱 2。\n（自定义效果演示）", "eng": "Kaka! Apply 2 Vulnerable and 2 Weak.\n(Demo of custom effects.)"},
            "flavor": {"zhs": "kind=custom + handler=demo_kaka，由 Runtime 注册表执行。", "eng": "Custom handler registered by the runtime."},
            "effects": [{"kind": "custom", "handler": "demo_kaka"}],
            "upgrades": {"damage": 0, "block": 0, "draw": 0, "energy": 0, "heal": 0, "keywords": []}
        }),
        // ---- 生命周期钩子 ----
        json!({
            "format_version": 1, "id": "echo", "card_type": "Skill", "rarity": "Uncommon",
            "target": "Self", "cost": 0, "costs_x": false, "keywords": ["Exhaust"],
            "pool": "colorless", "show_in_library": true, "multiplayer": "none",
            "max_upgrade_level": 0, "portrait": "assets/cards/echo.png",
            "name": {"zhs": "示例·回响", "eng": "Demo Echo"},
            "description": {"zhs": "消耗。\n被消耗时，回复 3 点生命。", "eng": "Exhaust.\nWhen exhausted, heal 3 HP."},
            "flavor": {"zhs": "生命周期钩子演示：on_exhaust。", "eng": "Lifecycle hook demo: on_exhaust."},
            "effects": [],
            "upgrades": {"damage": 0, "block": 0, "draw": 0, "energy": 0, "heal": 0, "keywords": []},
            "on_exhaust": [{"kind": "heal", "amount": 3}]
        }),
    ];
    defs.into_iter()
        .map(|d| serde_json::from_value(d).map_err(|e| format!("示例卡定义反序列化失败: {e}")))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn demo_cards_match_schema() {
        let cards = demo_cards().expect("demo defs deserialize");
        assert_eq!(cards.len(), 5);
        let ids: Vec<_> = cards.iter().map(|c| c.id.as_str()).collect();
        assert_eq!(ids, ["strike", "defend", "strength", "kaka", "echo"]);
        // Entry 派生与 validate 的 pack_id 校验都应通过
        assert!(crate::project::validate_pack_id("Demo").is_ok());
    }
}
