//! MarketPulse Fetcher 런처.
//!
//! 단일 실행파일 안에 Python 런타임 + data_fetcher 페이로드를 품고 있다.
//! 1. 이미 Fetcher 가 떠 있으면(포트 응답) 아무것도 하지 않고 끝낸다.
//! 2. marketpulse:// 스킴을 이 exe 로 등록한다.
//! 3. 트레이 아이콘을 띄우고, 백그라운드에서 페이로드를 풀어 Python Fetcher(헤드리스)를 기동한다.
//! 4. Fetcher 가 정상 종료(웹의 '종료' 버튼)하면 런처도 끝나고, 비정상 종료면 트레이에서 다시 시작할 수 있다.
#![cfg_attr(windows, windows_subsystem = "windows")]

mod log;
mod runtime;
mod scheme;
mod supervisor;
#[cfg(windows)]
mod job;

use std::{fs, path::PathBuf};

use tao::{
    event::{Event, StartCause},
    event_loop::{ControlFlow, EventLoopBuilder},
};
use tray_icon::{
    Icon, TrayIcon, TrayIconBuilder,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
};

use supervisor::{Status, Supervisor};

mod icon {
    include!(concat!(env!("OUT_DIR"), "/icon_size.rs"));
    pub static RGBA: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/icon.rgba"));
}

const DEFAULT_PORT: u16 = 8765;

pub enum UserEvent {
    Menu(MenuEvent),
    Status(Status),
    Exit,
}

/// FETCHER_PORT — 환경변수 > exe 옆 .env > ~/.marketpulse_fetcher/.env (Python app.py 와 같은 순서).
fn resolve_port() -> u16 {
    if let Some(p) = std::env::var("FETCHER_PORT").ok().and_then(|v| v.trim().parse().ok()) {
        return p;
    }
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from));
    let candidates = exe_dir.into_iter().map(|d| d.join(".env")).chain([log::dir().join(".env")]);
    for path in candidates {
        let Ok(text) = fs::read_to_string(&path) else { continue };
        // python-dotenv 와 마찬가지로 첫 번째로 존재하는 .env 만 본다
        return text
            .lines()
            .filter_map(|l| l.trim().strip_prefix("export ").unwrap_or(l.trim()).split_once('='))
            .find(|(k, _)| k.trim() == "FETCHER_PORT")
            .and_then(|(_, v)| v.trim().trim_matches(['"', '\'']).parse().ok())
            .unwrap_or(DEFAULT_PORT);
    }
    DEFAULT_PORT
}

fn status_text(port: u16, s: &Status) -> String {
    match s {
        Status::Preparing => "준비 중… (첫 실행은 1분 정도 걸립니다)".into(),
        Status::Starting => "시작 중…".into(),
        Status::Running => format!("실행 중  :{port}"),
        Status::Stopped(Some(code)) => format!("중지됨 (종료 코드 {code})"),
        Status::Stopped(None) => "중지됨".into(),
        Status::Failed(msg) => {
            let short: String = msg.chars().take(60).collect();
            format!("오류: {short}")
        }
    }
}

struct Tray {
    _icon: TrayIcon,
    status: MenuItem,
    restart: MenuItem,
}

fn main() {
    let port = resolve_port();
    if supervisor::port_open(port) {
        // 이미 실행 중 (딥링크로 또 불린 경우 등) — 두 번째 인스턴스는 조용히 끝낸다.
        return;
    }
    log::write(&format!("런처 시작 (v{}, port {port})", env!("CARGO_PKG_VERSION")));
    scheme::register();

    let mut builder = EventLoopBuilder::<UserEvent>::with_user_event();
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopBuilderExtMacOS};
        builder.with_activation_policy(ActivationPolicy::Accessory); // Dock 에 안 뜨게
    }
    let event_loop = builder.build();

    let proxy = event_loop.create_proxy();
    MenuEvent::set_event_handler(Some(move |e| {
        let _ = proxy.send_event(UserEvent::Menu(e));
    }));

    let supervisor = Supervisor::new(port, event_loop.create_proxy());

    let status = MenuItem::new(status_text(port, &Status::Preparing), false, None);
    let keys = MenuItem::new("API 키 설정 (브라우저)", true, None);
    let logs = MenuItem::new("로그 보기", true, None);
    let restart = MenuItem::new("다시 시작", false, None);
    let quit = MenuItem::new("종료", true, None);
    let menu = Menu::new();
    let _ = menu.append_items(&[
        &status,
        &PredefinedMenuItem::separator(),
        &keys,
        &logs,
        &restart,
        &PredefinedMenuItem::separator(),
        &quit,
    ]);
    let (keys_id, logs_id, restart_id, quit_id) =
        (keys.id().clone(), logs.id().clone(), restart.id().clone(), quit.id().clone());

    let mut menu = Some(menu);
    let mut items = Some((status, restart));
    let mut tray: Option<Tray> = None;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            // macOS 는 이벤트 루프가 돈 다음에 트레이를 만들어야 한다
            Event::NewEvents(StartCause::Init) => {
                let icon = Icon::from_rgba(icon::RGBA.to_vec(), icon::ICON_W, icon::ICON_H)
                    .expect("트레이 아이콘 데이터 오류");
                let built = TrayIconBuilder::new()
                    .with_menu(Box::new(menu.take().unwrap()))
                    .with_tooltip(format!("MarketPulse Fetcher :{port}"))
                    .with_icon(icon)
                    .build();
                let (status, restart) = items.take().unwrap();
                match built {
                    Ok(i) => tray = Some(Tray { _icon: i, status, restart }),
                    Err(e) => log::write(&format!("트레이 아이콘 생성 실패(트레이 없이 계속): {e}")),
                }
                supervisor.start();
            }
            Event::UserEvent(UserEvent::Status(s)) => {
                if let Some(t) = &tray {
                    t.status.set_text(status_text(port, &s));
                    t.restart.set_enabled(matches!(s, Status::Stopped(_) | Status::Failed(_)));
                }
            }
            Event::UserEvent(UserEvent::Menu(e)) => {
                if e.id == keys_id {
                    let _ = open::that(format!("http://127.0.0.1:{port}/"));
                } else if e.id == logs_id {
                    let path = [log::fetcher_log(), log::launcher_log()].into_iter().find(|p| p.exists());
                    if let Some(p) = path {
                        let _ = open::that(p);
                    }
                } else if e.id == restart_id {
                    supervisor.kill();
                    supervisor.start();
                } else if e.id == quit_id {
                    supervisor.shutdown();
                    tray.take();
                    *control_flow = ControlFlow::Exit;
                }
            }
            Event::UserEvent(UserEvent::Exit) => {
                log::write("Fetcher 가 정상 종료되어 런처도 종료");
                tray.take();
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}
