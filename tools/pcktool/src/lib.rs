//! Godot PCK 读写库（SpireForge 用）。
//!
//! 只实现游戏实际加载所需的子集：
//! - 写入：format v2（绝对偏移、无加密）——Godot 4.5.1 的加载器同时兼容 v2/v3，
//!   v2 布局更简单且不依赖 file_base 相对寻址。
//! - 读取（list）：v2/v3 头部解析，供调试比对真实 mod 的 PCK。
//!
//! v2 布局（小端）：
//!   "GDPC" | u32 ver=2 | u32 maj | u32 min | u32 patch
//!   | u32 pack_flags(0) | u64 file_base(0) | 16×u32 保留(0)
//!   | u32 file_count | entry{u32 path_len, path, u64 ofs, u64 size, md5[16], u32 flags(0)}...
//!   | 文件数据
//! v3 与 v2 的差异：无 64 字节保留区，紧跟 u64 dir_offset（相对 pck 起始），
//! 目录在文件尾部；每文件偏移 = file_base + ofs。
//!
//! 注：每文件 16 字节 MD5 是 PCK 格式规范的一部分（Godot 用作加载校验标记），
//! 属于格式兼容要求，不用于安全目的。

use std::fs;
use std::io;
use std::path::Path;

pub const MAGIC: &[u8; 4] = b"GDPC";
pub const FORMAT_V2: u32 = 2;
pub const FORMAT_V3: u32 = 3;

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

/// 解析现有 PCK（v2/v3），返回文件清单（路径、偏移、大小），用于调试与校验。
pub fn list(path: &Path) -> io::Result<Vec<(String, u64, u64)>> {
    let data = fs::read(path)?;
    if data.len() < 96 || &data[0..4] != MAGIC {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "not a PCK"));
    }
    let rd_u32 = |off: usize| u32::from_le_bytes(data[off..off + 4].try_into().unwrap());
    let rd_u64 = |off: usize| u64::from_le_bytes(data[off..off + 8].try_into().unwrap());
    let version = rd_u32(4);
    let mut cursor = match version {
        2 => 32 + 64, // 头部固定区之后
        3 => rd_u64(32) as usize,
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported version {version}"),
            ))
        }
    };
    let count = rd_u32(cursor);
    cursor += 4;
    let mut entries = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let sl = rd_u32(cursor) as usize;
        cursor += 4;
        let p = String::from_utf8_lossy(&data[cursor..cursor + sl]).into_owned();
        cursor += sl;
        let ofs = rd_u64(cursor);
        cursor += 8;
        let size = rd_u64(cursor);
        cursor += 8 + 16;
        cursor += 4; // flags
        entries.push((p, ofs, size));
    }
    Ok(entries)
}

/// 便捷打包入口（递归目录 → PCK v2）。
pub fn pack_dir(src: &Path, out: &Path, prefix: &str) -> io::Result<usize> {
    let entries = collect_files(src, prefix)?;
    write_v2(out, &entries, (4, 5, 1))
}

/// 读取 PCK（v2/v3）全部条目内容，供编辑器"导入卡包"使用。
pub fn read_entries(path: &Path) -> io::Result<Vec<(String, Vec<u8>)>> {
    let data = fs::read(path)?;
    if data.len() < 96 || &data[0..4] != MAGIC {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "not a PCK"));
    }
    let rd_u32 = |off: usize| u32::from_le_bytes(data[off..off + 4].try_into().unwrap());
    let rd_u64 = |off: usize| u64::from_le_bytes(data[off..off + 8].try_into().unwrap());
    let version = rd_u32(4);
    let mut cursor = match version {
        2 => 32 + 64,
        3 => rd_u64(32) as usize,
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported version {version}"),
            ))
        }
    };
    let count = rd_u32(cursor);
    cursor += 4;
    let mut slots = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let sl = rd_u32(cursor) as usize;
        cursor += 4;
        let p = String::from_utf8_lossy(&data[cursor..cursor + sl]).into_owned();
        cursor += sl;
        let ofs = rd_u64(cursor);
        cursor += 8;
        let size = rd_u64(cursor);
        cursor += 8 + 16;
        cursor += 4; // flags
        slots.push((p, ofs as usize, size as usize));
    }
    let mut out = Vec::with_capacity(slots.len());
    for (p, ofs, size) in slots {
        let end = ofs + size;
        if end > data.len() {
            return Err(io::Error::new(io::ErrorKind::InvalidData, "entry out of range"));
        }
        out.push((p, data[ofs..end].to_vec()));
    }
    Ok(out)
}
