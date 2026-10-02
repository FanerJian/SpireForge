//! 独立验证宿主：把编辑器后端的 model.rs / publish.rs / import.rs 直接纳入编译，
//! 使 PCK 打包、Entry 派生与导入逻辑可在无 Tauri 环境下测试。
//! 用法: cargo test（GNU 工具链即可，不需要 Windows SDK）

#[path = "../../../editor/src-tauri/src/model.rs"]
pub mod model;

#[path = "../../../editor/src-tauri/src/publish.rs"]
pub mod publish;

#[path = "../../../editor/src-tauri/src/import.rs"]
pub mod import;
