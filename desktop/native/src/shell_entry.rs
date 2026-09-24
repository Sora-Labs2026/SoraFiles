//! Per-user Explorer registration governed by the persisted application preference.
//! Every mutation is one Windows registry transaction; unfamiliar data is untouched.
pub const fn capability() -> bool { cfg!(windows) }

#[cfg(not(windows))]
pub fn enabled() -> Result<bool, String> { Ok(false) }
#[cfg(not(windows))]
pub fn set_enabled(value: bool) -> Result<bool, String> {
    if value { Err("Explorer integration is available on Windows only".into()) } else { Ok(false) }
}
#[cfg(not(windows))]
pub fn remove_owned_entries() -> Result<(), String> { Ok(()) }

#[cfg(windows)]
mod windows {
    use std::{io, path::Path};
    use winreg::{enums::*, transaction::Transaction, types::ToRegValue, RegKey};

    const BASE: &str = r"Software\Classes\SystemFileAssociations";
    const VERB: &str = "SoraFilesDesktop";
    const OWNER: &str = "SoraFilesDesktop.Explorer.v1";
    const LABEL: &str = "Edit with SoraFiles";
    const LEGACY_LABEL: &str = "Open in SoraFiles";
    // Suggestions only: file contents are revalidated by the normal import path.
    const EXTENSIONS: &[&str] = &[".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff", ".psd", ".docx", ".xlsx", ".pptx", ".gif"];
    const UNAVAILABLE: &str = "Explorer setting could not be read or saved";
    const CONFLICT: &str = "Another installation or unfamiliar entry owns the SoraFiles Explorer setting. No entries were changed.";

    fn command(executable: &Path) -> Result<String, String> {
        let path = executable.to_str().ok_or("Application location is not supported")?;
        if !executable.is_absolute() || path.contains('"') || path.chars().any(char::is_control) {
            return Err("Application location is not supported".into());
        }
        Ok(format!("\"{path}\" --edit \"%1\""))
    }
    fn entry_path(base: &str, extension: &str) -> String {
        format!(r"{base}\{extension}\shell\{VERB}")
    }
    fn open(root: &RegKey, path: &str, tx: &Transaction) -> Result<Option<RegKey>, String> {
        match root.open_subkey_transacted_with_flags(path, tx, KEY_READ) {
            Ok(key) => Ok(Some(key)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err(UNAVAILABLE.into()),
        }
    }
    fn exact_values(key: &RegKey, expected: &[(&str, &str)]) -> Result<bool, String> {
        let values = key.enum_values().collect::<io::Result<Vec<_>>>().map_err(|_| UNAVAILABLE)?;
        Ok(values.len() == expected.len() && values.iter().all(|(name, value)| {
            expected.iter().any(|(wanted_name, wanted_value)| name.eq_ignore_ascii_case(wanted_name) && *value == wanted_value.to_reg_value())
        }))
    }
    fn exact_children(key: &RegKey, expected: &[&str]) -> Result<bool, String> {
        let names = key.enum_keys().collect::<io::Result<Vec<_>>>().map_err(|_| UNAVAILABLE)?;
        Ok(names.len() == expected.len() && names.iter().all(|name| expected.iter().any(|wanted| name.eq_ignore_ascii_case(wanted))))
    }
    #[derive(Clone, Copy, PartialEq, Eq)]
    enum Entry { Current, Legacy }
    fn matches_entry(key: &RegKey, label: &str, expected: &str, tx: &Transaction) -> Result<bool, String> {
        if !exact_values(key, &[("", label), ("SoraFilesOwner", OWNER), ("MultiSelectModel", "Single")])?
            || !exact_children(key, &["command"])? { return Ok(false); }
        let Some(child) = open(key, "command", tx)? else { return Ok(false); };
        Ok(exact_values(&child, &[("", expected)])? && exact_children(&child, &[])?)
    }
    fn owned(key: &RegKey, expected: &str, tx: &Transaction) -> Result<Option<Entry>, String> {
        if matches_entry(key, LABEL, expected, tx)? { return Ok(Some(Entry::Current)); }
        // Only the known previous command for this exact executable may migrate.
        // Never accept an arbitrary matching owner marker or another install path.
        if let Some(executable) = expected.strip_suffix(" --edit \"%1\"") {
            let legacy = format!("{executable} --open \"%1\"");
            if matches_entry(key, LEGACY_LABEL, &legacy, tx)? { return Ok(Some(Entry::Legacy)); }
        }
        Ok(None)
    }
    #[cfg(test)]
    fn state(root: &RegKey, base: &str, expected: &str) -> Result<bool, String> {
        let tx = Transaction::new().map_err(|_| UNAVAILABLE)?;
        let mut all = true;
        for extension in EXTENSIONS {
            match open(root, &entry_path(base, extension), &tx)? {
                Some(key) => match owned(&key, expected, &tx)? {
                    Some(Entry::Current) => {},
                    Some(Entry::Legacy) => all = false,
                    None => return Err(CONFLICT.into()),
                },
                None => all = false,
            }
        }
        Ok(all)
    }
    // fail_after supports deterministic failure after real writes in isolated tests.
    #[cfg(test)]
    fn update(root: &RegKey, base: &str, expected: &str, value: bool, fail_after: Option<usize>) -> Result<bool, String> {
        let tx = Transaction::new().map_err(|_| UNAVAILABLE)?;
        let result = (|| {
            // Complete ownership preflight, in the same transaction as all changes.
            let mut present = Vec::with_capacity(EXTENSIONS.len());
            for extension in EXTENSIONS {
                let path = entry_path(base, extension);
                let found = match open(root, &path, &tx)? {
                    Some(key) => Some(owned(&key, expected, &tx)?.ok_or_else(|| CONFLICT.to_string())?),
                    None => None,
                };
                present.push((path, found));
            }
            let mut writes = 0;
            for (path, found) in present {
                if value && found.is_none() {
                    let (key, disposition) = root.create_subkey_transacted(&path, &tx).map_err(|_| UNAVAILABLE)?;
                    if disposition != REG_CREATED_NEW_KEY { return Err(CONFLICT.into()); }
                    key.set_value("", &LABEL).map_err(|_| UNAVAILABLE)?;
                    key.set_value("SoraFilesOwner", &OWNER).map_err(|_| UNAVAILABLE)?;
                    key.set_value("MultiSelectModel", &"Single").map_err(|_| UNAVAILABLE)?;
                    let (child, disposition) = key.create_subkey_transacted("command", &tx).map_err(|_| UNAVAILABLE)?;
                    if disposition != REG_CREATED_NEW_KEY { return Err(CONFLICT.into()); }
                    child.set_value("", &expected).map_err(|_| UNAVAILABLE)?;
                    writes += 1;
                } else if value && found == Some(Entry::Legacy) {
                    let key = root.open_subkey_transacted_with_flags(&path, &tx, KEY_READ | KEY_WRITE).map_err(|_| UNAVAILABLE)?;
                    key.set_value("", &LABEL).map_err(|_| UNAVAILABLE)?;
                    let child = key.open_subkey_transacted_with_flags("command", &tx, KEY_SET_VALUE).map_err(|_| UNAVAILABLE)?;
                    child.set_value("", &expected).map_err(|_| UNAVAILABLE)?;
                    writes += 1;
                } else if !value && found.is_some() {
                    // Never recursively remove shared parents or unknown contents.
                    root.delete_subkey_transacted(format!(r"{path}\command"), &tx).map_err(|_| UNAVAILABLE)?;
                    root.delete_subkey_transacted(&path, &tx).map_err(|_| UNAVAILABLE)?;
                    writes += 1;
                }
                if fail_after.is_some_and(|limit| writes >= limit) { return Err(UNAVAILABLE.into()); }
            }
            Ok(value)
        })();
        match result {
            Ok(value) => { tx.commit().map_err(|_| UNAVAILABLE)?; Ok(value) },
            Err(error) => {
                // Roll back explicitly, with drop providing the final rollback on
                // any error. No nontransactional fallback is permitted.
                tx.rollback().map_err(|_| UNAVAILABLE)?;
                Err(error)
            },
        }
    }
    include!("explorer_registration.rs");
    pub fn enabled() -> Result<bool, String> {
        let expected = command(&std::env::current_exe().map_err(|_| "Application location unavailable")?)?;
        dynamic_state(&RegKey::predef(HKEY_CURRENT_USER), BASE, r"Software\Classes\CLSID", &expected, &dll_path()?)
    }
    fn notify_explorer() {
        // Ask Explorer to refresh associations after the complete commit.
        #[link(name = "shell32")]
        extern "system" { fn SHChangeNotify(event: i32, flags: u32, item1: *const std::ffi::c_void, item2: *const std::ffi::c_void); }
        unsafe { SHChangeNotify(0x08000000, 0, std::ptr::null(), std::ptr::null()); }
    }
    pub fn set_enabled(value: bool) -> Result<bool, String> {
        let expected = command(&std::env::current_exe().map_err(|_| "Application location unavailable")?)?;
        let dll = dll_path()?;
        if value && !Path::new(&dll).is_file() { return Err("File-manager component is missing. Reinstall SoraFiles.".into()); }
        let saved = dynamic_update(&RegKey::predef(HKEY_CURRENT_USER), BASE, r"Software\Classes\CLSID", &expected, &dll, value, false, None)?;
        notify_explorer();
        Ok(saved)
    }
    #[cfg(test)]
    fn remove_owned(root: &RegKey, base: &str, expected: &str, fail_after: Option<usize>) -> Result<(), String> {
        let tx = Transaction::new().map_err(|_| UNAVAILABLE)?;
        let result = (|| {
            let mut owned_paths = Vec::new();
            for extension in EXTENSIONS {
                let path = entry_path(base, extension);
                if let Some(key) = open(root, &path, &tx)? {
                    // Uninstall skips other installations and augmented entries;
                    // it must not prevent removal of this installation's files.
                    if owned(&key, expected, &tx)?.is_some() { owned_paths.push(path); }
                }
            }
            for (index, path) in owned_paths.iter().enumerate() {
                root.delete_subkey_transacted(format!(r"{path}\command"), &tx).map_err(|_| UNAVAILABLE)?;
                root.delete_subkey_transacted(path, &tx).map_err(|_| UNAVAILABLE)?;
                if fail_after.is_some_and(|limit| index + 1 >= limit) { return Err(UNAVAILABLE.to_string()); }
            }
            Ok(())
        })();
        match result {
            Ok(()) => tx.commit().map_err(|_| UNAVAILABLE.to_string()),
            Err(error) => { tx.rollback().map_err(|_| UNAVAILABLE)?; Err(error) },
        }
    }
    /// Uninstaller-only cleanup: remove exact-current entries, skip foreign ones.
    pub fn remove_owned_entries() -> Result<(), String> {
        let expected = command(&std::env::current_exe().map_err(|_| "Application location unavailable")?)?;
        dynamic_update(&RegKey::predef(HKEY_CURRENT_USER), BASE, r"Software\Classes\CLSID", &expected, &dll_path()?, false, true, None)?;
        notify_explorer();
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        struct Sandbox { root: RegKey, base: String }
        impl Sandbox {
            fn new() -> Self {
                let root = RegKey::predef(HKEY_CURRENT_USER);
                let base = format!(r"Software\SoraFilesTests\Explorer-{}", uuid::Uuid::new_v4());
                let (_, disposition) = root.create_subkey(&base).unwrap();
                assert_eq!(disposition, REG_CREATED_NEW_KEY);
                Self { root, base }
            }
            fn update(&self, enabled: bool) -> Result<bool, String> { update(&self.root, &self.base, expected(), enabled, None) }
            fn state(&self) -> Result<bool, String> { state(&self.root, &self.base, expected()) }
            fn verb(&self, extension: &str) -> RegKey { self.root.open_subkey_with_flags(entry_path(&self.base, extension), KEY_ALL_ACCESS).unwrap() }
        }
        impl Drop for Sandbox {
            fn drop(&mut self) {
                // Cleanup is restricted to this test's fresh UUID subtree. None
                // of the tests invoke production enabled()/set_enabled().
                let prefix = r"Software\SoraFilesTests\Explorer-";
                assert!(self.base.starts_with(prefix));
                assert!(uuid::Uuid::parse_str(&self.base[prefix.len()..]).is_ok());
                self.root.delete_subkey_all(&self.base).unwrap();
            }
        }
        fn expected() -> &'static str { r#""C:\Synthetic App\sorafiles.exe" --edit "%1""# }
        const TEST_DLL: &str = r"C:\Synthetic App\sorafiles-explorer.dll";
        #[test]
        fn dynamic_menu_transaction_works_inside_per_user_classes_hive() {
            let root=RegKey::predef(HKEY_CURRENT_USER);
            let base=format!(r"Software\Classes\SoraFilesTests-{}",uuid::Uuid::new_v4());
            let (_,disposition)=root.create_subkey(&base).unwrap();assert_eq!(disposition,REG_CREATED_NEW_KEY);
            let classes=format!(r"{base}\CLSID");
            let result=(||{
                update(&root,&base,expected(),true,None)?;
                dynamic_update(&root,&base,&classes,expected(),TEST_DLL,true,false,None)?;
                assert!(dynamic_state(&root,&base,&classes,expected(),TEST_DLL)?);
                dynamic_update(&root,&base,&classes,expected(),TEST_DLL,false,false,None)?;
                Ok::<(),String>(())
            })();
            assert!(base.starts_with(r"Software\Classes\SoraFilesTests-"));
            root.delete_subkey_all(&base).unwrap();result.unwrap();
        }
        fn dynamic(sandbox: &Sandbox, enable: bool, uninstall: bool, fail: Option<usize>) -> Result<bool, String> {
            dynamic_update(&sandbox.root, &sandbox.base, &format!(r"{}\CLSID", sandbox.base), expected(), TEST_DLL, enable, uninstall, fail)
        }
        fn dynamic_status(sandbox: &Sandbox) -> Result<bool, String> {
            dynamic_state(&sandbox.root, &sandbox.base, &format!(r"{}\CLSID", sandbox.base), expected(), TEST_DLL)
        }
        #[test]
        fn dynamic_menu_migrates_both_previous_versions_and_removes_class() {
            let sandbox = Sandbox::new();
            sandbox.update(true).unwrap(); make_legacy(&sandbox, ".pdf");
            assert!(!dynamic_status(&sandbox).unwrap());
            assert!(dynamic(&sandbox, true, false, Some(3)).is_err());
            assert_eq!(sandbox.verb(".pdf").get_value::<String,_>("").unwrap(), LEGACY_LABEL);
            assert!(sandbox.root.open_subkey(format!(r"{}\CLSID\{CLSID}", sandbox.base)).is_err());
            dynamic(&sandbox, true, false, None).unwrap();
            dynamic(&sandbox, true, false, None).unwrap();
            assert!(dynamic_status(&sandbox).unwrap());
            for extension in EXTENSIONS {
                assert_eq!(sandbox.verb(extension).get_value::<String,_>("MultiSelectModel").unwrap(), "Player");
                assert!(sandbox.verb(extension).open_subkey("command").is_err());
            }
            assert!(dynamic(&sandbox, false, false, Some(4)).is_err());
            assert!(dynamic_status(&sandbox).unwrap());
            dynamic(&sandbox, false, false, None).unwrap();
            assert!(!dynamic_status(&sandbox).unwrap());
            assert!(sandbox.root.open_subkey(format!(r"{}\CLSID\{CLSID}", sandbox.base)).is_err());
        }
        #[test]
        fn dynamic_menu_preserves_augmented_verbs_and_foreign_classes() {
            let sandbox = Sandbox::new();
            dynamic(&sandbox, true, false, None).unwrap();
            sandbox.verb(".gif").set_value("Keep", &"Unrelated").unwrap();
            assert!(dynamic(&sandbox, false, false, None).is_err());
            dynamic(&sandbox, false, true, None).unwrap();
            assert_eq!(sandbox.verb(".gif").get_value::<String,_>("Keep").unwrap(), "Unrelated");
            assert!(sandbox.root.open_subkey(format!(r"{}\CLSID\{CLSID}", sandbox.base)).is_ok());
            assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".pdf")).is_err());
            let other = Sandbox::new();
            let path = format!(r"{}\CLSID\{CLSID}", other.base);
            other.root.create_subkey(&path).unwrap().0.set_value("", &"Foreign").unwrap();
            assert!(dynamic(&other, true, false, None).is_err());
            dynamic(&other, false, true, None).unwrap();
            assert_eq!(other.root.open_subkey(path).unwrap().get_value::<String,_>("").unwrap(), "Foreign");
            assert!(other.root.open_subkey(entry_path(&other.base, ".pdf")).is_err());
        }
        fn make_legacy(sandbox: &Sandbox, extension: &str) {
            let key = sandbox.verb(extension);
            key.set_value("", &LEGACY_LABEL).unwrap();
            key.open_subkey_with_flags("command", KEY_SET_VALUE).unwrap()
                .set_value("", &r#""C:\Synthetic App\sorafiles.exe" --open "%1""#).unwrap();
        }
        #[test]
        fn explorer_migrates_exact_legacy_entries_atomically() {
            let sandbox = Sandbox::new();
            sandbox.update(true).unwrap();
            for extension in EXTENSIONS { make_legacy(&sandbox, extension); }
            assert!(!sandbox.state().unwrap());
            assert!(update(&sandbox.root, &sandbox.base, expected(), true, Some(4)).is_err());
            for extension in EXTENSIONS {
                assert_eq!(sandbox.verb(extension).get_value::<String, _>("").unwrap(), LEGACY_LABEL);
                assert!(sandbox.verb(extension).open_subkey("command").unwrap().get_value::<String, _>("").unwrap().contains(" --open "));
            }
            sandbox.update(true).unwrap();
            assert!(sandbox.state().unwrap());
            for extension in EXTENSIONS {
                assert_eq!(sandbox.verb(extension).get_value::<String, _>("").unwrap(), LABEL);
                assert_eq!(sandbox.verb(extension).open_subkey("command").unwrap().get_value::<String, _>("").unwrap(), expected());
            }
        }
        #[test]
        fn explorer_legacy_conflicts_block_migration_without_touching_siblings() {
            for augmented in [false, true] {
                let sandbox = Sandbox::new();
                sandbox.update(true).unwrap();
                for extension in EXTENSIONS { make_legacy(&sandbox, extension); }
                let foreign = sandbox.verb(".gif");
                if augmented { foreign.set_value("Extra", &"Keep").unwrap(); }
                else { foreign.open_subkey_with_flags("command", KEY_SET_VALUE).unwrap().set_value("", &r#""C:\Other\sorafiles.exe" --open "%1""#).unwrap(); }
                assert!(sandbox.update(true).is_err());
                assert!(sandbox.update(false).is_err());
                assert_eq!(sandbox.verb(".pdf").get_value::<String, _>("").unwrap(), LEGACY_LABEL);
                remove_owned(&sandbox.root, &sandbox.base, expected(), None).unwrap();
                assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".pdf")).is_err());
                assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".gif")).is_ok());
            }
        }
        #[test]
        fn explorer_disable_and_uninstall_remove_mixed_owned_versions() {
            let sandbox = Sandbox::new();
            sandbox.update(true).unwrap();
            make_legacy(&sandbox, ".pdf");
            assert!(update(&sandbox.root, &sandbox.base, expected(), false, Some(4)).is_err());
            assert_eq!(sandbox.verb(".pdf").get_value::<String, _>("").unwrap(), LEGACY_LABEL);
            sandbox.update(false).unwrap();
            for extension in EXTENSIONS { assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, extension)).is_err()); }
            sandbox.update(true).unwrap();
            make_legacy(&sandbox, ".pdf");
            assert!(remove_owned(&sandbox.root, &sandbox.base, expected(), Some(4)).is_err());
            assert_eq!(sandbox.verb(".pdf").get_value::<String, _>("").unwrap(), LEGACY_LABEL);
            remove_owned(&sandbox.root, &sandbox.base, expected(), None).unwrap();
            for extension in EXTENSIONS { assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, extension)).is_err()); }
        }
        #[test]
        fn explorer_command_quotes_literals_and_rejects_unsafe_paths() {
            assert_eq!(command(Path::new(r"C:\Synthetic App\sorafiles.exe")).unwrap(), expected());
            for path in ["relative.exe", "C:\\bad\"path.exe", "C:\\bad\npath.exe", "C:\\bad\0path.exe"] { assert!(command(Path::new(path)).is_err()); }
        }
        #[test]
        fn explorer_entries_are_opt_in_idempotent_and_preserve_shared_state() {
            let sandbox = Sandbox::new();
            let (shared, _) = sandbox.root.create_subkey(format!(r"{}\.pdf\shell\OtherApplication", sandbox.base)).unwrap();
            shared.set_value("", &"Keep this entry").unwrap();
            assert!(!sandbox.state().unwrap());
            assert!(sandbox.update(true).unwrap());
            assert!(sandbox.update(true).unwrap());
            assert!(sandbox.state().unwrap());
            for extension in EXTENSIONS {
                let cmd = sandbox.verb(extension).open_subkey("command").unwrap();
                assert_eq!(cmd.get_value::<String, _>("").unwrap(), expected());
            }
            assert!(!sandbox.update(false).unwrap());
            assert!(!sandbox.update(false).unwrap());
            assert!(!sandbox.state().unwrap());
            assert_eq!(shared.get_value::<String, _>("").unwrap(), "Keep this entry");
        }
        #[test]
        fn explorer_foreign_or_augmented_entries_are_never_changed() {
            for modification in ["command", "extra-value", "extra-child", "marker", "type"] {
                let sandbox = Sandbox::new();
                sandbox.update(true).unwrap();
                let key = sandbox.verb(".pptx");
                match modification {
                    "command" => key.open_subkey_with_flags("command", KEY_SET_VALUE).unwrap().set_value("", &"different installation").unwrap(),
                    "extra-value" => key.set_value("Unrelated", &"Keep").unwrap(),
                    "extra-child" => { key.create_subkey("Unrelated").unwrap(); },
                    "marker" => key.delete_value("SoraFilesOwner").unwrap(),
                    "type" => key.set_raw_value("", &winreg::RegValue { bytes: LABEL.to_reg_value().bytes, vtype: REG_EXPAND_SZ }).unwrap(),
                    _ => unreachable!(),
                }
                assert!(sandbox.state().is_err());
                assert!(sandbox.update(true).is_err());
                assert!(sandbox.update(false).is_err());
                // A later conflicting extension cannot cause earlier removals.
                assert_eq!(sandbox.verb(".pdf").get_value::<String, _>("SoraFilesOwner").unwrap(), OWNER);
                match modification {
                    "command" => assert_eq!(key.open_subkey("command").unwrap().get_value::<String, _>("").unwrap(), "different installation"),
                    "extra-value" => assert_eq!(key.get_value::<String, _>("Unrelated").unwrap(), "Keep"),
                    "extra-child" => assert!(key.open_subkey("Unrelated").is_ok()),
                    "marker" => assert!(key.get_raw_value("SoraFilesOwner").is_err()),
                    "type" => assert_eq!(key.get_raw_value("").unwrap().vtype, REG_EXPAND_SZ),
                    _ => unreachable!(),
                }
            }
        }
        #[test]
        fn explorer_partial_mutations_roll_back_as_one_transaction() {
            let sandbox = Sandbox::new();
            assert!(update(&sandbox.root, &sandbox.base, expected(), true, Some(4)).is_err());
            for extension in EXTENSIONS { assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, extension)).is_err()); }
            sandbox.update(true).unwrap();
            assert!(update(&sandbox.root, &sandbox.base, expected(), false, Some(4)).is_err());
            assert!(sandbox.state().unwrap());
            // Missing one entry is not reported as fully enabled; an explicit
            // enable can repair that gap without replacing owned siblings.
            sandbox.root.delete_subkey_all(entry_path(&sandbox.base, ".gif")).unwrap();
            assert!(!sandbox.state().unwrap());
            assert!(sandbox.update(true).unwrap());
            assert!(sandbox.state().unwrap());
        }
        #[test]
        fn explorer_preexisting_empty_or_foreign_key_blocks_creation() {
            let sandbox = Sandbox::new();
            sandbox.root.create_subkey(entry_path(&sandbox.base, ".gif")).unwrap();
            assert!(sandbox.update(true).is_err());
            assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".pdf")).is_err());
            assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".gif")).is_ok());
        }
        #[test]
        fn explorer_uninstall_removes_only_exact_owned_entries_and_rolls_back_failures() {
            let sandbox = Sandbox::new();
            sandbox.update(true).unwrap();
            let foreign_command = r#""C:\Other installation\sorafiles.exe" --open "%1""#;
            sandbox.verb(".pptx").open_subkey_with_flags("command", KEY_SET_VALUE).unwrap().set_value("", &foreign_command).unwrap();
            sandbox.verb(".gif").set_value("Unrelated", &"Keep this value").unwrap();
            // Settings retain the strict all-or-nothing ownership policy.
            assert!(sandbox.update(false).is_err());
            assert!(remove_owned(&sandbox.root, &sandbox.base, expected(), Some(3)).is_err());
            assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, ".pdf")).is_ok());
            remove_owned(&sandbox.root, &sandbox.base, expected(), None).unwrap();
            for extension in EXTENSIONS {
                if ![".pptx", ".gif"].contains(extension) {
                    assert!(sandbox.root.open_subkey(entry_path(&sandbox.base, extension)).is_err());
                }
            }
            assert_eq!(sandbox.verb(".pptx").open_subkey("command").unwrap().get_value::<String, _>("").unwrap(), foreign_command);
            assert_eq!(sandbox.verb(".gif").get_value::<String, _>("Unrelated").unwrap(), "Keep this value");
            remove_owned(&sandbox.root, &sandbox.base, expected(), None).unwrap();
        }
    }
}
#[cfg(windows)]
pub use windows::{enabled, remove_owned_entries, set_enabled};
