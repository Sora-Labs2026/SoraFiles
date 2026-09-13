use serde_json::{json,Value};
use std::{io::{BufRead,BufReader,Read,Write},path::Path,process::{Command,Stdio},sync::{mpsc,atomic::{AtomicBool,Ordering}},time::{Duration,Instant}};
use crate::{license_host,vault::{self,OsKeyStore,KeyStore}};

pub fn run(directory:&Path,resources:&Path,params:Value,cancel:&AtomicBool,on_progress:impl Fn(Value))->Result<Value,String>{
 let (runtime,entry,config)=license_host::locations(resources)?;
 run_component(directory,&runtime,&entry.with_file_name("process-main.mjs"),config,params,cancel,on_progress,&OsKeyStore)
}
pub(crate) fn run_component(directory:&Path,runtime:&Path,entry:&Path,config:Value,params:Value,cancel:&AtomicBool,on_progress:impl Fn(Value),store:&impl KeyStore)->Result<Value,String>{
 let state=vault::load(directory,store)?.ok_or("Start a trial or activate a license first")?;
 let state:Value=serde_json::from_slice(&state).map_err(|_|"Private state is damaged")?;license_host::validate_state(&state)?;
 let mut command=Command::new(runtime);command.arg(entry).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
 for name in ["SystemRoot","WINDIR","TEMP","TMP","TMPDIR"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 let mut child=command.spawn().map_err(|_|"Processing component could not start")?;
 let mut input=child.stdin.take().ok_or("Processing connection unavailable")?;let output=child.stdout.take().ok_or("Processing connection unavailable")?;
 let (sender,receiver)=mpsc::sync_channel(2);
 let reader=std::thread::spawn(move||{let mut reader=BufReader::new(output);loop{let mut line=Vec::new();if !matches!(reader.by_ref().take(65537).read_until(b'\n',&mut line),Ok(n) if n>0&&n<=65536){break;}if sender.send(line).is_err(){break;}}});
 let started=Instant::now();let outcome=(||{
  let mut request=params;request["type"]=json!("process");request["state"]=state;request["config"]=config;write_frame(&mut input,&request)?;
  let mut cancelled=false;let mut writes=0;
  loop{
   if started.elapsed()>Duration::from_secs(1800){return Err("Processing stopped responding. Check the output folder before trying again.".into());}
   if cancel.load(Ordering::SeqCst)&&!cancelled {write_frame(&mut input,&json!({"type":"cancel"}))?;cancelled=true;}
   let line=match receiver.recv_timeout(Duration::from_millis(100)){Ok(line)=>line,Err(mpsc::RecvTimeoutError::Timeout)=>continue,Err(_)=>return Err("Processing closed unexpectedly. Check the output folder before trying again.".into())};
   let message:Value=serde_json::from_slice(&line).map_err(|_|"Invalid processing response")?;
   match message["type"].as_str(){
    Some("save")=>{writes+=1;if writes>2{return Err("Unexpected private write".into());}let state=&message["state"];license_host::validate_state(state)?;vault::save(directory,&serde_json::to_vec(state).map_err(|_|"Invalid private state")?,store)?;write_frame(&mut input,&json!({"type":"saved","ok":true}))?;},
    Some("progress")=>{if matches!(message["state"].as_str(),Some("queued"|"running"|"completed"|"failed"|"cancelled")){on_progress(json!({"state":message["state"]}));}},
    Some("result")=>{let result=message["result"].clone();validate_result(&result)?;return Ok(result);},
    Some("error")=>return Err("Processing could not finish. Check the selected files and options, then try again.".into()),
    _=>return Err("Invalid processing response".into())
   }
  }
 })();
 drop(input);let _=child.kill();let _=child.wait();drop(receiver);let _=reader.join();outcome
}
fn write_frame(writer:&mut impl Write,value:&Value)->Result<(),String>{let bytes=serde_json::to_vec(value).map_err(|_|"Invalid request")?;if bytes.len()>65535{return Err("Choose fewer files for this job".into());}writer.write_all(&bytes).and_then(|_|writer.write_all(b"\n")).and_then(|_|writer.flush()).map_err(|_|"Processing connection closed".into())}
fn validate_result(value:&Value)->Result<(),String>{
 let fields=value.as_object().ok_or("Invalid processing result")?;
 if value["state"]=="cancelled"&&fields.len()==1{return Ok(());}
 if value["state"]!="completed"||fields.keys().any(|key|!matches!(key.as_str(),"state"|"path"|"bytes"|"warnings"|"cleanupPending"))
  ||!value["path"].as_str().is_some_and(|path|path.len()<32768&&Path::new(path).is_absolute())
  ||!value["bytes"].as_u64().is_some_and(|size|size>0&&size<=256*1024*1024)
  ||fields.get("cleanupPending").is_some_and(|flag|!flag.is_boolean())
  ||fields.get("warnings").is_some_and(|warnings|!warnings.as_array().is_some_and(|list|list.len()<=16&&list.iter().all(|text|text.as_str().is_some_and(|s|s.len()<=512)))) {return Err("Invalid processing result".into());}
 Ok(())
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn processing_results_are_bounded(){assert!(validate_result(&json!({"state":"cancelled"})).is_ok());for result in [json!({"state":"completed","path":"relative.pdf","bytes":1}),json!({"state":"completed","path":"/tmp/file.pdf","bytes":1,"licenseKey":"secret"}),json!({"state":"cancelled","bytes":1})]{assert!(validate_result(&result).is_err());}}
}
