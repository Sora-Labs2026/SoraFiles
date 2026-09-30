//! Windows job-scoped input and directory handles. Publication uses the native
//! staging verification/rename boundary while these ancestors remain pinned.
use std::{collections::HashSet, fs::{File, OpenOptions}, os::windows::fs::{MetadataExt, OpenOptionsExt}, path::{Component, Path, PathBuf, Prefix}};
use serde_json::Value;

#[derive(Default)]
pub struct FilePins { handles: Vec<File>, directories: HashSet<PathBuf> }

impl FilePins {
    pub fn for_request(params: &Value) -> Result<Self, &'static str> {
        let paths = params["paths"].as_array().ok_or("Choose local files first")?;
        if paths.is_empty() || paths.len() > 256 { return Err("Choose fewer files for this job"); }
        let mut pins = Self::default();
        for value in paths {
            let path = Path::new(value.as_str().ok_or("Choose local files first")?);
            validate_path(path)?;
            pins.directory(path.parent().ok_or("Choose a local file")?)?;
            // READ sharing permits the engine to read, but denies other writers
            // and deletion/renaming, including through another hard-link name.
            let file = OpenOptions::new().read(true).share_mode(1)
                .custom_flags(0x00200000).open(path)
                .map_err(|_| "Input unavailable or being edited. Close its editor and try again.")?;
            let info = file.metadata().map_err(|_| "Input unavailable")?;
            if !info.is_file() || info.file_attributes() & 0x400 != 0 || info.len() == 0 || info.len() > 512 * 1024 * 1024 {
                return Err("Choose an ordinary local input file");
            }
            pins.handles.push(file);
        }
        if let Some(folder) = params.get("folder").filter(|folder| !folder.is_null()) {
            pins.directory(Path::new(folder.as_str().ok_or("Choose a local output folder")?))?;
        }
        Ok(pins)
    }

    fn directory(&mut self, path: &Path) -> Result<(), &'static str> {
        validate_path(path)?;
        let mut current = PathBuf::new();
        for component in path.components() {
            current.push(component);
            if matches!(component, Component::Prefix(_)) { continue; }
            if matches!(component, Component::RootDir) {
                use std::os::windows::ffi::OsStrExt;
                #[link(name="kernel32")] unsafe extern "system" { fn GetDriveTypeW(root: *const u16) -> u32; }
                let root: Vec<u16> = current.as_os_str().encode_wide().chain(Some(0)).collect();
                // A drive letter can point to a network share. Only removable,
                // fixed and RAM local volumes are eligible for this boundary.
                if !matches!(unsafe { GetDriveTypeW(root.as_ptr()) }, 2 | 3 | 6) { return Err("Choose a local drive, not a mapped network folder"); }
            }
            if self.directories.contains(&current) { continue; }
            if self.handles.len() >= 8192 { return Err("Choose fewer or shallower file paths"); }
            // Open each ancestor without following a final reparse point. The
            // already-open parent cannot be renamed before its child is opened.
            // No DELETE sharing: hold the directory chain in place for the job.
            // Metadata-only access (0) does not participate in Windows sharing
            // checks and allowed an empty directory rename in the actual test.
            let file = OpenOptions::new().read(true).share_mode(3)
                .custom_flags(0x02000000 | 0x00200000).open(&current)
                .map_err(|_| "Local folder unavailable or being moved")?;
            let info = file.metadata().map_err(|_| "Local folder unavailable")?;
            if !info.is_dir() || info.file_attributes() & 0x400 != 0 { return Err("Choose a local folder without links or reparse points"); }
            self.handles.push(file);
            self.directories.insert(current.clone());
        }
        Ok(())
    }
}

fn validate_path(path: &Path) -> Result<(), &'static str> {
    if !path.is_absolute() || path.as_os_str().len() > 32767 { return Err("Choose a local absolute path"); }
    let mut parts = path.components();
    if !matches!(parts.next(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), Prefix::Disk(_))) {
        return Err("Choose a local drive path");
    }
    for part in parts {
        match part {
            Component::RootDir => {},
            Component::Normal(name) => {
                let name = name.to_str().ok_or("Unsupported file name")?;
                let stem = name.split('.').next().unwrap_or_default().to_ascii_uppercase();
                if name.contains([':', '<', '>', '"', '|', '?', '*']) || name.chars().any(char::is_control)
                    || name.ends_with(['.', ' ']) || matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$")
                    || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit()) {
                    return Err("Choose an ordinary local file name");
                }
            },
            _ => return Err("Choose a path without parent traversal"),
        }
    }
    Ok(())
}

#[cfg(test)] mod tests {
    use super::*;
    use std::fs;
    use serde_json::json;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("sorafiles-pins-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap(); Self(path)
        }
        fn input(&self) -> PathBuf {
            let path = self.0.join("input.pdf"); fs::write(&path, b"synthetic input").unwrap(); path
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

    #[test] fn pins_deny_input_mutation_and_ancestor_moves_then_release() {
        let fixture = Fixture::new(); let source = fixture.input();
        let folder = fixture.0.join("destination"); fs::create_dir(&folder).unwrap();
        let pins = FilePins::for_request(&json!({"paths":[source],"folder":folder})).unwrap();
        assert_eq!(fs::read(&source).unwrap(), b"synthetic input");
        assert!(fs::write(&source, b"changed").is_err());
        assert!(fs::remove_file(&source).is_err());
        assert!(fs::rename(&source, fixture.0.join("moved.pdf")).is_err());
        assert!(fs::rename(&folder, fixture.0.join("moved-folder")).is_err());
        assert!(fs::rename(&fixture.0, fixture.0.with_extension("moved")).is_err());
        // Creating and publishing child files is still permitted.
        let staging = folder.join("staging.tmp"); let saved = folder.join("saved.pdf");
        fs::write(&staging, b"output").unwrap(); fs::rename(staging, &saved).unwrap();
        drop(pins);
        fs::write(&source, b"changed").unwrap(); fs::remove_file(source).unwrap();
        fs::rename(&folder, fixture.0.join("moved-folder")).unwrap();
    }

    #[test] fn errors_release_prior_pins_and_existing_writers_are_refused() {
        let fixture = Fixture::new(); let source = fixture.input();
        assert!(FilePins::for_request(&json!({"paths":[source,fixture.0.join("missing.pdf")]})).is_err());
        fs::write(&source, b"unchanged").unwrap();
        let writer = OpenOptions::new().write(true).open(&source).unwrap();
        assert!(FilePins::for_request(&json!({"paths":[source]})).is_err()); drop(writer);
        assert!(FilePins::for_request(&json!({"paths":[source],"folder":fixture.0.join("missing-folder")})).is_err());
        fs::remove_file(source).unwrap();
    }

    #[test] fn device_network_and_traversal_paths_are_refused() {
        for path in [r"relative.pdf", r"C:relative.pdf", r"\\server\share\input.pdf", r"\\?\C:\input.pdf", r"C:\folder\..\input.pdf", r"C:\input.pdf:secret", r"C:\NUL.pdf", r"C:\folder.\input.pdf"] {
            assert!(validate_path(Path::new(path)).is_err(), "{path}");
        }
    }

    #[test] fn hard_link_writes_are_denied_for_the_held_input() {
        let fixture = Fixture::new(); let source = fixture.input(); let alias = fixture.0.join("alias.pdf");
        fs::hard_link(&source, &alias).unwrap();
        let pins = FilePins::for_request(&json!({"paths":[source]})).unwrap();
        assert!(fs::write(&alias, b"changed").is_err()); drop(pins);
        fs::write(alias, b"changed").unwrap();
    }

    #[test] fn junction_ancestors_and_destinations_are_refused() {
        use std::os::windows::process::CommandExt;
        let fixture = Fixture::new(); let source = fixture.input(); let alias = fixture.0.join("junction");
        let status = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; $null=New-Item -ItemType Junction -Path $env:SORA_PIN_TEST_ALIAS -Target $env:SORA_PIN_TEST_TARGET"])
            .env("SORA_PIN_TEST_ALIAS", &alias).env("SORA_PIN_TEST_TARGET", &fixture.0)
            .creation_flags(0x08000000).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null())
            .status().unwrap();
        assert!(status.success(), "Synthetic junction creation must succeed for this test");
        assert!(FilePins::for_request(&json!({"paths":[alias.join("input.pdf")]})).is_err());
        assert!(FilePins::for_request(&json!({"paths":[source],"folder":alias})).is_err());
        fs::remove_dir(&alias).unwrap(); fs::write(source, b"released").unwrap();
    }
}
