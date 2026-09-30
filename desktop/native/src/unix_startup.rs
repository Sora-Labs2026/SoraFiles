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

pub fn initialize_fresh_install(directory: &Path, value: &mut serde_json::Value) -> Result<(), String> {
    initialize_with(directory, value, enabled, set)
}

fn initialize_with(directory: &Path, value: &mut serde_json::Value, current: impl FnOnce()->Result<bool,String>, mut change: impl FnMut(bool)->Result<bool,String>) -> Result<(),String> {
    // Existing settings also protect legacy opt-outs, which predate the saved
    // startup preference. Never rewrite OS-managed state on an ordinary launch.
    if directory.join("preferences.json").try_exists().map_err(|_| "Settings unavailable")? { return Ok(()); }
    let previous = current()?;
    change(true)?;
    let mut next = value.clone();
    next["startup"] = serde_json::json!(true);
    let preferences = crate::preferences::Preferences::from_value(&next).map_err(str::to_owned)?;
    if let Err(error) = crate::preferences::save(directory, &preferences) {
        if !previous { let _ = change(false); }
        return Err(error.into());
    }
    *value = next;
    Ok(())
}

#[cfg(test)] mod default_tests {
    use super::*;
    #[test] fn fresh_defaults_enable_once_and_preserve_existing_preferences() {
        let directory=std::env::temp_dir().join(format!("sorafiles-unix-startup-{}",uuid::Uuid::new_v4()));
        let mut value=crate::preferences::Preferences::default().value();let mut changes=Vec::new();
        initialize_with(&directory,&mut value,||Ok(false),|enabled|{changes.push(enabled);Ok(enabled)}).unwrap();
        assert_eq!(changes,vec![true]);assert_eq!(crate::preferences::load(&directory).unwrap().value()["startup"],true);
        for existing in [r#"{"version":1,"output":"source","theme":"system"}"#,r#"{"version":1,"output":"source","theme":"system","startup":false}"#] {
            std::fs::write(directory.join("preferences.json"),existing).unwrap();
            initialize_with(&directory,&mut value,||panic!("must preserve existing settings"),|_|panic!("must not re-enable")).unwrap();
            assert_eq!(std::fs::read_to_string(directory.join("preferences.json")).unwrap(),existing);
        }
        std::fs::remove_file(directory.join("preferences.json")).unwrap();std::fs::remove_dir(directory).unwrap();
    }
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
