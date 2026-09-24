use std::{path::Path,process::{Command,Stdio},time::{Instant,Duration}};
pub fn set_enabled(resources:&Path,enabled:bool)->Result<bool,String>{
 let executable=std::env::current_exe().map_err(|_|"Application location unavailable")?;
 let (runtime,_,_)=crate::license_host::locations(resources)?;
 let helper=runtime.parent().ok_or("Desktop components unavailable")?.join("desktop/scripts/unix-shell-integration.mjs");
 let mut command=Command::new(runtime);command.arg(helper).arg(if enabled{"enable"}else{"disable"}).arg(executable).env_clear().stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
 for name in ["HOME","TMPDIR","XDG_DATA_HOME","XDG_CONFIG_HOME"]{if let Some(value)=std::env::var_os(name){command.env(name,value);}}
 let mut child=command.spawn().map_err(|_|"File-manager actions could not be updated")?;
 let started=Instant::now();
 loop {
  match child.try_wait(){Ok(Some(status))=>return if status.success(){Ok(enabled)}else{Err("File-manager actions could not be updated. An existing entry may belong to another installation.".into())},Err(_)=>{let _=child.kill();let _=child.wait();return Err("File-manager actions could not be updated".into());},_=>{}}
  if started.elapsed()>Duration::from_secs(10){let _=child.kill();let _=child.wait();return Err("File-manager actions took too long to update".into());}
  std::thread::sleep(Duration::from_millis(25));
 }
}
