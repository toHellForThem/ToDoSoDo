/// Точка входа desktop-клиента.
///
/// Spake не регистрирует плагинов: приложению нужен только webview с
/// локальной статикой из `frontend/dist`. Нативные команды появятся позже
/// (если понадобятся для миграции данных из Electron).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
