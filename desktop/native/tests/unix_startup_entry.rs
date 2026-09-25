//! Run with cargo test --test unix_startup_entry on every CI host.
#[path = "../src/unix_startup_entry.rs"]
mod entry;
use std::{fs, path::PathBuf};

fn nonce() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |value| value.as_nanos())
    )
}

// Independent parser for the two Desktop Entry stages: general string escapes,
// followed by Exec argument quoting/field expansion. Reject extra arguments.
fn parse_exec(value: &str) -> Vec<String> {
    let mut chars = value.chars();
    let mut unescaped = String::new();
    while let Some(ch) = chars.next() {
        unescaped.push(if ch == '\\' {
            match chars.next().expect("incomplete string escape") {
                '\\' => '\\',
                '"' => '"',
                's' => ' ',
                'n' => '\n',
                't' => '\t',
                'r' => '\r',
                other => panic!("invalid general escape {other}"),
            }
        } else {
            ch
        });
    }
    let mut chars = unescaped.chars().peekable();
    let mut quoted = false;
    let mut token = String::new();
    let mut args = Vec::new();
    while let Some(ch) = chars.next() {
        match ch {
            '"' => quoted = !quoted,
            '\\' if quoted => {
                let escaped = chars.next().expect("incomplete Exec escape");
                assert!(matches!(escaped, '"' | '\\' | '$' | '`'));
                token.push(escaped);
            }
            '$' | '`' if quoted => panic!("unescaped special character"),
            '%' => {
                assert_eq!(chars.next(), Some('%'), "field code injection");
                token.push('%');
            }
            ' ' if !quoted => {
                if !token.is_empty() {
                    args.push(std::mem::take(&mut token));
                }
            }
            other => token.push(other),
        }
    }
    assert!(!quoted);
    if !token.is_empty() {
        args.push(token);
    }
    args
}

#[test]
fn desktop_exec_roundtrips_reserved_characters_without_extra_arguments() {
    for path in [r#"/opt/Sora Files/a\b"$`%%F';&(猫).AppImage"#, "/opt/plain"] {
        let bytes = entry::render(entry::Platform::Linux, path).unwrap();
        let text = String::from_utf8(bytes).unwrap();
        let exec = text
            .lines()
            .find_map(|line| line.strip_prefix("Exec="))
            .unwrap();
        assert_eq!(parse_exec(exec), [path, "--background"]);
    }
}

struct Temp(PathBuf);
impl Temp {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("sorafiles-startup-test-{}", nonce()));
        fs::create_dir(&path).unwrap();
        #[cfg(unix)]
        let path = fs::canonicalize(path).unwrap();
        Self(path)
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn create_repeat_and_remove_owned_entry() {
    let temp = Temp::new();
    let file = temp.0.join("nested/startup");
    let expected = entry::render(entry::Platform::Linux, "/opt/sorafiles").unwrap();
    entry::replace(&file, &expected).unwrap();
    assert_eq!(entry::read_regular(&file).unwrap(), Some(expected.clone()));
    entry::replace(&file, &expected).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
    entry::remove(&file, &expected).unwrap();
    assert!(!file.exists());
    entry::remove(&file, &expected).unwrap();
}

#[test]
fn preserve_foreign_edits_including_canonical_executable_and_xml_injection() {
    let temp = Temp::new();
    let file = temp.0.join("startup");
    for platform in [entry::Platform::Mac, entry::Platform::Linux] {
        let expected = entry::render(platform, "/opt/sorafiles").unwrap();
        let original = String::from_utf8(expected.clone()).unwrap();
        for foreign in [
            original.replace("/opt/sorafiles", "/opt/other"),
            format!("{original}Extra=true\n"),
            original.replace("/opt/sorafiles", "/opt/sorafiles</string><string>extra"),
        ] {
            fs::write(&file, foreign.as_bytes()).unwrap();
            assert!(!entry::owned(&expected, foreign.as_bytes()));
            assert!(entry::replace(&file, &expected).is_err());
            assert!(entry::remove(&file, &expected).is_err());
            assert_eq!(fs::read(&file).unwrap(), foreign.as_bytes());
        }
    }
}

#[test]
fn reject_large_entries_and_nonregular_destinations() {
    let temp = Temp::new();
    let file = temp.0.join("startup");
    let expected = entry::render(entry::Platform::Linux, "/opt/sorafiles").unwrap();
    fs::write(&file, vec![b'x'; 65537]).unwrap();
    assert!(entry::read_regular(&file).is_err());
    assert!(entry::replace(&file, &expected).is_err());
    assert!(entry::remove(&file, &expected).is_err());
    fs::remove_file(&file).unwrap();
    fs::create_dir(&file).unwrap();
    assert!(entry::read_regular(&file).is_err());
    assert!(entry::replace(&file, &expected).is_err());
    assert!(entry::replace(&file.join("..").join("escape"), &expected).is_err());
}

#[test]
fn reject_invalid_executable_and_escape_xml() {
    for path in ["relative", "", "/a\nb", "/a\0b"] {
        assert!(entry::render(entry::Platform::Linux, path).is_err());
    }
    let text =
        String::from_utf8(entry::render(entry::Platform::Mac, "/opt/a&<>'\"").unwrap()).unwrap();
    assert!(text.contains("/opt/a&amp;&lt;&gt;&apos;&quot;"));
}

#[cfg(unix)]
#[test]
fn refuse_entry_symlinks_and_symlink_ancestors() {
    use std::os::unix::fs::symlink;
    let temp = Temp::new();
    let target = temp.0.join("target");
    let link = temp.0.join("link");
    let expected = entry::render(entry::Platform::Linux, "/opt/sorafiles").unwrap();
    fs::write(&target, &expected).unwrap();
    symlink(&target, &link).unwrap();
    assert!(entry::read_regular(&link).is_err());
    assert!(entry::replace(&link, &expected).is_err());
    assert!(entry::remove(&link, &expected).is_err());
    assert_eq!(fs::read(&target).unwrap(), expected);
    fs::remove_file(&link).unwrap();
    let directory = temp.0.join("directory");
    fs::create_dir(&directory).unwrap();
    symlink(&directory, &link).unwrap();
    assert!(entry::replace(&link.join("startup"), &expected).is_err());
    assert!(!directory.join("startup").exists());
}
