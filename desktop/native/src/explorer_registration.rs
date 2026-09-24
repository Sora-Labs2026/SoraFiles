// Included inside shell_entry::windows to share strict legacy ownership checks.
const CLSID: &str = "{F482B896-7D0B-4C12-9832-5B6D326139A7}";
const DLL_NAME: &str = "sorafiles-explorer.dll";

fn dynamic_owned(key: &RegKey, expected: &str) -> Result<bool, String> {
    Ok(exact_values(key, &[("", LABEL), ("SoraFilesOwner", OWNER),
        ("SoraFilesExecutable", expected), ("MultiSelectModel", "Player"),
        ("ExplorerCommandHandler", CLSID)])? && exact_children(key, &[])?)
}
fn class_owned(key: &RegKey, dll: &str, tx: &Transaction) -> Result<bool, String> {
    if !exact_values(key, &[("", LABEL), ("SoraFilesOwner", OWNER)])?
        || !exact_children(key, &["InprocServer32"])? { return Ok(false); }
    let Some(server) = open(key, "InprocServer32", tx)? else { return Ok(false); };
    Ok(exact_values(&server, &[("", dll), ("ThreadingModel", "Both")])? && exact_children(&server, &[])?)
}
fn dll_path() -> Result<String, String> {
    let executable = std::env::current_exe().map_err(|_| UNAVAILABLE)?;
    executable.parent().ok_or(UNAVAILABLE)?.join(DLL_NAME).to_str()
        .map(str::to_owned).ok_or_else(|| UNAVAILABLE.into())
}
fn dynamic_state(root: &RegKey, base: &str, classes: &str, expected: &str, dll: &str) -> Result<bool, String> {
    let tx = Transaction::new().map_err(|_| UNAVAILABLE)?;
    let mut all = true;
    match open(root, &format!(r"{classes}\{CLSID}"), &tx)? {
        Some(key) => if !class_owned(&key, dll, &tx)? { return Err(CONFLICT.into()); },
        None => all = false,
    }
    for extension in EXTENSIONS {
        match open(root, &entry_path(base, extension), &tx)? {
            Some(key) if dynamic_owned(&key, expected)? => {},
            Some(key) if owned(&key, expected, &tx)?.is_some() => all = false,
            Some(_) => return Err(CONFLICT.into()),
            None => all = false,
        }
    }
    Ok(all)
}
// Creation, migration and removal of the COM class and all verbs commit together.
// Uninstall skips augmented/foreign verbs and retains their referenced class.
fn dynamic_update(root: &RegKey, base: &str, classes: &str, expected: &str, dll: &str,
                  enable: bool, uninstall: bool, fail_after: Option<usize>) -> Result<bool, String> {
    let tx = Transaction::new().map_err(|_| UNAVAILABLE)?;
    let result = (|| {
        let class_path = format!(r"{classes}\{CLSID}");
        let class = open(root, &class_path, &tx)?;
        let own_class = match &class { Some(key) => class_owned(key, dll, &tx)?, None => false };
        if class.is_some() && !own_class && !uninstall { return Err(CONFLICT.to_string()); }
        let mut entries = Vec::new();
        let mut foreign = false;
        for extension in EXTENSIONS {
            let path = entry_path(base, extension);
            let (exists, dynamic, legacy) = match open(root, &path, &tx)? {
                Some(key) => (true, dynamic_owned(&key, expected)?, owned(&key, expected, &tx)?.is_some()),
                None => (false, false, false),
            };
            if exists && !dynamic && !legacy {
                if !uninstall { return Err(CONFLICT.to_string()); }
                foreign = true; continue;
            }
            entries.push((path, exists, dynamic, legacy));
        }
        let mut writes = 0;
        if enable && !own_class {
            let (key, disposition) = root.create_subkey_transacted(&class_path, &tx).map_err(|_| UNAVAILABLE)?;
            if disposition != REG_CREATED_NEW_KEY { return Err(CONFLICT.into()); }
            key.set_value("", &LABEL).map_err(|_| UNAVAILABLE)?;
            key.set_value("SoraFilesOwner", &OWNER).map_err(|_| UNAVAILABLE)?;
            let (server, _) = key.create_subkey_transacted("InprocServer32", &tx).map_err(|_| UNAVAILABLE)?;
            server.set_value("", &dll).map_err(|_| UNAVAILABLE)?;
            server.set_value("ThreadingModel", &"Both").map_err(|_| UNAVAILABLE)?;
        }
        for (path, exists, dynamic, legacy) in entries {
            if enable && dynamic { continue; }
            if exists {
                if legacy { root.delete_subkey_transacted(format!(r"{path}\command"), &tx).map_err(|_| UNAVAILABLE)?; }
                root.delete_subkey_transacted(&path, &tx).map_err(|_| UNAVAILABLE)?;
            }
            if enable {
                let (key, disposition) = root.create_subkey_transacted(&path, &tx).map_err(|_| UNAVAILABLE)?;
                if disposition != REG_CREATED_NEW_KEY { return Err(CONFLICT.into()); }
                for (name, value) in [("", LABEL), ("SoraFilesOwner", OWNER), ("SoraFilesExecutable", expected),
                    ("MultiSelectModel", "Player"), ("ExplorerCommandHandler", CLSID)] {
                    key.set_value(name, &value).map_err(|_| UNAVAILABLE)?;
                }
            }
            writes += 1;
            if fail_after.is_some_and(|limit| writes >= limit) { return Err(UNAVAILABLE.into()); }
        }
        if !enable && own_class && !foreign {
            root.delete_subkey_transacted(format!(r"{class_path}\InprocServer32"), &tx).map_err(|_| UNAVAILABLE)?;
            root.delete_subkey_transacted(class_path, &tx).map_err(|_| UNAVAILABLE)?;
        }
        Ok(enable)
    })();
    match result {
        Ok(value) => { tx.commit().map_err(|_| UNAVAILABLE)?; Ok(value) },
        Err(error) => { tx.rollback().map_err(|_| UNAVAILABLE)?; Err(error) },
    }
}
