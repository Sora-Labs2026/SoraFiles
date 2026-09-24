//! Per-user login startup. Windows retains its separate registry implementation.
use std::path::{Path, PathBuf};

#[path = "unix_startup_entry.rs"]
mod entry;
#[path = "unix_launcher.rs"]
pub(crate) mod launcher;

fn location(base: &Path) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        base.join("Library/LaunchAgents/com.soralabs.sorafiles.desktop.desktop.plist")
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .unwrap_or_else(|| base.join(".config"))
            .join("autostart/com.soralabs.sorafiles.desktop.desktop")
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        base.join(".config/autostart/com.soralabs.sorafiles.desktop.desktop")
    }
}

fn platform() -> entry::Platform {
    #[cfg(target_os = "macos")]
    {
        entry::Platform::Mac
    }
    #[cfg(target_os = "linux")]
    {
        entry::Platform::Linux
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        entry::Platform::Linux
    }
}

fn entry_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| location(&home))
        .ok_or_else(|| "Home folder unavailable".into())
}

pub fn enabled() -> Result<bool, String> {
    let expected = contents()?;
    Ok(entry::read_regular(&entry_path()?)?.is_some_and(|bytes| entry::owned(&expected, &bytes)))
}

fn contents() -> Result<Vec<u8>, String> {
    let executable = launcher::current()?;
    entry::render(
        platform(),
        executable
            .to_str()
            .ok_or("Application location unavailable")?,
    )
}

pub fn set(enabled: bool) -> Result<bool, String> {
    let path = entry_path()?;
    let expected = contents()?;
    if enabled {
        entry::replace(&path, &expected)?;
    } else {
        entry::remove(&path, &expected)?;
    }
    Ok(enabled)
}
