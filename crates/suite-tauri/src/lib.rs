use tauri::{Emitter, Manager};

/// What differs from one app to the next in the « Ouvrir avec » handling: the
/// extensions the OS can hand us, and the event the running instance emits.
pub struct SuiteConfig {
    pub open_extensions: &'static [&'static str],
    pub open_event: &'static str,
}

/// The file in a command line, if any.
///
/// Double-clicking an associated file launches the app as
/// `app.exe "C:coursractions.zmap"`, so the path arrives as an argument.
/// Matching on the extension rather than taking `argv[1]` blindly keeps a
/// stray flag — or the `--` separator a `cargo tauri dev` run adds — from
/// being handed to the frontend as a file to open.
pub fn file_arg(args: &[String], extensions: &[&str]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|arg| {
            let lower = arg.to_lowercase();
            extensions
                .iter()
                .any(|extension| lower.ends_with(&format!(".{extension}")))
        })
        .cloned()
}

/// Sizes and shows the main window against the screen it actually opens on.
///
/// `tauri.conf.json` ships a fixed 1200×900 as a design target, but a
/// student's laptop is just as likely to be a 1366×768 screen, where a fixed
/// 900px height overflows the usable desktop. The window is created hidden
/// (`"visible": false` in the config) so this can size and center it before
/// the first paint instead of flashing the oversized default first.
pub fn size_main_window_to_screen(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Ok(Some(monitor)) = window.primary_monitor() {
        let screen = monitor.size().to_logical::<f64>(monitor.scale_factor());
        // 85% of the available screen, floored so the UI stays usable and
        // capped at the app's own 1200×900 design size so a huge monitor
        // doesn't get a needlessly stretched window.
        let width = (screen.width * 0.85).clamp(1000.0, 1200.0);
        let height = (screen.height * 0.85).clamp(700.0, 900.0);
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
    }

    let _ = window.center();
    let _ = window.show();
}

/// The builder every app of the suite starts from: file, dialog, opener and
/// updater plugins, plus single-instance on desktop.
pub fn builder(config: SuiteConfig) -> tauri::Builder<tauri::Wry> {
    let builder = tauri::Builder::default();

    // Registered FIRST, as the plugin requires. Without it, double-clicking a
    // second file while the app is open starts a SECOND copy of the editor —
    // and two copies autosaving the same file on a 500 ms debounce would take
    // turns overwriting each other's work. Instead the running instance is
    // handed the new argv, opens that file, and comes to the front.
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(move |app, argv, _cwd| {
        if let Some(path) = file_arg(&argv, config.open_extensions) {
            let _ = app.emit(config.open_event, path);
        }
        if let Some(window) = app.get_webview_window("main") {
            // Unminimized first: `set_focus` alone leaves a minimized window
            // minimized, so the file would open somewhere the user cannot see.
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    // `config` is only read by the desktop-only plugin above.
    #[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
    let _ = config;

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
}

#[cfg(test)]
mod tests {
    use super::file_arg;

    const MAPS: &[&str] = &["zmap", "json"];

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn finds_the_map_windows_asked_us_to_open() {
        assert_eq!(
            file_arg(&args(&["app.exe", r"C:\cours\fractions.zmap"]), MAPS),
            Some(r"C:\cours\fractions.zmap".to_string())
        );
    }

    #[test]
    fn still_opens_a_legacy_json_map() {
        assert_eq!(
            file_arg(&args(&["app.exe", r"C:\cours\fractions.json"]), MAPS),
            Some(r"C:\cours\fractions.json".to_string())
        );
    }

    #[test]
    fn matches_the_extension_whatever_its_case() {
        assert_eq!(
            file_arg(&args(&["app.exe", r"C:\cours\Fractions.ZMAP"]), MAPS),
            Some(r"C:\cours\Fractions.ZMAP".to_string())
        );
    }

    #[test]
    fn ignores_the_executable_itself() {
        // The binary is not named like a map, but the guard matters: argv[0] is
        // never a file the user asked to open.
        assert_eq!(file_arg(&args(&["fractions.zmap"]), MAPS), None);
    }

    #[test]
    fn ignores_flags_and_unrelated_files() {
        assert_eq!(file_arg(&args(&["app.exe"]), MAPS), None);
        assert_eq!(file_arg(&args(&["app.exe", "--flag", "notes.pdf"]), MAPS), None);
    }

    #[test]
    fn ignores_the_cargo_tauri_dev_separator() {
        assert_eq!(
            file_arg(&args(&["app.exe", "--", "x.zmap"]), &["zmap"]),
            Some("x.zmap".to_string())
        );
    }

    #[test]
    fn ignores_an_extension_it_was_not_told_about() {
        assert_eq!(file_arg(&args(&["app.exe", "x.pdf"]), &["zmap"]), None);
    }

    #[test]
    fn rejects_a_bare_extension_without_a_dot() {
        assert_eq!(file_arg(&args(&["app.exe", "zmap"]), &["zmap"]), None);
    }

    #[test]
    fn an_app_with_no_file_type_never_finds_a_file() {
        assert_eq!(file_arg(&args(&["app.exe", "x.zmap"]), &[]), None);
    }
}
