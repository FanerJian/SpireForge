//! 卡包目录发现与最近打开记录。记录跟随 projects 目录，不写入卡包本身。
use crate::project;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const HISTORY_FILE: &str = ".recent-projects.json";
const HISTORY_LIMIT: usize = 100;

#[derive(Clone, Debug, Deserialize, Serialize)]
struct RecentProject {
    path: String,
    last_opened_at: u64,
}

#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub path: String,
    pub name: String,
    pub pack_id: String,
    pub author: String,
    pub card_count: usize,
    pub modified_at: Option<u64>,
    pub last_opened_at: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectLibrary {
    pub root: String,
    pub projects: Vec<ProjectSummary>,
    pub warnings: Vec<String>,
}

fn display_path(path: &Path) -> String {
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let raw = resolved.to_string_lossy();
    // Windows canonicalize 的扩展路径前缀不适合展示。
    if let Some(unc) = raw.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
    }
}

fn path_key(path: &str) -> String {
    let key = display_path(Path::new(path)).replace('\\', "/");
    if cfg!(windows) { key.to_lowercase() } else { key }
}

fn read_history(root: &Path) -> Result<Vec<RecentProject>, String> {
    let path = root.join(HISTORY_FILE);
    if !path.exists() { return Ok(vec![]); }
    let raw = fs::read_to_string(&path).map_err(|e| format!("无法读取最近卡包记录：{e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("最近卡包记录损坏，默认目录中的卡包仍可使用：{e}"))
}

/// 调用方持有 library_lock，避免多次打开同时改写同一个历史文件。
pub fn remember(root: &Path, path: &str) -> Result<(), String> {
    let mut history = read_history(root)?;
    let key = path_key(path);
    history.retain(|r| path_key(&r.path) != key);
    history.insert(0, RecentProject {
        path: display_path(Path::new(path)),
        last_opened_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(),
    });
    history.truncate(HISTORY_LIMIT);
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let raw = serde_json::to_vec_pretty(&history).map_err(|e| e.to_string())?;
    project::atomic_write(&root.join(HISTORY_FILE), &raw)
}

/// 只扫描已知根目录的直接子目录；不递归扫描磁盘，也不修改项目。
pub fn list(root: &Path, scan_roots: &[PathBuf], legacy_path: Option<&str>) -> ProjectLibrary {
    let mut warnings = Vec::new();
    let history = read_history(root).unwrap_or_else(|e| { warnings.push(e); vec![] });
    let mut paths: HashMap<String, (String, Option<u64>)> = HashMap::new();
    for recent in history {
        let key = path_key(&recent.path);
        let value = paths.entry(key).or_insert((recent.path, None));
        value.1 = Some(value.1.unwrap_or(0).max(recent.last_opened_at));
    }
    if let Some(path) = legacy_path.filter(|p| !p.trim().is_empty()) {
        paths.entry(path_key(path)).or_insert((display_path(Path::new(path)), None));
    }
    for scan_root in scan_roots {
        if !scan_root.exists() { continue; }
        match fs::read_dir(scan_root) {
            Ok(entries) => {
                for entry in entries {
                    match entry {
                        Ok(entry) if entry.path().join("project.json").is_file() => {
                            let path = display_path(&entry.path());
                            paths.entry(path_key(&path)).or_insert((path, None));
                        }
                        Err(e) => warnings.push(format!("部分目录无法读取：{e}")),
                        _ => {}
                    }
                }
            }
            Err(e) => warnings.push(format!("无法扫描 {}：{e}", scan_root.display())),
        }
    }
    let mut projects: Vec<ProjectSummary> = paths.into_values().map(|(path, last_opened_at)| {
        let modified_at = fs::metadata(project::meta_path(&path)).ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs());
        let mut summary = ProjectSummary {
            name: Path::new(&path).file_name().unwrap_or_default().to_string_lossy().into_owned(),
            path, pack_id: String::new(), author: String::new(), card_count: 0,
            modified_at, last_opened_at, error: None,
        };
        match project::read_meta(&summary.path) {
            Ok(meta) => {
                if !meta.name.trim().is_empty() { summary.name = meta.name; }
                summary.pack_id = meta.pack_id;
                summary.author = meta.author;
                summary.card_count = meta.cards.len();
            }
            Err(e) => summary.error = Some(if !Path::new(&summary.path).is_dir() {
                "卡包目录不存在，可能已移动或删除。请从新位置打开。".into()
            } else { format!("无法读取卡包信息：{e}") }),
        }
        summary
    }).collect();
    projects.sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at)
        .then_with(|| b.modified_at.cmp(&a.modified_at))
        .then_with(|| a.path.cmp(&b.path)));
    ProjectLibrary { root: display_path(root), projects, warnings }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("sf_library_{}_{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn pack(&self, dir: &str, name: &str) -> PathBuf {
            let path = self.0.join(dir);
            project::create_project(path.to_str().unwrap(), "TestPack", name, "作者").unwrap();
            path
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

    #[test]
    fn discovers_existing_packs_without_touching_them() {
        let f = Fixture::new();
        let pack = f.pack("old", "以前的卡包");
        let before = fs::read(pack.join("project.json")).unwrap();
        fs::create_dir_all(f.0.join("unrelated")).unwrap();
        let library = list(&f.0, &[f.0.clone()], None);
        assert_eq!(library.projects.len(), 1);
        assert_eq!(library.projects[0].name, "以前的卡包");
        assert_eq!(fs::read(pack.join("project.json")).unwrap(), before);
        assert!(!f.0.join(HISTORY_FILE).exists());
    }

    #[test]
    fn remembers_external_packs_and_deduplicates_on_reload() {
        let f = Fixture::new();
        let other = Fixture::new();
        let pack = other.pack("outside", "外部卡包");
        remember(&f.0, pack.to_str().unwrap()).unwrap();
        remember(&f.0, pack.to_str().unwrap()).unwrap();
        let library = list(&f.0, &[other.0.clone()], Some(pack.to_str().unwrap()));
        assert_eq!(library.projects.len(), 1);
        assert!(library.projects[0].last_opened_at.is_some());
        assert_eq!(library.projects[0].name, "外部卡包");
    }

    #[test]
    fn broken_neighbor_does_not_hide_valid_packs() {
        let f = Fixture::new();
        f.pack("good", "可用卡包");
        let bad = f.pack("bad", "损坏卡包");
        fs::write(bad.join("project.json"), b"broken json").unwrap();
        let library = list(&f.0, &[f.0.clone()], None);
        assert_eq!(library.projects.len(), 2);
        assert_eq!(library.projects.iter().filter(|p| p.error.is_some()).count(), 1);
        assert!(library.projects.iter().any(|p| p.name == "可用卡包" && p.error.is_none()));
    }

    #[test]
    fn missing_history_entry_is_visible_and_future_format_is_blocked() {
        let f = Fixture::new();
        let pack = f.pack("future", "新版卡包");
        let mut meta = project::read_meta(pack.to_str().unwrap()).unwrap();
        meta.format_version = crate::model::FORMAT_VERSION + 1;
        project::write_meta(pack.to_str().unwrap(), &meta).unwrap();
        remember(&f.0, f.0.join("missing").to_str().unwrap()).unwrap();
        let library = list(&f.0, &[f.0.clone()], None);
        assert_eq!(library.projects.len(), 2);
        assert!(library.projects.iter().all(|p| p.error.is_some()));
    }

    #[test]
    fn corrupt_history_is_reported_without_overwriting_it() {
        let f = Fixture::new();
        let pack = f.pack("good", "卡包");
        fs::write(f.0.join(HISTORY_FILE), b"damaged").unwrap();
        let library = list(&f.0, &[f.0.clone()], None);
        assert_eq!(library.projects.len(), 1);
        assert_eq!(library.warnings.len(), 1);
        assert!(remember(&f.0, pack.to_str().unwrap()).is_err());
        assert_eq!(fs::read(f.0.join(HISTORY_FILE)).unwrap(), b"damaged");
    }

    #[test]
    fn previous_browser_path_is_discovered_before_history_exists() {
        let f = Fixture::new();
        let other = Fixture::new();
        let pack = other.pack("legacy", "旧版上次打开");
        let library = list(&f.0, &[f.0.clone()], Some(pack.to_str().unwrap()));
        assert_eq!(library.projects.len(), 1);
        assert_eq!(library.projects[0].name, "旧版上次打开");
    }
}
