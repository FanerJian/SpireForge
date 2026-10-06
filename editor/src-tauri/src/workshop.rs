//! Steam 创意工坊发布：生成 ModUploader 工作区并调用官方上传器。
//!
//! 官方工具：MegaCrit/sts2-mod-uploader（ModUploader.exe）
//! 流程：workspace 文件夹 = content/（= mods 目录里的卡包文件）+ workshop.json + image.png(<1MB)
//! 更新已发布条目：替换 content/ 后重跑（mod_id.txt 记录的工坊 id 会被复用）。
//!
//! 工坊 id 持久化：首次上传成功后 mod_id.txt 回写到 ProjectMeta.workshop_id；
//! 重新生成工作区时若 mod_id.txt 不存在会从 meta 恢复——换导出目录也不会误发新条目。
//!
//! 注意（官方文档）：工坊 tags 在上传后无法修改；建议首次就填好或留空。
//!
//! 子进程说明：上传器经 duct（参数列表、不经 shell）启动，stdout/stderr
//! 由 duct 在后台线程收集；run_uploader 带 15 分钟超时，超时 kill 子进程。

use crate::model::{CardDef, ProjectMeta};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub fn dependencies_for_cards(meta: &ProjectMeta, cards: &[CardDef]) -> Vec<String> {
    let mut used = BTreeSet::new();
    for card in cards {
        used.extend(crate::custom_pools::active_pool_keys(card));
    }
    let mut ids = BTreeSet::new();
    if let Some(id) = meta.runtime_workshop_id {
        ids.insert(id.to_string());
    }
    for pool in &meta.custom_pools {
        if used.contains(pool.key.as_str()) {
            if let Some(id) = &pool.workshop_id {
                ids.insert(id.clone());
            }
        }
    }
    ids.into_iter().collect()
}

#[cfg(test)]
mod custom_pool_tests {
    use super::*;
    #[test]
    fn workshop_dependencies_include_only_used_pools_and_deduplicate_ids() {
        let mut meta = ProjectMeta::default();
        meta.runtime_workshop_id = Some(123);
        meta.custom_pools = vec![
            crate::custom_pools::CustomPoolDef {
                key: "mod:A:A.Pool".into(),
                label: "A".into(),
                mod_id: "A".into(),
                type_name: "A.Pool".into(),
                workshop_id: Some("456".into()),
            },
            crate::custom_pools::CustomPoolDef {
                key: "mod:B:B.Pool".into(),
                label: "B".into(),
                mod_id: "B".into(),
                type_name: "B.Pool".into(),
                workshop_id: Some("789".into()),
            },
        ];
        let mut card = CardDef::default();
        card.pool = "mod:Stale:Stale.Pool".into();
        card.pools = vec!["mod:A:A.Pool".into()];
        let mut override_card = CardDef::default();
        override_card.pool = "mod:B:B.Pool".into();
        override_card.vanilla_id = Some("Vanilla.Entry".into());
        assert_eq!(dependencies_for_cards(&meta, &[card, override_card]), vec!["123", "456"]);
    }
}
use crate::project::atomic_write;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

// ---- 内置 ModUploader（MegaCrit/sts2-mod-uploader v0.2.0；许可与分发授权待核实）----
// 以字节内嵌进编辑器，首次使用时释放到应用数据目录，用户无需单独下载。
const UPLOADER_EXE: &[u8] = include_bytes!("../../../tools/uploader/ModUploader.exe");
const STEAM_API_DLL: &[u8] = include_bytes!("../../../tools/uploader/steam_api64.dll");
const STEAM_APPID: &[u8] = include_bytes!("../../../tools/uploader/steam_appid.txt");

const UPLOADER_NOTICE: &[u8] = b"\
ModUploader v0.2.0 - bundled with SpireForge editor
Source: https://github.com/MegaCrit/sts2-mod-uploader
SHA-256 ModUploader.exe: 7d5283dbaff01ec5182bc08a09f4aac864cff870d7d692af08daf3830b4efa19
SHA-256 steam_api64.dll: eb17909a76668cf9ae0b92a618a34a50f6c73d3a6787cb4dd8ce36a8b10bfb75
SHA-256 steam_appid.txt: bc80578ba89b7f67e609974743e33203e7da3d1eaae0b1c0bb1ddbb9b4f104f5
The upstream v0.2.0 release package and source do not include verifiable license text.
The previous MIT label was unverified; distribution authorization remains unverified.
The hashes identify these bundled copies only and do not establish license or permission.
";

/// 上传超时：Steam 卡住时不能让发布面板永久 busy
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// 确保内置上传器已释放到应用数据目录，返回 ModUploader.exe 路径。
/// 用版本戳判断是否需要重释放（升级编辑器内置版本后自动刷新，老用户不会一直用旧版）。
pub fn ensure_bundled_uploader(base_dir: &str) -> Result<String, String> {
    let dir = PathBuf::from(base_dir).join("uploader");
    let exe = dir.join("ModUploader.exe");
    let stamp = dir.join(".bundled_version");
    // 内置内容变化（换版本）时重写；stamp 内容 = 版本 + 内嵌文件字节数指纹
    let fingerprint = format!(
        "v0.2.0 exe={} dll={}\n",
        UPLOADER_EXE.len(),
        STEAM_API_DLL.len()
    );
    let needs_extract = match fs::read_to_string(&stamp) {
        Ok(s) => s != fingerprint,
        Err(_) => !exe.exists(), // 无 stamp 但 exe 在：视为用户手工放置，不覆盖
    };
    if needs_extract {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(&exe, UPLOADER_EXE).map_err(|e| e.to_string())?;
        fs::write(dir.join("steam_api64.dll"), STEAM_API_DLL).map_err(|e| e.to_string())?;
        fs::write(dir.join("steam_appid.txt"), STEAM_APPID).map_err(|e| e.to_string())?;
        fs::write(dir.join("NOTICE.txt"), UPLOADER_NOTICE).map_err(|e| e.to_string())?;
        fs::write(&stamp, fingerprint).map_err(|e| e.to_string())?;
    }
    Ok(exe.to_string_lossy().into_owned())
}

/// 生成上传工作区，返回 workspace 路径。
/// image.png：优先取第一张有立绘的卡；否则生成 1×1 透明 PNG 占位（提示用户替换）。
#[allow(clippy::too_many_arguments)]
pub fn prepare_workspace(
    out_root: &str,
    root: &str,
    meta: &ProjectMeta,
    version: &str,
    visibility: &str,
    change_note: &str,
    cards: &[CardDef],
) -> Result<String, String> {
    let pack_id = meta.pack_id.as_str();
    let ws = PathBuf::from(out_root).join(format!("{pack_id}_workshop"));
    let content = ws.join("content");
    fs::create_dir_all(&content).map_err(|e| e.to_string())?;

    // content/ = 卡包产物（json + pck），不带外层目录
    let pack_dir = crate::publish::build_pack(
        root,
        out_root,
        pack_id,
        &meta.name,
        &meta.author,
        &meta.description,
        version,
        cards,
    )?;
    for name in [format!("{pack_id}.json"), format!("{pack_id}.pck")] {
        fs::copy(pack_dir.join(&name), content.join(&name)).map_err(|er| er.to_string())?;
    }

    // workshop.json（字段名对齐官方 template）
    // dependencies：SpireForge Runtime 的工坊 id（项目设置里配置），
    // 玩家订阅卡包时 Steam 自动安装 Runtime——不写的话卡包加载会失败。
    let dependencies = dependencies_for_cards(meta, cards);
    let visibility_norm = match visibility {
        "public" | "private" | "unlisted" | "friends_only" => visibility,
        _ => "private",
    };
    let ws_json = json!({
        "title": meta.name,
        "description": meta.description,
        "visibility": visibility_norm,
        "changeNote": if change_note.is_empty() { "None" } else { change_note },
        "tags": [],           // 上传后不可改，默认留空最稳
        "dependencies": dependencies,
        "contentDescriptors": []
    });
    atomic_write(
        &ws.join("workshop.json"),
        serde_json::to_string_pretty(&ws_json)
            .unwrap_or_default()
            .as_bytes(),
    )?;

    // 工坊 id 持久化：已发布过（meta.workshop_id）而工作区是新目录时恢复 mod_id.txt，
    // 避免换导出目录后误发布成新条目
    if let Some(id) = meta.workshop_id {
        let mod_id_path = ws.join("mod_id.txt");
        if !mod_id_path.exists() {
            fs::write(&mod_id_path, id.to_string()).map_err(|e| e.to_string())?;
        }
    }

    // image.png：取第一张卡的立绘；无则写 1×1 透明 PNG 占位
    let mut wrote_preview = false;
    for card in cards {
        if !card.portrait.is_empty() {
            let src = PathBuf::from(root).join(&card.portrait);
            if src.exists() {
                fs::copy(&src, ws.join("image.png")).map_err(|e| e.to_string())?;
                wrote_preview = true;
                break;
            }
        }
    }
    if !wrote_preview {
        fs::write(ws.join("image.png"), TINY_PNG).map_err(|e| e.to_string())?;
    }
    // 工坊限制：预览图 < 1MB
    if let Ok(meta) = fs::metadata(ws.join("image.png")) {
        if meta.len() > 1_000_000 {
            return Err(format!(
                "预览图 image.png 超过 1MB（{} 字节），Steam 后端会拒绝；请换更小的立绘",
                meta.len()
            ));
        }
    }

    Ok(ws.to_string_lossy().into_owned())
}

#[derive(Clone)]
pub struct PreparedWorkspace {
    pub root: String,
    pub workspace: String,
    pub version: String,
    pub visibility: String,
    pub change_note: String,
    pub runtime_dependency: Option<u64>,
    pub source_signature: String,
    pub content_signature: String,
}

pub fn source_signature(root: &str, meta: &ProjectMeta, cards: &[CardDef]) -> Result<String, String> {
    let mut meta = meta.clone();
    // 构建只回写默认版本，不应把刚生成的工作区判成过期。
    meta.last_version = None;
    let mut hash = Sha256::new();
    hash.update(serde_json::to_vec(&(&meta, cards)).map_err(|e| e.to_string())?);
    let paths: std::collections::BTreeSet<&str> = cards.iter().map(|c| c.portrait.as_str())
        .filter(|p| !p.is_empty()).collect();
    for rel in paths {
        crate::project::validate_rel_path(rel)?;
        hash.update(rel.as_bytes());
        hash.update(fs::read(Path::new(root).join(rel)).map_err(|e| format!("读取立绘 {rel} 失败: {e}"))?);
    }
    Ok(format!("{:x}", hash.finalize()))
}

// 预览图允许用户自行替换；上传配置和实际卡包必须与生成时一致。
pub fn content_signature(workspace: &str) -> Result<String, String> {
    let ws = Path::new(workspace);
    let mut hash = Sha256::new();
    hash.update(fs::read(ws.join("workshop.json")).map_err(|e| e.to_string())?);
    let mut files = fs::read_dir(ws.join("content")).map_err(|e| e.to_string())?
        .map(|entry| entry.map(|e| e.path()).map_err(|e| e.to_string())).collect::<Result<Vec<_>, _>>()?;
    files.sort();
    for file in files {
        if !file.is_file() { return Err("上传内容目录包含非预期子目录，请重新生成工作区".into()); }
        hash.update(file.file_name().unwrap().to_string_lossy().as_bytes());
        hash.update(fs::read(file).map_err(|e| e.to_string())?);
    }
    Ok(format!("{:x}", hash.finalize()))
}

impl PreparedWorkspace {
    #[allow(clippy::too_many_arguments)]
    pub fn verify(&self, root: &str, workspace: &str, version: &str, visibility: &str,
        change_note: &str, runtime_dependency: Option<u64>, meta: &ProjectMeta, cards: &[CardDef]) -> Result<(), String> {
        if self.root != root || self.workspace != workspace || self.version != version || self.visibility != visibility
            || self.change_note != change_note || self.runtime_dependency != runtime_dependency
            || self.source_signature != source_signature(root, meta, cards)?
            || self.content_signature != content_signature(workspace)? {
            return Err("项目内容或发布配置已变化，请重新生成工坊工作区后上传".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod consistency_tests {
    use super::*;
    #[test]
    fn upload_guard_rejects_changed_settings_sources_images_and_generated_content() {
        let base = std::env::temp_dir().join("sf_workshop_consistency");
        let _ = fs::remove_dir_all(&base);
        let root = base.join("project").to_string_lossy().into_owned();
        let out = base.join("output").to_string_lossy().into_owned();
        crate::project::create_project(&root, "TestPack", "Test", "").unwrap();
        let card = CardDef { id: "a".into(), portrait: "assets/cards/a.png".into(), ..Default::default() };
        crate::project::save_portrait(&root, "a", "png", TINY_PNG).unwrap();
        crate::project::add_card(&root, &card).unwrap();
        let (meta, cards) = crate::project::load_project(&root).unwrap();
        let ws = prepare_workspace(&out, &root, &meta, "1", "private", "first", &cards).unwrap();
        let prepared = PreparedWorkspace { root: root.clone(), workspace: ws.clone(), version: "1".into(), visibility: "private".into(), change_note: "first".into(),
            runtime_dependency: meta.runtime_workshop_id, source_signature: source_signature(&root, &meta, &cards).unwrap(), content_signature: content_signature(&ws).unwrap() };
        let verify = |m: &ProjectMeta, c: &[CardDef], v: &str, visibility: &str, note: &str, dep| prepared.verify(&root, &ws, v, visibility, note, dep, m, c);
        assert!(verify(&meta, &cards, "1", "private", "first", meta.runtime_workshop_id).is_ok());
        assert!(verify(&meta, &cards, "2", "private", "first", meta.runtime_workshop_id).is_err());
        assert!(verify(&meta, &cards, "1", "public", "first", meta.runtime_workshop_id).is_err());
        assert!(verify(&meta, &cards, "1", "private", "second", meta.runtime_workshop_id).is_err());
        assert!(verify(&meta, &cards, "1", "private", "first", Some(42)).is_err());
        let mut changed_meta = meta.clone(); changed_meta.last_version = Some("1".into());
        assert!(verify(&changed_meta, &cards, "1", "private", "first", meta.runtime_workshop_id).is_ok());
        changed_meta.name = "changed".into();
        assert!(verify(&changed_meta, &cards, "1", "private", "first", meta.runtime_workshop_id).is_err());
        let mut changed_cards = cards.clone(); changed_cards[0].cost = 8;
        assert!(verify(&meta, &changed_cards, "1", "private", "first", meta.runtime_workshop_id).is_err());
        crate::project::save_portrait(&root, "a", "png", b"changed image").unwrap();
        assert!(verify(&meta, &cards, "1", "private", "first", meta.runtime_workshop_id).is_err());
        crate::project::save_portrait(&root, "a", "png", TINY_PNG).unwrap();
        fs::write(Path::new(&ws).join("content/TestPack.pck"), b"changed pack").unwrap();
        assert!(verify(&meta, &cards, "1", "private", "first", meta.runtime_workshop_id).is_err());
        // 重新生成得到当前版本与配置，正常通过；不复制构建目录中的 .bak。
        let ws = prepare_workspace(&out, &root, &meta, "2", "public", "second", &cards).unwrap();
        assert!(!Path::new(&ws).join("content/TestPack.pck.bak").exists());
        let config: serde_json::Value = serde_json::from_slice(&fs::read(Path::new(&ws).join("workshop.json")).unwrap()).unwrap();
        assert_eq!(config["visibility"], "public"); assert_eq!(config["changeNote"], "second");
    }
}

/// 调用官方 ModUploader 上传工作区。返回上传器输出。
/// duct 负责管道收集；这里做 15 分钟超时守护，超时 kill 子进程。
pub fn run_uploader(uploader: &str, workspace: &str) -> Result<String, String> {
    let exe = PathBuf::from(uploader);
    if !exe.exists() {
        return Err(format!("未找到 ModUploader.exe：{uploader}\n请从 github.com/MegaCrit/sts2-mod-uploader 下载并设置路径"));
    }
    let workdir = exe.parent().unwrap_or(Path::new(".")).to_path_buf();
    let handle = duct::cmd(exe, ["upload", "-w", workspace])
        .dir(workdir)
        .start()
        .map_err(|e| format!("启动上传器失败: {e}"))?;

    let deadline = Instant::now() + UPLOAD_TIMEOUT;
    let output = loop {
        match handle.try_wait() {
            Ok(Some(out)) => break out,
            Ok(None) if Instant::now() >= deadline => {
                let _ = handle.kill();
                let _ = handle.wait();
                return Err("上传超时（15 分钟）：请确认 Steam 客户端在线后重试".to_string());
            }
            Ok(None) => thread::sleep(Duration::from_millis(500)),
            Err(e) => return Err(format!("等待上传器失败: {e}")),
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let log = if stderr.trim().is_empty() {
        stdout
    } else {
        format!("{stdout}\n{stderr}")
    };
    if !output.status.success() {
        return Err(format!(
            "上传失败（退出码 {:?}）:\n{log}",
            output.status.code()
        ));
    }
    Ok(log)
}

/// 从工作区读取 mod_id.txt（首次上传后由 ModUploader 生成）
pub fn read_workshop_id(workspace: &str) -> Option<u64> {
    let raw = fs::read_to_string(PathBuf::from(workspace).join("mod_id.txt")).ok()?;
    raw.trim().parse::<u64>().ok()
}

/// 1×1 透明 PNG（占位预览图）
pub const TINY_PNG: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];
