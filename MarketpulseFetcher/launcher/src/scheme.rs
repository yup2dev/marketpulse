//! `marketpulse://` URL 스킴 등록 — 웹의 'Fetcher 실행' 딥링크가 이 exe 를 띄우도록.
//!
//! - Windows: HKCU\Software\Classes\marketpulse 에 현재 exe 경로를 등록(관리자 불필요, 멱등).
//! - macOS  : .app 번들의 Info.plist(CFBundleURLTypes)로 등록되므로 여기서는 할 일이 없다.
//!
//! 스킴 호출의 목적은 "Fetcher 를 띄우는 것" 하나라 전달된 URL 인자는 무시한다.

#[cfg(windows)]
pub fn register() {
    if let Err(e) = register_windows() {
        crate::log::write(&format!("URL 스킴 등록 실패(무시): {e}"));
    }
}

#[cfg(windows)]
fn register_windows() -> std::io::Result<()> {
    use winreg::{RegKey, enums::HKEY_CURRENT_USER};

    let exe = std::env::current_exe()?;
    let command = format!("\"{}\" \"%1\"", exe.display());
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let base = r"Software\Classes\marketpulse";

    let cmd_key = hkcu.open_subkey(format!(r"{base}\shell\open\command")).ok();
    if cmd_key.and_then(|k| k.get_value::<String, _>("").ok()).as_deref() == Some(command.as_str()) {
        return Ok(()); // 이미 이 exe 로 등록됨
    }

    let (root, _) = hkcu.create_subkey(base)?;
    root.set_value("", &"URL:MarketPulse Fetcher")?;
    root.set_value("URL Protocol", &"")?;
    let (icon, _) = hkcu.create_subkey(format!(r"{base}\DefaultIcon"))?;
    icon.set_value("", &format!("\"{}\",0", exe.display()))?;
    let (cmd, _) = hkcu.create_subkey(format!(r"{base}\shell\open\command"))?;
    cmd.set_value("", &command)?;
    crate::log::write(&format!("URL 스킴 등록: marketpulse:// → {command}"));
    Ok(())
}

#[cfg(not(windows))]
pub fn register() {}
