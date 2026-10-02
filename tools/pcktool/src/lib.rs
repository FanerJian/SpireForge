//! Godot PCK 读写库（SpireForge 用）。
//!
//! 只实现游戏实际加载所需的子集：
//! - 写入：format v2（绝对偏移、无加密）——Godot 4.5.1 的加载器同时兼容 v2/v3，
//!   v2 布局更简单且不依赖 file_base 相对寻址。
//! - 读取（list / read_entries）：v2/v3 头部解析。解析路径全部走带边界检查的
//!   游标 Reader：截断、越界、超大计数的输入返回 Err 而不是 panic——
//!   编辑器以 panic=abort 发行，恶意/损坏 PCK 不能炸掉整个进程。
//!
//! v2 布局（小端）：
//!   "GDPC" | u32 ver=2 | u32 maj | u32 min | u32 patch
//!   | u32 pack_flags(0) | u64 file_base(0) | 16×u32 保留(0)
//!   | u32 file_count | entry{u32 path_len, path, u64 ofs, u64 size, md5[16], u32 flags(0)}...
//!   | 文件数据
//! v3 与 v2 的差异：无 64 字节保留区，紧跟 u64 dir_offset（相对 pck 起始），
//! 目录在文件尾部；每文件绝对偏移 = file_base + ofs。
//!
//! 注：每文件 16 字节 MD5 是 PCK 格式规范的一部分（Godot 用作加载校验标记），
//! 属于格式兼容要求，不用于安全目的。

use std::fs;
use std::io;
use std::path::Path;

pub const MAGIC: &[u8; 4] = b"GDPC";
pub const FORMAT_V2: u32 = 2;
pub const FORMAT_V3: u32 = 3;

/// 解析防护上限：损坏/恶意 PCK 的计数与偏移不可信，超限直接拒绝
const MAX_FILE_COUNT: u32 = 1 << 20; // 目录条目上限（约 100 万）
const MAX_PATH_LEN: usize = 8 * 1024; // 单路径字节上限
const MAX_PCK_BYTES: u64 = 1 << 31; // 整包读取上限 2 GiB

pub struct PackEntry {
    /// res:// 全路径，如 "res://SpireForgeTestPack/cards/x.json"
    pub path: String,
    pub data: Vec<u8>,
}

/// 递归收集 src_dir 下所有文件，虚拟路径 = res://{prefix}/{相对路径}（/ 分隔）。
pub fn collect_files(src_dir: &Path, prefix: &str) -> io::Result<Vec<PackEntry>> {
    let mut out = Vec::new();
    collect_recursive(src_dir, src_dir, prefix, &mut out)?;
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn collect_recursive(
    root: &Path,
    dir: &Path,
    prefix: &str,
    out: &mut Vec<PackEntry>,
) -> io::Result<()> {
    for e in fs::read_dir(dir)? {
        let e = e?;
        let p = e.path();
        if p.is_dir() {
            collect_recursive(root, &p, prefix, out)?;
        } else {
            let rel = p
                .strip_prefix(root)
                .expect("child under root")
                .to_string_lossy()
                .replace('\\', "/");
            let data = fs::read(&p)?;
            out.push(PackEntry {
                path: format!("res://{prefix}/{rel}"),
                data,
            });
        }
    }
    Ok(())
}

/// 打包为 format v2（内存构建后一次性落盘）。返回写入的文件数。
pub fn write_v2(out_path: &Path, entries: &[PackEntry], engine: (u32, u32, u32)) -> io::Result<usize> {
    let mut buf: Vec<u8> = Vec::with_capacity(1 << 20);
    let mut w = |buf: &mut Vec<u8>, bytes: &[u8]| buf.extend_from_slice(bytes);

    // 头部（固定 96 字节：4 magic + 5×u32 + u64 + 64 保留 + u32 count）
    w(&mut buf, MAGIC);
    push_u32(&mut buf, FORMAT_V2);
    push_u32(&mut buf, engine.0);
    push_u32(&mut buf, engine.1);
    push_u32(&mut buf, engine.2);
    push_u32(&mut buf, 0); // pack_flags：无加密、绝对偏移
    push_u64(&mut buf, 0); // file_base：未使用
    for _ in 0..16 {
        push_u32(&mut buf, 0); // 保留区
    }
    push_u32(&mut buf, entries.len() as u32);

    // 目录项 + 占位
    let mut offset_slots = Vec::with_capacity(entries.len());
    for e in entries {
        let path = e.path.as_bytes();
        push_u32(&mut buf, path.len() as u32);
        w(&mut buf, path);
        offset_slots.push(buf.len());
        push_u64(&mut buf, 0); // offset 占位
        push_u64(&mut buf, e.data.len() as u64);
        w(&mut buf, &md5::compute(&e.data).0);
        push_u32(&mut buf, 0); // flags
    }

    // 数据区：每个文件 16 字节对齐，回填绝对偏移
    for (e, slot) in entries.iter().zip(&offset_slots) {
        while buf.len() % 16 != 0 {
            buf.push(0);
        }
        let pos = buf.len() as u64;
        buf.extend_from_slice(&e.data);
        buf[*slot..*slot + 8].copy_from_slice(&pos.to_le_bytes());
    }

    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(out_path, &buf)?;
    Ok(entries.len())
}

fn push_u32(buf: &mut Vec<u8>, v: u32) {
    buf.extend_from_slice(&v.to_le_bytes());
}

fn push_u64(buf: &mut Vec<u8>, v: u64) {
    buf.extend_from_slice(&v.to_le_bytes());
}

// ---- 安全读取（不可信输入：全部边界检查，只返回 Err 不 panic）----

fn bad(msg: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, msg.to_string())
}

struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> io::Result<&'a [u8]> {
        let end = self
            .pos
            .checked_add(n)
            .ok_or_else(|| bad("PCK 目录偏移溢出"))?;
        if end > self.data.len() {
            return Err(bad("PCK 已截断或目录损坏"));
        }
        let s = &self.data[self.pos..end];
        self.pos = end;
        Ok(s)
    }
    fn u32(&mut self) -> io::Result<u32> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }
    fn u64(&mut self) -> io::Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
}

struct DirEntryMeta {
    path: String,
    ofs: u64,
    size: u64,
}

/// 解析头部 + 目录。返回 (file_base, 条目元数据)。
/// 不按文件中声明的 count 预分配内存（防伪造巨量计数触发 OOM）。
fn parse_dir(data: &[u8]) -> io::Result<(u64, Vec<DirEntryMeta>)> {
    if data.len() < 96 {
        return Err(bad("不是 PCK（文件过短）"));
    }
    let mut r = Reader { data, pos: 0 };
    if r.take(4)? != MAGIC {
        return Err(bad("不是 PCK（magic 不符）"));
    }
    let version = r.u32()?;
    let _major = r.u32()?;
    let _minor = r.u32()?;
    let _patch = r.u32()?;
    let _pack_flags = r.u32()?;
    let file_base = r.u64()?;
    match version {
        FORMAT_V2 => {
            r.take(64)?; // 保留区
        }
        FORMAT_V3 => {
            let dir_ofs = r.u64()?;
            if dir_ofs as usize as u64 != dir_ofs || dir_ofs > data.len() as u64 {
                return Err(bad("PCK v3 目录偏移越界"));
            }
            r.pos = dir_ofs as usize;
        }
        other => return Err(bad(&format!("不支持的 PCK 版本 {other}"))),
    }
    let count = r.u32()?;
    if count > MAX_FILE_COUNT {
        return Err(bad("PCK 条目数超限（疑似损坏文件）"));
    }
    // 有意不 with_capacity(count)：count 来自不可信输入
    let mut entries = Vec::new();
    for _ in 0..count {
        let sl = r.u32()? as usize;
        if sl > MAX_PATH_LEN {
            return Err(bad("PCK 路径长度超限（疑似损坏文件）"));
        }
        let path = String::from_utf8_lossy(r.take(sl)?).into_owned();
        let ofs = r.u64()?;
        let size = r.u64()?;
        r.take(16)?; // md5
        r.take(4)?; // flags
        entries.push(DirEntryMeta { path, ofs, size });
    }
    Ok((file_base, entries))
}

/// 解析现有 PCK（v2/v3），返回文件清单（路径、绝对偏移、大小），用于调试与校验。
pub fn list(path: &Path) -> io::Result<Vec<(String, u64, u64)>> {
    let data = fs::read(path)?;
    let (file_base, entries) = parse_dir(&data)?;
    Ok(entries
        .into_iter()
        .map(|e| {
            let abs = file_base.saturating_add(e.ofs);
            (e.path, abs, e.size)
        })
        .collect())
}

/// 便捷打包入口（递归目录 → PCK v2）。
pub fn pack_dir(src: &Path, out: &Path, prefix: &str) -> io::Result<usize> {
    let entries = collect_files(src, prefix)?;
    write_v2(out, &entries, (4, 5, 1))
}

/// 读取 PCK（v2/v3）全部条目内容，供编辑器"导入卡包"使用。
pub fn read_entries(path: &Path) -> io::Result<Vec<(String, Vec<u8>)>> {
    let data = fs::read(path)?;
    if data.len() as u64 > MAX_PCK_BYTES {
        return Err(bad("PCK 过大（超过 2 GiB 读取上限）"));
    }
    let (file_base, entries) = parse_dir(&data)?;
    let mut out = Vec::with_capacity(entries.len());
    for e in entries {
        let start = file_base
            .checked_add(e.ofs)
            .ok_or_else(|| bad("条目偏移溢出"))?;
        let end = start.checked_add(e.size).ok_or_else(|| bad("条目长度溢出"))?;
        if end > data.len() as u64 {
            return Err(bad("PCK 条目越界（文件截断或损坏）"));
        }
        out.push((e.path, data[start as usize..end as usize].to_vec()));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("pcktool_{name}"));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn build_sample(dir: &Path) -> PathBuf {
        let src = dir.join("src/res/PackA");
        fs::create_dir_all(src.join("cards")).unwrap();
        fs::write(src.join("cards/a.json"), b"{\"id\":\"a\"}").unwrap();
        fs::write(src.join("cards/b.json"), b"{\"id\":\"b\"}").unwrap();
        let out = dir.join("PackA.pck");
        let n = pack_dir(&src, &out, "PackA").unwrap();
        assert_eq!(n, 2);
        out
    }

    #[test]
    fn roundtrip_and_list() {
        let d = tmp_dir("roundtrip");
        let out = build_sample(&d);
        let mut entries = read_entries(&out).unwrap();
        entries.sort_by(|a, b| a.0.cmp(&b.0));
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].0, "res://PackA/cards/a.json");
        assert_eq!(entries[0].1, b"{\"id\":\"a\"}");
        let listing = list(&out).unwrap();
        assert_eq!(listing.len(), 2);
        // 绝对偏移必须落在文件内
        let sz = fs::metadata(&out).unwrap().len();
        for (_, ofs, size) in listing {
            assert!(ofs + size <= sz, "offset {ofs}+{size} beyond {sz}");
        }
    }

    #[test]
    fn truncated_file_is_err_not_panic() {
        let d = tmp_dir("trunc");
        let out = build_sample(&d);
        let bytes = fs::read(&out).unwrap();
        // 样本包目录区结束于 100 + 2×(40+24) = 228；之前的截断必然打断头部/目录
        let dir_end = 100 + 2 * (40 + 24);
        for cut in [0usize, 50, 96, 97, 110, dir_end - 1] {
            let p = d.join(format!("cut{cut}.pck"));
            fs::write(&p, &bytes[..cut]).unwrap();
            assert!(read_entries(&p).is_err(), "cut at {cut} must error");
            assert!(list(&p).is_err(), "list cut at {cut} must error");
        }
        // 目录之后截断：list 仍可解析（目录完整），read_entries 必须因数据越界报错
        let p = d.join("cut_data.pck");
        fs::write(&p, &bytes[..bytes.len() - 1]).unwrap();
        assert!(read_entries(&p).is_err());
    }

    #[test]
    fn corrupt_count_is_err_no_huge_alloc() {
        let d = tmp_dir("count");
        let out = build_sample(&d);
        let mut bytes = fs::read(&out).unwrap();
        // v2: count 位于固定 96..100；伪造巨量计数（不得触发巨量分配/panic）
        bytes[96..100].copy_from_slice(&u32::MAX.to_le_bytes());
        let p = d.join("huge_count.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
        // 伪造中等计数：目录迅速读穿 → 截断错误
        bytes[96..100].copy_from_slice(&65_535u32.to_le_bytes());
        let p = d.join("mid_count.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
    }

    #[test]
    fn bad_magic_and_version() {
        let d = tmp_dir("magic");
        let out = build_sample(&d);
        let mut bytes = fs::read(&out).unwrap();
        bytes[0..4].copy_from_slice(b"XXXX");
        let p = d.join("bad_magic.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
        let mut bytes = fs::read(&out).unwrap();
        bytes[4..8].copy_from_slice(&99u32.to_le_bytes());
        let p = d.join("bad_ver.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
    }

    #[test]
    fn oversized_path_is_err() {
        let d = tmp_dir("pathlen");
        let out = build_sample(&d);
        let mut bytes = fs::read(&out).unwrap();
        // 第一条目的 path_len 位于 100..104；改为超过 MAX_PATH_LEN
        bytes[100..104].copy_from_slice(&(MAX_PATH_LEN as u32 + 1).to_le_bytes());
        let p = d.join("long_path.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
    }

    #[test]
    fn entry_out_of_range_is_err() {
        let d = tmp_dir("range");
        let out = build_sample(&d);
        let bytes = fs::read(&out).unwrap();
        // 目录自 100 起：entry0 = path_len(4) + path(N) + ofs(8) + size(8)
        let n = u32::from_le_bytes(bytes[100..104].try_into().unwrap()) as usize;
        let size_at = 100 + 4 + n + 8;
        let mut bytes = bytes.clone();
        bytes[size_at..size_at + 8].copy_from_slice(&u64::MAX.to_le_bytes());
        let p = d.join("huge_size.pck");
        fs::write(&p, &bytes).unwrap();
        assert!(read_entries(&p).is_err());
    }

    /// 手工构造 v3（dir_offset 在头部 32..40，无保留区）验证 v3 解析路径。
    #[test]
    fn v3_layout_parses() {
        let d = tmp_dir("v3");
        let mut buf: Vec<u8> = Vec::new();
        buf.extend_from_slice(MAGIC);
        push_u32(&mut buf, FORMAT_V3);
        push_u32(&mut buf, 4);
        push_u32(&mut buf, 5);
        push_u32(&mut buf, 1);
        push_u32(&mut buf, 0); // pack_flags
        push_u64(&mut buf, 0); // file_base
        let dir_slot = buf.len(); // 32
        push_u64(&mut buf, 0); // dir_offset 占位
        let payload = b"hello-v3";
        let data_ofs = buf.len() as u64;
        buf.extend_from_slice(payload);
        while buf.len() % 16 != 0 {
            buf.push(0);
        }
        let dir_at = buf.len() as u64;
        buf[dir_slot..dir_slot + 8].copy_from_slice(&dir_at.to_le_bytes());
        push_u32(&mut buf, 1); // count
        let path = b"res://V3/x.txt";
        push_u32(&mut buf, path.len() as u32);
        buf.extend_from_slice(path);
        push_u64(&mut buf, data_ofs);
        push_u64(&mut buf, payload.len() as u64);
        buf.extend_from_slice(&[0u8; 16]); // md5
        push_u32(&mut buf, 0); // flags

        let p = d.join("v3.pck");
        fs::write(&p, &buf).unwrap();
        let entries = read_entries(&p).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "res://V3/x.txt");
        assert_eq!(entries[0].1, payload);
    }

    /// v3 file_base 相对寻址：条目绝对偏移 = file_base + ofs（dir_offset 仍为绝对值）。
    #[test]
    fn v3_file_base_applied() {
        let d = tmp_dir("v3base");
        let file_base: u64 = 100;
        let payload_abs: usize = 256; // 数据实际放在绝对 256 处
        let mut buf: Vec<u8> = Vec::new();
        buf.extend_from_slice(MAGIC);
        push_u32(&mut buf, FORMAT_V3);
        push_u32(&mut buf, 4);
        push_u32(&mut buf, 5);
        push_u32(&mut buf, 1);
        push_u32(&mut buf, 0);
        push_u64(&mut buf, file_base);
        let dir_slot = buf.len(); // 32
        push_u64(&mut buf, 0); // dir_offset 占位（绝对，稍后回填）
        // 数据区：垫到绝对 256，写入 payload；ofs = 256 - 100 = 156
        let payload = b"payload!";
        while buf.len() < payload_abs {
            buf.push(0);
        }
        buf.extend_from_slice(payload);
        let ofs = payload_abs as u64 - file_base;
        // 目录（绝对偏移）
        while buf.len() % 16 != 0 {
            buf.push(0);
        }
        let dir_abs = buf.len() as u64;
        buf[dir_slot..dir_slot + 8].copy_from_slice(&dir_abs.to_le_bytes());
        push_u32(&mut buf, 1);
        let path = b"res://B/x";
        push_u32(&mut buf, path.len() as u32);
        buf.extend_from_slice(path);
        push_u64(&mut buf, ofs);
        push_u64(&mut buf, payload.len() as u64);
        buf.extend_from_slice(&[0u8; 16]);
        push_u32(&mut buf, 0);

        let p = d.join("v3base.pck");
        fs::write(&p, &buf).unwrap();
        let entries = read_entries(&p).unwrap();
        assert_eq!(entries[0].1, payload);
    }
}
