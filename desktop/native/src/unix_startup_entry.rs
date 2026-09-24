use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Component, Path},
};

pub enum Platform {
    Mac,
    Linux,
}
const OWNER: &str = "com.soralabs.sorafiles.desktop";
const MAX_ENTRY_BYTES: u64 = 64 * 1024;

fn temp_nonce() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |value| value.as_nanos())
    )
}

fn ancestor_safe(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err("Startup location unavailable".into());
    }
    for dir in path.ancestors().skip(1) {
        match fs::symlink_metadata(dir) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err("A different startup entry already exists".into())
            }
            Ok(meta) if !meta.is_dir() => return Err("Sign-in setting could not be saved".into()),
            Ok(_) => (),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => return Err("Sign-in setting could not be read".into()),
        }
    }
    Ok(())
}

pub fn read_regular(path: &Path) -> Result<Option<Vec<u8>>, String> {
    ancestor_safe(path)?;
    match fs::symlink_metadata(path) {
        Ok(meta)
            if meta.file_type().is_symlink() || !meta.is_file() || meta.len() > MAX_ENTRY_BYTES =>
        {
            Err("A different startup entry already exists".into())
        }
        Ok(_) => {
            let file = fs::File::open(path).map_err(|_| "Sign-in setting could not be read")?;
            let mut bytes = Vec::new();
            file.take(MAX_ENTRY_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "Sign-in setting could not be read")?;
            if bytes.len() as u64 > MAX_ENTRY_BYTES {
                return Err("A different startup entry already exists".into());
            }
            Ok(Some(bytes))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("Sign-in setting could not be read".into()),
    }
}

fn xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
fn desktop(value: &str) -> String {
    let mut result = String::new();
    for ch in value.chars() {
        // Exec quoting follows the desktop file's general string unescaping.
        // A quote has an extra backslash for general string quote escaping.
        let backslashes = match ch {
            '\\' => 4,
            '"' => 3,
            '$' | '`' => 2,
            _ => 0,
        };
        for _ in 0..backslashes {
            result.push('\\');
        }
        if ch != '\\' {
            result.push(ch);
        }
        if ch == '%' {
            result.push('%');
        }
    }
    result
}

pub fn render(platform: Platform, executable: &str) -> Result<Vec<u8>, String> {
    if !executable.starts_with('/') || executable.chars().any(char::is_control) {
        return Err("Application location unavailable".into());
    }
    let bytes = match platform {
        Platform::Mac => format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!-- SoraFiles-owned: {OWNER} -->\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\"><plist version=\"1.0\"><dict><key>Label</key><string>{OWNER}</string><key>ProgramArguments</key><array><string>{}</string><string>--background</string></array><key>RunAtLoad</key><true/></dict></plist>\n", xml(executable)).into_bytes(),
        Platform::Linux => format!("[Desktop Entry]\nType=Application\nVersion=1.0\nName=SoraFiles Desktop\nComment=Start SoraFiles quick actions\nExec=\"{}\" --background\nTerminal=false\nX-GNOME-Autostart-enabled=true\nX-SoraFiles-Owned={}\n", desktop(executable), OWNER).into_bytes(),
    };
    if bytes.len() as u64 > MAX_ENTRY_BYTES {
        return Err("Application location unavailable".into());
    }
    Ok(bytes)
}

// A marker is not proof of ownership: edits to the executable or other fields
// must be preserved, including entries installed at a different location.
pub fn owned(expected: &[u8], bytes: &[u8]) -> bool {
    bytes == expected
}

fn publish_new(temp: &Path, destination: &Path) -> Result<(), String> {
    ancestor_safe(destination)?;
    // Atomic no-replace publication. rename would overwrite a file created
    // after the preflight check. Hard links are supported by macOS/Linux user
    // filesystems; fail closed if the filesystem does not support them.
    fs::hard_link(temp, destination).map_err(|_| "Sign-in setting could not be saved".into())
}

pub fn replace(path: &Path, expected: &[u8]) -> Result<(), String> {
    if expected.is_empty() || expected.len() as u64 > MAX_ENTRY_BYTES {
        return Err("Sign-in setting could not be saved".into());
    }
    match read_regular(path)? {
        Some(old) if owned(expected, &old) => return Ok(()),
        Some(_) => return Err("A different startup entry already exists".into()),
        None => (),
    }
    let parent = path.parent().ok_or("Sign-in setting could not be saved")?;
    fs::create_dir_all(parent).map_err(|_| "Sign-in setting could not be saved")?;
    ancestor_safe(path)?;
    let temp = path.with_extension(format!("tmp-{}", temp_nonce()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temp)
        .map_err(|_| "Sign-in setting could not be saved")?;
    let result = (|| -> Result<(), String> {
        file.write_all(expected)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Sign-in setting could not be saved")?;
        drop(file);
        publish_new(&temp, path)
    })();
    let _ = fs::remove_file(&temp);
    result
}

pub fn remove(path: &Path, expected: &[u8]) -> Result<(), String> {
    match read_regular(path)? {
        Some(bytes) if owned(expected, &bytes) => {
            // Recheck immediately before removal. This does not lock out a
            // hostile process running as the same user during unlink.
            if read_regular(path)?.as_deref() != Some(expected) {
                return Err("Startup entry changed; try again".into());
            }
            fs::remove_file(path).map_err(|_| "Sign-in setting could not be removed".into())
        }
        Some(_) => Err("A different startup entry already exists".into()),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn publication_does_not_replace_racing_entry() {
        let root = std::env::temp_dir().join(format!("sorafiles-publish-{}", temp_nonce()));
        fs::create_dir(&root).unwrap();
        let temp = root.join("tmp");
        let dest = root.join("entry");
        fs::write(&temp, b"ours").unwrap();
        fs::write(&dest, b"racing foreign entry").unwrap();
        assert!(publish_new(&temp, &dest).is_err());
        assert_eq!(fs::read(&dest).unwrap(), b"racing foreign entry");
        fs::remove_file(temp).unwrap();
        fs::remove_file(dest).unwrap();
        fs::remove_dir(root).unwrap();
    }
}
