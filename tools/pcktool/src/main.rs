use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("用法: pcktool <pack|list> ...");
        eprintln!("  pack <src_dir> <out.pck> <prefix>   递归打包目录，条目路径=res://<prefix>/<相对路径>");
        eprintln!("  list <file.pck>                     列出 PCK 内的文件");
        return ExitCode::from(2);
    }
    match args[1].as_str() {
        "pack" if args.len() == 5 => {
            let src = PathBuf::from(&args[2]);
            let out = PathBuf::from(&args[3]);
            match pcktool::pack_dir(&src, &out, &args[4]) {
                Ok(n) => {
                    println!("packed {n} files -> {}", out.display());
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("pack 失败: {e}");
                    ExitCode::FAILURE
                }
            }
        }
        "list" if args.len() == 3 => {
            match pcktool::list(&PathBuf::from(&args[2])) {
                Ok(entries) => {
                    for (p, ofs, size) in entries {
                        println!("{ofs:>12} {size:>10}  {p}");
                    }
                    ExitCode::SUCCESS
                }
                Err(e) => {
                    eprintln!("list 失败: {e}");
                    ExitCode::FAILURE
                }
            }
        }
        _ => {
            eprintln!("参数错误");
            ExitCode::from(2)
        }
    }
}
