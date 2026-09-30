/// The extensions Windows can hand us. `zmap` is the one the installer
/// registers; `json` is here because a legacy map opened through
/// « Ouvrir avec » must work too.
const MIND_MAP_EXTENSIONS: &[&str] = &["zmap", "json"];

/// The map the app was launched to open, read fresh from the process's own
/// command line. Returns `None` for a normal launch, which is the common case.
#[tauri::command]
fn launch_mind_map() -> Option<String> {
    suite_tauri::file_arg(&std::env::args().collect::<Vec<_>>(), MIND_MAP_EXTENSIONS)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    suite_tauri::builder(suite_tauri::SuiteConfig {
        open_extensions: MIND_MAP_EXTENSIONS,
        open_event: "open-mind-map",
    })
    .invoke_handler(tauri::generate_handler![launch_mind_map])
    .setup(|app| {
        suite_tauri::size_main_window_to_screen(app);
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
