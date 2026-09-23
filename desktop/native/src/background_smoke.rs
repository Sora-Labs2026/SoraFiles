//! Development-only real offline job diagnostic. No installed credentials.
use std::{cell::RefCell, io::{BufRead, BufReader, Read}, path::PathBuf, process::{Child, Command, Stdio}};
use serde_json::{json, Value};
use tauri::Manager;
use zeroize::Zeroizing;
use crate::{HostState, license_host, outputs, processing_host, vault::KeyStore};

#[derive(Default)]
struct MemoryKeys(RefCell<Option<Vec<u8>>>);
impl KeyStore for MemoryKeys {
    fn read(&self)->Result<Option<Zeroizing<Vec<u8>>>, &'static str>{Ok(self.0.borrow().clone().map(Zeroizing::new))}
    fn create(&self,key:&[u8])->Result<(), &'static str>{*self.0.borrow_mut()=Some(key.to_vec());Ok(())}
}
pub struct Fixture { directory:PathBuf, server:Option<Child> }
impl Drop for Fixture {
    fn drop(&mut self){
        if let Some(server)=&mut self.server{let _=server.kill();let _=server.wait();}
        // Only this freshly generated directory belongs to the diagnostic.
        let _=std::fs::remove_dir_all(&self.directory);
    }
}
fn command(program:impl AsRef<std::ffi::OsStr>)->Command{
    let mut command=Command::new(program);
    command.stderr(Stdio::null());
    #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
    command
}
pub fn run(app:&tauri::AppHandle)->Result<(Value,Fixture),String>{
    if app.get_webview_window("main").is_some(){return Err("The original WebView was not destroyed".into());}
    let directory=std::env::temp_dir().join(format!("sorafiles-background-smoke-{}",uuid::Uuid::new_v4()));
    std::fs::create_dir(&directory).map_err(|_|"Diagnostic directory unavailable")?;
    let mut fixture=Fixture{directory,server:None};
    let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let server=command("node").arg(root.join("tests/fixtures/native-license-service.mjs"))
        .stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().map_err(|_|"Diagnostic service unavailable")?;
    fixture.server=Some(server);
    let mut line=String::new();
    BufReader::new(fixture.server.as_mut().unwrap().stdout.take().ok_or("Diagnostic pipe unavailable")?)
        .take(65536).read_line(&mut line).map_err(|_|"Diagnostic service unavailable")?;
    let connection:Value=serde_json::from_str(&line).map_err(|_|"Diagnostic response invalid")?;
    let runtime=PathBuf::from(connection["runtime"].as_str().ok_or("Diagnostic runtime missing")?);
    let config=connection["config"].clone();let keys=MemoryKeys::default();
    let entry=root.join("native-host/main.mjs");
    let trial=license_host::run_component(&fixture.directory,&runtime,&entry,config.clone(),"trial",json!({}),&keys)?;
    if trial["license"]!="trial"{return Err("Diagnostic trial failed".into());}
    // The entitlement must authorize processing with its service stopped.
    if let Some(mut server)=fixture.server.take(){let _=server.kill();let _=server.wait();}
    let folder=std::fs::canonicalize(&fixture.directory).map_err(|_|"Diagnostic directory unavailable")?;
    #[cfg(windows)]let folder=PathBuf::from(folder.to_string_lossy().strip_prefix(r"\\?\").ok_or("Unexpected diagnostic path")?.to_owned());
    let source=folder.join("Synthetic background fixture.pdf");let pdf=root.join("tests/fixtures/processing-pdf.mjs");
    if !command(&runtime).arg(&pdf).arg("create").arg(&source).status().map_err(|_|"Diagnostic PDF unavailable")?.success(){return Err("Diagnostic PDF failed".into());}
    let original=std::fs::read(&source).map_err(|_|"Diagnostic input unavailable")?;
    let state=app.state::<HostState>();
    let progress_without_window=std::cell::Cell::new(false);
    let result=processing_host::run_component(&fixture.directory,&runtime,&entry.with_file_name("process-main.mjs"),config,
        json!({"tool":"rotate-pdf","paths":[source],"options":{"rotations":[{"pageIndex":0,"angle":90}]}}),
        &state.processing_cancel,|_|{if app.get_webview_window("main").is_none(){progress_without_window.set(true);}},&keys)?;
    if result["state"]!="completed"||!progress_without_window.get()||app.get_webview_window("main").is_some(){return Err("Diagnostic did not complete without a WebView".into());}
    let output=PathBuf::from(result["path"].as_str().ok_or("Diagnostic output missing")?);
    if std::fs::read(&source).map_err(|_|"Diagnostic input missing")?!=original
        ||!command(&runtime).arg(&pdf).arg("verify").arg(&output).status().map_err(|_|"Diagnostic verification unavailable")?.success(){return Err("Diagnostic output verification failed".into());}
    let mut ledger=state.outputs.lock().map_err(|_|"Outputs unavailable")?;
    let public=outputs::public_result(result,&[source],None,&mut ledger)?;
    if !public["outputId"].is_string(){return Err("Diagnostic output action missing".into());}
    Ok((public,fixture))
}
