//! 从项目目录构建卡包（验证编辑器完整打包链路）。
//! 用法: cargo run --example build_pack -- <project_dir> <out_dir> <pack_id> <name> <author> <version>
//!
//! 项目目录布局（与编辑器 .sfp 项目一致）：
//!   project.json      {pack_id, name, author, description, cards: [id...]}
//!   cards/<id>.json   CardDef（与 schema 一致）
//!   assets/cards/*   立绘

use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 6 {
        eprintln!("用法: build_pack <project_dir> <out_dir> <pack_id> <name> <author> [version]");
        std::process::exit(2);
    }
    let project_dir = &args[1];
    let out_dir = &args[2];
    let pack_id = &args[3];
    let name = &args[4];
    let author = &args[5];
    let version = args.get(6).map(|s| s.as_str()).unwrap_or("0.1.0");

    // 读全部卡牌 JSON
    let cards_dir = PathBuf::from(project_dir).join("cards");
    let mut cards = Vec::new();
    for entry in fs::read_dir(&cards_dir).expect("cards 目录") {
        let p = entry.expect("dir entry").path();
        if p.extension().map(|e| e == "json").unwrap_or(false) {
            let raw = fs::read_to_string(&p).expect("read card json");
            let card: publish_test::model::CardDef = serde_json::from_str(&raw)
                .unwrap_or_else(|e| panic!("解析 {} 失败: {e}", p.display()));
            cards.push(card);
        }
    }
    println!("载入 {} 张卡", cards.len());

    let description = format!("{name} — 由 SpireForge 尖塔锻炉制作");
    let dir = publish_test::publish::build_pack(
        project_dir, out_dir, pack_id, name, author, &description, version, &cards,
    )
    .expect("build_pack");
    println!("已构建: {}", dir.display());
    for f in fs::read_dir(&dir).expect("out dir") {
        let f = f.expect("entry");
        println!("  {} ({} bytes)", f.file_name().to_string_lossy(), f.metadata().map(|m| m.len()).unwrap_or(0));
    }
}
