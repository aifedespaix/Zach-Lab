#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    suite_tauri::builder(suite_tauri::SuiteConfig {
        // This app opens no file type of its own: an app that does lists its
        // extensions here and listens to `open_event` in the frontend.
        open_extensions: &[],
        open_event: "open-file",
    })
    .setup(|app| {
        suite_tauri::size_main_window_to_screen(app);
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
