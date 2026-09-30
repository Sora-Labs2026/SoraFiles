//! Per-user Windows login startup. Fresh installs opt in once; upgrades and
//! Windows Startup Apps opt-outs are never silently re-enabled.
use std::path::Path;
use winreg::{RegKey,enums::{HKEY_CURRENT_USER,KEY_READ,KEY_SET_VALUE}};
const KEY:&str=r"Software\Microsoft\Windows\CurrentVersion\Run";
const NAME:&str="SoraFilesDesktop";
const APPROVED_KEY:&str=r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
fn approval_allows_startup(key:Option<&RegKey>)->Result<bool,String>{
    let Some(key)=key else{return Ok(true);};
    match key.get_raw_value(NAME){
        // Windows owns this metadata. Read it conservatively, never rewrite it.
        Ok(value)=>Ok(value.vtype==winreg::enums::REG_BINARY && value.bytes.len()==12 && matches!(value.bytes[0],2|6)),
        Err(error) if error.kind()==std::io::ErrorKind::NotFound=>Ok(true),
        Err(_)=>Err("Windows startup setting could not be read".into())
    }
}
fn windows_allows_startup()->Result<bool,String>{
    let key=match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(APPROVED_KEY,KEY_READ){
        Ok(key)=>Some(key),Err(error) if error.kind()==std::io::ErrorKind::NotFound=>None,
        Err(_)=>return Err("Windows startup setting could not be read".into())
    };
    approval_allows_startup(key.as_ref())
}
pub fn initialize_fresh_install(directory:&Path,value:&mut serde_json::Value)->Result<(),String>{
    // The Microsoft Store package never opts in on its own: the user turns the
    // startup task on in Settings (Store policy), and Windows remembers it.
    if crate::store_package::packaged(){value["startup"]=serde_json::json!(crate::store_package::startup_enabled().unwrap_or(false));return Ok(());}
    initialize_with(directory,value,windows_allows_startup,self::enabled,set)
}
fn initialize_with(directory:&Path,value:&mut serde_json::Value,allowed:impl FnOnce()->Result<bool,String>,current:impl FnOnce()->Result<bool,String>,mut change:impl FnMut(bool)->Result<bool,String>)->Result<(),String>{
    // Older versions did not save the startup preference. An existing settings
    // file is therefore also an opt-out boundary, even without a startup field.
    if directory.join("preferences.json").try_exists().map_err(|_|"Settings unavailable")?{return Ok(());}
    let enabled=allowed()?;
    let previous=current()?;
    if enabled{change(true)?;}
    let mut next=value.clone();next["startup"]=serde_json::json!(enabled);
    let preferences=crate::preferences::Preferences::from_value(&next).map_err(str::to_owned)?;
    if let Err(error)=crate::preferences::save(directory,&preferences){
        if enabled&&!previous{let _=change(false);}
        return Err(error.into());
    }
    *value=next;Ok(())
}
fn command(executable:&Path)->Result<String,String>{
    let path=executable.to_str().ok_or("Startup path is not supported")?;
    if !executable.is_absolute()||path.contains('"')||path.chars().any(char::is_control){return Err("Startup path is not supported".into());}
    Ok(format!("\"{path}\" --background"))
}
fn stored(key:&RegKey)->Result<Option<String>,String>{
    match key.get_value::<String,_>(NAME){Ok(value)=>Ok(Some(value)),Err(error) if error.kind()==std::io::ErrorKind::NotFound=>Ok(None),Err(_)=>Err("Sign-in setting could not be read".into())}
}
fn update(key:&RegKey,expected:&str,enabled:bool)->Result<bool,String>{
    if let Some(value)=stored(key)?{if value!=expected{return Err("A different SoraFiles installation owns the sign-in entry. Remove that entry in Windows startup settings before changing it here.".into());}}
    if enabled{key.set_value(NAME,&expected).map_err(|_|"Sign-in setting could not be saved")?;}
    else{match key.delete_value(NAME){Ok(())=>{},Err(error) if error.kind()==std::io::ErrorKind::NotFound=>{},Err(_)=>return Err("Sign-in setting could not be removed".into())}}
    Ok(enabled)
}
pub fn enabled()->Result<bool,String>{
    if crate::store_package::packaged(){return crate::store_package::startup_enabled();}
    let executable=std::env::current_exe().map_err(|_|"Application location unavailable")?;let expected=command(&executable)?;
    let key=match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(KEY,KEY_READ){Ok(key)=>key,Err(error) if error.kind()==std::io::ErrorKind::NotFound=>return Ok(false),Err(_)=>return Err("Sign-in setting unavailable".into())};
    Ok(stored(&key)?.is_some_and(|value|value==expected)&&windows_allows_startup()?)
}
pub fn set(enabled:bool)->Result<bool,String>{
    if crate::store_package::packaged(){return crate::store_package::set_startup(enabled);}
    if enabled&&!windows_allows_startup()?{return Err("Enable SoraFiles Desktop in Windows Settings > Apps > Startup, then try again.".into());}
    let executable=std::env::current_exe().map_err(|_|"Application location unavailable")?;let expected=command(&executable)?;
    let (key,_)=RegKey::predef(HKEY_CURRENT_USER).create_subkey_with_flags(KEY,KEY_READ|KEY_SET_VALUE).map_err(|_|"Sign-in setting unavailable")?;
    update(&key,&expected,enabled)
}
#[cfg(test)]mod tests{use super::*;
    #[test]fn fresh_install_defaults_once_and_preserves_legacy_or_explicit_opt_out(){
        let directory=std::env::temp_dir().join(format!("sorafiles-startup-{}",uuid::Uuid::new_v4()));
        let mut value=crate::preferences::Preferences::default().value();let mut changes=Vec::new();
        initialize_with(&directory,&mut value,||Ok(true),||Ok(false),|enabled|{changes.push(enabled);Ok(enabled)}).unwrap();
        assert_eq!(changes,vec![true]);assert_eq!(crate::preferences::load(&directory).unwrap().value()["startup"],true);
        for existing in [r#"{"version":1,"output":"source","theme":"system"}"#,r#"{"version":1,"output":"source","theme":"system","startup":false}"#]{
            std::fs::write(directory.join("preferences.json"),existing).unwrap();
            initialize_with(&directory,&mut value,||panic!("must preserve older choices"),||panic!("must not inspect registration"),|_|panic!("must not re-enable")).unwrap();
            assert_eq!(std::fs::read_to_string(directory.join("preferences.json")).unwrap(),existing);
        }
        std::fs::remove_file(directory.join("preferences.json")).unwrap();std::fs::remove_dir(directory).unwrap();
    }
    #[test]fn fresh_install_preserves_windows_startup_apps_opt_out(){
        let directory=std::env::temp_dir().join(format!("sorafiles-startup-{}",uuid::Uuid::new_v4()));let mut value=crate::preferences::Preferences::default().value();
        initialize_with(&directory,&mut value,||Ok(false),||Ok(false),|_|panic!("must not override Windows disable")).unwrap();
        assert_eq!(crate::preferences::load(&directory).unwrap().value()["startup"],false);
        std::fs::remove_file(directory.join("preferences.json")).unwrap();std::fs::remove_dir(directory).unwrap();
    }
    #[test]fn windows_disabled_and_unknown_approval_records_are_respected(){
        let root=RegKey::predef(HKEY_CURRENT_USER);let path=format!(r"Software\SoraFilesTests\{}",uuid::Uuid::new_v4());let (key,_)=root.create_subkey(&path).unwrap();
        assert!(approval_allows_startup(Some(&key)).unwrap());
        for (state,expected) in [(2,true),(6,true),(3,false),(7,false),(0,false),(255,false)]{
            let mut bytes=vec![0;12];bytes[0]=state;key.set_raw_value(NAME,&winreg::RegValue{bytes,vtype:winreg::enums::REG_BINARY}).unwrap();
            assert_eq!(approval_allows_startup(Some(&key)).unwrap(),expected);
        }
        key.set_value(NAME,&"unknown format").unwrap();assert!(!approval_allows_startup(Some(&key)).unwrap());
        drop(key);root.delete_subkey(&path).unwrap();
    }
    #[test]fn startup_command_quotes_literal_executable_and_rejects_injection(){
        assert_eq!(command(Path::new(r"C:\Program Files\SoraFiles\sorafiles.exe")).unwrap(),r#""C:\Program Files\SoraFiles\sorafiles.exe" --background"#);
        for path in ["relative.exe","C:\\bad\"path.exe","C:\\bad\npath.exe"]{assert!(command(Path::new(path)).is_err());}
    }
    #[test]fn isolated_registry_setting_is_idempotent_and_never_replaces_another_install(){
        // Never touch the actual Run key in tests.
        let root=RegKey::predef(HKEY_CURRENT_USER);let path=format!(r"Software\SoraFilesTests\{}",uuid::Uuid::new_v4());
        let (key,_)=root.create_subkey(&path).unwrap();let expected=r#""C:\Synthetic\sorafiles.exe" --background"#;
        assert_eq!(stored(&key).unwrap(),None);assert!(update(&key,expected,true).unwrap());assert!(update(&key,expected,true).unwrap());assert_eq!(stored(&key).unwrap().as_deref(),Some(expected));
        key.set_value(NAME,&"different installation").unwrap();assert!(update(&key,expected,true).is_err());assert!(update(&key,expected,false).is_err());assert_eq!(stored(&key).unwrap().unwrap(),"different installation");
        key.set_value(NAME,&expected).unwrap();assert!(!update(&key,expected,false).unwrap());assert!(!update(&key,expected,false).unwrap());drop(key);root.delete_subkey(&path).unwrap();
    }
}
