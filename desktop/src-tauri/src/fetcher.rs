/// Fetcher 프로세스 관리
/// - 앱 시작 시 sidecar 바이너리(marketpulse-fetcher) 실행
/// - 앱 종료 시 자동 kill

use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

static FETCHER_CHILD: Mutex<Option<tauri_plugin_shell::process::CommandChild>> = Mutex::new(None);

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match app.shell().sidecar("marketpulse-fetcher") {
            Err(e) => log::error!("[fetcher] sidecar 실행 실패: {e}"),
            Ok(cmd) => {
                // 트레이 모드(HEADLESS=0)로 기동 → 맥 상단 메뉴바에 Fetcher 아이콘 표시
                match cmd
                    .env("FETCHER_HEADLESS", "0")
                    .spawn()
                {
                    Err(e) => log::error!("[fetcher] spawn 실패: {e}"),
                    Ok((mut rx, child)) => {
                        *FETCHER_CHILD.lock().unwrap() = Some(child);
                        log::info!("[fetcher] 프로세스 시작됨 (localhost:8765)");

                        // 로그 스트림 (디버그용)
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    log::debug!("[fetcher] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Stderr(line) => {
                                    log::warn!("[fetcher] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Terminated(status) => {
                                    log::info!("[fetcher] 프로세스 종료: {:?}", status);
                                    *FETCHER_CHILD.lock().unwrap() = None;
                                    break;
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
    });
}

pub fn stop() {
    if let Ok(mut guard) = FETCHER_CHILD.lock() {
        if let Some(child) = guard.take() {
            let _ = child.kill();
            log::info!("[fetcher] 프로세스 종료 요청");
        }
    }
}
