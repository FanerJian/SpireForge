// 更新清单只从官方仓库读取。IPC 参数用于匹配清单，下载和安装授权保存在后端。
// 下载文件与程序位于同一目录，采用独占创建、限量读取、双次校验和失败回滚。

use futures_util::StreamExt;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs::{File, Metadata, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/FanerJian/SpireForge/main/update/latest.json";
const RELEASE_PAGE: &str = "https://github.com/FanerJian/SpireForge/releases/latest";
const RELEASE_PATH: &str = "/FanerJian/SpireForge/releases/download/";
const MAX_MANIFEST_BYTES: usize = 64 * 1024;
const MAX_ASSET_BYTES: u64 = 256 * 1024 * 1024;
const MAX_REDIRECTS: usize = 5;

static UPDATE_BUSY: AtomicBool = AtomicBool::new(false);
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static VERIFIED_DOWNLOAD: Mutex<Option<VerifiedDownload>> = Mutex::new(None);

#[derive(Deserialize)]
struct UpdateNotes {
    zhs: String,
    eng: String,
}

#[derive(Deserialize)]
struct UpdateAsset {
    sha256: String,
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

/// 有新版本时的检查结果，保留前端命令契约。
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

struct UpdateOperation<'a>(&'a AtomicBool);

impl<'a> UpdateOperation<'a> {
    fn acquire(busy: &'a AtomicBool) -> Result<Self, String> {
        busy.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "更新操作正在进行，请稍后重试".to_string())?;
        Ok(Self(busy))
    }
}

impl Drop for UpdateOperation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

/// 文件句柄持续存活到安装前复验结束。Windows 独占共享模式阻止中途替换和写入。
struct PendingFile {
    path: PathBuf,
    file: Option<File>,
}

impl Drop for PendingFile {
    fn drop(&mut self) {
        self.file.take();
        let _ = std::fs::remove_file(&self.path);
    }
}

struct VerifiedDownload {
    pending: PendingFile,
    sha256: String,
    size: u64,
}

/// 当前发布使用三段数字版本，可带 v 前缀。
fn version_tuple(version: &str) -> Option<[u64; 3]> {
    if version.len() > 64 {
        return None;
    }
    let version = version.strip_prefix('v').unwrap_or(version);
    let mut parts = version.split('.');
    let mut result = [0; 3];
    for part in &mut result {
        let text = parts.next()?;
        if text.is_empty()
            || !text.bytes().all(|b| b.is_ascii_digit())
            || (text.len() > 1 && text.starts_with('0'))
        {
            return None;
        }
        *part = text.parse().ok()?;
    }
    parts.next().is_none().then_some(result)
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (version_tuple(latest), version_tuple(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

fn is_secure_https(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url.fragment().is_none()
}

fn valid_asset_url(text: &str, version: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(text) else {
        return false;
    };
    if !is_secure_https(&url) || url.host_str() != Some("github.com") || url.query().is_some() {
        return false;
    }
    let Some(path) = url.path().strip_prefix(RELEASE_PATH) else {
        return false;
    };
    let Some((tag, name)) = path.split_once('/') else {
        return false;
    };
    let version = version.strip_prefix('v').unwrap_or(version);
    tag == format!("v{version}")
        && !name.starts_with('.')
        && name.ends_with(".exe")
        && name.len() <= 200
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

fn allowed_asset_redirect(url: &reqwest::Url) -> bool {
    if !is_secure_https(url) {
        return false;
    }
    match url.host_str() {
        Some("github.com") => url.path().starts_with(RELEASE_PATH),
        Some("release-assets.githubusercontent.com")
        | Some("objects.githubusercontent.com")
        | Some("github-releases.githubusercontent.com") => true,
        _ => false,
    }
}

fn http_client(policy: reqwest::redirect::Policy) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .redirect(policy)
        .referer(false)
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(60))
        .user_agent(concat!("SpireForge/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("创建更新连接失败：{e}"))
}

fn download_client() -> Result<reqwest::Client, String> {
    http_client(reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS || !allowed_asset_redirect(attempt.url()) {
            attempt.error("更新下载重定向地址无效")
        } else {
            attempt.follow()
        }
    }))
}

fn validate_manifest(manifest: &UpdateManifest) -> Result<(), String> {
    if version_tuple(&manifest.version).is_none() {
        return Err("更新清单版本无效".into());
    }
    if manifest.exe.sha256.len() != 64
        || !manifest.exe.sha256.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("更新清单校验值无效".into());
    }
    if manifest.exe.size == 0 || manifest.exe.size > MAX_ASSET_BYTES {
        return Err("更新文件大小超出允许范围".into());
    }
    if manifest.exe.urls.is_empty()
        || manifest.exe.urls.len() > 4
        || manifest
            .exe
            .urls
            .iter()
            .any(|url| !valid_asset_url(url, &manifest.version))
    {
        return Err("更新清单下载地址无效".into());
    }
    Ok(())
}

fn parse_manifest(bytes: &[u8]) -> Result<UpdateManifest, String> {
    if bytes.len() > MAX_MANIFEST_BYTES {
        return Err("更新清单超出大小限制".into());
    }
    let bytes = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes);
    let manifest: UpdateManifest =
        serde_json::from_slice(bytes).map_err(|e| format!("读取更新清单失败：{e}"))?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

async fn fetch_manifest() -> Result<UpdateManifest, String> {
    // 官方 raw URL 使用固定路径，并拒绝所有重定向。
    let client = http_client(reqwest::redirect::Policy::none())?;
    let response = client
        .get(MANIFEST_URL)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("获取更新清单失败：{e}"))?;
    if response.status() != reqwest::StatusCode::OK {
        return Err(format!("获取更新清单失败，HTTP {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|n| n > MAX_MANIFEST_BYTES as u64)
    {
        return Err("更新清单超出大小限制".into());
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取更新清单失败：{e}"))?;
        if chunk.len() > MAX_MANIFEST_BYTES - bytes.len() {
            return Err("更新清单超出大小限制".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    parse_manifest(&bytes)
}

pub async fn check_update(app: AppHandle) -> Result<Option<UpdateCheck>, String> {
    let manifest = fetch_manifest().await?;
    let current = app.package_info().version.to_string();
    if !is_newer(&manifest.version, &current) {
        return Ok(None);
    }
    let (notes_zhs, notes_eng) = match manifest.notes {
        Some(notes) => (notes.zhs, notes.eng),
        None => (String::new(), String::new()),
    };
    Ok(Some(UpdateCheck {
        current,
        latest: manifest.version,
        pub_date: manifest.pub_date,
        notes_zhs,
        notes_eng,
        sha256: manifest.exe.sha256,
        size: manifest.exe.size,
        urls: manifest.exe.urls,
    }))
}

fn validate_download_request(
    manifest: &UpdateManifest,
    urls: &[String],
    sha256: &str,
    size: u64,
    current: &str,
) -> Result<(), String> {
    if manifest.exe.urls != urls || manifest.exe.sha256 != sha256 || manifest.exe.size != size {
        return Err("更新信息已变化，请重新检查更新".into());
    }
    if !is_newer(&manifest.version, current) {
        return Err("当前版本已是最新版本".into());
    }
    Ok(())
}

fn regular_file_metadata(path: &Path) -> Result<Metadata, String> {
    let metadata = std::fs::symlink_metadata(path).map_err(|e| format!("读取更新文件失败：{e}"))?;
    #[cfg(windows)]
    let is_link = {
        use std::os::windows::fs::MetadataExt;
        // 包括符号链接、连接点及其他重解析点。
        metadata.file_attributes() & 0x400 != 0
    };
    #[cfg(not(windows))]
    let is_link = metadata.file_type().is_symlink();
    if is_link || !metadata.is_file() {
        return Err("更新路径须为普通文件".into());
    }
    Ok(metadata)
}

fn create_download_file(directory: &Path) -> Result<PendingFile, String> {
    for _ in 0..32 {
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = directory.join(format!(
            ".spireforge-update-{}-{timestamp}-{sequence}.tmp",
            std::process::id()
        ));
        let mut options = OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0);
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(file) => {
                return Ok(PendingFile {
                    path,
                    file: Some(file),
                })
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("创建更新文件失败，请检查程序目录权限：{e}")),
        }
    }
    Err("创建更新临时文件失败，请重试".into())
}

fn checked_received(received: u64, chunk_size: usize, expected: u64) -> Result<u64, String> {
    received
        .checked_add(chunk_size as u64)
        .filter(|n| *n <= expected && *n <= MAX_ASSET_BYTES)
        .ok_or_else(|| "更新下载超出大小限制".to_string())
}

fn verify_download(
    pending: &mut PendingFile,
    expected_size: u64,
    sha256: &str,
) -> Result<(), String> {
    let path_metadata = regular_file_metadata(&pending.path)?;
    let file = pending.file.as_mut().ok_or("更新文件已关闭")?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("读取更新文件失败：{e}"))?;
    if expected_size == 0
        || expected_size > MAX_ASSET_BYTES
        || path_metadata.len() != expected_size
        || metadata.len() != expected_size
    {
        return Err("更新文件大小校验失败".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if path_metadata.dev() != metadata.dev() || path_metadata.ino() != metadata.ino() {
            return Err("更新文件路径已变化".into());
        }
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|e| format!("读取更新文件失败：{e}"))?;
    let mut hasher = Sha256::new();
    let mut received = 0;
    let mut buffer = [0u8; 256 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|e| format!("读取更新文件失败：{e}"))?;
        if count == 0 {
            break;
        }
        received = checked_received(received, count, expected_size)?;
        hasher.update(&buffer[..count]);
    }
    if received != expected_size || !format!("{:x}", hasher.finalize()).eq_ignore_ascii_case(sha256)
    {
        return Err("更新文件校验失败，请重新下载".into());
    }
    Ok(())
}

async fn download_to(
    app: &AppHandle,
    client: &reqwest::Client,
    url: &str,
    pending: &mut PendingFile,
    expected_size: u64,
) -> Result<(), String> {
    let response = client
        .get(url)
        .timeout(Duration::from_secs(30 * 60))
        .send()
        .await
        .map_err(|e| format!("下载更新失败：{e}"))?;
    if response.status() != reqwest::StatusCode::OK {
        return Err(format!("下载更新失败，HTTP {}", response.status()));
    }
    if response
        .content_length()
        .is_some_and(|n| n != expected_size)
    {
        return Err("更新下载大小与清单不一致".into());
    }
    let file = pending.file.as_mut().ok_or("更新文件已关闭")?;
    let mut received = 0;
    let mut next_report = 0;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取更新下载失败：{e}"))?;
        received = checked_received(received, chunk.len(), expected_size)?;
        file.write_all(&chunk)
            .map_err(|e| format!("保存更新文件失败：{e}"))?;
        if received >= next_report {
            next_report = received + 256 * 1024;
            let _ = app.emit(
                "update-progress",
                DlProgress {
                    received,
                    total: expected_size,
                },
            );
        }
    }
    if received != expected_size {
        return Err("更新下载尚未完成，请重试".into());
    }
    file.sync_all()
        .map_err(|e| format!("保存更新文件失败：{e}"))?;
    Ok(())
}

pub async fn download_update(
    app: AppHandle,
    urls: Vec<String>,
    sha256: String,
    size: u64,
) -> Result<String, String> {
    let _operation = UpdateOperation::acquire(&UPDATE_BUSY)?;
    let manifest = fetch_manifest().await?;
    validate_download_request(
        &manifest,
        &urls,
        &sha256,
        size,
        &app.package_info().version.to_string(),
    )?;
    // 新下载替代旧授权。任何失败、取消或被替代的临时文件均通过 Drop 清理。
    VERIFIED_DOWNLOAD
        .lock()
        .map_err(|_| "更新状态读取失败")?
        .take();
    let exe = std::env::current_exe().map_err(|e| format!("读取程序路径失败：{e}"))?;
    let directory = exe.parent().ok_or("读取程序目录失败")?;
    let client = download_client()?;
    let mut last_error = String::from("更新清单下载地址为空");
    for url in &manifest.exe.urls {
        let mut pending = create_download_file(directory)?;
        match download_to(&app, &client, url, &mut pending, manifest.exe.size).await {
            Ok(()) => {
                match verify_download(&mut pending, manifest.exe.size, &manifest.exe.sha256) {
                    Ok(()) => {
                        let path = pending
                            .path
                            .to_str()
                            .ok_or("更新文件路径编码无效")?
                            .to_string();
                        *VERIFIED_DOWNLOAD.lock().map_err(|_| "更新状态保存失败")? =
                            Some(VerifiedDownload {
                                pending,
                                sha256: manifest.exe.sha256,
                                size: manifest.exe.size,
                            });
                        return Ok(path);
                    }
                    Err(error) => last_error = error,
                }
            }
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

fn take_verified_download(
    state: &Mutex<Option<VerifiedDownload>>,
    path: &str,
) -> Result<VerifiedDownload, String> {
    let mut state = state.lock().map_err(|_| "更新状态读取失败")?;
    let pending = state.as_ref().ok_or("请先下载并验证更新文件")?;
    if pending.pending.path.as_os_str() != std::ffi::OsStr::new(path) {
        return Err("更新文件与已验证下载不匹配".into());
    }
    state
        .take()
        .ok_or_else(|| "更新授权已使用，请重新下载".into())
}

fn replace_executable(exe: &Path, downloaded: &Path) -> Result<(), String> {
    regular_file_metadata(exe)?;
    regular_file_metadata(downloaded)?;
    let old = exe.with_extension("exe.old");
    match std::fs::symlink_metadata(&old) {
        Ok(_) => {
            regular_file_metadata(&old)?;
            std::fs::remove_file(&old).map_err(|e| format!("清理旧版本失败：{e}"))?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("读取旧版本备份失败：{error}")),
    }
    std::fs::rename(exe, &old).map_err(|e| format!("备份当前程序失败：{e}"))?;
    if let Err(error) = std::fs::rename(downloaded, exe) {
        return match std::fs::rename(&old, exe) {
            Ok(()) => Err(format!("安装更新失败，当前程序已恢复：{error}")),
            Err(restore_error) => Err(format!(
                "安装更新失败：{error}。恢复失败：{restore_error}。原程序保存在 {}",
                old.display()
            )),
        };
    }
    Ok(())
}

/// 安装权限来自本进程的单次下载记录，在改动当前程序前再次校验同一文件句柄。
pub fn apply_update(app: AppHandle, path: String) -> Result<bool, String> {
    let _operation = UpdateOperation::acquire(&UPDATE_BUSY)?;
    let mut download = take_verified_download(&VERIFIED_DOWNLOAD, &path)?;
    verify_download(&mut download.pending, download.size, &download.sha256)?;
    let exe = std::env::current_exe().map_err(|e| format!("读取程序路径失败：{e}"))?;
    download.pending.file.take();
    replace_executable(&exe, &download.pending.path)?;
    let started = duct::cmd(&exe, Vec::<String>::new())
        .stdout_null()
        .stderr_null()
        .start()
        .is_ok();
    if started {
        app.exit(0);
    }
    Ok(started)
}

pub fn open_release_page(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(RELEASE_PAGE, None::<&str>)
        .map_err(|e| e.to_string())
}

/// 旧进程仍占用备份时留待后续启动清理。
pub fn cleanup_old_update() {
    if let Ok(exe) = std::env::current_exe() {
        let old = exe.with_extension("exe.old");
        if regular_file_metadata(&old).is_ok() {
            let _ = std::fs::remove_file(&old);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../work/update-tests");
            std::fs::create_dir_all(&root).unwrap();
            let root = root.canonicalize().unwrap();
            loop {
                let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
                let path = root.join(format!("{}-{sequence}", std::process::id()));
                match std::fs::create_dir(&path) {
                    Ok(()) => return Self(path),
                    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("创建测试目录失败：{error}"),
                }
            }
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let root = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../work/update-tests")
                .canonicalize()
                .unwrap();
            let target = self.0.canonicalize().unwrap();
            assert_eq!(target.parent(), Some(root.as_path()));
            std::fs::remove_dir_all(&target).unwrap();
        }
    }

    fn fixture() -> UpdateManifest {
        UpdateManifest {
            version: "0.4.3".into(),
            notes: None,
            pub_date: String::new(),
            exe: UpdateAsset {
                sha256: format!("{:x}", Sha256::digest(b"update")),
                size: 6,
                urls: vec![
                    "https://github.com/FanerJian/SpireForge/releases/download/v0.4.3/SpireForge-editor-v0.4.3.exe".into(),
                ],
            },
        }
    }

    fn verified_fixture(directory: &Path) -> VerifiedDownload {
        let mut pending = create_download_file(directory).unwrap();
        pending.file.as_mut().unwrap().write_all(b"update").unwrap();
        let manifest = fixture();
        VerifiedDownload {
            pending,
            sha256: manifest.exe.sha256,
            size: manifest.exe.size,
        }
    }

    #[test]
    fn versions_require_valid_three_part_release_numbers() {
        assert!(is_newer("v0.4.3", "0.4.2"));
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.4.2", "0.4.2"));
        assert!(!is_newer("0.4.1", "0.4.2"));
        for invalid in [
            "",
            "0.4",
            "0.4.3.1",
            "01.4.3",
            "0.x.3",
            "0.4.3-beta",
            " 0.4.3",
            "vv0.4.3",
        ] {
            assert!(version_tuple(invalid).is_none(), "{invalid}");
        }
    }

    #[test]
    fn manifest_checks_version_digest_size_and_asset_origin() {
        let mut manifest = fixture();
        assert!(validate_manifest(&manifest).is_ok());
        manifest.version = "garbage".into();
        assert!(validate_manifest(&manifest).is_err());
        manifest = fixture();
        manifest.exe.sha256 = "g".repeat(64);
        assert!(validate_manifest(&manifest).is_err());
        manifest.exe.sha256 = "0".repeat(63);
        assert!(validate_manifest(&manifest).is_err());
        manifest = fixture();
        for size in [0, MAX_ASSET_BYTES + 1, u64::MAX] {
            manifest.exe.size = size;
            assert!(validate_manifest(&manifest).is_err());
        }
        manifest = fixture();
        manifest.exe.urls.clear();
        assert!(validate_manifest(&manifest).is_err());
        manifest.exe.urls = vec![fixture().exe.urls[0].clone(); 5];
        assert!(validate_manifest(&manifest).is_err());
    }

    #[test]
    fn assets_require_official_repository_and_matching_release_tag() {
        let valid = &fixture().exe.urls[0];
        assert!(valid_asset_url(valid, "v0.4.3"));
        for invalid in [
            valid.replace("https://", "http://"),
            valid.replace("github.com/", "github.com.evil.test/"),
            valid.replace("github.com/", "user@github.com/"),
            valid.replace("github.com/", "github.com:8443/"),
            valid.replace("FanerJian", "attacker"),
            valid.replace("v0.4.3/", "v0.4.2/"),
            valid.replace(".exe", "%2fother.exe"),
            format!("{valid}?redirect=https://evil.test"),
            format!("{valid}#fragment"),
            format!("https://ghfast.top/{valid}"),
            "file:///C:/payload.exe".into(),
        ] {
            assert!(!valid_asset_url(&invalid, "0.4.3"), "{invalid}");
        }
    }

    #[test]
    fn redirects_require_https_and_explicit_github_asset_hosts() {
        for host in [
            "release-assets.githubusercontent.com",
            "objects.githubusercontent.com",
            "github-releases.githubusercontent.com",
        ] {
            assert!(allowed_asset_redirect(
                &reqwest::Url::parse(&format!("https://{host}/asset?signature=abc")).unwrap()
            ));
        }
        for text in [
            "http://release-assets.githubusercontent.com/asset",
            "https://release-assets.githubusercontent.com.evil.test/asset",
            "https://evil.test/asset",
            "https://github.com/attacker/repo/releases/download/v1.0.0/a.exe",
            "https://user@objects.githubusercontent.com/asset",
            "https://objects.githubusercontent.com:8443/asset",
        ] {
            assert!(
                !allowed_asset_redirect(&reqwest::Url::parse(text).unwrap()),
                "{text}"
            );
        }
    }

    #[test]
    fn manifest_parser_enforces_byte_limit_before_parsing() {
        assert!(parse_manifest(&vec![b' '; MAX_MANIFEST_BYTES + 1]).is_err());
        let manifest = fixture();
        let json = serde_json::json!({
            "version": manifest.version,
            "exe": {"sha256": manifest.exe.sha256, "size": manifest.exe.size, "urls": manifest.exe.urls}
        });
        let mut bytes = vec![0xef, 0xbb, 0xbf];
        bytes.extend_from_slice(json.to_string().as_bytes());
        assert!(parse_manifest(&bytes).is_ok());
    }

    #[test]
    fn ipc_download_parameters_must_match_fresh_official_manifest() {
        let manifest = fixture();
        let asset = &manifest.exe;
        assert!(validate_download_request(
            &manifest,
            &asset.urls,
            &asset.sha256,
            asset.size,
            "0.4.2"
        )
        .is_ok());
        assert!(validate_download_request(
            &manifest,
            &["https://evil.test/a.exe".into()],
            &asset.sha256,
            asset.size,
            "0.4.2"
        )
        .is_err());
        assert!(validate_download_request(
            &manifest,
            &asset.urls,
            &"0".repeat(64),
            asset.size,
            "0.4.2"
        )
        .is_err());
        assert!(validate_download_request(
            &manifest,
            &asset.urls,
            &asset.sha256,
            asset.size + 1,
            "0.4.2"
        )
        .is_err());
        assert!(validate_download_request(
            &manifest,
            &asset.urls,
            &asset.sha256,
            asset.size,
            "0.4.3"
        )
        .is_err());
        assert!(validate_download_request(
            &manifest,
            &asset.urls,
            &asset.sha256,
            asset.size,
            "1.0.0"
        )
        .is_err());
    }

    #[test]
    fn stream_size_checks_reject_oversize_and_arithmetic_overflow() {
        assert_eq!(checked_received(3, 3, 6).unwrap(), 6);
        assert!(checked_received(3, 4, 6).is_err());
        assert!(checked_received(MAX_ASSET_BYTES, 1, u64::MAX).is_err());
        assert!(checked_received(u64::MAX, 1, u64::MAX).is_err());
    }

    #[test]
    fn pending_files_are_unique_exclusively_created_and_cleaned() {
        let directory = TestDirectory::new();
        let first = create_download_file(&directory.0).unwrap();
        let second = create_download_file(&directory.0).unwrap();
        assert_ne!(first.path, second.path);
        assert!(OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&first.path)
            .is_err());
        let first_path = first.path.clone();
        drop(first);
        assert!(!first_path.exists());
    }

    #[test]
    fn verification_rejects_hash_size_and_after_download_tampering() {
        let directory = TestDirectory::new();
        let mut download = verified_fixture(&directory.0);
        assert!(verify_download(&mut download.pending, download.size, &download.sha256).is_ok());
        assert!(
            verify_download(&mut download.pending, download.size + 1, &download.sha256).is_err()
        );
        assert!(verify_download(&mut download.pending, download.size, &"0".repeat(64)).is_err());
        let file = download.pending.file.as_mut().unwrap();
        file.seek(SeekFrom::Start(0)).unwrap();
        file.write_all(b"edited").unwrap();
        assert!(verify_download(&mut download.pending, download.size, &download.sha256).is_err());
    }

    #[test]
    fn installation_authorization_requires_exact_path_and_is_single_use() {
        let directory = TestDirectory::new();
        let download = verified_fixture(&directory.0);
        let path = download.pending.path.to_str().unwrap().to_string();
        let state = Mutex::new(Some(download));
        assert!(take_verified_download(&state, "untrusted.exe").is_err());
        let approved = take_verified_download(&state, &path).unwrap();
        assert!(take_verified_download(&state, &path).is_err());
        drop(approved);
    }

    #[test]
    fn update_operations_are_serialized_and_released_on_failure() {
        let busy = AtomicBool::new(false);
        let operation = UpdateOperation::acquire(&busy).unwrap();
        assert!(UpdateOperation::acquire(&busy).is_err());
        drop(operation);
        assert!(UpdateOperation::acquire(&busy).is_ok());
    }

    #[test]
    fn replacement_keeps_original_backup_and_installs_only_staged_file() {
        let directory = TestDirectory::new();
        let exe = directory.0.join("editor.exe");
        let payload = directory.0.join("payload.tmp");
        std::fs::write(&exe, b"original").unwrap();
        std::fs::write(&payload, b"update").unwrap();
        replace_executable(&exe, &payload).unwrap();
        assert_eq!(std::fs::read(&exe).unwrap(), b"update");
        assert_eq!(
            std::fs::read(exe.with_extension("exe.old")).unwrap(),
            b"original"
        );
        assert!(!payload.exists());
    }

    #[cfg(windows)]
    #[test]
    fn failed_replacement_restores_original_executable() {
        use std::os::windows::fs::OpenOptionsExt;
        let directory = TestDirectory::new();
        let exe = directory.0.join("editor.exe");
        let payload = directory.0.join("payload.tmp");
        std::fs::write(&exe, b"original").unwrap();
        std::fs::write(&payload, b"update").unwrap();
        // 独占句柄使第二次 rename 失败，覆盖真实回滚分支。
        let _locked = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&payload)
            .unwrap();
        assert!(replace_executable(&exe, &payload).is_err());
        assert_eq!(std::fs::read(&exe).unwrap(), b"original");
        assert!(!exe.with_extension("exe.old").exists());
    }

    #[test]
    fn replacement_rejects_directory_backup_before_touching_executable() {
        let directory = TestDirectory::new();
        let exe = directory.0.join("editor.exe");
        let payload = directory.0.join("payload.tmp");
        std::fs::write(&exe, b"original").unwrap();
        std::fs::write(&payload, b"update").unwrap();
        std::fs::create_dir(exe.with_extension("exe.old")).unwrap();
        assert!(replace_executable(&exe, &payload).is_err());
        assert_eq!(std::fs::read(&exe).unwrap(), b"original");
    }

    #[test]
    fn linked_payloads_are_rejected() {
        let directory = TestDirectory::new();
        let target = directory.0.join("target.exe");
        let link = directory.0.join("linked.exe");
        std::fs::write(&target, b"update").unwrap();
        #[cfg(windows)]
        let result = std::os::windows::fs::symlink_file(&target, &link);
        #[cfg(unix)]
        let result = std::os::unix::fs::symlink(&target, &link);
        if let Err(error) = result {
            if error.kind() == std::io::ErrorKind::PermissionDenied
                || error.raw_os_error() == Some(1314)
            {
                eprintln!("当前系统创建符号链接需要额外权限，跳过链接创建验证");
                return;
            }
            panic!("创建链接失败：{error}");
        }
        assert!(regular_file_metadata(&link).is_err());
        assert_eq!(std::fs::read(&target).unwrap(), b"update");
    }

    #[cfg(windows)]
    #[test]
    fn windows_junction_payload_is_rejected_without_symlink_privilege() {
        use std::os::windows::fs::MetadataExt;
        use std::os::windows::process::CommandExt;

        let directory = TestDirectory::new();
        let target = directory.0.join("junction-target");
        let junction = directory.0.join("junction.tmp");
        let exe = directory.0.join("editor.exe");
        std::fs::create_dir(&target).unwrap();
        std::fs::write(&exe, b"original").unwrap();
        // Junction 创建使用普通目录权限，覆盖 Windows 重解析点分支。
        // 路径经环境变量传入 PowerShell，保持命令源码固定。
        let output = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "New-Item -ItemType Junction -Path $env:SF_TEST_JUNCTION -Target $env:SF_TEST_TARGET -ErrorAction Stop | Out-Null",
            ])
            .env("SF_TEST_JUNCTION", &junction)
            .env("SF_TEST_TARGET", &target)
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let metadata = std::fs::symlink_metadata(&junction).unwrap();
        assert_ne!(metadata.file_attributes() & 0x400, 0);
        assert!(regular_file_metadata(&junction).is_err());
        assert!(replace_executable(&exe, &junction).is_err());
        assert_eq!(std::fs::read(&exe).unwrap(), b"original");
        assert!(target.is_dir());
    }
}
