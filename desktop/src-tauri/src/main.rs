// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fetcher;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Fetcher 프로세스 시작
            fetcher::start(handle.clone());

            // 업데이터 체크 (백그라운드)
            let updater_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = check_update(updater_handle).await {
                    log::warn!("Update check failed: {e}");
                }
            });

            // 창 표시 (약간 지연 — Fetcher 기동 대기)
            let win = app.get_webview_window("main").unwrap();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
                let _ = win.show();
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                fetcher::stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MarketPulse");
}

async fn check_update(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;
    if let Some(update) = app.updater()?.check().await? {
        let _ = update.download_and_install(|_, _| {}, || {}).await;
    }
    Ok(())
}
