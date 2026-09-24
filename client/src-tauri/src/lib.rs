// Shared app entry point for both desktop (main.rs) and mobile (Android/iOS).
// Tauri's mobile build compiles this crate as a library and calls `run()`,
// which is why a [lib] target + this file are required. Without them the
// Android build fails with "no library targets found in package `botion`".

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            // Updater is desktop-only; register it there so the frontend can
            // check GitHub releases and prompt to update.
            #[cfg(desktop)]
            {
                _app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
