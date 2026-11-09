//! 내장 페이로드(Python 런타임 + data_fetcher) 풀기.
//!
//! 페이로드는 build.py 가 만든 zip 이고 exe 안에 그대로 들어 있다. 첫 실행 때
//! `<로컬 데이터 폴더>/MarketPulseFetcher/runtime/<페이로드 ID>/` 에 한 번 풀고,
//! 이후 실행은 그 폴더를 바로 쓴다. ID 는 페이로드 sha256 앞부분이라 새 버전 exe 는
//! 새 폴더에 풀리고, 이전 버전 폴더는 정리한다.
use std::{
    fs,
    io::{self, Cursor},
    path::{Path, PathBuf},
};

static PAYLOAD: &[u8] = include_bytes!(env!(
    "MP_PAYLOAD",
    "MP_PAYLOAD 가 없습니다 — cargo build 대신 `python MarketpulseFetcher/build/build.py` 로 빌드하세요"
));
const PAYLOAD_ID: &str = env!("MP_PAYLOAD_ID");

/// 풀기가 끝까지 됐다는 표시. 이 파일이 없으면 폴더를 신뢰하지 않는다.
const COMPLETE_MARKER: &str = ".complete";
/// build.py 가 페이로드 루트에 쓰는 실행 정보 (`key=상대경로` 줄).
const LAUNCH_FILE: &str = "launch.txt";

pub struct Runtime {
    pub root: PathBuf,
    pub python: PathBuf,
    pub site_packages: PathBuf,
}

fn runtime_base() -> PathBuf {
    dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(std::env::temp_dir)
        .join("MarketPulseFetcher")
        .join("runtime")
}

/// 이미 풀려 있으면 바로, 아니면 풀어서 런타임 위치를 돌려준다.
pub fn ensure() -> io::Result<Runtime> {
    let base = runtime_base();
    let target = base.join(PAYLOAD_ID);
    if !target.join(COMPLETE_MARKER).exists() {
        extract(&base, &target)?;
        remove_old_versions(&base);
    }
    load(&target)
}

fn extract(base: &Path, target: &Path) -> io::Result<()> {
    crate::log::write(&format!("런타임 풀기 시작 → {}", target.display()));
    fs::create_dir_all(base)?;
    // 같은 이름 폴더에 바로 풀면 중간에 꺼졌을 때 반쯤 풀린 폴더가 남는다.
    // 임시 폴더에 다 푼 뒤 이름을 바꿔 원자적으로 교체한다.
    let tmp = base.join(format!("{PAYLOAD_ID}.partial-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let mut archive = zip::ZipArchive::new(Cursor::new(PAYLOAD)).map_err(io::Error::other)?;
    archive.extract(&tmp).map_err(io::Error::other)?;
    fs::write(tmp.join(COMPLETE_MARKER), PAYLOAD_ID)?;

    if target.exists() {
        // 마커 없는 잔여 폴더(이전 버전 런처가 남긴 것 등) — 지우고 교체
        let _ = fs::remove_dir_all(target);
    }
    if let Err(e) = fs::rename(&tmp, target) {
        let _ = fs::remove_dir_all(&tmp);
        // 동시에 뜬 다른 인스턴스가 먼저 끝냈으면 그걸 쓴다
        if !target.join(COMPLETE_MARKER).exists() {
            return Err(e);
        }
    }
    crate::log::write("런타임 풀기 완료");
    Ok(())
}

/// 다른 버전의 런타임 폴더 정리 (best-effort — 실행 중인 구버전이 잡고 있으면 남는다).
fn remove_old_versions(base: &Path) {
    let Ok(entries) = fs::read_dir(base) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name != PAYLOAD_ID && !name.starts_with(&format!("{PAYLOAD_ID}.partial-")) {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

fn load(root: &Path) -> io::Result<Runtime> {
    let text = fs::read_to_string(root.join(LAUNCH_FILE))?;
    let get = |key: &str| {
        text.lines()
            .filter_map(|l| l.split_once('='))
            .find(|(k, _)| k.trim() == key)
            .map(|(_, v)| root.join(v.trim()))
            .ok_or_else(|| io::Error::other(format!("{LAUNCH_FILE} 에 {key} 항목이 없습니다")))
    };
    let python = get("python")?;
    if !python.exists() {
        return Err(io::Error::other(format!(
            "Python 실행파일이 없습니다: {} (런타임 폴더가 손상됐다면 지우고 다시 실행하세요: {})",
            python.display(),
            root.display()
        )));
    }
    Ok(Runtime { root: root.to_path_buf(), python, site_packages: get("site")? })
}
