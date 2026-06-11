/// Fetcher 프로세스 관리
/// - 앱 시작 시 sidecar 바이너리(marketpulse-fetcher) 실행
/// - 앱 종료 시 자동 kill
/// - 로그인 토큰을 토큰 파일로 주입 → Fetcher가 클라우드 /ws/fetcher 워커풀에 합류

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

static FETCHER_CHILD: Mutex<Option<tauri_plugin_shell::process::CommandChild>> = Mutex::new(None);

/// Fetcher 설정 디렉터리 (Python data_fetcher.server.keystore._config_dir 와 동일 규칙)
fn fetcher_config_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("MarketPulseFetcher");
        }
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".marketpulse_fetcher")
}

fn user_token_path() -> PathBuf {
    fetcher_config_dir().join("user_token")
}

/// 백엔드 /ws/fetcher WS URL (env로 덮어쓰기 가능, 기본은 클라우드)
fn backend_ws_url() -> String {
    std::env::var("FETCHER_BACKEND_WS_URL")
        .unwrap_or_else(|_| "wss://api.finance.dns-co.kr/ws/fetcher".to_string())
}

/// 로그인 JWT를 토큰 파일에 기록 → 워커가 다음 접속 시 사용. (프론트: 로그인/갱신 시 호출)
#[tauri::command]
pub fn set_fetcher_token(token: String) -> Result<(), String> {
    let dir = fetcher_config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = user_token_path();
    std::fs::write(&path, token.trim()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// 로그아웃 시 토큰 파일 제거 → 워커가 접속을 보류한다. (프론트: 로그아웃 시 호출)
#[tauri::command]
pub fn clear_fetcher_token() -> Result<(), String> {
    let path = user_token_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match app.shell().sidecar("marketpulse-fetcher") {
            Err(e) => log::error!("[fetcher] sidecar 실행 실패: {e}"),
            Ok(cmd) => {
                // 트레이 모드(HEADLESS=0) + 클라우드 워커풀 합류 URL 주입
                match cmd
                    .env("FETCHER_HEADLESS", "0")
                    .env("FETCHER_BACKEND_WS_URL", backend_ws_url())
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
