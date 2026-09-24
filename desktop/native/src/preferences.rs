use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs::{self, OpenOptions}, io::{Read, Write}, path::{Path, PathBuf}};
use uuid::Uuid;

// Ordinary preferences only. License keys, device secrets and entitlements must
// use their separate protected storage boundary and never enter this file.
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Preferences {
    version: u32,
    output: String,
    theme: String,
    #[serde(rename = "customFolder", default, skip_serializing_if = "Option::is_none")]
    custom_folder: Option<PathBuf>,
    // None means the user has never chosen; preserve explicit false on upgrades.
    #[serde(rename = "shellEntry", default, skip_serializing_if = "Option::is_none")]
    shell_entry: Option<bool>,
}
impl Default for Preferences {
    fn default() -> Self { Self { version: 1, output: "source".into(), theme: "system".into(), custom_folder: None, shell_entry: None } }
}
impl Preferences {
    fn validate(&self) -> Result<(), &'static str> {
        if self.version != 1 || !matches!(self.output.as_str(), "source" | "downloads" | "custom" | "ask")
            || !matches!(self.theme.as_str(), "system" | "light" | "dark") { return Err("Invalid settings"); }
        if let Some(path) = &self.custom_folder {
            let text = path.to_string_lossy();
            if !path.is_absolute() || text.len() > 8192 || text.starts_with("\\\\") || text.starts_with("//") || text.chars().any(char::is_control) {
                return Err("Choose a local output folder");
            }
        }
        Ok(())
    }
    pub fn value(&self) -> Value {
        let mut value = json!({"output":self.output,"theme":self.theme,"startup":false});
        if let Some(folder) = &self.custom_folder { value["customFolder"] = json!(folder); }
        if let Some(enabled) = self.shell_entry { value["shellEntry"] = json!(enabled); }
        value
    }
    pub fn from_value(value: &Value) -> Result<Self, &'static str> {
        let settings: Self = serde_json::from_value(json!({"version":1,"output":value["output"],"theme":value["theme"],"customFolder":value.get("customFolder"),"shellEntry":value.get("shellEntry")})).map_err(|_| "Invalid settings")?;
        settings.validate()?; Ok(settings)
    }
}
fn ordinary(path: &Path, directory: bool) -> Result<(), &'static str> {
    let metadata = fs::symlink_metadata(path).map_err(|_| "Settings unavailable")?;
    if metadata.file_type().is_symlink() || (directory && !metadata.is_dir()) || (!directory && !metadata.is_file()) { return Err("Settings location unavailable"); }
    #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if metadata.file_attributes() & 0x400 != 0 { return Err("Settings location unavailable"); } }
    Ok(())
}
pub fn load(directory: &Path) -> Result<Preferences, &'static str> {
    let file = directory.join("preferences.json");
    if !file.try_exists().map_err(|_| "Settings unavailable")? { return Ok(Preferences::default()); }
    ordinary(directory, true)?; ordinary(&file, false)?;
    let mut bytes = Vec::new();
    fs::File::open(file).map_err(|_| "Settings unavailable")?.take(16385).read_to_end(&mut bytes).map_err(|_| "Settings unavailable")?;
    if bytes.len() > 16384 { return Err("Settings are too large"); }
    let value: Preferences = serde_json::from_slice(&bytes).map_err(|_| "Saved settings could not be read")?;
    value.validate()?; Ok(value)
}
pub fn save(directory: &Path, value: &Preferences) -> Result<(), &'static str> {
    value.validate()?;
    fs::create_dir_all(directory).map_err(|_| "Settings folder unavailable")?;
    ordinary(directory, true)?;
    let destination = directory.join("preferences.json");
    if destination.try_exists().map_err(|_| "Settings unavailable")? { ordinary(&destination, false)?; }
    let temporary = directory.join(format!("preferences-{}.tmp", Uuid::new_v4()));
    let result = (|| {
        let mut options = OpenOptions::new(); options.write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&temporary).map_err(|_| "Settings could not be saved")?;
        let bytes = serde_json::to_vec(value).map_err(|_| "Settings could not be saved")?;
        file.write_all(&bytes).and_then(|_| file.sync_all()).map_err(|_| "Settings could not be saved")?;
        drop(file);
        fs::rename(&temporary, &destination).map_err(|_| "Settings could not be saved")?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

#[cfg(test)] mod tests {
    use super::*;
    fn directory() -> PathBuf { let path=std::env::temp_dir().join(format!("sorafiles-preferences-{}",Uuid::new_v4()));fs::create_dir(&path).unwrap();path }
    #[test] fn preferences_survive_replacement_without_persisting_license_material() {
        let dir=directory();let mut value=Preferences::default().value();value["theme"]=json!("dark");value["licenseKey"]=json!("must-not-persist");
        save(&dir,&Preferences::from_value(&value).unwrap()).unwrap();assert_eq!(load(&dir).unwrap().value()["theme"],"dark");
        value["output"]=json!("custom");value["customFolder"]=json!(dir.join("outputs"));
        save(&dir,&Preferences::from_value(&value).unwrap()).unwrap();assert_eq!(load(&dir).unwrap().value()["output"],"custom");
        let bytes=fs::read_to_string(dir.join("preferences.json")).unwrap();assert!(!bytes.contains("must-not-persist"));assert_eq!(fs::read_dir(&dir).unwrap().count(),1);
        fs::remove_file(dir.join("preferences.json")).unwrap();fs::remove_dir(dir).unwrap();
    }
    #[test] fn malformed_or_injected_preferences_fail_without_replacing_the_file() {
        let dir=directory();let file=dir.join("preferences.json");
        for bytes in [b"not json".to_vec(),vec![b'x';16385],br#"{"version":1,"output":"source","theme":"system","license":"paid"}"#.to_vec(),br#"{"version":2,"output":"source","theme":"system"}"#.to_vec()] {
            fs::write(&file,&bytes).unwrap();assert!(load(&dir).is_err());assert_eq!(fs::read(&file).unwrap(),bytes);
        }
        assert!(Preferences::from_value(&json!({"output":"source","theme":"unknown"})).is_err());
        assert!(Preferences::from_value(&json!({"output":"custom","theme":"light","customFolder":"relative"})).is_err());
        fs::remove_file(file).unwrap();fs::remove_dir(dir).unwrap();
    }
    #[test] fn failed_save_keeps_the_existing_destination() {
        let dir=directory();let destination=dir.join("preferences.json");fs::create_dir(&destination).unwrap();
        assert!(save(&dir,&Preferences::default()).is_err());assert!(destination.is_dir());assert_eq!(fs::read_dir(&dir).unwrap().count(),1);
        fs::remove_dir(destination).unwrap();fs::remove_dir(dir).unwrap();
    }
    #[test] fn integration_preference_distinguishes_unset_from_explicit_disabled() {
        let dir=directory();
        assert!(load(&dir).unwrap().value().get("shellEntry").is_none());
        fs::write(dir.join("preferences.json"),br#"{"version":1,"output":"source","theme":"system"}"#).unwrap();
        assert!(load(&dir).unwrap().value().get("shellEntry").is_none());
        let mut value=load(&dir).unwrap().value();value["shellEntry"]=json!(false);
        save(&dir,&Preferences::from_value(&value).unwrap()).unwrap();
        assert_eq!(load(&dir).unwrap().value()["shellEntry"],false);
        value["theme"]=json!("dark");save(&dir,&Preferences::from_value(&value).unwrap()).unwrap();
        assert_eq!(load(&dir).unwrap().value()["shellEntry"],false);
        value["shellEntry"]=json!(true);save(&dir,&Preferences::from_value(&value).unwrap()).unwrap();
        assert_eq!(load(&dir).unwrap().value()["shellEntry"],true);
        fs::remove_file(dir.join("preferences.json")).unwrap();fs::remove_dir(dir).unwrap();
    }
}
