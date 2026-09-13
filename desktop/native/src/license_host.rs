use serde_json::{json,Value};
use std::{io::{BufRead,BufReader,Read,Write},path::{Path,PathBuf},process::{Command,Stdio},sync::mpsc,time::{Duration,Instant}};
use crate::vault::{self,KeyStore,OsKeyStore};
const MAX_FRAME:u64=65536;

pub fn run(directory:&Path,resources:&Path,action:&str,params:Value)->Result<Value,String>{
 let (runtime,entry,config)=locations(resources)?;
 run_component(directory,&runtime,&entry,config,action,params,&OsKeyStore)
}
fn run_component(directory:&Path,runtime:&Path,entry:&Path,config:Value,action:&str,params:Value,store:&impl KeyStore)->Result<Value,String>{
 let state=match vault::load(directory,store)? {Some(bytes)=>serde_json::from_slice::<Value>(&bytes).map_err(|_|"Private state is damaged")?,None=>Value::Null};
 if !state.is_null(){validate_state(&state)?;}
 if action=="status"&&state["license"].is_null(){return Ok(json!({"license":"not-activated"}));}
 let mut command=Command::new(runtime);command.arg(entry).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
 for name in ["SystemRoot","WINDIR","TEMP","TMP","TMPDIR"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 let mut child=command.spawn().map_err(|_|"Desktop license component could not start")?;
 let mut input=child.stdin.take().ok_or("Private connection unavailable")?;
 let output=child.stdout.take().ok_or("Private connection unavailable")?;
 let (sender,receiver)=mpsc::sync_channel(2);
 let reader=std::thread::spawn(move||{let mut reader=BufReader::new(output);loop{let mut line=Vec::new();let read=reader.by_ref().take(MAX_FRAME+1).read_until(b'\n',&mut line);if !matches!(read,Ok(n) if n>0&&n<=MAX_FRAME as usize){break;}if sender.send(line).is_err(){break;}}});
 let started=Instant::now();let outcome=(||{
  let request=json!({"type":"request","action":action,"params":params,"state":state,"config":config});
  write_frame(&mut input,&request)?;
  let mut writes=0;
  loop{
   let remaining=Duration::from_secs(90).checked_sub(started.elapsed()).ok_or("License action timed out")?;
   let line=receiver.recv_timeout(remaining).map_err(|_|"License action could not finish")?;
   let message:Value=serde_json::from_slice(&line).map_err(|_|"Invalid license component response")?;
   match message["type"].as_str(){
    Some("save")=>{writes+=1;if writes>8{return Err("Too many private state writes".into());}let value=&message["state"];validate_state(value)?;
     let bytes=serde_json::to_vec(value).map_err(|_|"Invalid private state")?;vault::save(directory,&bytes,store)?;write_frame(&mut input,&json!({"type":"saved","ok":true}))?;
    },
    Some("result")=>{let result=message["result"].clone();validate_result(&result)?;return Ok(result);},
    Some("error")=>{let text=message["message"].as_str().unwrap_or("License action failed");return Err(if text.len()<=256{text.to_string()}else{"License action failed".into()});},
    _=>return Err("Invalid license component response".into()),
   }
  }
 })();
 // No processing or license runtime remains resident after the action.
 drop(input);let _=child.kill();let _=child.wait();drop(receiver);let _=reader.join();outcome
}
fn write_frame(writer:&mut impl Write,value:&Value)->Result<(),String>{let bytes=serde_json::to_vec(value).map_err(|_|"Invalid private request")?;if bytes.len()>MAX_FRAME as usize-1{return Err("Private request exceeds its limit".into());}writer.write_all(&bytes).and_then(|_|writer.write_all(b"\n")).and_then(|_|writer.flush()).map_err(|_|"Private connection closed".into())}
fn locations(resources:&Path)->Result<(PathBuf,PathBuf,Value),String>{
 let mut runtime=resources.join("license-host").join(if cfg!(windows){"node.exe"}else{"node"});
 let mut entry=resources.join("license-host/desktop/native-host/main.mjs");
 let mut config_path=resources.join("license-host/config.json");
 #[cfg(debug_assertions)] {
  if let Some(path)=std::env::var_os("SORAFILES_NODE_RUNTIME"){let p=PathBuf::from(path);if !p.is_absolute(){return Err("Desktop runtime path must be absolute".into());}runtime=p;entry=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../native-host/main.mjs");}
  if let Some(path)=std::env::var_os("SORAFILES_LICENSE_TEST_CONFIG"){config_path=PathBuf::from(path);}
 }
 let mut bytes=Vec::new();std::fs::File::open(config_path).map_err(|_|"License service configuration is not available in this build")?.take(16385).read_to_end(&mut bytes).map_err(|_|"License configuration unavailable")?;
 if bytes.len()>16384{return Err("License configuration too large".into());}
 let config:Value=serde_json::from_slice(&bytes).map_err(|_|"License configuration invalid")?;
 #[cfg(not(debug_assertions))] let config={let mut config=config;config["allowLocalTesting"]=json!(false);config["origin"]=json!("https://license.sorafiles.com");config};
 Ok((runtime,entry,config))
}
fn validate_state(value:&Value)->Result<(),String>{
 let object=value.as_object().ok_or("Invalid private state")?;
 if object.len()!=3||value["schema"]!=1||!object.contains_key("license"){return Err("Invalid private state".into());}
 let device=value["device"].as_object().ok_or("Invalid private device")?;
 if device.len()!=2||!["publicKey","privateKey"].iter().all(|key|device.get(*key).and_then(Value::as_str).is_some_and(|text|!text.is_empty()&&text.len()<=2048)){return Err("Invalid private device".into());}
 if !value["license"].is_null(){let license=value["license"].as_object().ok_or("Invalid private license")?;if license.keys().any(|key|!matches!(key.as_str(),"licenseKey"|"licenseRef"|"instanceId"|"entitlement"|"lastTrustedTime"|"deactivationPending")){return Err("Invalid private license".into());}}
 Ok(())
}
fn validate_result(value:&Value)->Result<(),String>{
 let result=value.as_object().ok_or("Invalid license result")?;
 if result.keys().any(|key|!matches!(key.as_str(),"license"|"plan"|"expiresAt"|"maxDevices"|"deactivated"|"devices")){return Err("Private fields cannot enter the interface".into());}
 for (key,value) in result {let valid=match key.as_str(){
  "license"=>matches!(value.as_str(),Some("not-activated"|"trial"|"active"|"needs-verification"|"deactivation-pending")),
  "plan"=>value.as_str().is_some_and(|s|s.len()<64&&s.bytes().all(|b|b.is_ascii_lowercase()||b.is_ascii_digit()||b==b'-')),
  "expiresAt"=>value.is_null()||value.as_u64().is_some(),"maxDevices"=>matches!(value.as_u64(),Some(1|5)),"deactivated"=>value==true,
  "devices"=>value.as_array().is_some_and(|rows|rows.len()<=256&&rows.iter().all(|row|row.as_object().is_some_and(|r|r.len()==3&&r.get("id").and_then(Value::as_str).is_some_and(|id|id.len()<=128)&&r.get("current").is_some_and(Value::is_boolean)&&r.get("active").is_some_and(Value::is_boolean)))),_=>false};
  if !valid{return Err("Invalid public license response".into());}
 }
 Ok(())
}
#[cfg(test)] mod tests{use super::*;
 #[test]fn renderer_results_cannot_contain_private_state(){for key in ["entitlement","licenseKey","privateKey","state"]{assert!(validate_result(&json!({key:"secret"})).is_err());}assert!(validate_result(&json!({"license":"trial","plan":"trial","expiresAt":1})).is_ok());}
 #[test]fn vault_boundary_rejects_unknown_state_fields(){assert!(validate_state(&json!({"schema":1,"device":{"publicKey":"public","privateKey":"private"},"license":null})).is_ok());assert!(validate_state(&json!({"schema":1,"device":{"publicKey":"public","privateKey":"private"},"license":{"url":"elsewhere"}})).is_err());}
 #[test]fn native_pipe_trial_survives_process_restart_and_offline_service(){
  use std::cell::RefCell;use zeroize::Zeroizing;
  #[derive(Default)]struct TestStore(RefCell<Option<Vec<u8>>>);
  impl KeyStore for TestStore{fn read(&self)->Result<Option<Zeroizing<Vec<u8>>>,&'static str>{Ok(self.0.borrow().clone().map(Zeroizing::new))}fn create(&self,key:&[u8])->Result<(),&'static str>{*self.0.borrow_mut()=Some(key.to_vec());Ok(())}}
  struct Cleanup{child:std::process::Child,directory:PathBuf}
  impl Drop for Cleanup{fn drop(&mut self){let _=self.child.kill();let _=self.child.wait();let _=std::fs::remove_file(self.directory.join("private-state.sealed"));let _=std::fs::remove_dir(&self.directory);}}
  let directory=std::env::temp_dir().join(format!("sorafiles-native-pipe-{}",uuid::Uuid::new_v4()));std::fs::create_dir(&directory).unwrap();
  let fixture=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/native-license-service.mjs");
  let child=Command::new("node").arg(fixture).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().expect("Node is required for the native protocol test");
  let mut cleanup=Cleanup{child,directory};let mut line=String::new();BufReader::new(cleanup.child.stdout.take().unwrap()).read_line(&mut line).unwrap();
  let fixture:Value=serde_json::from_str(&line).expect("Synthetic service must start");let runtime=PathBuf::from(fixture["runtime"].as_str().unwrap());let entry=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../native-host/main.mjs");let config=fixture["config"].clone();let store=TestStore::default();
  let invoke=|action,params|run_component(&cleanup.directory,&runtime,&entry,config.clone(),action,params,&store);
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"not-activated");
  let trial=invoke("trial",json!({})).unwrap();assert_eq!(trial["license"],"trial");assert!(trial["expiresAt"].as_u64().unwrap()>0);validate_result(&trial).unwrap();
  let encrypted=std::fs::read(cleanup.directory.join("private-state.sealed")).unwrap();assert!(!encrypted.windows(11).any(|w|w==b"PRIVATE KEY"));
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  cleanup.child.kill().unwrap();cleanup.child.wait().unwrap();
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  assert!(invoke("activate",json!({"licenseKey":"synthetic-license-key"})).is_err());
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  let mut damaged=std::fs::read(cleanup.directory.join("private-state.sealed")).unwrap();damaged[25]^=1;std::fs::write(cleanup.directory.join("private-state.sealed"),damaged).unwrap();assert!(invoke("status",json!({})).is_err());
 }
}
