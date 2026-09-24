use std::{path::{Path,PathBuf},process::{Command,Stdio},time::{Instant,Duration}};
fn launcher(executable:PathBuf)->Result<PathBuf,String>{
 #[cfg(target_os="linux")]
 if let (Some(image),Some(mount))=(std::env::var_os("APPIMAGE"),std::env::var_os("APPDIR")){
  use std::io::Read;
  let image=PathBuf::from(image);let mount=PathBuf::from(mount);
  if !image.is_absolute()||!mount.is_absolute(){return Err("AppImage location unavailable".into());}
  let mount=mount.canonicalize().map_err(|_|"AppImage location unavailable")?;
  if !executable.canonicalize().map_err(|_|"Application location unavailable")?.starts_with(&mount){return Ok(executable);}
  let mut header=[0u8;11];std::fs::File::open(&image).and_then(|mut file|file.read_exact(&mut header)).map_err(|_|"AppImage location unavailable")?;
  if &header[..4]!=b"\x7fELF"||&header[8..]!=b"AI\x02"{return Err("AppImage location unavailable".into());}
  // The mount disappears on Quit; the persistent AppImage must receive future
  // file-manager actions so it can recreate the mount and restart the helper.
  return Ok(image);
 }
 Ok(executable)
}
pub fn set_enabled(resources:&Path,enabled:bool)->Result<bool,String>{
 let executable=launcher(std::env::current_exe().map_err(|_|"Application location unavailable")?)?;
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
