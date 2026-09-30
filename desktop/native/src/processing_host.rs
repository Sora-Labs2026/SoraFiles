use serde_json::{json,Value};
use std::{io::{BufRead,BufReader,Read,Write},path::Path,process::{Command,Stdio},sync::{mpsc,atomic::{AtomicBool,Ordering}},time::{Duration,Instant}};
use crate::{license_host,vault::{self,OsKeyStore,KeyStore}};
// A bounded batch may include 256 output names and engine warnings. Requests
// remain limited to 64 KiB; no full output file bytes travel through this pipe.
const MAX_RESPONSE:u64=4*1024*1024;

pub fn run(directory:&Path,resources:&Path,params:Value,cancel:&AtomicBool,on_progress:impl Fn(Value))->Result<Value,String>{
 let (runtime,entry,config)=license_host::locations(resources)?;
 run_component(directory,&runtime,&entry.with_file_name("process-main.mjs"),config,params,cancel,on_progress,&OsKeyStore)
}
pub(crate) fn run_component(directory:&Path,runtime:&Path,entry:&Path,config:Value,params:Value,cancel:&AtomicBool,on_progress:impl Fn(Value),store:&impl KeyStore)->Result<Value,String>{
 let state=vault::load(directory,store)?.ok_or("Start a trial or activate a license first")?;
 let state:Value=serde_json::from_slice(&state).map_err(|_|"Private state is damaged")?;license_host::validate_state(&state)?;
 if cancel.load(Ordering::SeqCst){return Ok(json!({"state":"cancelled"}));}
 // Keep these alive until the component has exited, including cancellation and
 // error cleanup. No renderer-controlled path bypasses this Windows boundary.
 #[cfg(windows)] let _pins=crate::file_pins::FilePins::for_request(&params)?;
 let mut command=Command::new(runtime);command.arg(entry).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
 for name in ["SystemRoot","WINDIR","TEMP","TMP","TMPDIR"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 #[cfg(unix)] let mut child=crate::unix_process_group::ProcessGroup::spawn(&mut command).map_err(|_|"Processing component could not start")?;
 #[cfg(not(unix))] let mut child=command.spawn().map_err(|_|"Processing component could not start")?;
 #[cfg(windows)] let process_job=crate::process_job::ProcessJob::attach(&mut child)?;
 let mut input=child.stdin.take().ok_or("Processing connection unavailable")?;let output=child.stdout.take().ok_or("Processing connection unavailable")?;
 #[cfg(not(unix))] let (sender,receiver)=mpsc::sync_channel(2);
 #[cfg(unix)] let (receiver,reader)=crate::unix_process_group::FrameReader::start(output,MAX_RESPONSE as usize);
 #[cfg(not(unix))] let reader=std::thread::spawn(move||{let mut reader=BufReader::new(output);loop{let mut line=Vec::new();if !matches!(reader.by_ref().take(MAX_RESPONSE+1).read_until(b'\n',&mut line),Ok(n) if n>0&&n<=MAX_RESPONSE as usize){break;}if sender.send(line).is_err(){break;}}});
 let started=Instant::now();let outcome=(||{
  let mut request=params;request["type"]=json!("process");request["state"]=state;request["config"]=config;request["nativePublication"]=json!(cfg!(windows));write_frame(&mut input,&request)?;
  let mut cancelled=false;let mut writes=0;
  #[cfg(windows)]let mut publications=0;
  loop{
   if started.elapsed()>Duration::from_secs(1800){return Err("Processing stopped responding. Check the output folder before trying again.".into());}
   if cancel.load(Ordering::SeqCst)&&!cancelled {write_frame(&mut input,&json!({"type":"cancel"}))?;cancelled=true;}
   let line=match receiver.recv_timeout(Duration::from_millis(100)){Ok(line)=>line,Err(mpsc::RecvTimeoutError::Timeout)=>continue,Err(_)=>return Err("Processing closed unexpectedly. Check the output folder before trying again.".into())};
   let message:Value=serde_json::from_slice(&line).map_err(|_|"Invalid processing response")?;
   match message["type"].as_str(){
    #[cfg(windows)]Some("publish")=>{
     publications+=1;if publications>256{return Err("Too many output publications".into());}
     // The engine has already entered its commit boundary. Do not turn a
     // successfully published file into a cancelled result.
     let result=crate::publication::publish(&message,&request).unwrap_or_else(|_|json!({"type":"published","ok":false}));
     write_frame(&mut input,&result)?;
    },
    Some("save")=>{writes+=1;if writes>2{return Err("Unexpected private write".into());}let state=&message["state"];license_host::validate_state(state)?;vault::save(directory,&serde_json::to_vec(state).map_err(|_|"Invalid private state")?,store)?;write_frame(&mut input,&json!({"type":"saved","ok":true}))?;},
    Some("progress")=>{if matches!(message["state"].as_str(),Some("queued"|"running"|"completed"|"failed"|"cancelled")){on_progress(json!({"state":message["state"]}));}},
    Some("result")=>{let result=message["result"].clone();validate_result(&result)?;return Ok(result);},
    Some("error")=>return Err("Processing could not finish. Check the selected files and options, then try again.".into()),
    _=>return Err("Invalid processing response".into())
   }
  }
 })();
 drop(input);
 #[cfg(windows)] drop(process_job);
 #[cfg(unix)] child.cleanup();
 #[cfg(not(unix))] let _=child.kill();
 #[cfg(not(unix))] let _=child.wait();
 drop(receiver);
 #[cfg(unix)] drop(reader);
 #[cfg(not(unix))] let _=reader.join();
 outcome
}
// On-screen previews: a separate short-lived component that needs no licence
// state and writes nothing. Paths come from the native selection only.
const PREVIEW_FILES:usize=24;
pub fn run_preview(resources:&Path,paths:&[std::path::PathBuf])->Result<Value,String>{
 let (runtime,entry,_)=license_host::locations(resources)?;
 run_preview_component(&runtime,&entry.with_file_name("preview-main.mjs"),paths)
}
pub(crate) fn run_preview_component(runtime:&Path,entry:&Path,paths:&[std::path::PathBuf])->Result<Value,String>{
 let paths=&paths[..paths.len().min(PREVIEW_FILES)];
 if paths.is_empty(){return Err("Choose files first".into());}
 let mut command=Command::new(runtime);command.arg(entry).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
 for name in ["SystemRoot","WINDIR","TEMP","TMP","TMPDIR"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 #[cfg(unix)] let mut child=crate::unix_process_group::ProcessGroup::spawn(&mut command).map_err(|_|"Preview component could not start")?;
 #[cfg(not(unix))] let mut child=command.spawn().map_err(|_|"Preview component could not start")?;
 #[cfg(windows)] let process_job=crate::process_job::ProcessJob::attach(&mut child)?;
 let mut input=child.stdin.take().ok_or("Preview connection unavailable")?;let output=child.stdout.take().ok_or("Preview connection unavailable")?;
 #[cfg(not(unix))] let (sender,receiver)=mpsc::sync_channel(2);
 #[cfg(unix)] let (receiver,reader)=crate::unix_process_group::FrameReader::start(output,MAX_RESPONSE as usize);
 #[cfg(not(unix))] let reader=std::thread::spawn(move||{let mut reader=BufReader::new(output);loop{let mut line=Vec::new();if !matches!(reader.by_ref().take(MAX_RESPONSE+1).read_until(b'\n',&mut line),Ok(n) if n>0&&n<=MAX_RESPONSE as usize){break;}if sender.send(line).is_err(){break;}}});
 let outcome=(||{
  write_frame(&mut input,&json!({"type":"preview","paths":paths}))?;
  let line=receiver.recv_timeout(Duration::from_secs(90)).map_err(|_|"Preview unavailable")?;
  let message:Value=serde_json::from_slice(&line).map_err(|_|"Invalid preview response")?;
  if message["type"]!="result"{return Err("Preview unavailable".into());}
  let result=message["result"].clone();validate_preview(&result,paths.len())?;Ok(result)
 })();
 drop(input);
 #[cfg(windows)] drop(process_job);
 #[cfg(unix)] child.cleanup();
 #[cfg(not(unix))] let _=child.kill();
 #[cfg(not(unix))] let _=child.wait();
 drop(receiver);
 #[cfg(unix)] drop(reader);
 #[cfg(not(unix))] let _=reader.join();
 outcome
}
fn preview_source(value:&Value,mime:&str,total:&mut usize)->bool{
 let prefix=format!("data:{mime};base64,");
 value.as_str().is_some_and(|text|{
  let valid=text.starts_with(&prefix)&&text.len()>prefix.len()&&text.len()<=3_500_000
   &&text[prefix.len()..].bytes().all(|b|b.is_ascii_alphanumeric()||matches!(b,b'+'|b'/'|b'='));
  *total+=text.len();valid
 })
}
fn preview_size(value:&Value,max:u64)->bool{value.as_u64().is_some_and(|n|n>=1&&n<=max)}
fn validate_preview(value:&Value,count:usize)->Result<(),String>{
 let invalid=||"Invalid preview".to_string();
 let previews=value["previews"].as_array().ok_or_else(invalid)?;
 if value.as_object().is_none_or(|fields|fields.len()!=1)||previews.len()>PREVIEW_FILES{return Err(invalid());}
 let (mut total,mut last)=(0usize,None::<u64>);
 for preview in previews{
  let fields=preview.as_object().ok_or_else(invalid)?;
  let index=preview["index"].as_u64().ok_or_else(invalid)?;
  if index as usize>=count||last.is_some_and(|previous|index<=previous){return Err(invalid());}last=Some(index);
  let valid=match preview["kind"].as_str(){
   Some("image")=>fields.len()==7&&["width","height","sourceWidth","sourceHeight"].iter().all(|key|preview_size(&preview[*key],16000))
    &&preview_source(&preview["src"],"image/webp",&mut total),
   Some("pdf")=>fields.len()==4&&preview_size(&preview["pages"],100_000)&&preview["thumbs"].as_array().is_some_and(|thumbs|thumbs.len()<=100&&thumbs.iter().all(|thumb|
    thumb.as_object().is_some_and(|keys|keys.len()==4)&&preview_size(&thumb["page"],preview["pages"].as_u64().unwrap_or(0))
    &&preview_size(&thumb["width"],4000)&&preview_size(&thumb["height"],4000)&&preview_source(&thumb["src"],"image/jpeg",&mut total))),
   _=>false
  };
  if !valid||total>MAX_RESPONSE as usize{return Err(invalid());}
 }
 Ok(())
}
fn write_frame(writer:&mut impl Write,value:&Value)->Result<(),String>{let bytes=serde_json::to_vec(value).map_err(|_|"Invalid request")?;if bytes.len()>65535{return Err("Choose fewer files for this job".into());}writer.write_all(&bytes).and_then(|_|writer.write_all(b"\n")).and_then(|_|writer.flush()).map_err(|_|"Processing connection closed".into())}
fn validate_result(value:&Value)->Result<(),String>{
 let fields=value.as_object().ok_or("Invalid processing result")?;
 if value["state"]=="batch"{
  let results=value["results"].as_array().ok_or("Invalid batch results")?;
  if fields.len()!=2||results.is_empty()||results.len()>256{return Err("Invalid batch results".into());}
  for (index,row) in results.iter().enumerate(){
   let fields=row.as_object().ok_or("Invalid batch result")?;
   if row["index"].as_u64()!=Some(index as u64){return Err("Invalid batch index".into());}
   if matches!(row["state"].as_str(),Some("failed"|"cancelled"))&&fields.len()==2{continue;}
   if row["state"]!="completed"||fields.keys().any(|key|!matches!(key.as_str(),"index"|"state"|"name"|"bytes"|"warnings"|"cleanupPending"))
    ||!row["name"].as_str().is_some_and(|name|!name.is_empty()&&name.len()<=1024&&!name.contains(['/', '\\'])&&!name.chars().any(char::is_control))
    ||!valid_output_details(row){return Err("Invalid batch output".into());}
  }
  return Ok(());
 }
 if value["state"]=="cancelled"&&fields.len()==1{return Ok(());}
 if value["state"]!="completed"||fields.keys().any(|key|!matches!(key.as_str(),"state"|"path"|"bytes"|"warnings"|"cleanupPending"))
  ||!value["path"].as_str().is_some_and(|path|path.len()<32768&&Path::new(path).is_absolute())
  ||!valid_output_details(value) {return Err("Invalid processing result".into());}
 Ok(())
}
fn valid_output_details(value:&Value)->bool{
 value["bytes"].as_u64().is_some_and(|size|size>0&&size<=256*1024*1024)
 &&value.get("cleanupPending").is_none_or(Value::is_boolean)
 &&value.get("warnings").is_none_or(|warnings|warnings.as_array().is_some_and(|list|list.len()<=16&&list.iter().all(|text|text.as_str().is_some_and(|s|s.len()<=512))))
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn previews_accept_only_bounded_image_data_urls_in_order(){
  let image=json!({"index":0,"kind":"image","src":"data:image/webp;base64,AAAA","width":10,"height":5,"sourceWidth":100,"sourceHeight":50});
  let pdf=json!({"index":1,"kind":"pdf","pages":3,"thumbs":[{"page":1,"src":"data:image/jpeg;base64,AA==","width":20,"height":28}]});
  assert!(validate_preview(&json!({"previews":[image.clone(),pdf.clone()]}),2).is_ok());
  assert!(validate_preview(&json!({"previews":[]}),1).is_ok());
  let mut script=image.clone();script["src"]=json!("data:text/html;base64,AAAA");
  let mut unsafe_chars=image.clone();unsafe_chars["src"]=json!("data:image/webp;base64,AA\"><script>");
  let mut extra=image.clone();extra["path"]=json!("C:/secret.png");
  let mut page=pdf.clone();page["thumbs"][0]["page"]=json!(4);
  for previews in [json!([script]),json!([unsafe_chars]),json!([extra]),json!([page]),json!([pdf.clone(),image.clone()]),json!([image.clone(),image.clone()])]{
   assert!(validate_preview(&json!({"previews":previews}),2).is_err());
  }
  assert!(validate_preview(&json!({"previews":[pdf]}),1).is_err(),"index outside the selection");
  assert!(validate_preview(&json!({"previews":[image],"extra":1}),1).is_err());
 }
 #[test]fn processing_results_are_bounded(){assert!(validate_result(&json!({"state":"cancelled"})).is_ok());for result in [json!({"state":"completed","path":"relative.pdf","bytes":1}),json!({"state":"completed","path":"/tmp/file.pdf","bytes":1,"licenseKey":"secret"}),json!({"state":"cancelled","bytes":1})]{assert!(validate_result(&result).is_err());}}
 #[test]fn batch_results_preserve_order_and_reject_paths_and_private_fields(){
  let valid=json!({"state":"batch","results":[{"index":0,"state":"completed","name":"saved.pdf","bytes":12},{"index":1,"state":"failed"},{"index":2,"state":"cancelled"}]});
  assert!(validate_result(&valid).is_ok());
  for row in [json!({"index":1,"state":"failed"}),json!({"index":0,"state":"completed","name":"../saved.pdf","bytes":12}),json!({"index":0,"state":"failed","licenseKey":"secret"}),json!({"index":0,"state":"completed","name":"saved.pdf","bytes":0})]{assert!(validate_result(&json!({"state":"batch","results":[row]})).is_err());}
  assert!(validate_result(&json!({"state":"batch","results":[]})).is_err());
 }
}
