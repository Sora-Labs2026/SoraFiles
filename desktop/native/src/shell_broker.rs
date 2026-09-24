use std::{fs::{self,OpenOptions},io::{Read,Write},path::{Path,PathBuf}};
use serde_json::{json,Value};

fn ordinary(path:&Path,directory:bool)->Result<(),String>{
 let meta=fs::symlink_metadata(path).map_err(|_|"Menu request unavailable")?;
 if meta.file_type().is_symlink()||directory!=meta.is_dir()||!directory&&!meta.is_file(){return Err("Invalid menu request location".into());}
 #[cfg(windows)]{use std::os::windows::fs::MetadataExt;if meta.file_attributes()&0x400!=0{return Err("Invalid menu request location".into());}}
 Ok(())
}
fn request(input:&Path,output:&Path)->Result<Vec<PathBuf>,String>{
 let parent=input.parent().ok_or("Invalid menu request")?;
 if input.file_name().and_then(|s|s.to_str())!=Some("request.json")||output!=parent.join("response.tsv"){return Err("Invalid menu request".into());}
 let name=parent.file_name().and_then(|s|s.to_str()).ok_or("Invalid menu request")?;
 let id=name.strip_prefix("sorafiles-shell-").ok_or("Invalid menu request")?;
 uuid::Uuid::parse_str(id).map_err(|_|"Invalid menu request")?;
 ordinary(parent,true)?;ordinary(input,false)?;
 let base=parent.parent().ok_or("Invalid menu request")?.canonicalize().map_err(|_|"Invalid menu request")?;
 if base!=std::env::temp_dir().canonicalize().map_err(|_|"Temporary folder unavailable")?{return Err("Invalid menu request location".into());}
 if output.try_exists().map_err(|_|"Menu response unavailable")?{return Err("Menu response already exists".into());}
 let mut bytes=Vec::new();fs::File::open(input).map_err(|_|"Menu request unavailable")?.take(65537).read_to_end(&mut bytes).map_err(|_|"Menu request unavailable")?;
 if bytes.len()>65536{return Err("Menu request too large".into());}
 let value:Value=serde_json::from_slice(&bytes).map_err(|_|"Invalid menu request")?;
 if value.as_object().is_none_or(|row|row.len()!=2)||value["version"]!=1{return Err("Invalid menu request".into());}
 let files:Vec<String>=serde_json::from_value(value["files"].clone()).map_err(|_|"Invalid menu files")?;
 let mut args=vec!["--edit".into()];args.extend(files);
 crate::launch::selected_paths(&args).map_err(String::from)
}
pub fn run(directory:&Path,resources:&Path,input:&Path,output:&Path)->Result<(),String>{
 let paths=request(input,output)?;
 let mut selected=crate::selection::Selection::default();let selection=selected.add(paths);
 if selection.rejected||selection.files.is_empty(){return Err("Selection unavailable".into());}
 let settings=crate::preferences::load(directory).map_err(String::from)?.value();
 if settings.get("shellEntry").and_then(Value::as_bool)==Some(false){return Err("File-manager actions disabled".into());}
 let result=crate::license_host::run(directory,resources,"nativeActions",json!({"files":selection.files,"platform":std::env::consts::OS,"outputMode":settings["output"]}))?;
 let mut text=String::new();
 for action in result["actions"].as_array().ok_or("Menu unavailable")?{
  let id=action["id"].as_str().ok_or("Menu unavailable")?;let label=action["label"].as_str().ok_or("Menu unavailable")?;
  if id.contains(['\t','\n','\r'])||label.chars().any(char::is_control){return Err("Invalid menu action".into());}
  text.push_str(id);text.push('\t');text.push_str(label);text.push('\n');
 }
 if text.len()>65536{return Err("Menu too large".into());}
 ordinary(input.parent().unwrap(),true)?;
 let mut options=OpenOptions::new();options.write(true).create_new(true);
 #[cfg(unix)]{use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
 let mut file=options.open(output).map_err(|_|"Menu response unavailable")?;
 file.write_all(text.as_bytes()).and_then(|_|file.sync_all()).map_err(|_|"Menu response unavailable".into())
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn request_is_limited_to_unique_local_temporary_files(){
  let dir=std::env::temp_dir().join(format!("sorafiles-shell-{}",uuid::Uuid::new_v4()));fs::create_dir(&dir).unwrap();
  let input=dir.join("request.json");let output=dir.join("response.tsv");
  let path=std::env::temp_dir().join("file space Ω.png");
  fs::write(&input,serde_json::to_vec(&json!({"version":1,"files":[path]})).unwrap()).unwrap();
  assert_eq!(request(&input,&output).unwrap(),vec![path]);
  assert!(request(&input,&dir.join("other.tsv")).is_err());
  fs::write(&output,"existing").unwrap();assert!(request(&input,&output).is_err());fs::remove_file(&output).unwrap();
  fs::write(&input,vec![b'x';65537]).unwrap();assert!(request(&input,&output).is_err());
  fs::remove_file(input).unwrap();fs::remove_dir(dir).unwrap();
 }
}
