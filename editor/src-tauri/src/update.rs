// 自动更新：更新清单 = 仓库内 update/latest.json（随发版提交），下载载荷 = 发布页的裸 exe。
// 清单源顺序：GitHub raw → ghfast.top 镜像 → gh-proxy.com 镜像（国内直连实测可用，逐个回落）；
// exe 下载源写在清单里（GitHub 直链 + 同款镜像前缀），逐源尝试，SHA256 校验通过才算数。
// 安装 = 原地换文件：运行中的 exe 在 Windows 上允许改名，旧文件落 editor.exe.old，
// duct 拉起新进程后旧进程退出（Windows 上 duct 句柄 drop 不会杀子进程）；启动时清残留 .old。

use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const MANIFEST_URLS: [&str; 3] = [
    "https://raw.githubusercontent.com/FanerJian/SpireForge/main/update/latest.json",
    "https://ghfast.top/https://raw.githubusercontent.com/FanerJian/SpireForge/main/update/latest.json",
    "https://gh-proxy.com/https://raw.githubusercontent.com/FanerJian/SpireForge/main/update/latest.json",
];

const RELEASE_PAGE: &str = "https://github.com/FanerJian/SpireForge/releases/latest";

#[derive(Deserialize)]
struct UpdateNotes {
    zhs: String,
    eng: String,
}

#[derive(Deserialize)]
struct UpdateAsset {
    sha256: String,
    #[serde(default)]
    size: u64,
    urls: Vec<String>,
}

#[derive(Deserialize)]
struct UpdateManifest {
    version: String,
    #[serde(default)]
    notes: Option<UpdateNotes>,
    #[serde(default)]
    pub_date: String,
    exe: UpdateAsset,
}

/// 有新版本时的检查结果（前端展示 + 驱动下载）
#[derive(serde::Serialize, Clone)]
pub struct UpdateCheck {
    pub current: String,
    pub latest: String,
    pub pub_date: String,
    pub notes_zhs: String,
    pub notes_eng: String,
    pub sha256: String,
    pub size: u64,
    pub urls: Vec<String>,
}

#[derive(serde::Serialize, Clone)]
struct DlProgress {
    received: u64,
    total: u64,
}

/// "v0.2.0" / "0.2" / "0.2.0" → [0,2,0]，逐段比较；缺段按 0
fn version_tuple(v: &str) -> Vec<u64> {
    v.trim()
        .trim_start_matches('v')
        .split('.')
        .map(|p| p.trim().parse::<u64>().unwrap_or(0))
        .collect()
}

fn is_newer(latest: &str, current: &str) -> bool {
    let a = version_tuple(latest);
    let b = version_tuple(current);
    for i in 0..a.len().max(b.len()) {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        // 校园网/公司网慢速源不至于卡死整个检查
        .read_timeout(Duration::from_secs(60))
        .user_agent(concat!("SpireForge/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

async fn fetch_manifest(client: &reqwest::Client) -> Result<UpdateManifest, String> {
    let mut last = String::from("no attempt");
    for url in MANIFEST_URLS {
        let outcome = (|| async {
            let resp = client
                .get(url)
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !resp.status().is_success() {
                return Err(format!("HTTP {}", resp.status()));
            }
            let text = resp.text().await.map_err(|e| e.to_string())?;
            // 容忍镜像加的 BOM / 前导空白
            serde_json::from_str::<UpdateManifest>(text.trim_start_matches('\u{feff}').trim())
                .map_err(|e| format!("parse: {e}"))
        })()
        .await;
        match outcome {
            Ok(m) => return Ok(m),
            Err(e) => last = format!("{url} -> {e}"),
        }
    }
    Err(last)
}

/// 检查更新：清单任一源可达即可。无新版本返回 None（前端静默）。
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateCheck>, String> {
    let client = http_client()?;
    let m = fetch_manifest(&client).await?;
    let current = app.package_info().version.to_string();
    if !is_newer(&m.version, &current) {
        return Ok(None);
    }
    let (notes_zhs, notes_eng) = match m.notes {
        Some(n) => (n.zhs, n.eng),
        None => (String::new(), String::new()),
    };
    Ok(Some(UpdateCheck {
        current,
        latest: m.version,
        pub_date: m.pub_date,
        notes_zhs,
        notes_eng,
        sha256: m.exe.sha256,
        size: m.exe.size,
        urls: m.exe.urls,
    }))
}

fn sha256_of(path: &std::path::Path) -> Result<String, String> {
    let mut f = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 256 * 1024];
    loop {
        let n = std::io::Read::read(&mut f, &mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// 下载落点：exe 同目录（便携版必然可写）；不可写回落系统临时目录
fn download_target() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join(".update-new.exe.tmp");
            if std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&p)
                .is_ok()
            {
                let _ = std::fs::remove_file(&p);
                return p;
            }
        }
    }
    std::env::temp_dir().join(".update-new.exe.tmp")
}

async fn download_to(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    target: &std::path::Path,
    size_hint: u64,
) -> Result<(), String> {
    let resp = client
        .get(url)
        .timeout(Duration::from_secs(30 * 60))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(size_hint);
    let mut file = std::fs::File::create(target).map_err(|e| e.to_string())?;
    let mut received: u64 = 0;
    let mut next_report = 0u64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if received >= next_report {
            next_report = received + 256 * 1024;
            let _ = app.emit("update-progress", DlProgress { received, total });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    if total > 0 && received != total {
        return Err(format!("incomplete download: {received}/{total}"));
    }
    Ok(())
}

/// 下载新版本 exe 到临时文件：逐源尝试 + SHA256 校验，成功返回临时文件路径。
pub async fn download_update(
    app: AppHandle,
    urls: Vec<String>,
    sha256: String,
    size: u64,
) -> Result<String, String> {
    let client = http_client()?;
    let target = download_target();
    let mut last = String::from("no urls");
    for url in &urls {
        // 中途断流也换下一源重来（临时文件每次重建）
        match download_to(&app, &client, url, &target, size).await {
            Ok(()) => {
                let got = sha256_of(&target).map_err(|e| {
                    let _ = std::fs::remove_file(&target);
                    e
                })?;
                if got.eq_ignore_ascii_case(&sha256) {
                    return Ok(target.to_string_lossy().into_owned());
                }
                last = format!("sha256 mismatch from {url}: got {got}");
            }
            Err(e) => last = format!("{url} -> {e}"),
        }
    }
    let _ = std::fs::remove_file(&target);
    Err(last)
}

/// 应用更新：旧 exe 改名 .old → 新 exe 换入 → 拉起新进程 → 旧进程退出。
/// 返回是否成功拉起新进程（false 时前端提示用户手动重新打开）。
pub fn apply_update(app: AppHandle, path: String) -> Result<bool, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let old = exe.with_extension("exe.old");
    if old.exists() {
        let _ = std::fs::remove_file(&old);
    }
    std::fs::rename(&exe, &old).map_err(|e| format!("backup current exe failed: {e}"))?;
    if let Err(e) = std::fs::rename(&path, &exe) {
        // 换入失败（跨盘 rename 等）：还原旧文件，回落复制
        let _ = std::fs::rename(&old, &exe);
        if std::fs::copy(&path, &exe).is_err() {
            return Err(format!("install new exe failed: {e}"));
        }
        let _ = std::fs::remove_file(&path);
    }
    let new_exe = exe.to_string_lossy().into_owned();
    // duct：无 shell 的直接子进程；Windows 上句柄丢弃不影响子进程存活
    let started = duct::cmd(&new_exe, Vec::<String>::new())
        .stdout_null()
        .stderr_null()
        .start()
        .is_ok();
    app.exit(0);
    Ok(started)
}

/// 打开发布页（检查失败/想手动下载时的兜底入口）
pub fn open_release_page(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(RELEASE_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

/// 启动期清理上一轮更新残留的 editor.exe.old（新进程刚拉起时旧进程可能还没退完，
/// 删不掉就留给下一次启动，尽力而为）。
pub fn cleanup_old_update() {
    if let Ok(exe) = std::env::current_exe() {
        let old = exe.with_extension("exe.old");
        if old.exists() {
            let _ = std::fs::remove_file(&old);
        }
    }
}
