#[cfg(target_os = "windows")]
fn clear_legacy_webview_cache(app: &tauri::App) -> tauri::Result<()> {
    use tauri::Manager;
    use webview2_com::{
        ClearBrowsingDataCompletedHandler,
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Profile2, ICoreWebView2_13,
            COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE,
            COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
            COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS,
        },
    };
    use windows::core::Interface;

    let marker = app
        .path()
        .app_cache_dir()?
        .join("legacy-pwa-cache-cleared-v1");
    if marker.exists() {
        return Ok(());
    }

    if let Some(main_window) = app.get_webview_window("main") {
        main_window.with_webview(move |platform_webview| {
            let result = (|| -> windows::core::Result<()> {
                unsafe {
                    let webview = platform_webview.controller().CoreWebView2()?;
                    let profile = webview
                        .cast::<ICoreWebView2_13>()?
                        .Profile()?
                        .cast::<ICoreWebView2Profile2>()?;
                    let reload_webview = webview.clone();
                    let data_kinds = COREWEBVIEW2_BROWSING_DATA_KINDS_SERVICE_WORKERS
                        | COREWEBVIEW2_BROWSING_DATA_KINDS_CACHE_STORAGE
                        | COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE;

                    profile.ClearBrowsingData(
                        data_kinds,
                        &ClearBrowsingDataCompletedHandler::create(Box::new(move |clear_result| {
                            clear_result?;
                            if let Some(parent) = marker.parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }
                            let _ = std::fs::write(&marker, b"cleared");
                            reload_webview.Reload()?;
                            Ok(())
                        })),
                    )
                }
            })();

            if let Err(error) = result {
                eprintln!("failed to clear legacy WebView cache: {error}");
            }
        })?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            clear_legacy_webview_cache(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running worktools");
}
