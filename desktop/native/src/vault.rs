use aes_gcm::{aead::{Aead, KeyInit, Payload}, Aes256Gcm, Nonce};
use std::{fs::{self, OpenOptions}, io::{Read, Write}, path::Path};
use zeroize::Zeroizing;

const MAX_STATE: usize = 32768;
const AAD: &[u8] = b"com.soralabs.sorafiles.desktop/private-state/v1";
const HEADER: &[u8] = b"SFVAULT1";
const FILE: &str = "private-state.sealed";

// The OS credential store contains only a 32-byte wrapping key. The larger
// entitlement/device record lives in an authenticated, atomically replaced file.
// Missing or locked secure storage is an error, never a plaintext fallback.
pub trait KeyStore {
    fn read(&self) -> Result<Option<Zeroizing<Vec<u8>>>, &'static str>;
    fn create(&self, key: &[u8]) -> Result<(), &'static str>;
}
pub struct OsKeyStore;
impl KeyStore for OsKeyStore {
    fn read(&self) -> Result<Option<Zeroizing<Vec<u8>>>, &'static str> {
        let entry = keyring::Entry::new("com.soralabs.sorafiles.desktop", "private-state-v1").map_err(|_| "Secure storage unavailable")?;
        match entry.get_secret() {
            Ok(value) => Ok(Some(Zeroizing::new(value))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("Unlock your system key store and try again"),
        }
    }
    fn create(&self, key: &[u8]) -> Result<(), &'static str> {
        let entry = keyring::Entry::new("com.soralabs.sorafiles.desktop", "private-state-v1").map_err(|_| "Secure storage unavailable")?;
        entry.set_secret(key).map_err(|_| "Secure storage could not save the device key")
    }
}
fn ordinary(path: &Path, directory: bool) -> Result<(), &'static str> {
    let info=fs::symlink_metadata(path).map_err(|_| "Private storage unavailable")?;
    if info.file_type().is_symlink() || if directory {!info.is_dir()} else {!info.is_file()} {return Err("Private storage location is not an ordinary file or folder");}
    #[cfg(windows)] {use std::os::windows::fs::MetadataExt;if info.file_attributes() & 0x400 != 0 {return Err("Private storage cannot use a linked location");}}
    Ok(())
}
fn wrapping_key(store: &impl KeyStore, existing: bool) -> Result<Zeroizing<Vec<u8>>, &'static str> {
    if let Some(key)=store.read()? {if key.len()!=32{return Err("Invalid secure storage key");}return Ok(key);}
    if existing {return Err("The device key is missing. Restore secure storage before continuing");}
    let mut key=Zeroizing::new(vec![0u8;32]);getrandom::fill(&mut key).map_err(|_| "Secure randomness unavailable")?;
    store.create(&key)?;
    let saved=store.read()?.ok_or("Secure storage did not retain the device key")?;
    if *saved!=*key{return Err("Secure storage changed during initialization");}Ok(key)
}
pub fn load(directory: &Path, store: &impl KeyStore) -> Result<Option<Zeroizing<Vec<u8>>>, &'static str> {
    let path=directory.join(FILE);
    // symlink_metadata distinguishes a dangling link from a missing record.
    match fs::symlink_metadata(&path) {Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(None),Err(_)=>return Err("Private storage unavailable"),Ok(_)=>{}}
    ordinary(directory,true)?;ordinary(&path,false)?;
    let key=wrapping_key(store,true)?;
    let mut bytes=Vec::new();fs::File::open(path).map_err(|_| "Private storage unavailable")?.take((MAX_STATE+64) as u64).read_to_end(&mut bytes).map_err(|_| "Private storage unavailable")?;
    if bytes.len()<HEADER.len()+12+16||bytes.len()>MAX_STATE+HEADER.len()+12+16||!bytes.starts_with(HEADER){return Err("Private storage is damaged");}
    let cipher=Aes256Gcm::new_from_slice(&key).map_err(|_| "Invalid device key")?;
    let plain=cipher.decrypt(Nonce::from_slice(&bytes[8..20]),Payload {msg:&bytes[20..],aad:AAD}).map_err(|_| "Private storage could not be verified")?;
    Ok(Some(Zeroizing::new(plain)))
}
pub fn save(directory: &Path, value: &[u8], store: &impl KeyStore) -> Result<(), &'static str> {
    if value.is_empty()||value.len()>MAX_STATE{return Err("Private state exceeds its size limit");}
    fs::create_dir_all(directory).map_err(|_| "Private storage folder unavailable")?;ordinary(directory,true)?;
    let path=directory.join(FILE);let existing=match fs::symlink_metadata(&path){Ok(_)=>{ordinary(&path,false)?;true},Err(e) if e.kind()==std::io::ErrorKind::NotFound=>false,Err(_)=>return Err("Private storage unavailable")};
    let key=wrapping_key(store,existing)?;
    let cipher=Aes256Gcm::new_from_slice(&key).map_err(|_| "Invalid device key")?;
    let mut nonce=[0u8;12];getrandom::fill(&mut nonce).map_err(|_| "Secure randomness unavailable")?;
    let encrypted=cipher.encrypt(Nonce::from_slice(&nonce),Payload {msg:value,aad:AAD}).map_err(|_| "Private state could not be protected")?;
    let temporary=directory.join(format!("private-{}.tmp",uuid::Uuid::new_v4()));
    let result=(||{let mut options=OpenOptions::new();options.write(true).create_new(true);
        #[cfg(unix)] {use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
        let mut output=options.open(&temporary).map_err(|_| "Private state could not be saved")?;
        output.write_all(HEADER).and_then(|_| output.write_all(&nonce)).and_then(|_| output.write_all(&encrypted)).and_then(|_| output.sync_all()).map_err(|_| "Private state could not be saved")?;
        drop(output);fs::rename(&temporary,&path).map_err(|_| "Private state could not be saved")?;Ok(())
    })();if result.is_err(){let _=fs::remove_file(temporary);}result
}

#[cfg(test)] mod tests {
 use super::*;use std::cell::RefCell;
 #[derive(Default)]struct MemoryStore(RefCell<Option<Vec<u8>>>);
 impl KeyStore for MemoryStore {fn read(&self)->Result<Option<Zeroizing<Vec<u8>>>, &'static str>{Ok(self.0.borrow().clone().map(Zeroizing::new))}fn create(&self,key:&[u8])->Result<(), &'static str>{*self.0.borrow_mut()=Some(key.to_vec());Ok(())}}
 fn dir()->std::path::PathBuf{let dir=std::env::temp_dir().join(format!("sorafiles-vault-{}",uuid::Uuid::new_v4()));fs::create_dir(&dir).unwrap();dir}
 #[test]fn sealed_state_survives_replacement_and_rejects_tampering(){let d=dir();let store=MemoryStore::default();assert!(load(&d,&store).unwrap().is_none());save(&d,b"private-device-and-license",&store).unwrap();let first=fs::read(d.join(FILE)).unwrap();assert!(!first.windows(7).any(|s|s==b"private"));assert_eq!(&**load(&d,&store).unwrap().as_ref().unwrap(),b"private-device-and-license");save(&d,b"private-device-and-license",&store).unwrap();assert_ne!(first,fs::read(d.join(FILE)).unwrap());let mut bad=fs::read(d.join(FILE)).unwrap();bad[25]^=1;fs::write(d.join(FILE),bad).unwrap();assert!(load(&d,&store).is_err());fs::remove_file(d.join(FILE)).unwrap();fs::remove_dir(d).unwrap();}
 #[test]fn missing_key_never_reinitializes_an_existing_record(){let d=dir();let store=MemoryStore::default();save(&d,b"existing-state",&store).unwrap();let original=fs::read(d.join(FILE)).unwrap();*store.0.borrow_mut()=None;assert!(load(&d,&store).is_err());assert!(save(&d,b"new-state",&store).is_err());assert_eq!(original,fs::read(d.join(FILE)).unwrap());assert!(store.0.borrow().is_none());fs::remove_file(d.join(FILE)).unwrap();fs::remove_dir(d).unwrap();}
 #[test]fn oversized_or_blocked_private_state_cannot_replace_existing_state(){let d=dir();let store=MemoryStore::default();save(&d,b"existing-state",&store).unwrap();let original=fs::read(d.join(FILE)).unwrap();assert!(save(&d,&vec![0;MAX_STATE+1],&store).is_err());assert_eq!(original,fs::read(d.join(FILE)).unwrap());*store.0.borrow_mut()=Some(vec![1;32]);assert!(load(&d,&store).is_err());fs::remove_file(d.join(FILE)).unwrap();fs::remove_dir(d).unwrap();}
 #[test] #[ignore="Requires an unlocked OS credential store"]
 fn actual_os_credential_store_roundtrip(){
  struct TestStore(keyring::Entry);
  impl KeyStore for TestStore {fn read(&self)->Result<Option<Zeroizing<Vec<u8>>>, &'static str>{match self.0.get_secret(){Ok(v)=>Ok(Some(Zeroizing::new(v))),Err(keyring::Error::NoEntry)=>Ok(None),Err(_)=>Err("OS key store unavailable")}}fn create(&self,key:&[u8])->Result<(), &'static str>{self.0.set_secret(key).map_err(|_|"OS key store save failed")}}
  let d=dir();let store=TestStore(keyring::Entry::new("com.soralabs.sorafiles.desktop.test",&uuid::Uuid::new_v4().to_string()).unwrap());
  let result=(||{save(&d,b"synthetic-native-secret",&store)?;let read=load(&d,&store)?.ok_or("Missing stored value")?;if &*read!=b"synthetic-native-secret"{return Err("Wrong stored value");}Ok::<(),&'static str>(())})();
  let _=store.0.delete_credential();let _=fs::remove_file(d.join(FILE));let _=fs::remove_dir(d);result.unwrap();
 }
}
