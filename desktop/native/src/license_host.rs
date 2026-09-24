use serde_json::{json,Value};
use std::{io::{BufRead,BufReader,Read,Write},path::{Path,PathBuf},process::{Command,Stdio},sync::mpsc,time::{Duration,Instant}};
use crate::vault::{self,KeyStore,OsKeyStore};
const MAX_FRAME:u64=65536;

pub fn run(directory:&Path,resources:&Path,action:&str,params:Value)->Result<Value,String>{
 let (runtime,entry,config)=locations(resources)?;
 run_component(directory,&runtime,&entry,config,action,params,&OsKeyStore)
}
pub(crate) fn run_component(directory:&Path,runtime:&Path,entry:&Path,config:Value,action:&str,params:Value,store:&impl KeyStore)->Result<Value,String>{
 let state=match vault::load(directory,store)? {Some(bytes)=>serde_json::from_slice::<Value>(&bytes).map_err(|_|"Private state is damaged")?,None=>Value::Null};
 if !state.is_null(){validate_state(&state)?;}
 if action=="status"&&state["license"].is_null(){return Ok(json!({"license":"not-activated"}));}
 if action=="validate"&&state["license"]["licenseRef"].is_null(){return Ok(json!({}));}
 let mut command=Command::new(runtime);command.arg(entry).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
 for name in ["SystemRoot","WINDIR","TEMP","TMP","TMPDIR"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 let mut child=command.spawn().map_err(|_|"Desktop license component could not start")?;
 #[cfg(windows)] let process_job=crate::process_job::ProcessJob::attach(&mut child)?;
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
 drop(input);
 #[cfg(windows)] drop(process_job);
 let _=child.kill();let _=child.wait();drop(receiver);let _=reader.join();outcome
}
fn write_frame(writer:&mut impl Write,value:&Value)->Result<(),String>{let bytes=serde_json::to_vec(value).map_err(|_|"Invalid private request")?;if bytes.len()>MAX_FRAME as usize-1{return Err("Private request exceeds its limit".into());}writer.write_all(&bytes).and_then(|_|writer.write_all(b"\n")).and_then(|_|writer.flush()).map_err(|_|"Private connection closed".into())}
pub(crate) fn locations(resources:&Path)->Result<(PathBuf,PathBuf,Value),String>{
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
pub(crate) fn validate_state(value:&Value)->Result<(),String>{
 let object=value.as_object().ok_or("Invalid private state")?;
 if !(object.len()==3||object.len()==4&&object.contains_key("replacement"))||value["schema"]!=1||!object.contains_key("license"){return Err("Invalid private state".into());}
 let device=value["device"].as_object().ok_or("Invalid private device")?;
 if device.len()!=2||!["publicKey","privateKey"].iter().all(|key|device.get(*key).and_then(Value::as_str).is_some_and(|text|!text.is_empty()&&text.len()<=2048)){return Err("Invalid private device".into());}
 if !value["license"].is_null(){let license=value["license"].as_object().ok_or("Invalid private license")?;if license.keys().any(|key|!matches!(key.as_str(),"licenseKey"|"licenseRef"|"instanceId"|"entitlement"|"lastTrustedTime"|"deactivationPending")){return Err("Invalid private license".into());}}
 if !value["replacement"].is_null(){let flow=value["replacement"].as_object().ok_or("Invalid private replacement")?;
  if flow.keys().any(|key|!matches!(key.as_str(),"stage"|"licenseKey"|"verificationId"|"maskedEmail"|"expiresAt"|"resendAfter"|"identityToken"|"licenseRef"|"plan"|"devices"|"oldDeviceId"|"orderId"|"status"|"checkoutUrl"))||value["replacement"].to_string().len()>24576{return Err("Invalid private replacement".into());}
 }
 Ok(())
}
fn validate_result(value:&Value)->Result<(),String>{
 let result=value.as_object().ok_or("Invalid license result")?;
 if result.keys().any(|key|!matches!(key.as_str(),"license"|"plan"|"expiresAt"|"maxDevices"|"devices"|"activationAvailable"|"supportDeviceId"|"actions"|"action"|"replacement"|"checkoutUrl")){return Err("Private fields cannot enter the interface".into());}
 for (key,value) in result {let valid=match key.as_str(){
  "license"=>matches!(value.as_str(),Some("not-activated"|"trial"|"active"|"needs-verification")),
  "plan"=>value.as_str().is_some_and(|s|s.len()<64&&s.bytes().all(|b|b.is_ascii_lowercase()||b.is_ascii_digit()||b==b'-')),
  "expiresAt"=>value.is_null()||value.as_u64().is_some(),"maxDevices"=>matches!(value.as_u64(),Some(1|5)),
  "activationAvailable"=>value.is_boolean(),
  "replacement"=>valid_replacement(value),
  "checkoutUrl"=>trusted_checkout(value.as_str().unwrap_or("")),
  "actions"=>value.as_array().is_some_and(|rows|rows.len()<=32&&rows.iter().all(valid_native_action)),
  "action"=>valid_native_action(value),
  "supportDeviceId"=>value.as_str().is_some_and(|s|s.len()==43&&s.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_')),
  "devices"=>value.as_array().is_some_and(|rows|rows.len()<=256&&rows.iter().all(|row|row.as_object().is_some_and(|r|r.len()==3&&r.get("id").and_then(Value::as_str).is_some_and(|id|id.len()<=128)&&r.get("current").is_some_and(Value::is_boolean)&&r.get("active").is_some_and(Value::is_boolean)))),_=>false};
  if !valid{return Err("Invalid public license response".into());}
 }
 Ok(())
}
pub(crate) fn trusted_checkout(value:&str)->bool{
 value.len()<=4096&&tauri::Url::parse(value).is_ok_and(|url|url.scheme()=="https"&&matches!(url.host_str(),Some("checkout.dodopayments.com"|"test.checkout.dodopayments.com"))&&url.username().is_empty()&&url.password().is_none()&&url.port().is_none())
}
fn valid_replacement(value:&Value)->bool{
 let Some(row)=value.as_object()else{return false;};
 row.keys().all(|key|matches!(key.as_str(),"stage"|"maskedEmail"|"expiresAt"|"resendAfter"|"plan"|"devices"|"fee"|"status"|"checkoutAvailable"))
 &&matches!(value["stage"].as_str(),Some("idle"|"email"|"verified"|"payment"|"complete"))
 &&(value["maskedEmail"].is_null()||value["maskedEmail"].as_str().is_some_and(|s|s.len()<=254&&s.contains('*')&&!s.chars().any(char::is_control)))
 &&(value["expiresAt"].is_null()||value["expiresAt"].as_u64().is_some())&&(value["resendAfter"].is_null()||value["resendAfter"].as_u64().is_some())
 &&(value["plan"].is_null()||matches!(value["plan"].as_str(),Some("personal-monthly"|"personal-annual"|"personal-lifetime"|"team-monthly"|"team-annual"|"team-lifetime")))
 &&(value["devices"].is_null()||validate_result(&json!({"devices":value["devices"]})).is_ok())
 &&(value["status"].is_null()||matches!(value["status"].as_str(),Some("payment-pending"|"payment-confirmed"|"payment-failed"|"complete")))
 &&(value["checkoutAvailable"].is_null()||value["checkoutAvailable"].is_boolean())
 &&(value["fee"].is_null()||value["fee"].as_object().is_some_and(|fee|fee.len()==5&&fee.keys().all(|key|matches!(key.as_str(),"plan"|"amount"|"currency"|"formatted"|"perSeat"))&&value["fee"]["plan"]==value["plan"]&&matches!(value["fee"]["amount"].as_u64(),Some(99|999|4999|399|3999|19999))&&value["fee"]["currency"]=="USD"&&value["fee"]["formatted"].as_str().is_some_and(|s|s.len()<=16)&&value["fee"]["perSeat"].is_boolean()))
}
fn valid_native_action(value:&Value)->bool{
 let Some(row)=value.as_object() else{return false;};
 row.len()<=6&&row.keys().all(|key|matches!(key.as_str(),"id"|"label"|"tool"|"options"|"direct"|"requiresUI"))
 &&value["id"].as_str().is_some_and(|s|!s.is_empty()&&s.len()<=64&&s.bytes().all(|b|b.is_ascii_lowercase()||b.is_ascii_digit()||b==b'-'))
 &&(value["label"].is_null()||value["label"].as_str().is_some_and(|s|s.len()<=100&&!s.chars().any(char::is_control)))
 &&(value["tool"].is_null()||value["tool"].as_str().is_some_and(|s|s.len()<=64))
 &&value["options"].is_object()&&value["options"].to_string().len()<=8192&&value["direct"].is_boolean()&&value["requiresUI"].is_boolean()
}
#[cfg(test)] mod tests{use super::*;
 #[test]fn replacement_snapshot_cannot_expose_purchaser_proof(){
  assert!(validate_result(&json!({"replacement":{"stage":"email","maskedEmail":"j***@example.com","expiresAt":1900000000,"resendAfter":1800000000}})).is_ok());
  for key in ["identityToken","licenseKey","verificationId","checkoutUrl"]{assert!(validate_result(&json!({"replacement":{"stage":"email",key:"private"}})).is_err());}
  assert!(trusted_checkout("https://checkout.dodopayments.com/session"));
  for url in ["http://checkout.dodopayments.com/a","https://checkout.dodopayments.com.evil.example/a","https://user@checkout.dodopayments.com/a"]{assert!(!trusted_checkout(url));}
 }
 #[test]fn renderer_results_cannot_contain_private_state(){for key in ["entitlement","licenseKey","privateKey","state"]{assert!(validate_result(&json!({key:"secret"})).is_err());}assert!(validate_result(&json!({"license":"trial","plan":"trial","expiresAt":1})).is_ok());}
 #[test]fn support_identity_accepts_only_a_bounded_public_identifier(){
  assert!(validate_result(&json!({"supportDeviceId":"a".repeat(43)})).is_ok());
  for value in [json!(null),json!(42),json!("a".repeat(42)),json!("a".repeat(44)),json!("/".repeat(43))]{assert!(validate_result(&json!({"supportDeviceId":value})).is_err());}
  assert!(validate_result(&json!({"supportDeviceId":"a".repeat(43),"privateKey":"secret"})).is_err());
 }
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
  let support=invoke("support",json!({})).unwrap();validate_result(&support).unwrap();assert_eq!(support.as_object().unwrap().len(),1);
  assert_eq!(invoke("support",json!({})).unwrap(),support);
  let trial=invoke("trial",json!({})).unwrap();assert_eq!(trial["license"],"trial");assert!(trial["expiresAt"].as_u64().unwrap()>0);validate_result(&trial).unwrap();
  let encrypted=std::fs::read(cleanup.directory.join("private-state.sealed")).unwrap();assert!(!encrypted.windows(11).any(|w|w==b"PRIVATE KEY"));
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  cleanup.child.kill().unwrap();cleanup.child.wait().unwrap();
  assert_eq!(invoke("support",json!({})).unwrap(),support);
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  // Run a real PDF job through Rust -> private process -> reference engine,
  // while the service is offline. Only synthetic files/keys are used.
  let pdf_fixture=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/processing-pdf.mjs");
  let folder=std::fs::canonicalize(&cleanup.directory).unwrap();
  #[cfg(windows)] let folder=PathBuf::from(folder.to_string_lossy().strip_prefix(r"\\?\").unwrap().to_string());
  let source=folder.join("input.pdf");
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("create").arg(&source).status().unwrap().success());
  let original=std::fs::read(&source).unwrap();
  let observed=std::cell::Cell::new(false);
  let result=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"rotate-pdf","paths":[source],"options":{"rotations":[{"pageIndex":0,"angle":90}]}}),&std::sync::atomic::AtomicBool::new(false),|_|{
   observed.set(true);
   #[cfg(windows)] {assert!(std::fs::OpenOptions::new().write(true).open(&source).is_err());assert!(std::fs::rename(&folder,folder.with_extension("moved")).is_err());}
  },&store).unwrap();
  assert!(observed.get());
  assert_eq!(result["state"],"completed");let output=PathBuf::from(result["path"].as_str().unwrap());
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("verify").arg(&output).status().unwrap().success());
  let batch=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"rotate-pdf","paths":[source,source],"options":{"rotations":[{"pageIndex":0,"angle":90}]}}),&std::sync::atomic::AtomicBool::new(false),|_|{},&store).unwrap();
  assert_eq!(batch["state"],"batch");assert_eq!(batch["results"].as_array().unwrap().len(),2);
  for row in batch["results"].as_array().unwrap(){assert_eq!(row["state"],"completed");let output=folder.join(row["name"].as_str().unwrap());assert!(Command::new(&runtime).arg(&pdf_fixture).arg("verify").arg(&output).status().unwrap().success());std::fs::remove_file(output).unwrap();}
  assert_eq!(std::fs::read(&source).unwrap(),original);
  let word=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"pdf-to-word","paths":[source],"options":{"direction":"ltr"}}),&std::sync::atomic::AtomicBool::new(false),|_|{},&store).unwrap();
  assert_eq!(word["state"],"completed");let word_path=PathBuf::from(word["path"].as_str().unwrap());
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("verify-word").arg(&word_path).status().unwrap().success());std::fs::remove_file(word_path).unwrap();
  let compressed=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"compress-pdf","paths":[source],"options":{}}),&std::sync::atomic::AtomicBool::new(false),|_|{},&store).unwrap();
  assert_eq!(compressed["state"],"completed");let compressed_path=PathBuf::from(compressed["path"].as_str().unwrap());
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("verify-compressed").arg(&compressed_path).status().unwrap().success());std::fs::remove_file(compressed_path).unwrap();
  let repair_source=folder.join("repair.pdf");
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("create-damaged").arg(&repair_source).status().unwrap().success());
  let damaged=std::fs::read(&repair_source).unwrap();
  let repaired=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"repair-pdf","paths":[repair_source],"options":{}}),&std::sync::atomic::AtomicBool::new(false),|_|{},&store).unwrap();
  assert_eq!(repaired["state"],"completed");let repaired_path=PathBuf::from(repaired["path"].as_str().unwrap());
  assert!(Command::new(&runtime).arg(&pdf_fixture).arg("verify-repaired").arg(&repaired_path).status().unwrap().success());
  assert_eq!(std::fs::read(&repair_source).unwrap(),damaged);std::fs::remove_file(repair_source).unwrap();std::fs::remove_file(repaired_path).unwrap();
  // Both normal completion and component errors release native input handles.
  assert!(std::fs::OpenOptions::new().write(true).open(&source).is_ok());
  assert!(crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"rotate-pdf","paths":[source],"options":{"rotations":[{"pageIndex":-1,"angle":90}]}}),&std::sync::atomic::AtomicBool::new(false),|_|{},&store).is_err());
  assert!(std::fs::OpenOptions::new().write(true).open(&source).is_ok());
  let cancelled=crate::processing_host::run_component(&cleanup.directory,&runtime,&entry.with_file_name("process-main.mjs"),config.clone(),json!({"tool":"rotate-pdf","paths":[source],"options":{"rotations":[{"pageIndex":0,"angle":90}]}}),&std::sync::atomic::AtomicBool::new(true),|_|{},&store).unwrap();
  assert_eq!(cancelled["state"],"cancelled");
  assert!(std::fs::OpenOptions::new().write(true).open(&source).is_ok());
  std::fs::remove_file(source).unwrap();std::fs::remove_file(output).unwrap();
  assert!(invoke("activate",json!({"licenseKey":"synthetic-license-key"})).is_err());
  assert_eq!(invoke("status",json!({})).unwrap()["license"],"trial");
  let mut damaged=std::fs::read(cleanup.directory.join("private-state.sealed")).unwrap();damaged[25]^=1;std::fs::write(cleanup.directory.join("private-state.sealed"),damaged).unwrap();assert!(invoke("status",json!({})).is_err());
 }
}
