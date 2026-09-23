//! Per-user Windows login startup, changed only by an explicit settings action.
use std::path::Path;
use winreg::{RegKey,enums::{HKEY_CURRENT_USER,KEY_READ,KEY_SET_VALUE}};
const KEY:&str=r"Software\Microsoft\Windows\CurrentVersion\Run";
const NAME:&str="SoraFilesDesktop";
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
    let executable=std::env::current_exe().map_err(|_|"Application location unavailable")?;let expected=command(&executable)?;
    let key=match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(KEY,KEY_READ){Ok(key)=>key,Err(error) if error.kind()==std::io::ErrorKind::NotFound=>return Ok(false),Err(_)=>return Err("Sign-in setting unavailable".into())};
    Ok(stored(&key)?.is_some_and(|value|value==expected))
}
pub fn set(enabled:bool)->Result<bool,String>{
    let executable=std::env::current_exe().map_err(|_|"Application location unavailable")?;let expected=command(&executable)?;
    let (key,_)=RegKey::predef(HKEY_CURRENT_USER).create_subkey_with_flags(KEY,KEY_READ|KEY_SET_VALUE).map_err(|_|"Sign-in setting unavailable")?;
    update(&key,&expected,enabled)
}
#[cfg(test)]mod tests{use super::*;
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
