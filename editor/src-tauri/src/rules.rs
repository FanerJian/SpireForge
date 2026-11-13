//! 可移植规则程序的边界校验、项目状态绑定及行为资源遍历。
//! 规则仍储存在 Custom.params，保留既有扩展处理器的数据表示。
use crate::model::{CardDef, EffectDef};
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};

pub const MAX_DEPTH: usize = 8;
pub const MAX_NODES: usize = 256;
pub const MAX_VALUE: f64 = 1_000_000_000.0;

#[derive(Debug, Clone, serde::Serialize)]
pub struct RuleIssue {
    pub field: String,
    pub message: String,
    #[serde(skip)]
    pub draft: bool,
}

fn fail(issues: &[RuleIssue]) -> Result<(), String> {
    if issues.is_empty() {
        return Ok(());
    }
    Err(issues
        .iter()
        .map(|i| format!("{}：{}", i.field, i.message))
        .collect::<Vec<_>>()
        .join("\n"))
}

#[derive(Default)]
struct Validator {
    issues: Vec<RuleIssue>,
    nodes: usize,
}

impl Validator {
    fn issue(&mut self, path: &str, message: impl Into<String>) {
        self.issues.push(RuleIssue {
            field: path.into(),
            message: message.into(),
            draft: false,
        });
    }

    fn semantic(&mut self, path: &str, message: impl Into<String>) {
        self.issues.push(RuleIssue {
            field: path.into(),
            message: message.into(),
            draft: true,
        });
    }

    fn object<'a>(&mut self, value: &'a Value, path: &str) -> Option<&'a Map<String, Value>> {
        match value.as_object() {
            Some(map) => Some(map),
            None => {
                self.issue(path, "需要对象");
                None
            }
        }
    }

    fn list<'a>(&mut self, value: &'a Value, path: &str) -> Option<&'a [Value]> {
        match value.as_array() {
            Some(list) => Some(list),
            None => {
                self.issue(path, "需要数组");
                None
            }
        }
    }

    fn fields(&mut self, map: &Map<String, Value>, allowed: &[&str], path: &str) {
        for key in map.keys() {
            if !allowed.contains(&key.as_str()) {
                self.issue(&format!("{path}.{key}"), "未知字段");
            }
        }
    }

    fn choice(&mut self, value: &Value, choices: &[&str], path: &str) {
        if !value.as_str().map_or(false, |s| choices.contains(&s)) {
            self.issue(path, format!("允许值为 {}", choices.join(" / ")));
        }
    }

    fn key(&mut self, value: &Value, path: &str) {
        if value.as_str().map_or(false, |s| s.trim().is_empty()) {
            self.semantic(path, "请填写标识");
        } else if !value.as_str().map_or(false, |s| {
            s.len() <= 128 && !s.chars().any(char::is_control)
        }) {
            self.issue(path, "需要 1–128 字节的非空标识");
        }
    }

    fn number(&mut self, value: &Value, path: &str) -> Option<f64> {
        let number = value.as_f64().filter(|n| n.is_finite());
        if number.is_none() {
            self.issue(path, "需要有限数值");
        }
        if number.map_or(false, |n| n.abs() > MAX_VALUE) {
            self.issue(path, "数值范围为 -1000000000 至 1000000000");
            return None;
        }
        number
    }

    fn integer(&mut self, value: &Value, min: f64, path: &str) {
        if let Some(number) = self.number(value, path) {
            if number.fract() != 0.0 || number < min {
                self.issue(path, format!("需要 {min}–{MAX_VALUE} 范围内的整数"));
            }
        }
    }

    fn value(&mut self, value: &Value, path: &str, statuses: &BTreeSet<String>) {
        if value.is_number() {
            self.number(value, path);
            return;
        }
        let Some(map) = self.object(value, path) else {
            return;
        };
        self.fields(
            map,
            &[
                "source", "key", "scope", "subject", "factor", "offset", "min", "max", "rounding",
            ],
            path,
        );
        self.choice(
            &value["source"],
            &[
                "self_hp",
                "self_max_hp",
                "self_missing_hp",
                "self_block",
                "hand_count",
                "draw_count",
                "discard_count",
                "exhaust_count",
                "enemy_count",
                "x",
                "upgrade",
                "counter",
                "status_stacks",
                "power_stacks",
            ],
            &format!("{path}.source"),
        );
        let source = value["source"].as_str().unwrap_or_default();
        if matches!(source, "counter" | "status_stacks" | "power_stacks") {
            self.key(&value["key"], &format!("{path}.key"));
        } else if map.contains_key("key") {
            self.issue(&format!("{path}.key"), "该来源无需 key");
        }
        if let Some(scope) = map.get("scope") {
            self.choice(scope, &["turn", "combat"], &format!("{path}.scope"));
            if source != "counter" {
                self.issue(&format!("{path}.scope"), "scope 适用于 counter 来源");
            }
        }
        if let Some(subject) = map.get("subject") {
            self.choice(subject, &["self", "target"], &format!("{path}.subject"));
            if !matches!(source, "status_stacks" | "power_stacks") {
                self.issue(&format!("{path}.subject"), "subject 适用于状态及力量来源");
            }
        }
        if source == "status_stacks" {
            self.status_ref(&value["key"], &format!("{path}.key"), statuses);
        }
        for key in ["factor", "offset", "min", "max"] {
            if let Some(number) = map.get(key) {
                self.number(number, &format!("{path}.{key}"));
            }
        }
        if let Some(rounding) = map.get("rounding") {
            self.choice(
                rounding,
                &["floor", "ceil", "round"],
                &format!("{path}.rounding"),
            );
        }
        if let (Some(min), Some(max)) = (value["min"].as_f64(), value["max"].as_f64()) {
            if min > max {
                self.issue(&format!("{path}.max"), "max 应大于或等于 min");
            }
        }
    }

    fn status_ref(&mut self, id: &Value, path: &str, statuses: &BTreeSet<String>) {
        if let Some(id) = id.as_str() {
            if !statuses.contains(id) {
                self.semantic(path, format!("状态 {id} 缺少定义"));
            }
        }
    }

    fn statuses(
        &mut self,
        value: &Value,
        path: &str,
        depth: usize,
        separate_budget: bool,
    ) -> BTreeSet<String> {
        let mut ids = BTreeSet::new();
        let Some(list) = self.list(value, path) else {
            return ids;
        };
        for (index, status) in list.iter().enumerate() {
            let path = format!("{path}.{index}");
            self.key(&status["id"], &format!("{path}.id"));
            if let Some(id) = status["id"].as_str() {
                if !ids.insert(id.to_string()) {
                    self.issue(&format!("{path}.id"), format!("状态 id 重复 {id}"));
                }
            }
        }
        for (index, status) in list.iter().enumerate() {
            let path = format!("{path}.{index}");
            let Some(map) = self.object(status, &path) else {
                continue;
            };
            self.fields(
                map,
                &[
                    "id",
                    "name",
                    "description",
                    "icon",
                    "stacking",
                    "max_stacks",
                    "decay",
                    "trigger",
                    "max_triggers_per_turn",
                    "nodes",
                ],
                &path,
            );
            for key in ["name", "description"] {
                let loc_path = format!("{path}.{key}");
                if let Some(loc) = self.object(&status[key], &loc_path) {
                    self.fields(loc, &["eng", "zhs"], &loc_path);
                    for lang in ["eng", "zhs"] {
                        if !status[key][lang].is_string() {
                            self.issue(&format!("{loc_path}.{lang}"), "需要文本");
                        }
                    }
                }
            }
            self.key(&status["icon"], &format!("{path}.icon"));
            self.choice(
                &status["stacking"],
                &["add", "replace", "max"],
                &format!("{path}.stacking"),
            );
            self.integer(&status["max_stacks"], 1.0, &format!("{path}.max_stacks"));
            self.integer(&status["decay"], 0.0, &format!("{path}.decay"));
            self.integer(
                &status["max_triggers_per_turn"],
                1.0,
                &format!("{path}.max_triggers_per_turn"),
            );
            self.choice(
                &status["trigger"],
                &["turn_start", "turn_end", "after_play", "after_attack"],
                &format!("{path}.trigger"),
            );
            if separate_budget {
                self.nodes = 0;
            }
            self.node_list(&status["nodes"], &format!("{path}.nodes"), depth, &ids);
        }
        ids
    }

    fn program(&mut self, value: &Value, path: &str, depth: usize) {
        let Some(map) = self.object(value, path) else {
            return;
        };
        self.fields(map, &["rules_version", "nodes", "statuses"], path);
        if value["rules_version"].as_u64() != Some(1) {
            self.issue(&format!("{path}.rules_version"), "规则版本应为 1");
        }
        let ids = self.statuses(
            &value["statuses"],
            &format!("{path}.statuses"),
            depth,
            false,
        );
        self.node_list(&value["nodes"], &format!("{path}.nodes"), depth, &ids);
    }

    fn node_list(&mut self, value: &Value, path: &str, depth: usize, statuses: &BTreeSet<String>) {
        let Some(list) = self.list(value, path) else {
            return;
        };
        if depth > MAX_DEPTH && !list.is_empty() {
            self.issue(path, "规则嵌套深度上限为 8");
            return;
        }
        for (index, node) in list.iter().enumerate() {
            self.nodes += 1;
            if self.nodes > MAX_NODES {
                self.issue(&format!("{path}.{index}"), "单程序节点上限为 256");
                return;
            }
            self.node(node, &format!("{path}.{index}"), depth, statuses);
        }
    }

    fn node(&mut self, node: &Value, path: &str, depth: usize, statuses: &BTreeSet<String>) {
        let Some(map) = self.object(node, path) else {
            return;
        };
        if let Some(enabled) = map.get("enabled") {
            if !enabled.is_boolean() {
                self.issue(&format!("{path}.enabled"), "需要布尔值");
            }
        }
        let fields: &[&str] = match node["type"].as_str().unwrap_or_default() {
            "action" => {
                self.effect(&node["effect"], &format!("{path}.effect"), depth);
                if let Some(amount) = map.get("amount") {
                    self.value(amount, &format!("{path}.amount"), statuses);
                }
                &["effect", "amount"]
            }
            "if" => {
                self.choice(&node["match"], &["all", "any"], &format!("{path}.match"));
                if let Some(conditions) =
                    self.list(&node["conditions"], &format!("{path}.conditions"))
                {
                    for (index, condition) in conditions.iter().enumerate() {
                        let field = format!("{path}.conditions.{index}");
                        if let Some(map) = self.object(condition, &field) {
                            self.fields(map, &["left", "op", "right"], &field);
                        }
                        self.value(&condition["left"], &format!("{field}.left"), statuses);
                        self.value(&condition["right"], &format!("{field}.right"), statuses);
                        self.choice(
                            &condition["op"],
                            &["eq", "ne", "gt", "gte", "lt", "lte"],
                            &format!("{field}.op"),
                        );
                    }
                }
                for key in ["then", "else"] {
                    self.node_list(&node[key], &format!("{path}.{key}"), depth + 1, statuses);
                }
                &["match", "conditions", "then", "else"]
            }
            "repeat" | "random" => {
                self.value(&node["count"], &format!("{path}.count"), statuses);
                self.node_list(
                    &node["nodes"],
                    &format!("{path}.nodes"),
                    depth + 1,
                    statuses,
                );
                &["count", "nodes"]
            }
            "counter" => {
                self.key(&node["key"], &format!("{path}.key"));
                self.choice(
                    &node["scope"],
                    &["turn", "combat"],
                    &format!("{path}.scope"),
                );
                self.choice(
                    &node["operation"],
                    &["set", "add"],
                    &format!("{path}.operation"),
                );
                self.value(&node["value"], &format!("{path}.value"), statuses);
                &["key", "scope", "operation", "value"]
            }
            "status" => {
                self.key(&node["id"], &format!("{path}.id"));
                self.status_ref(&node["id"], &format!("{path}.id"), statuses);
                self.choice(
                    &node["operation"],
                    &["apply", "remove"],
                    &format!("{path}.operation"),
                );
                self.choice(
                    &node["target"],
                    &["self", "target", "all_enemies"],
                    &format!("{path}.target"),
                );
                self.value(&node["stacks"], &format!("{path}.stacks"), statuses);
                &["id", "operation", "target", "stacks"]
            }
            "select" => {
                self.choice(
                    &node["from"],
                    &["hand", "draw", "discard", "exhaust"],
                    &format!("{path}.from"),
                );
                self.choice(
                    &node["mode"],
                    &["choose", "random", "all"],
                    &format!("{path}.mode"),
                );
                self.value(&node["count"], &format!("{path}.count"), statuses);
                if let Some(card_type) = map.get("card_type") {
                    self.choice(
                        card_type,
                        &["", "Attack", "Skill", "Power", "Status", "Curse", "Quest"],
                        &format!("{path}.card_type"),
                    );
                }
                if let Some(operations) =
                    self.list(&node["operations"], &format!("{path}.operations"))
                {
                    for (index, operation) in operations.iter().enumerate() {
                        self.operation(operation, &format!("{path}.operations.{index}"), statuses);
                    }
                }
                &["from", "mode", "card_type", "count", "operations"]
            }
            _ => {
                self.issue(&format!("{path}.type"), "未知规则节点");
                &[]
            }
        };
        let mut allowed = vec!["type", "enabled"];
        allowed.extend_from_slice(fields);
        self.fields(map, &allowed, path);
    }

    fn operation(&mut self, operation: &Value, path: &str, statuses: &BTreeSet<String>) {
        let Some(map) = self.object(operation, path) else {
            return;
        };
        let fields: &[&str] = match operation["type"].as_str().unwrap_or_default() {
            "move" | "copy" => {
                self.choice(
                    &operation["pile"],
                    &["hand", "draw", "discard"],
                    &format!("{path}.pile"),
                );
                &["type", "pile"]
            }
            "exhaust" | "upgrade" => &["type"],
            "cost" => {
                self.value(&operation["amount"], &format!("{path}.amount"), statuses);
                self.choice(
                    &operation["duration"],
                    &["turn", "combat"],
                    &format!("{path}.duration"),
                );
                &["type", "amount", "duration"]
            }
            _ => {
                self.issue(&format!("{path}.type"), "未知选牌操作");
                &["type"]
            }
        };
        self.fields(map, fields, path);
    }

    fn effect(&mut self, value: &Value, path: &str, depth: usize) {
        if depth > MAX_DEPTH {
            self.issue(path, "效果嵌套深度上限为 8");
            return;
        }
        if self.reject_nested_programs(value, path) {
            return;
        }
        if let Err(error) = serde_json::from_value::<EffectDef>(value.clone()) {
            self.issue(path, format!("基础效果结构无效 {error}"));
            return;
        }
        for (kind, key) in [
            ("power", "power"),
            ("spawn", "card_entry"),
            ("summon", "monster"),
            ("vfx", "vfx"),
            ("custom", "handler"),
        ] {
            if value["kind"].as_str() == Some(kind)
                && value[key].as_str().unwrap_or_default().trim().is_empty()
            {
                self.semantic(&format!("{path}.{key}"), "请填写效果引用");
            }
        }
        if let Some(map) = value.as_object() {
            for (key, child) in map {
                self.embedded_effects(child, &format!("{path}.{key}"), depth + 1);
            }
        }
    }

    fn reject_nested_programs(&mut self, value: &Value, path: &str) -> bool {
        if value["handler"]
            .as_str()
            .map_or(false, |s| s.eq_ignore_ascii_case("sf_rules"))
            || value["kind"]
                .as_str()
                .map_or(false, |s| s.eq_ignore_ascii_case("sf_rules"))
        {
            self.issue(
                &format!("{path}.handler"),
                "动作内的规则组合请使用 if / repeat / random 节点",
            );
            return true;
        }
        let mut found = false;
        match value {
            Value::Array(list) => {
                for (index, child) in list.iter().enumerate() {
                    found |= self.reject_nested_programs(child, &format!("{path}.{index}"));
                }
            }
            Value::Object(map) => {
                for (key, child) in map {
                    found |= self.reject_nested_programs(child, &format!("{path}.{key}"));
                }
            }
            _ => {}
        }
        found
    }

    fn embedded_effects(&mut self, value: &Value, path: &str, depth: usize) {
        if value.get("kind").and_then(Value::as_str).is_some()
            && serde_json::from_value::<EffectDef>(value.clone()).is_ok()
        {
            self.effect(value, path, depth);
            return;
        }
        match value {
            Value::Array(list) => {
                for (index, child) in list.iter().enumerate() {
                    self.embedded_effects(child, &format!("{path}.{index}"), depth);
                }
            }
            Value::Object(map) => {
                for (key, child) in map {
                    self.embedded_effects(child, &format!("{path}.{key}"), depth);
                }
            }
            _ => {}
        }
    }

    // 兼容旧组合处理器在 params 内携带的效果及全部生命周期钩子。
    fn scan(&mut self, value: &Value, path: &str, depth: usize) {
        if is_program_effect(value) {
            if depth == 1 {
                self.nodes = 0;
            }
            self.program(&value["params"], &format!("{path}.params"), depth);
            return;
        }
        match value {
            Value::Array(list) => {
                for (index, value) in list.iter().enumerate() {
                    self.scan(value, &format!("{path}.{index}"), depth);
                }
            }
            Value::Object(map) => {
                for (key, value) in map {
                    self.scan(value, &format!("{path}.{key}"), depth);
                }
            }
            _ => {}
        }
    }
}

fn is_program_effect(value: &Value) -> bool {
    value["kind"].as_str() == Some("custom")
        && value["handler"]
            .as_str()
            .map_or(false, |s| s.eq_ignore_ascii_case("sf_rules"))
}

pub fn validate_statuses(statuses: &[Value]) -> Vec<RuleIssue> {
    let mut validator = Validator::default();
    validator.statuses(&Value::Array(statuses.to_vec()), "rule_statuses", 1, true);
    validator.issues
}

pub fn ensure_statuses(statuses: &[Value]) -> Result<(), String> {
    fail(
        &validate_statuses(statuses)
            .into_iter()
            .filter(|i| !i.draft)
            .collect::<Vec<_>>(),
    )
}

pub fn ensure_templates(templates: &[Value]) -> Result<(), String> {
    let mut validator = Validator::default();
    if templates.len() > 100 {
        validator.issue("rule_templates", "个人模板上限为 100");
    }
    let mut ids = BTreeSet::new();
    for (index, template) in templates.iter().enumerate() {
        let path = format!("rule_templates.{index}");
        let Some(map) = validator.object(template, &path) else {
            continue;
        };
        validator.fields(map, &["id", "name", "program"], &path);
        validator.key(&template["id"], &format!("{path}.id"));
        if let Some(id) = template["id"].as_str() {
            if !ids.insert(id) {
                validator.issue(&format!("{path}.id"), "模板 id 重复");
            }
        }
        if !template["name"].is_string() {
            validator.issue(&format!("{path}.name"), "需要文本");
        }
        validator.nodes = 0;
        validator.program(&template["program"], &format!("{path}.program"), 1);
    }
    fail(
        &validator
            .issues
            .into_iter()
            .filter(|i| !i.draft)
            .collect::<Vec<_>>(),
    )
}

pub fn validate_card(card: &CardDef) -> Vec<RuleIssue> {
    let mut issues = Vec::new();
    for (name, effects) in effect_lists(card) {
        if let Ok(Value::Array(list)) = serde_json::to_value(effects) {
            for (index, effect) in list.iter().enumerate() {
                // 每个程序独立预算，程序中的状态和嵌套动作共用预算。
                let mut validator = Validator::default();
                validator.scan(effect, &format!("{name}.{index}"), 1);
                issues.extend(validator.issues);
            }
        }
    }
    if has_rules(card) && card.format_version < 3 {
        issues.push(RuleIssue {
            field: "format_version".into(),
            message: "规则程序要求卡牌格式版本 3".into(),
            draft: false,
        });
    }
    issues
}

pub fn ensure_card(card: &CardDef) -> Result<(), String> {
    fail(
        &validate_card(card)
            .into_iter()
            .filter(|i| !i.draft)
            .collect::<Vec<_>>(),
    )
}

pub fn ensure_publish(card: &CardDef) -> Result<(), String> {
    fail(&validate_card(card))
}

pub fn effect_lists(card: &CardDef) -> [(&'static str, &[EffectDef]); 6] {
    [
        ("effects", &card.effects),
        ("on_draw", &card.on_draw),
        ("on_discard", &card.on_discard),
        ("on_exhaust", &card.on_exhaust),
        ("on_enter_combat", &card.on_enter_combat),
        ("on_turn_end_in_hand", &card.on_turn_end_in_hand),
    ]
}

fn contains_rules(value: &Value) -> bool {
    if is_program_effect(value) {
        return true;
    }
    match value {
        Value::Array(list) => list.iter().any(contains_rules),
        Value::Object(map) => map.values().any(contains_rules),
        _ => false,
    }
}

pub fn has_rules(card: &CardDef) -> bool {
    effect_lists(card)
        .iter()
        .any(|(_, effects)| serde_json::to_value(effects).map_or(false, |v| contains_rules(&v)))
}

fn walk_mut(
    value: &mut Value,
    path: &str,
    visitor: &mut impl FnMut(&mut Value, &str) -> Result<(), String>,
) -> Result<(), String> {
    match value {
        Value::Array(list) => {
            for (index, value) in list.iter_mut().enumerate() {
                walk_mut(value, &format!("{path}.{index}"), visitor)?;
            }
        }
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                walk_mut(value, &format!("{path}.{key}"), visitor)?;
            }
        }
        _ => {}
    }
    visitor(value, path)
}

pub fn transform_effects(
    card: &mut CardDef,
    mut visitor: impl FnMut(&mut Value, &str) -> Result<(), String>,
) -> Result<(), String> {
    for (name, effects) in [
        ("effects", &mut card.effects),
        ("on_draw", &mut card.on_draw),
        ("on_discard", &mut card.on_discard),
        ("on_exhaust", &mut card.on_exhaust),
        ("on_enter_combat", &mut card.on_enter_combat),
        ("on_turn_end_in_hand", &mut card.on_turn_end_in_hand),
    ] {
        let mut value = serde_json::to_value(&*effects).map_err(|e| e.to_string())?;
        walk_mut(&mut value, name, &mut visitor)?;
        *effects = serde_json::from_value(value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn bind_statuses(card: &mut CardDef, statuses: &[Value]) -> Result<(), String> {
    ensure_statuses(statuses)?;
    if has_rules(card) {
        card.format_version = card.format_version.max(3);
    }
    ensure_card(card)?;
    let catalog: BTreeMap<&str, &Value> = statuses
        .iter()
        .filter_map(|status| status["id"].as_str().map(|id| (id, status)))
        .collect();
    transform_effects(card, |value, _| {
        if !is_program_effect(value) {
            return Ok(());
        }
        let Some(params) = value.get_mut("params").and_then(Value::as_object_mut) else {
            return Ok(());
        };
        let mut referenced = BTreeSet::new();
        status_references(&params["nodes"], &mut referenced);
        let Some(snapshot) = params.get_mut("statuses").and_then(Value::as_array_mut) else {
            return Ok(());
        };
        let mut known = BTreeSet::new();
        for status in snapshot.iter_mut() {
            if let Some(id) = status["id"].as_str() {
                known.insert(id.to_string());
                if let Some(project_status) = catalog.get(id) {
                    *status = (*project_status).clone();
                }
            }
            status_references(&status["nodes"], &mut referenced);
        }
        // 被引用状态的节点可继续引用其他共享状态，逐项补全闭包。
        while let Some(id) = referenced.pop_first() {
            if !known.insert(id.clone()) {
                continue;
            }
            if let Some(status) = catalog.get(id.as_str()) {
                status_references(&status["nodes"], &mut referenced);
                snapshot.push((*status).clone());
            }
        }
        Ok(())
    })?;
    ensure_card(card)
}

fn status_references(value: &Value, out: &mut BTreeSet<String>) {
    let key = if value["type"].as_str() == Some("status") {
        Some("id")
    } else if value["source"].as_str() == Some("status_stacks") {
        Some("key")
    } else {
        None
    };
    if let Some(id) = key
        .and_then(|key| value[key].as_str())
        .filter(|id| !id.is_empty())
    {
        out.insert(id.into());
    }
    match value {
        Value::Array(list) => {
            for child in list {
                status_references(child, out);
            }
        }
        Value::Object(map) => {
            for child in map.values() {
                status_references(child, out);
            }
        }
        _ => {}
    }
}

/// 遍历基础效果图标，覆盖规则动作、共享状态节点、旧组合 params 与钩子。
pub fn transform_icons(
    card: &mut CardDef,
    mut transform: impl FnMut(&str) -> Result<String, String>,
) -> Result<(), String> {
    transform_effects(card, |value, _| {
        if value["kind"].as_str() == Some("delayed") {
            if let Some(icon) = value.get_mut("icon").filter(|v| v.is_string()) {
                *icon = Value::String(transform(icon.as_str().unwrap_or_default())?);
            }
        }
        Ok(())
    })
}

pub fn asset_paths(card: &CardDef) -> Result<BTreeSet<String>, String> {
    let mut paths = BTreeSet::new();
    transform_icons(&mut card.clone(), |icon| {
        if icon.trim().starts_with("assets/") {
            paths.insert(icon.trim().into());
        }
        Ok(icon.into())
    })?;
    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn action() -> Value {
        json!({"type":"action", "effect":{"kind":"block", "amount":3}})
    }
    fn program(nodes: Vec<Value>, statuses: Vec<Value>) -> Value {
        json!({"rules_version":1,"nodes":nodes,"statuses":statuses})
    }
    fn effect(program: Value) -> EffectDef {
        serde_json::from_value(json!({"kind":"custom","handler":"sf_rules","params":program}))
            .unwrap()
    }
    fn card(program: Value) -> CardDef {
        CardDef {
            id: "rules_card".into(),
            effects: vec![effect(program)],
            ..Default::default()
        }
    }
    fn status(id: &str) -> Value {
        json!({"id":id,"name":{"zhs":"星火","eng":"Spark"},"description":{"eng":"","zhs":""},"icon":"Poison",
            "stacking":"add","max_stacks":99,"decay":1,"trigger":"turn_end","max_triggers_per_turn":1,"nodes":[action()]})
    }
    fn root(name: &str) -> String {
        let root = std::env::temp_dir().join(format!("sf_rules_{name}"));
        let _ = std::fs::remove_dir_all(&root);
        let root = root.to_string_lossy().into_owned();
        crate::project::create_project(&root, "RulesPack", "Rules", "Tester").unwrap();
        root
    }

    #[test]
    fn all_nodes_expressions_and_operations_round_trip() {
        let value = json!({"source":"status_stacks","key":"spark","subject":"target","factor":1.5,"offset":-1,"min":0,"max":100,"rounding":"ceil"});
        let nodes = vec![
            json!({"type":"action","effect":{"kind":"damage","amount":0,"props":["Unpowered"]},"amount":value}),
            json!({"type":"if","match":"any","conditions":[{"left":{"source":"counter","key":"combo","scope":"turn"},"op":"gte","right":2}],"then":[action()],"else":[]}),
            json!({"type":"repeat","count":{"source":"x"},"nodes":[action()]}),
            json!({"type":"random","count":1,"nodes":[action(),action()]}),
            json!({"type":"counter","key":"combo","scope":"combat","operation":"set","value":0}),
            json!({"type":"status","id":"spark","target":"all_enemies","operation":"remove","stacks":1}),
            json!({"type":"select","from":"exhaust","mode":"all","card_type":"Attack","count":2,"operations":[
                {"type":"copy","pile":"draw"},{"type":"move","pile":"hand"},{"type":"exhaust"},{"type":"upgrade"},
                {"type":"cost","amount":-1,"duration":"turn"}]}),
        ];
        let original = card(program(nodes, vec![status("spark")]));
        assert!(validate_card(&original).is_empty());
        let raw = serde_json::to_string(&original).unwrap();
        let imported = crate::import::import_any(&raw).unwrap().card;
        assert_eq!(
            serde_json::to_value(original).unwrap(),
            serde_json::to_value(imported).unwrap()
        );
    }

    #[test]
    fn empty_card_type_preserves_all_card_selection_for_existing_drafts() {
        let node = json!({"type":"select","from":"hand","mode":"all","card_type":"","count":1,"operations":[{"type":"upgrade"}]});
        let original = card(program(vec![node], vec![]));
        assert!(validate_card(&original).is_empty());
        let raw = serde_json::to_string(&original).unwrap();
        let imported = crate::import::import_any(&raw).unwrap().card;
        assert_eq!(
            serde_json::to_value(original).unwrap(),
            serde_json::to_value(imported).unwrap()
        );
    }

    #[test]
    fn frontend_template_fixtures_validate_and_pack_import_without_contract_changes() {
        let examples: Vec<Value> =
            serde_json::from_str(include_str!("../../../schema/rules-v1.examples.json")).unwrap();
        assert_eq!(examples.len(), 5);
        let root = root("frontend_templates");
        let cards: Vec<CardDef> = examples
            .iter()
            .map(|example| {
                let mut card = card(example["program"].clone());
                card.id = example["id"].as_str().unwrap().into();
                assert!(validate_card(&card).is_empty(), "{}", card.id);
                card
            })
            .collect();
        let files = crate::publish::build_pack_files(&root, "RulesPack", &cards).unwrap();
        let path = std::path::Path::new(&root).join("frontend_templates.pck");
        crate::publish::write_pck(&path, &files).unwrap();
        let imported = crate::import::import_pck(path.to_str().unwrap()).unwrap();
        assert!(imported.errors.is_empty());
        assert_eq!(imported.imported.len(), cards.len());
        for original in cards {
            let copy = &imported
                .imported
                .iter()
                .find(|report| report.card.id == original.id)
                .unwrap()
                .card;
            assert_eq!(
                serde_json::to_value(&original).unwrap(),
                serde_json::to_value(copy).unwrap()
            );
        }
    }

    #[test]
    fn runtime_manifest_minimum_tracks_rules_and_preserves_legacy_version_requirements() {
        let mut legacy = CardDef {
            id: "legacy".into(),
            format_version: 1,
            ..Default::default()
        };
        for (version, expected) in [(1, Value::Null), (2, json!("0.1.16")), (3, json!("0.2.0"))] {
            legacy.format_version = version;
            let manifest: Value = serde_json::from_str(&crate::publish::build_manifest_for_cards(
                "RulesPack",
                "Rules",
                "Author",
                "",
                "1",
                &[legacy.clone()],
            ))
            .unwrap();
            let runtime = manifest["dependencies"]
                .as_array()
                .unwrap()
                .iter()
                .find(|dependency| dependency["id"] == "SpireForgeRuntime")
                .unwrap();
            assert_eq!(runtime["min_version"], expected);
        }
    }

    #[test]
    fn validation_locates_invalid_sources_enums_numbers_and_references() {
        let mut definition = status("spark");
        definition["nodes"] = json!([{"type":"status","id":"missing","target":"self","operation":"apply","stacks":1}]);
        let card = card(program(
            vec![
                json!({"type":"repeat","enabled":"false","count":{"source":"made_up","factor":null,"rounding":"truncate","min":5,"max":2},"nodes":[]}),
                json!({"type":"select","from":"vault","mode":"choose","count":1,"operations":[{"type":"cost","amount":{},"duration":"forever"}]}),
                json!({"type":"status","id":"missing","target":"self","operation":"add","stacks":1}),
            ],
            vec![definition],
        ));
        let fields: BTreeSet<_> = validate_card(&card).into_iter().map(|i| i.field).collect();
        for path in [
            "nodes.0.enabled",
            "nodes.0.count.source",
            "nodes.0.count.factor",
            "nodes.0.count.rounding",
            "nodes.0.count.max",
            "nodes.1.from",
            "nodes.1.operations.0.duration",
            "nodes.2.id",
            "nodes.2.operation",
            "statuses.0.nodes.0.id",
        ] {
            assert!(
                fields.contains(&format!("effects.0.params.{path}")),
                "{path}: {fields:?}"
            );
        }
    }

    #[test]
    fn numeric_literals_and_expression_adjustments_enforce_shared_runtime_range() {
        for number in [-MAX_VALUE, MAX_VALUE] {
            let node =
                json!({"type":"action","effect":{"kind":"block","amount":1},"amount":number});
            assert!(ensure_card(&card(program(vec![node], vec![]))).is_ok());
        }
        for number in [-MAX_VALUE - 1.0, MAX_VALUE + 1.0, 1e100] {
            let node =
                json!({"type":"action","effect":{"kind":"block","amount":1},"amount":number});
            assert!(ensure_card(&card(program(vec![node], vec![])))
                .unwrap_err()
                .contains("nodes.0.amount"));
            for key in ["factor", "offset", "min", "max"] {
                let mut value = json!({"source":"x"});
                value[key] = json!(number);
                let node = json!({"type":"repeat","count":value,"nodes":[]});
                assert!(ensure_card(&card(program(vec![node], vec![])))
                    .unwrap_err()
                    .contains(&format!("count.{key}")));
            }
        }
        let mut status = status("bounded");
        status["max_stacks"] = json!(MAX_VALUE + 1.0);
        assert!(ensure_statuses(&[status])
            .unwrap_err()
            .contains("max_stacks"));
    }

    #[test]
    fn node_depth_and_combined_status_budgets_have_exact_boundaries() {
        let mut nested = action();
        for _ in 1..MAX_DEPTH {
            nested = json!({"type":"repeat","count":1,"nodes":[nested]});
        }
        assert!(validate_card(&card(program(vec![nested.clone()], vec![]))).is_empty());
        nested = json!({"type":"repeat","count":1,"nodes":[nested]});
        assert!(ensure_card(&card(program(vec![nested], vec![])))
            .unwrap_err()
            .contains("深度"));
        let mut definition = status("spark");
        definition["nodes"] = json!([action()]);
        assert!(ensure_card(&card(program(
            vec![action(); 255],
            vec![definition.clone()]
        )))
        .is_ok());
        assert!(
            ensure_card(&card(program(vec![action(); 256], vec![definition])))
                .unwrap_err()
                .contains("256")
        );
        let mut deepest_if = json!({"type":"if","match":"all","conditions":[],"then":[],"else":[]});
        for _ in 1..MAX_DEPTH {
            deepest_if = json!({"type":"repeat","count":1,"nodes":[deepest_if]});
        }
        assert!(ensure_card(&card(program(vec![deepest_if], vec![]))).is_ok());
        let mut effect = json!({"kind":"block","amount":1});
        for _ in 1..MAX_DEPTH {
            effect = json!({"kind":"delayed","effects":[effect]});
        }
        let node = json!({"type":"action","effect":effect.clone()});
        assert!(ensure_card(&card(program(vec![node], vec![]))).is_ok());
        effect = json!({"kind":"delayed","effects":[effect]});
        let node = json!({"type":"action","effect":effect});
        assert!(ensure_card(&card(program(vec![node], vec![])))
            .unwrap_err()
            .contains("效果嵌套"));
    }

    #[test]
    fn nested_programs_are_located_and_legacy_outer_containers_remain_portable() {
        let nested = json!({"type":"action","effect":{"kind":"custom","handler":"sf_rules","params":program(vec![action(); 256], vec![])}});
        assert!(ensure_card(&card(program(vec![nested], vec![])))
            .unwrap_err()
            .contains("effects.0.params.nodes.0.effect.handler"));
        let nested = json!({"type":"action","effect":{"kind":"custom","handler":"third_party","params":{"actions":[
            {"kind":"delayed","effects":[{"kind":"custom","handler":"SF_RULES","params":program(vec![],vec![])}]}
        ]}}});
        assert!(ensure_card(&card(program(vec![nested], vec![])))
            .unwrap_err()
            .contains("effect.params.actions.0.effects.0.handler"));
        let program = program(vec![action(); 256], vec![]);
        let card = CardDef { id: "independent".into(), effects: vec![serde_json::from_value(json!({"kind":"custom","handler":"chain","params":{"effects":[
            serde_json::to_value(effect(program.clone())).unwrap(),serde_json::to_value(effect(program)).unwrap()
        ]}})).unwrap()], ..Default::default() };
        assert!(ensure_card(&card).is_ok());
    }

    #[test]
    fn drafts_save_and_preflight_locates_semantic_gaps_before_pack() {
        let root = root("draft");
        let draft = card(program(
            vec![json!({"type":"status","id":"","operation":"apply","target":"self","stacks":1})],
            vec![],
        ));
        crate::project::add_card(&root, &draft).unwrap();
        let issues = crate::publish::preflight("RulesPack", &[draft.clone()]);
        assert!(issues
            .iter()
            .any(|i| i.field == "effects.0.params.nodes.0.id"));
        assert!(crate::publish::build_pack_files(&root, "RulesPack", &[draft]).is_err());
    }

    #[test]
    fn project_catalog_overrides_matching_snapshots_and_preserves_imported_statuses() {
        let root = root("binding");
        let mut imported = status("spark");
        imported["max_stacks"] = json!(10);
        let mut original = card(program(vec![action()], vec![imported, status("portable")]));
        original.format_version = 1;
        crate::project::add_card(&root, &original).unwrap();
        let mut meta = crate::project::read_meta(&root).unwrap();
        assert_eq!(meta.format_version, 3);
        let mut project_definition = status("spark");
        project_definition["max_stacks"] = json!(50);
        meta.rule_statuses = vec![project_definition.clone()];
        meta.rule_templates =
            vec![json!({"id":"saved","name":"常用组合","program":program(vec![action()],vec![])})];
        crate::project::write_meta(&root, &meta).unwrap();
        let exported: Value =
            serde_json::from_str(&crate::project::export_card_json(&root, &original.id).unwrap())
                .unwrap();
        assert_eq!(
            exported["effects"][0]["params"]["statuses"][0],
            project_definition
        );
        assert_eq!(
            exported["effects"][0]["params"]["statuses"][1]["id"],
            "portable"
        );
        assert_eq!(
            crate::project::read_meta(&root).unwrap().rule_templates,
            meta.rule_templates
        );
        let files = crate::publish::build_pack_files(&root, "RulesPack", &[original]).unwrap();
        let packed: Value =
            serde_json::from_slice(&files["res://RulesPack/cards/rules_card.json"]).unwrap();
        assert_eq!(packed["effects"], exported["effects"]);
        assert!(packed.get("rule_templates").is_none());
    }

    #[test]
    fn project_status_reference_closure_is_bounded_and_stable_across_repeated_saves() {
        let mut first = status("first");
        first["nodes"] =
            json!([{"type":"status","id":"second","operation":"apply","target":"self","stacks":1}]);
        let mut second = status("second");
        second["nodes"] =
            json!([{"type":"status","id":"first","operation":"remove","target":"self","stacks":1}]);
        let directory = vec![status("unused"), first, second];
        let mut bound_card = card(program(
            vec![json!({"type":"action","effect":{"kind":"block","amount":0},
            "amount":{"source":"status_stacks","key":"first"}})],
            vec![status("portable")],
        ));
        bind_statuses(&mut bound_card, &directory).unwrap();
        let stable = serde_json::to_value(&bound_card).unwrap();
        let ids: BTreeSet<_> = stable["effects"][0]["params"]["statuses"]
            .as_array()
            .unwrap()
            .iter()
            .map(|status| status["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, BTreeSet::from(["first", "second", "portable"]));
        for _ in 0..5 {
            bind_statuses(&mut bound_card, &directory).unwrap();
            assert_eq!(serde_json::to_value(&bound_card).unwrap(), stable);
        }
        let mut large_first = status("one");
        large_first["nodes"] = json!(vec![action(); 200]);
        let mut large_second = status("two");
        large_second["nodes"] = json!(vec![action(); 200]);
        assert!(ensure_statuses(&[large_first.clone(), large_second.clone()]).is_ok());
        let over_budget = card(program(vec![], vec![large_first, large_second]));
        assert!(ensure_card(&over_budget).unwrap_err().contains("256"));
    }

    #[test]
    fn duplicate_status_ids_and_template_limits_are_hard_save_errors() {
        let duplicate = card(program(vec![], vec![status("spark"), status("spark")]));
        assert!(ensure_card(&duplicate)
            .unwrap_err()
            .contains("statuses.1.id"));
        let mut clone = duplicate.clone();
        assert!(bind_statuses(&mut clone, &[status("spark")]).is_err());
        assert!(ensure_statuses(&[status("spark"), status("spark")]).is_err());
        let template = json!({"id":"one","name":"One","program":program(vec![], vec![])});
        assert!(ensure_templates(&[template.clone()]).is_ok());
        assert!(ensure_templates(&vec![template; 101])
            .unwrap_err()
            .contains("100"));
    }

    #[test]
    fn hook_legacy_params_and_status_actions_keep_assets_and_dependencies_in_pck_round_trip() {
        let root = root("pck");
        let mut definition = status("spark");
        definition["nodes"] = json!([{"type":"action","effect":{"kind":"delayed","icon":"assets/powers/spark.png","effects":[
            {"kind":"power","power":"mod:StatusMod:Status.Power","amount":1}
        ]}}]);
        std::fs::create_dir_all(std::path::Path::new(&root).join("assets/powers")).unwrap();
        std::fs::write(
            std::path::Path::new(&root).join("assets/powers/spark.png"),
            b"icon-bytes",
        )
        .unwrap();
        let mut card = CardDef { id:"hook_rule".into(), on_draw:vec![serde_json::from_value(json!({"kind":"custom","handler":"old_chain","params":{"effects":[
            serde_json::to_value(effect(program(vec![json!({"type":"action","effect":{"kind":"spawn","card_entry":"mod:CardMod:Card.Type","amount":1}})], vec![definition]))).unwrap(),
            {"kind":"delayed","icon":"assets/powers/spark.png","effects":[]}
        ]}})).unwrap()], ..Default::default() };
        crate::content_refs::enrich(&mut card, None);
        assert_eq!(
            crate::content_refs::mod_ids(&card),
            BTreeSet::from(["CardMod".into(), "StatusMod".into()])
        );
        assert_eq!(
            asset_paths(&card).unwrap(),
            BTreeSet::from(["assets/powers/spark.png".into()])
        );
        let files = crate::publish::build_pack_files(&root, "RulesPack", &[card.clone()]).unwrap();
        assert_eq!(
            files["res://RulesPack/images/powers/spark.png"],
            b"icon-bytes"
        );
        let pck = std::path::Path::new(&root).join("rules.pck");
        crate::publish::write_pck(&pck, &files).unwrap();
        let mut result = crate::import::import_pck(pck.to_str().unwrap()).unwrap();
        assert!(result.errors.is_empty());
        let mut imported = result.imported.remove(0).card;
        crate::import::restore_effect_icons(&root, &mut imported, &result.images).unwrap();
        let restored_paths = asset_paths(&imported).unwrap();
        assert_eq!(restored_paths.len(), 1);
        assert_eq!(
            crate::project::read_portrait_bytes(&root, restored_paths.first().unwrap()).unwrap(),
            b"icon-bytes"
        );
        let repacked =
            crate::publish::build_pack_files(&root, "RulesPack", &[imported.clone()]).unwrap();
        assert!(repacked.values().any(|bytes| bytes == b"icon-bytes"));
        transform_icons(&mut imported, |_| Ok("same_icon".into())).unwrap();
        transform_icons(&mut card, |_| Ok("same_icon".into())).unwrap();
        assert_eq!(
            serde_json::to_value(imported).unwrap(),
            serde_json::to_value(card).unwrap()
        );
    }
}
