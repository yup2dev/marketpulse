//! 런처 로그 — `~/.marketpulse_fetcher/launcher.log`.
//! Python 쪽 로그(fetcher.log)와 같은 폴더. Python 의 stdout/stderr 도 이 파일로 받는다.
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

/// Python 쪽 `Path.home() / ".marketpulse_fetcher"` 와 같은 위치.
pub fn dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(std::env::temp_dir).join(".marketpulse_fetcher")
}

pub fn launcher_log() -> PathBuf {
    dir().join("launcher.log")
}

pub fn fetcher_log() -> PathBuf {
    dir().join("fetcher.log")
}

/// 추가 모드로 연 런처 로그 파일 (자식 프로세스 stdout/stderr 연결용).
pub fn open() -> Option<File> {
    let _ = fs::create_dir_all(dir());
    let path = launcher_log();
    // 무한정 커지지 않게 5MB 넘으면 새로 시작
    if fs::metadata(&path).map(|m| m.len() > 5 * 1024 * 1024).unwrap_or(false) {
        let _ = fs::rename(&path, dir().join("launcher.log.1"));
    }
    OpenOptions::new().create(true).append(true).open(path).ok()
}

pub fn write(msg: &str) {
    if let Some(mut f) = open() {
        let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
        let _ = writeln!(f, "[launcher {secs}] {msg}");
    }
}
