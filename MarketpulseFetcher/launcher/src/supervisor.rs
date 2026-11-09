//! Python Fetcher 프로세스 기동·감시.
//!
//! 런타임 준비 → `python -I -m data_fetcher.app` (헤드리스) 기동 → 포트가 열리면 Running,
//! 프로세스가 끝나면 종료 코드를 트레이로 알린다. 종료 코드 0 은 웹의 '종료' 버튼
//! (/shutdown → os._exit(0)) 이므로 런처도 같이 내려간다.
use std::{
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Duration,
};

use tao::event_loop::EventLoopProxy;

use crate::{UserEvent, runtime};

#[derive(Debug, Clone)]
pub enum Status {
    Preparing,
    Starting,
    Running,
    Stopped(Option<i32>),
    Failed(String),
}

#[derive(Clone)]
pub struct Supervisor {
    port: u16,
    proxy: EventLoopProxy<UserEvent>,
    child: Arc<Mutex<Option<Child>>>,
    quitting: Arc<AtomicBool>,
}

pub fn port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

impl Supervisor {
    pub fn new(port: u16, proxy: EventLoopProxy<UserEvent>) -> Self {
        Self { port, proxy, child: Arc::default(), quitting: Arc::default() }
    }

    /// 백그라운드 스레드에서 런타임 준비 + Python 기동 + 감시.
    pub fn start(&self) {
        let me = self.clone();
        thread::spawn(move || {
            let status = me.run();
            if me.quitting.load(Ordering::SeqCst) {
                return; // 사용자가 '종료'를 눌러 우리가 죽인 경우
            }
            let event = match status {
                Status::Stopped(Some(0)) => UserEvent::Exit,
                s => UserEvent::Status(s),
            };
            let _ = me.proxy.send_event(event);
        });
    }

    fn send(&self, s: Status) {
        let _ = self.proxy.send_event(UserEvent::Status(s));
    }

    fn run(&self) -> Status {
        self.send(Status::Preparing);
        let rt = match runtime::ensure() {
            Ok(rt) => rt,
            Err(e) => {
                crate::log::write(&format!("런타임 준비 실패: {e}"));
                return Status::Failed(format!("런타임 준비 실패: {e}"));
            }
        };

        self.send(Status::Starting);
        match self.spawn(&rt) {
            Ok(child) => *self.child.lock().unwrap() = Some(child),
            Err(e) => {
                crate::log::write(&format!("Python 기동 실패: {e}"));
                return Status::Failed(format!("Python 기동 실패: {e}"));
            }
        }

        let mut announced = false;
        loop {
            {
                let mut slot = self.child.lock().unwrap();
                let Some(child) = slot.as_mut() else { return Status::Stopped(None) };
                match child.try_wait() {
                    Ok(Some(exit)) => {
                        *slot = None;
                        crate::log::write(&format!("Fetcher 종료: {exit}"));
                        return Status::Stopped(exit.code());
                    }
                    Ok(None) => {}
                    Err(e) => return Status::Failed(format!("프로세스 감시 실패: {e}")),
                }
            }
            if !announced && port_open(self.port) {
                announced = true;
                self.send(Status::Running);
            }
            thread::sleep(Duration::from_millis(500));
        }
    }

    fn spawn(&self, rt: &runtime::Runtime) -> std::io::Result<Child> {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(PathBuf::from))
            .unwrap_or_default();

        let mut cmd = Command::new(&rt.python);
        // -I: 사용자 site-packages·PYTHON* 환경변수·현재 폴더를 무시 → PC 에 깔린 다른
        //     파이썬 설정이 섞이지 않는다. data_fetcher 는 런타임 site-packages 에 있다.
        cmd.args(["-I", "-X", "utf8", "-m", "data_fetcher.app"])
            .current_dir(&rt.root)
            .env("FETCHER_HEADLESS", "1") // 트레이는 런처가 그린다
            .env("FETCHER_LAUNCHER", "1") // 스킴 등록은 런처가 한다 (python 경로로 덮어쓰지 않게)
            .env("FETCHER_EXE_DIR", &exe_dir) // exe 옆 .env 를 읽도록
            .env("FETCHER_PORT", self.port.to_string())
            .stdin(Stdio::null());

        // macOS: python-build-standalone 의 OpenSSL 은 시스템 인증서를 못 찾는다 → certifi 사용
        #[cfg(target_os = "macos")]
        {
            let pem = rt.site_packages.join("certifi").join("cacert.pem");
            if pem.exists() && std::env::var_os("SSL_CERT_FILE").is_none() {
                cmd.env("SSL_CERT_FILE", pem);
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = &rt.site_packages;

        match crate::log::open() {
            Some(f) => {
                let err = f.try_clone()?;
                cmd.stdout(f).stderr(err);
            }
            None => {
                cmd.stdout(Stdio::null()).stderr(Stdio::null());
            }
        }

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        crate::log::write(&format!("Fetcher 기동: {} (port {})", rt.python.display(), self.port));
        let child = cmd.spawn()?;
        #[cfg(windows)]
        crate::job::assign(&child);
        Ok(child)
    }

    /// '종료' — Python 을 내리고 감시 스레드가 이벤트를 보내지 않게 한다.
    pub fn shutdown(&self) {
        self.quitting.store(true, Ordering::SeqCst);
        self.kill();
    }

    /// '다시 시작' 전에 남은 프로세스 정리.
    pub fn kill(&self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
