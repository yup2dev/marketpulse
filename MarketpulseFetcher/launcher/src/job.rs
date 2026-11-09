//! Windows Job Object — 런처가 어떤 식으로 죽든(작업 관리자 강제 종료 포함) Python 도
//! 함께 종료되게 한다. 없으면 트레이 없는 python.exe 가 포트를 잡은 채 남는다.
use std::{os::windows::io::AsRawHandle, process::Child, ptr, sync::OnceLock};

use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation, SetInformationJobObject,
};

/// 핸들은 프로세스 끝까지 닫지 않는다 — 런처 종료로 핸들이 닫히는 순간 자식이 정리된다.
struct Job(isize);

fn job() -> Option<isize> {
    static JOB: OnceLock<Option<Job>> = OnceLock::new();
    JOB.get_or_init(|| unsafe {
        let handle = CreateJobObjectW(ptr::null(), ptr::null());
        if handle.is_null() {
            return None;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            handle,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        (ok != 0).then_some(Job(handle as isize))
    })
    .as_ref()
    .map(|j| j.0)
}

pub fn assign(child: &Child) {
    let Some(handle) = job() else { return };
    let ok = unsafe { AssignProcessToJobObject(handle as _, child.as_raw_handle() as _) };
    if ok == 0 {
        crate::log::write("Job Object 연결 실패(무시) — 런처 강제 종료 시 Python 이 남을 수 있음");
    }
}
