/// Точка входа desktop-клиента.
///
/// Единственный плагин — `opener`: внешние ссылки (donate) должны
/// открываться системным браузером, а не внутри webview. Остальное
/// приложению не нужно: статика отдаётся из `frontend/dist`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
