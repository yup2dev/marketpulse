// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fetcher;

use tauri::{Manager, menu::{MenuBuilder, MenuItemBuilder}};
use std::time::Duration;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // 1️⃣ Fetcher 프로세스 시작
            fetcher::start(handle.clone());

            // 2️⃣ Fetcher 헬스체크 및 재시작 (Tauri 시작 후 약 1초)
            let fetcher_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(1)).await;
                monitor_fetcher(&fetcher_handle).await;
            });

            // 3️⃣ 트레이 메뉴 설정
            let open_item = MenuItemBuilder::with_id("open", "Open MarketPulse").build(app)
                .expect("failed to build open menu item");
            let check_update_item = MenuItemBuilder::with_id("check_update", "Check for Updates").build(app)
                .expect("failed to build check update menu item");
            let exit_item = MenuItemBuilder::with_id("exit", "Quit").build(app)
                .expect("failed to build exit menu item");
            let tray_menu = MenuBuilder::new(app)
                .item(&open_item)
                .separator()
                .item(&check_update_item)
                .separator()
                .item(&exit_item)
                .build()
                .expect("failed to build tray menu");

            let _tray = tauri::tray::TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("MarketPulse - Running")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "open" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "check_update" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = check_and_install_update(app_handle).await {
                                    log::error!("Update check failed: {e}");
                                }
                            });
                        }
                        "exit" => {
                            fetcher::stop();
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)
                .expect("failed to create tray icon");

            // 4️⃣ 자동 업데이트 체크 (앱 시작 후 5초, 그 다음 매 1시간)
            let updater_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(5)).await;
                auto_update_loop(updater_handle).await;
            });

            // 5️⃣ 창 표시 (약간 지연)
            let win = app.get_webview_window("main").unwrap();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(800)).await;
                let _ = win.show();
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                fetcher::stop();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MarketPulse");
}

/// Fetcher 백그라운드 모니터링
async fn monitor_fetcher(_handle: &tauri::AppHandle) {
    loop {
        // 5분마다 Fetcher 상태 확인
        tokio::time::sleep(Duration::from_secs(300)).await;

        if check_fetcher_health().await.is_err() {
            log::warn!("🔄 Fetcher 연결 실패, Backend API를 통해 재시작 시도");
            if let Err(e) = start_fetcher_via_api().await {
                log::error!("❌ Fetcher 재시작 실패: {e}");
            }
        }
    }
}

/// Fetcher 헬스체크
async fn check_fetcher_health() -> Result<(), String> {
    let client = reqwest::Client::new();
    match tokio::time::timeout(
        Duration::from_secs(2),
        client.get("http://127.0.0.1:8765/health").send()
    ).await {
        Ok(Ok(resp)) if resp.status().is_success() => {
            log::debug!("✅ Fetcher 정상");
            Ok(())
        }
        _ => Err("Fetcher not responding".to_string()),
    }
}

/// Backend API를 통해 Fetcher 시작
async fn start_fetcher_via_api() -> Result<(), String> {
    let client = reqwest::Client::new();
    match tokio::time::timeout(
        Duration::from_secs(5),
        client.post("http://127.0.0.1:8000/api/fetcher/start").send()
    ).await {
        Ok(Ok(resp)) if resp.status().is_success() => {
            log::info!("✅ Fetcher 재시작 완료");
            Ok(())
        }
        e => Err(format!("Failed to start fetcher: {:?}", e)),
    }
}

/// 자동 업데이트 루프 (1시간마다)
async fn auto_update_loop(app: tauri::AppHandle) {
    loop {
        if let Err(e) = check_and_install_update(app.clone()).await {
            log::debug!("Auto-update check: {e}");
        }
        // 1시간 대기
        tokio::time::sleep(Duration::from_secs(3600)).await;
    }
}

/// 업데이트 확인 및 자동 설치
async fn check_and_install_update(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_updater::UpdaterExt;

    log::info!("🔍 업데이트 확인 중...");

    match app.updater()?.check().await {
        Ok(Some(update)) => {
            log::info!("📦 새 버전 발견: {}", update.version);

            // 다운로드 및 설치
            match update.download_and_install(
                |chunk_length, _| {
                    log::debug!("Downloaded {} bytes", chunk_length);
                },
                || {
                    log::info!("업데이트 설치 완료");
                }
            ).await {
                Ok(_) => {
                    log::info!("✅ 업데이트 완료, 앱 재시작 중...");
                    app.restart();
                }
                Err(e) => {
                    log::error!("❌ 업데이트 설치 실패: {e}");
                }
            }
        }
        Ok(None) => {
            log::debug!("✅ 최신 버전입니다");
        }
        Err(e) => {
            log::warn!("⚠️ 업데이트 확인 실패: {e}");
        }
    }

    Ok(())
}
