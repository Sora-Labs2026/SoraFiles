use std::{collections::VecDeque,path::{Path,PathBuf},time::SystemTime};
use serde_json::{json,Value};
use uuid::Uuid;

struct Output { id:String,path:PathBuf,size:u64,modified:SystemTime }
#[derive(Default)]pub struct Outputs { entries:VecDeque<Output> }
impl Outputs {
 pub fn register(&mut self,path:&Path)->Result<String,&'static str>{
  if !matches!(path.extension().and_then(|value|value.to_str()),Some("pdf"|"png"|"jpg"|"jpeg"|"webp"|"zip"|"txt"|"xlsx"|"docx"|"pptx")){return Err("Output type cannot be opened");}
  let (path,file,size)=crate::selection::local_file(path)?;let modified=file.metadata().and_then(|info|info.modified()).map_err(|_|"Output unavailable")?;
  let id=Uuid::new_v4().simple().to_string();if self.entries.len()>=512{self.entries.pop_front();}self.entries.push_back(Output{id:id.clone(),path,size,modified});Ok(id)
 }
 pub fn resolve(&self,id:&str)->Result<PathBuf,&'static str>{
  let saved=self.entries.iter().find(|entry|entry.id==id).ok_or("Output expired. Open it from its saved folder.")?;
  #[cfg(windows)]let path={let value=saved.path.to_string_lossy();PathBuf::from(value.strip_prefix(r"\\?\").unwrap_or(&value))};
  #[cfg(not(windows))]let path=saved.path.clone();
  let (_,file,size)=crate::selection::local_file(&path)?;let modified=file.metadata().and_then(|info|info.modified()).map_err(|_|"Output unavailable")?;
  if saved.size!=size||saved.modified!=modified{return Err("Output has changed. Open it from its saved folder.");}Ok(path)
 }
 pub fn clear(&mut self){self.entries.clear();}
}
pub fn public_result(result:Value,paths:&[PathBuf],folder:Option<&Path>,outputs:&mut Outputs)->Result<Value,String>{
 if result["state"]=="cancelled"{return Ok(result);}
 if result["state"]=="batch"{
  let mut result=result;
  for row in result["results"].as_array_mut().ok_or("Invalid batch")?{
   if row["state"]!="completed"{continue;}
   let source=paths.get(row["index"].as_u64().ok_or("Invalid batch index")? as usize).ok_or("Invalid batch index")?;
   let folder=folder.or_else(||source.parent()).ok_or("Output folder unavailable")?;
   let path=folder.join(row["name"].as_str().ok_or("Output name unavailable")?);
   // A post-publication rename must not relabel a saved result as a failed job.
   if let Ok(id)=outputs.register(&path){row["outputId"]=json!(id);}
  }
  return Ok(result);
 }
 let path=Path::new(result["path"].as_str().ok_or("Output unavailable")?);
 let name=path.file_name().unwrap_or_default().to_string_lossy();
 let mut public=json!({"state":"completed","name":name,"bytes":result["bytes"],"warnings":result["warnings"],"cleanupPending":result["cleanupPending"]});
 if let Ok(id)=outputs.register(path){public["outputId"]=json!(id);}Ok(public)
}
pub fn open(path:&Path,folder:bool)->Result<(),&'static str>{
 let path=if folder{path.parent().ok_or("Output folder unavailable")?}else{path};
 #[cfg(windows)]{
  use std::os::windows::ffi::OsStrExt;
  #[link(name="shell32")]unsafe extern "system" {fn ShellExecuteW(window:*mut std::ffi::c_void,operation:*const u16,file:*const u16,parameters:*const u16,directory:*const u16,show:i32)->isize;}
  let operation:Vec<u16>="open".encode_utf16().chain(Some(0)).collect();let file:Vec<u16>=path.as_os_str().encode_wide().chain(Some(0)).collect();
  // Invoke the registered document/folder handler, never a command interpreter.
  let result=unsafe{ShellExecuteW(std::ptr::null_mut(),operation.as_ptr(),file.as_ptr(),std::ptr::null(),std::ptr::null(),1)};
  if result<=32{return Err("No application could open this output");}Ok(())
 }
 #[cfg(not(windows))]{
  let mut command=std::process::Command::new(if cfg!(target_os="macos"){ "/usr/bin/open" }else{"xdg-open"});
  if cfg!(target_os="macos"){command.arg("--");}command.arg(path).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
  let mut child=command.spawn().map_err(|_|"No application could open this output")?;std::thread::spawn(move||{let _=child.wait();});Ok(())
 }
}
#[cfg(test)]mod tests{use super::*;use std::fs;
 #[test]fn only_registered_unchanged_documents_can_be_opened(){
  let base=std::fs::canonicalize(std::env::temp_dir()).unwrap();
  #[cfg(windows)]let base=PathBuf::from(base.to_string_lossy().strip_prefix(r"\\?\").unwrap().to_string());
  let dir=base.join(format!("sorafiles-output-{}",Uuid::new_v4()));fs::create_dir(&dir).unwrap();let path=dir.join("result.pdf");fs::write(&path,b"synthetic pdf").unwrap();
  let mut outputs=Outputs::default();assert!(outputs.resolve("injected-path").is_err());let id=outputs.register(&path).unwrap();assert_eq!(outputs.resolve(&id).unwrap(),path);
  fs::write(&path,b"changed").unwrap();assert!(outputs.resolve(&id).is_err());let exe=dir.join("result.exe");fs::write(&exe,b"not executable").unwrap();assert!(outputs.register(&exe).is_err());
  outputs.clear();assert!(outputs.resolve(&id).is_err());fs::remove_file(path).unwrap();fs::remove_file(exe).unwrap();fs::remove_dir(dir).unwrap();
 }
 #[test]fn saved_results_expose_only_ids_and_missing_files_do_not_rewrite_success(){
  let base=std::fs::canonicalize(std::env::temp_dir()).unwrap();
  #[cfg(windows)]let base=PathBuf::from(base.to_string_lossy().strip_prefix(r"\\?\").unwrap().to_string());
  let dir=base.join(format!("sorafiles-results-{}",Uuid::new_v4()));fs::create_dir(&dir).unwrap();let output=dir.join("result.pdf");fs::write(&output,b"synthetic").unwrap();let source=dir.join("source.pdf");let mut ledger=Outputs::default();
  let result=public_result(json!({"state":"completed","path":output,"bytes":9}),&[source.clone()],None,&mut ledger).unwrap();
  assert!(result.get("path").is_none());assert_eq!(ledger.resolve(result["outputId"].as_str().unwrap()).unwrap(),output);
  let batch=public_result(json!({"state":"batch","results":[{"index":0,"state":"completed","name":"result.pdf","bytes":9}]}),&[source],None,&mut ledger).unwrap();assert!(batch["results"][0]["outputId"].is_string());
  fs::remove_file(&output).unwrap();let missing=public_result(json!({"state":"completed","path":output,"bytes":9}),&[],None,&mut ledger).unwrap();assert_eq!(missing["state"],"completed");assert!(missing.get("outputId").is_none());fs::remove_dir(dir).unwrap();
 }
}
