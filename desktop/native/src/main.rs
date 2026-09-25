#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod selection;
mod bridge_policy;
mod launch;
mod preferences;
mod classify;
mod vault;
mod license_host;
mod license_schedule;
mod shell_broker;
mod processing_host;
mod outputs;
mod job_status;
mod checkout;
#[cfg(debug_assertions)] mod background_smoke;
#[cfg(windows)] mod file_pins;
#[cfg(windows)] mod process_job;
#[cfg(windows)] mod publication;
#[cfg(windows)] mod startup;
#[cfg(windows)] mod shell_entry;
#[cfg(any(target_os = "macos", target_os = "linux"))] mod unix_shell_entry;
#[cfg(unix)] mod unix_process_group;
#[cfg(any(target_os = "macos", target_os = "linux"))] mod unix_startup;
use bridge_policy::{DialogLease, local_navigation, valid_request};
use selection::Selection;
use serde_json::{json, Value};
use std::sync::{Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}};
use tauri::{Manager, Emitter, WebviewUrl, WebviewWindowBuilder, RunEvent, DragDropEvent, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_dialog::DialogExt;

struct HostState { launch_busy:AtomicBool, launch_intent:Mutex<Value>, #[cfg(debug_assertions)] smoke_fixture:Mutex<Option<background_smoke::Fixture>>, window_closing:Mutex<bool>, retain_job:AtomicBool, job:Mutex<job_status::JobStatus>, selection: Mutex<Selection>, outputs: Mutex<outputs::Outputs>, settings: Mutex<Value>, quitting: AtomicBool, tray_available: AtomicBool, smoke_count: AtomicUsize, window_generation: AtomicUsize, dialog_busy: AtomicBool, processing_busy: AtomicBool, processing_cancel: AtomicBool }
impl Default for HostState {
    fn default() -> Self { Self { launch_busy:AtomicBool::new(false), launch_intent:Mutex::new(Value::Null), #[cfg(debug_assertions)] smoke_fixture:Mutex::new(None), window_closing:Mutex::new(false), retain_job:AtomicBool::new(false), job:Mutex::new(job_status::JobStatus::default()), selection: Mutex::new(Selection::default()), outputs:Mutex::new(outputs::Outputs::default()), settings: Mutex::new(json!({"output":"source","theme":"system","startup":false})), quitting: AtomicBool::new(false), tray_available: AtomicBool::new(false), smoke_count:AtomicUsize::new(0), window_generation:AtomicUsize::new(0), dialog_busy:AtomicBool::new(false), processing_busy:AtomicBool::new(false), processing_cancel:AtomicBool::new(false) } }
}
fn smoke_output() -> Option<std::path::PathBuf> { let args:Vec<_>=std::env::args().collect();let index=args.iter().position(|arg| arg=="--native-smoke")?;args.get(index+1).map(std::path::PathBuf::from) }
fn background_smoke() -> bool { cfg!(debug_assertions) && smoke_output().is_some() && std::env::args().any(|arg|arg=="--background-job") }
fn startup_smoke() -> bool { cfg!(debug_assertions) && smoke_output().is_some() && std::env::args().any(|arg|arg=="--startup-helper") }
fn diagnostic_step(step: &str) { if smoke_output().is_some() { eprintln!("Native diagnostic: {step}"); } }
fn receive_launch(app: &tauri::AppHandle, args: &[String]) -> bool {
    let Ok(paths)=launch::selected_paths(args) else { return false; };
    if paths.is_empty() { return false; }
    if app.state::<HostState>().processing_busy.load(Ordering::SeqCst)||app.state::<HostState>().launch_busy.load(Ordering::SeqCst){let _=app.emit_to("main","native-notice","Finish the current action before editing another selection.");return false;}
    if let Ok(mut selection)=app.state::<HostState>().selection.lock() {
        selection.clear();
        let result=selection.add(paths);
        if result.rejected{selection.clear();let _=app.emit_to("main","native-notice","The whole selection could not be opened. Choose readable supported files and try again.");return false;}
        let _=app.emit_to("main","native-selection",result);
        return true;
    }
    false
}
fn route_native_launch(app:&tauri::AppHandle,args:&[String])->bool{
    if !args.first().is_some_and(|arg|matches!(arg.as_str(),"--edit"|"--action")){return false;}
    let state=app.state::<HostState>();
    if launch::selected_paths(args).is_err()||state.processing_busy.load(Ordering::SeqCst){return true;}
    if state.launch_busy.swap(true,Ordering::SeqCst){return true;}
    let action_id=launch::action(args).map(String::from);let handle=app.clone();
    std::thread::spawn(move||{
        let state=handle.state::<HostState>();
        let result=(||->Result<bool,String>{
            let files=state.selection.lock().map_err(|_|"Selection unavailable")?.list();
            if files.is_empty(){return Err("Choose readable files to edit.".into());}
            let directory=handle.path().app_config_dir().map_err(|_|"Private storage unavailable")?;
            let resources=handle.path().resource_dir().map_err(|_|"Desktop components unavailable")?;
            let output=state.settings.lock().map_err(|_|"Settings unavailable")?["output"].clone();
            let mut params=json!({"files":files,"platform":std::env::consts::OS,"outputMode":output});
            if let Some(action)=action_id{params["actionId"]=json!(action);}
            let resolved={let _lease=DialogLease::acquire(&state.dialog_busy)?;license_host::run(&directory,&resources,"nativeActions",params)?};
            *state.launch_intent.lock().map_err(|_|"Selection unavailable")?=resolved.clone();
            let action=&resolved["action"];
            if action["direct"]==true&&action["tool"].is_string(){
                let ids:Vec<_>=files.iter().map(|file|file.id.clone()).collect();
                run_processing(&handle,json!({"tool":action["tool"],"options":action["options"],"selectionIds":ids}),None)?;
                state.retain_job.store(true,Ordering::SeqCst);
                return Ok(false);
            }
            Ok(true)
        })();
        state.launch_busy.store(false,Ordering::SeqCst);
        if let Err(error)=&result{if let Ok(mut settings)=state.settings.lock(){settings["notice"]=json!(error);}}
        if !matches!(result,Ok(false)){
            let copy=handle.clone();let _=handle.run_on_main_thread(move||{let _=open_window(&copy);let _=copy.emit_to("main","native-launch",json!({}));});
        }
    });
    true
}
fn state_value(app: &tauri::AppHandle) -> Result<Value,String> {
    let state = app.state::<HostState>();
    let mut value = state.settings.lock().map_err(|_| "Settings unavailable")?.clone();
    value.as_object_mut().unwrap().remove("customFolder");
    value["platform"] = json!(std::env::consts::OS);
    // License status has its own verified action. Preference responses must not
    // reset an already activated renderer to the initial unactivated state.
    value["version"] = json!("SoraFiles Desktop 0.1.0");
    value["startupAvailable"]=json!(cfg!(windows) || cfg!(target_os = "macos") || cfg!(target_os = "linux"));
    value["shellEntryAvailable"]=json!(false);
    value["shellEntry"]=json!(false);
    #[cfg(any(target_os = "macos", target_os = "linux"))] {value["shellEntryAvailable"]=json!(true);value["shellEntry"]=json!(state.settings.lock().map_err(|_|"Settings unavailable")?.get("shellEntry").and_then(Value::as_bool).unwrap_or(true));}
    #[cfg(windows)] {value["shellEntryAvailable"]=json!(shell_entry::capability());if smoke_output().is_none(){value["shellEntry"]=json!(shell_entry::enabled().unwrap_or(false));}}
    #[cfg(windows)] {if smoke_output().is_none(){value["startup"]=json!(startup::enabled().unwrap_or(false));}}
    #[cfg(any(target_os = "macos", target_os = "linux"))] {if smoke_output().is_none(){value["startup"]=json!(unix_startup::enabled().unwrap_or(false));}}
    value["launchIntent"]=state.launch_intent.lock().map_err(|_|"Selection unavailable")?.clone();
    value["files"] = json!(state.selection.lock().map_err(|_| "Selection unavailable")?.list());
    value["job"] = state.job.lock().map_err(|_|"Job status unavailable")?.snapshot(state.processing_busy.load(Ordering::SeqCst));
    Ok(value)
}
fn persist_preferences(app: &tauri::AppHandle, value: &Value) -> Result<(), String> {
    // Diagnostics use defaults and never touch the user's installed preferences.
    if smoke_output().is_some() { return Ok(()); }
    let directory=app.path().app_config_dir().map_err(|_| "Settings folder unavailable")?;
    preferences::save(&directory,&preferences::Preferences::from_value(value)?).map_err(String::from)
}
fn open_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    diagnostic_step("opening window");
    if let Some(window) = app.get_webview_window("main") { window.show()?; window.unminimize()?; window.set_focus()?; return Ok(()); }
    // Serialize accepting a job with closing its originating window.
    if let Ok(mut closing)=app.state::<HostState>().window_closing.lock(){*closing=false;}
    let generation = app.state::<HostState>().window_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let window = WebviewWindowBuilder::new(app,"main",WebviewUrl::App("index.html".into()))
        .title("SoraFiles Desktop").inner_size(1180.0,900.0).min_inner_size(760.0,600.0)
        // GTK needs a mapped window to allocate the WebView viewport. CI uses Xvfb.
        .visible(smoke_output().is_none() || cfg!(target_os="linux"))
        .on_navigation(local_navigation)
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .build()?;
    let handle = app.clone();
    window.on_window_event(move |event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            let state=handle.state::<HostState>();
            let Ok(mut closing)=state.window_closing.lock() else {api.prevent_close();return;};
            let busy=state.processing_busy.load(Ordering::SeqCst);
            if busy&&!state.tray_available.load(Ordering::SeqCst) {
                api.prevent_close();let _=handle.emit_to("main","native-notice","The background menu is unavailable. Wait for processing to finish, or cancel it before closing this window.");
            } else {*closing=true;state.retain_job.store(busy,Ordering::SeqCst);}
        }
        tauri::WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
            if let Ok(mut selection) = handle.state::<HostState>().selection.lock() { let result=selection.add(paths.clone()); let _=handle.emit_to("main","native-selection",result); }
        }
        tauri::WindowEvent::Destroyed => {
            let state=handle.state::<HostState>();
            if state.window_generation.compare_exchange(generation,generation+1,Ordering::SeqCst,Ordering::SeqCst).is_ok() {
                if let Ok(mut selection)=state.selection.lock() { selection.clear(); }
                if !state.retain_job.load(Ordering::SeqCst) {
                    if let Ok(mut outputs)=state.outputs.lock(){outputs.clear();}
                    if let Ok(mut job)=state.job.lock(){job.clear();}
                }
            }
        }
        _ => {}
    });
    Ok(())
}

fn run_processing(handle:&tauri::AppHandle,params:Value,generation:Option<usize>)->Result<Value,String>{
                let state=handle.state::<HostState>();
                let _processing={
                    let closing=state.window_closing.lock().map_err(|_|"Window state unavailable")?;
                    if state.quitting.load(Ordering::SeqCst)||generation.is_some_and(|generation|*closing||state.window_generation.load(Ordering::SeqCst)!=generation){return Err("The original window was closed. Choose files again.".into());}
                    let lease=DialogLease::acquire(&state.processing_busy)?;
                    state.processing_cancel.store(false,Ordering::SeqCst);
                    state.job.lock().map_err(|_|"Job status unavailable")?.start(params["tool"].as_str().ok_or("Unknown tool")?,vec![]);
                    lease
                };
                let outcome=(||{
                let _private=DialogLease::acquire(&state.dialog_busy)?;
                let ids:Vec<String>=serde_json::from_value(params["selectionIds"].clone()).map_err(|_|"Choose files first")?;
                let paths=state.selection.lock().map_err(|_|"Selection unavailable")?.resolve(&ids)?;
                let settings=state.settings.lock().map_err(|_|"Settings unavailable")?.clone();
                let folder=match settings["output"].as_str().unwrap_or("source") {
                    "downloads"=>Some(handle.path().download_dir().map_err(|_|"Downloads folder unavailable")?),
                    "custom"=>Some(std::path::PathBuf::from(settings["customFolder"].as_str().ok_or("Choose an output folder in Settings")?)),
                    "ask"=>handle.dialog().file().set_title("Save SoraFiles results").blocking_pick_folder().and_then(|file|file.into_path().ok()),
                    _=>None
                };
                if settings["output"]=="ask"&&folder.is_none(){return Ok(json!({"state":"cancelled"}));}
                if generation.is_some_and(|generation|state.window_generation.load(Ordering::SeqCst)!=generation){return Err("The original window was closed. Choose files again.".into());}
                let directory=handle.path().app_config_dir().map_err(|_|"Private storage folder unavailable")?;
                let resources=handle.path().resource_dir().map_err(|_|"Desktop components unavailable")?;
                state.job.lock().map_err(|_|"Job status unavailable")?.sources(paths.iter().map(|path|path.file_name().unwrap_or_default().to_string_lossy().into_owned()).collect());
                    let result=processing_host::run(&directory,&resources,json!({"tool":params["tool"],"options":params["options"],"paths":paths,"folder":folder}),&state.processing_cancel,|progress|{let _=handle.emit_to("main","processing-progress",progress);})?;
                    let mut outputs=state.outputs.lock().map_err(|_|"Outputs unavailable")?;
                    outputs::public_result(result,&paths,folder.as_deref(),&mut outputs)
                })();
                state.job.lock().map_err(|_|"Job status unavailable")?.finish(&outcome);
                outcome
}

#[tauri::command]
async fn host_request(app: tauri::AppHandle, window: tauri::WebviewWindow, method: String, params: Value) -> Result<Value,String> {
    if window.label()!="main" || !valid_request(&method,&params,smoke_output().is_some()) { return Err("Invalid desktop request".into()); }
    let state=app.state::<HostState>();
    if method == "smokeReport" { diagnostic_step("received view report"); }
    let generation=state.window_generation.load(Ordering::SeqCst);
    match method.as_str() {
        "getState" if params.as_object().unwrap().is_empty() => state_value(&app),
        "smokeReport" => {
            let Some(output)=smoke_output() else { return Err("Unknown action".into()); };
            let mut good=params["heading"]=="File tools for your desktop." && params["tools"]==6 && params["overflow"]==false && params["error"].is_null();
            let count=state.smoke_count.fetch_add(1,Ordering::SeqCst)+1;
            if background_smoke() {
                if count==1 {good &= state.tray_available.load(Ordering::SeqCst);}
                if count==2 {let status=state.job.lock().map_err(|_|"Job status unavailable")?.snapshot(state.processing_busy.load(Ordering::SeqCst));good &= status["result"]["state"]=="completed" && status["sources"][0]=="Synthetic background fixture.pdf";if let Some(id)=status["result"]["outputId"].as_str(){good &= state.outputs.lock().map_err(|_|"Outputs unavailable")?.resolve(id).is_ok();}else{good=false;};}
                if count==3 {good &= state.job.lock().map_err(|_|"Job status unavailable")?.snapshot(false)["tool"].is_null();}
            }
            if !good || count>=3 {
                let report=json!({"status":if good {"PASS"}else{"FAIL"},"os":std::env::consts::OS,"arch":std::env::consts::ARCH,"nativeWindowLoads":count,"closeReopenCycles":count.saturating_sub(1),"ui":params,"backgroundJobState":background_smoke(),"trayOnlyStartup":startup_smoke(),"scope":if background_smoke(){"Native WebView destruction during a real offline synthetic PDF job, verified output, retained result actions and clearing; no installer or production-license certification"}else{"Native UI load and WebView destruction/recreation only; no engine, licensing or installer certification"}});
                if let Some(parent)=output.parent(){std::fs::create_dir_all(parent).map_err(|_| "Evidence folder unavailable")?;}
                std::fs::write(output,serde_json::to_vec_pretty(&report).unwrap()).map_err(|_| "Evidence write failed")?;
                #[cfg(debug_assertions)] if let Ok(mut fixture)=state.smoke_fixture.lock(){fixture.take();}
                state.quitting.store(true,Ordering::SeqCst);app.exit(if good {0}else{1});
            } else {
                if background_smoke()&&count==1 {
                    state.job.lock().map_err(|_|"Job status unavailable")?.start("rotate-pdf",vec!["Synthetic background fixture.pdf".into()]);
                    state.processing_busy.store(true,Ordering::SeqCst);
                }
                window.close().map_err(|_| "Could not close native view")?;
                let handle=app.clone();std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    if background_smoke()&&count==1 {
                        let state=handle.state::<HostState>();
                        #[cfg(debug_assertions)] {
                            let result=background_smoke::run(&handle).map(|(result,fixture)|{
                                if let Ok(mut saved)=state.smoke_fixture.lock(){*saved=Some(fixture);}result
                            });
                            if result.is_err(){diagnostic_step("background file diagnostic failed");}
                            if let Ok(mut job)=state.job.lock(){job.finish(&result);}
                        }
                        state.processing_busy.store(false,Ordering::SeqCst);
                    }
                    let copy=handle.clone();let _=handle.run_on_main_thread(move||{let _=open_window(&copy);});
                });
            }
            Ok(json!({"received":true}))
        }
        "selectFiles" if params.as_object().unwrap().is_empty() => {
            let handle=app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let state=handle.state::<HostState>();
                let _lease=DialogLease::acquire(&state.dialog_busy)?;
                if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose files again.".into()); }
                let files=handle.dialog().file().set_title("Choose files for SoraFiles").blocking_pick_files().unwrap_or_default();
                if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose files again.".into()); }
                let paths=files.into_iter().filter_map(|file| file.into_path().ok()).collect();
                let mut selection=state.selection.lock().map_err(|_| "Selection unavailable")?;
                if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose files again.".into()); }
                Ok(json!(selection.add(paths)))
            }).await.map_err(|_| "File picker unavailable")?
        }
        "releaseSelection" => {
            if params.as_object().unwrap().len()!=1 { return Err("Invalid selection".into()); }
            let ids:Vec<String>=serde_json::from_value(params["ids"].clone()).map_err(|_| "Invalid selection")?;
            state.selection.lock().map_err(|_| "Selection unavailable")?.release(&ids)?;
            Ok(json!({"released":true}))
        }
        "saveSettings" => {
            if params.as_object().unwrap().len()!=1 { return Err("Choose one setting".into()); }
            let (key,value)=params.as_object().unwrap().iter().next().unwrap();
            if key=="shellEntry" {
                #[cfg(windows)] {
                    let enabled=value.as_bool().ok_or("Invalid Explorer setting")?;
                    if smoke_output().is_some(){return Err("Explorer changes are disabled in diagnostics".into());}
                    let previous=shell_entry::enabled()?;
                    shell_entry::set_enabled(enabled)?;
                    let mut settings=state.settings.lock().map_err(|_| "Settings unavailable")?;
                    let mut next=settings.clone();next["shellEntry"]=json!(enabled);
                    if let Err(error)=persist_preferences(&app,&next){let _=shell_entry::set_enabled(previous);return Err(error);}
                    *settings=next;drop(settings);
                    return state_value(&app);
                }
                #[cfg(any(target_os = "macos", target_os = "linux"))] {
                    if smoke_output().is_some(){return Err("File-manager changes are disabled in diagnostics".into());}
                    let enabled=value.as_bool().ok_or("Invalid file-manager setting")?;
                    let resources=app.path().resource_dir().map_err(|_|"Desktop components unavailable")?;
                    let mut settings=state.settings.lock().map_err(|_|"Settings unavailable")?;
                    let previous=settings.get("shellEntry").and_then(Value::as_bool).unwrap_or(true);
                    unix_shell_entry::set_enabled(&resources,enabled)?;
                    let mut next=settings.clone();next["shellEntry"]=json!(enabled);
                    if let Err(error)=persist_preferences(&app,&next){let _=unix_shell_entry::set_enabled(&resources,previous);return Err(error);}
                    *settings=next;drop(settings);return state_value(&app);
                }
            }
            if key=="startup" {
                #[cfg(windows)] {
                    let enabled=value.as_bool().ok_or("Invalid sign-in setting")?;
                    if smoke_output().is_some(){return Err("Sign-in changes are disabled in diagnostics".into());}
                    startup::set(enabled)?;
                    return state_value(&app);
                }
                #[cfg(any(target_os = "macos", target_os = "linux"))] {
                    let enabled=value.as_bool().ok_or("Invalid sign-in setting")?;
                    if smoke_output().is_some(){return Err("Sign-in changes are disabled in diagnostics".into());}
                    unix_startup::set(enabled)?;
                    return state_value(&app);
                }
            }
            let valid=match key.as_str() { "output"=>matches!(value.as_str(),Some("source"|"downloads"|"custom"|"ask")), "theme"=>matches!(value.as_str(),Some("system"|"light"|"dark")), _=>false };
            if !valid { return Err("This setting is not available in this build.".into()); }
            {
                let mut settings=state.settings.lock().map_err(|_| "Settings unavailable")?;
                let mut next=settings.clone();next[key]=value.clone();next.as_object_mut().unwrap().remove("notice");
                persist_preferences(&app,&next)?;*settings=next;
            }
            state_value(&app)
        }
        "chooseFolder" if params.as_object().unwrap().is_empty() => {
            let handle=app.clone();tauri::async_runtime::spawn_blocking(move || {
                let state=handle.state::<HostState>();
                let _lease=DialogLease::acquire(&state.dialog_busy)?;
                if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose a folder again.".into()); }
                let folder=handle.dialog().file().set_title("Choose output folder").blocking_pick_folder();
                if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose a folder again.".into()); }
                if let Some(folder)=folder { let path=folder.into_path().map_err(|_| "Choose a local folder")?;
                    // This preference is native-only; paths are not returned to the view.
                    let mut settings=state.settings.lock().map_err(|_| "Settings unavailable")?;
                    if state.window_generation.load(Ordering::SeqCst)!=generation { return Err("The original window was closed. Choose a folder again.".into()); }
                    let mut next=settings.clone();next["customFolder"]=json!(path);
                    persist_preferences(&handle,&next)?;*settings=next;return Ok(json!({"selected":true})); }
                Ok(json!({"selected":false}))
            }).await.map_err(|_| "Folder picker unavailable")?
        }
        "startTrial"|"activate"|"licenseStatus"|"refreshLicense"|"licenseDevices"|"supportDetails"|"replacementEmailStart"|"replacementEmailVerify"|"replacementRequest"|"replacementStatus"|"replacementState"|"replacementCheckout" => {
            let handle=app.clone();tauri::async_runtime::spawn_blocking(move||{
                let state=handle.state::<HostState>();
                let deadline=std::time::Instant::now()+std::time::Duration::from_secs(90);
                let _lease=loop{match DialogLease::acquire(&state.dialog_busy){Ok(lease)=>break lease,Err(_) if method=="licenseStatus"&&std::time::Instant::now()<deadline=>std::thread::sleep(std::time::Duration::from_millis(100)),Err(error)=>return Err(error.to_string())}};
                let directory=handle.path().app_config_dir().map_err(|_|"Private storage folder unavailable")?;
                let resources=handle.path().resource_dir().map_err(|_|"Desktop components unavailable")?;
                let action=match method.as_str(){"startTrial"=>"trial","activate"=>"activate","refreshLicense"=>"refresh","licenseDevices"=>"devices","supportDetails"=>"support",name if name.starts_with("replacement")=>name,_=>"status"};
                let result=license_host::run(&directory,&resources,action,params)?;
                if action=="replacementCheckout"{checkout::open(result["checkoutUrl"].as_str().ok_or("Checkout unavailable")?)?;return Ok(json!({"opened":true}));}
                Ok(result)
            }).await.map_err(|_|"License action could not finish")?
        },
        "cancelProcessing" => {state.processing_cancel.store(true,Ordering::SeqCst);Ok(json!({"requested":true}))},
        "processingStatus"=>Ok(state.job.lock().map_err(|_|"Job status unavailable")?.snapshot(state.processing_busy.load(Ordering::SeqCst))),
        "openOutput"|"revealOutput"=>{
            let path=state.outputs.lock().map_err(|_|"Outputs unavailable")?.resolve(params["id"].as_str().ok_or("Invalid output")?)?;
            outputs::open(&path,method=="revealOutput")?;Ok(json!({"opened":true}))
        },
        "processFiles" => {
            let handle=app.clone();tauri::async_runtime::spawn_blocking(move||run_processing(&handle,params,Some(generation))).await.map_err(|_|"Processing could not finish")?
        },
        "checkUpdates" => Ok(json!({"message":"No Desktop releases are published yet."})),
        "quit" => { if state.processing_busy.load(Ordering::SeqCst) {return Err("Wait for processing to finish, or cancel it before quitting.".into());} state.quitting.store(true,Ordering::SeqCst);app.exit(0);Ok(json!({"quitting":true})) }
        _ => Err("This action is not available.".into())
    }
}

fn main() {
    // Generate once: macOS embeds a single Info.plist symbol per executable.
    let context=tauri::generate_context!();
    let early:Vec<String>=std::env::args().skip(1).collect();
    if early.len()==1&&early[0]=="--initialize-trial" {
        let result=(||{
            let directory=dirs::config_dir().ok_or("Settings unavailable".to_string())?.join(&context.config().identifier);
            let resources=tauri::utils::platform::resource_dir(context.package_info(),&tauri::utils::Env::default()).map_err(|_|"Desktop components unavailable".to_string())?;
            license_host::run(&directory,&resources,"initializeTrial",json!({}))
        })();
        std::process::exit(if result.is_ok(){0}else{1});
    }
    if early.first().is_some_and(|arg|arg=="--shell-menu"){
        if early.len()!=3{std::process::exit(2);}
        let input=std::path::PathBuf::from(&early[1]);let output=std::path::PathBuf::from(&early[2]);
        // Separate, windowless process: never forward file-manager discovery to
        // the interactive instance or load any processing engine.
        // Resolve the same paths as Tauri without initializing a GUI runtime.
        // GTK/WebKit initialization can block in a headless file-manager query.
        let result=(||{
            let directory=dirs::config_dir().ok_or("Settings unavailable".to_string())?.join(&context.config().identifier);
            let resources=tauri::utils::platform::resource_dir(context.package_info(),&tauri::utils::Env::default()).map_err(|_|"Desktop components unavailable".to_string())?;
            shell_broker::run(&directory,&resources,&input,&output)
        })();
        if let Err(message)=&result {eprintln!("SoraFiles menu: {message}");}
        std::process::exit(if result.is_ok(){0}else{1});
    }
    // Uninstaller cleanup is handled before single-instance forwarding. Only
    // entries owned by this exact executable may be changed by the module.
    #[cfg(windows)] {
        let args:Vec<_>=std::env::args_os().skip(1).collect();
        if args.len()==1 && args[0]=="--remove-explorer-entry" {
            std::process::exit(if shell_entry::remove_owned_entries().is_ok(){0}else{1});
        }
        if args.len()==1 && args[0]=="--sync-explorer-entry" {
            // Installer runs after files are in place, without showing a window
            // or replacing the user's saved opt-out on upgrades.
            let result=tauri::Builder::default().build(context)
                .map_err(|_|"Desktop setup unavailable".to_string()).and_then(|app|{
                    let directory=app.path().app_config_dir().map_err(|_|"Settings unavailable".to_string())?;
                    let settings=preferences::load(&directory).map_err(str::to_owned)?.value();
                    shell_entry::set_enabled(settings["shellEntry"].as_bool().unwrap_or(true))
                });
            std::process::exit(if result.is_ok(){0}else{1});
        }
    }
    let app=tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app,args,_| {
            let args:Vec<_>=args.into_iter().skip(1).collect();
            if args.len()==1&&args[0]=="--background"{return;}
            let accepted=receive_launch(app,&args);if !accepted||!route_native_launch(app,&args){let _=open_window(app);}
        }))
        .plugin(tauri_plugin_dialog::init()).manage(HostState::default())
        .invoke_handler(tauri::generate_handler![host_request])
        .on_page_load(|view,payload| {
            if smoke_output().is_some() && payload.event()==tauri::webview::PageLoadEvent::Finished {
                diagnostic_step("view loaded");
                if view.eval(include_str!("smoke-probe.js")).is_err() { diagnostic_step("view probe could not start"); }
            }
        })
        .setup(|app| {
            if smoke_output().is_none() {
                let loaded=app.path().app_config_dir().map_err(|_| "Settings folder unavailable").and_then(|directory| preferences::load(&directory));
                let readable=loaded.is_ok();
                let mut value=match loaded { Ok(settings)=>settings.value(),Err(_)=>{
                    let mut defaults=preferences::Preferences::default().value();
                    defaults["notice"]=json!("Saved settings could not be read. Default settings are in use; choose your preferences in Settings.");defaults
                }};
                #[cfg(windows)] if readable {
                    let enabled=value.get("shellEntry").and_then(Value::as_bool).unwrap_or(true);
                    if shell_entry::set_enabled(enabled).is_err(){value["notice"]=json!("File-manager actions could not be updated. Try changing the setting in Settings.");}
                }
                #[cfg(any(target_os = "macos", target_os = "linux"))] if readable {
                    let enabled=value.get("shellEntry").and_then(Value::as_bool).unwrap_or(true);
                    let result=app.path().resource_dir().map_err(|_|"Desktop components unavailable".to_string()).and_then(|resources|unix_shell_entry::set_enabled(&resources,enabled));
                    if result.is_err(){value["notice"]=json!("File-manager actions could not be updated. Try changing the setting in Settings.");}
                }
                *app.state::<HostState>().settings.lock().map_err(|_| "Settings unavailable")?=value;
                // Record first launch locally before exposing actions. Network
                // initialization follows on the worker thread, under the same lease.
                if let (Ok(directory),Ok(resources))=(app.path().app_config_dir(),app.path().resource_dir()) {
                    let state=app.state::<HostState>();
                    if let Ok(_lease)=DialogLease::acquire(&state.dialog_busy){let _=license_host::run(&directory,&resources,"prepareTrial",json!({}));};
                }
            }
            let open=MenuItem::with_id(app,"open","Open SoraFiles",true,None::<&str>)?;
            let quit=MenuItem::with_id(app,"quit","Quit SoraFiles",true,None::<&str>)?;
            let menu=Menu::with_items(app,&[&open,&quit])?;
            let tray=TrayIconBuilder::new().icon(app.default_window_icon().unwrap().clone()).menu(&menu)
                .on_menu_event(|app,event| match event.id.as_ref() {
                    "open"=>{let _=open_window(app);},
                    "quit"=>{app.state::<HostState>().quitting.store(true,Ordering::SeqCst);app.exit(0);},_=>{}
                }).build(app);
            app.state::<HostState>().tray_available.store(tray.is_ok(),Ordering::SeqCst);
            if smoke_output().is_none(){
                let handle=app.handle().clone();
                std::thread::spawn(move||{
                    let mut initial=true;let mut initialize=true;
                    loop {
                        if !initialize{std::thread::sleep(license_schedule::delay(initial));initial=false;}
                        let state=handle.state::<HostState>();
                        if state.quitting.load(Ordering::SeqCst){break;}
                        if state.processing_busy.load(Ordering::SeqCst){std::thread::sleep(std::time::Duration::from_secs(1));continue;}
                        let Ok(_lease)=DialogLease::acquire(&state.dialog_busy) else {std::thread::sleep(std::time::Duration::from_secs(1));continue;};
                        let (Ok(directory),Ok(resources))=(handle.path().app_config_dir(),handle.path().resource_dir()) else {continue;};
                        if initialize {
                            let result=license_host::run(&directory,&resources,"initializeTrial",json!({}));
                            initialize=result.as_ref().map_or(true,|value|value["trialPending"]==true);
                            drop(_lease);
                            if let Ok(value)=result{let _=handle.emit_to("main","license-updated",value);}
                            if initialize{std::thread::sleep(std::time::Duration::from_secs(60));}
                            continue;
                        }
                        // Network failure is deliberately silent and leaves the
                        // signed offline authorization intact. No engine loads.
                        let _=license_host::run(&directory,&resources,"validate",json!({}));
                    }
                });
            }
            let accepted=receive_launch(app.handle(),&std::env::args().skip(1).collect::<Vec<_>>());
            let args:Vec<_>=std::env::args().skip(1).collect();
            let background=(args.len()==1&&args[0]=="--background")||startup_smoke();
            let routed=accepted&&route_native_launch(app.handle(),&args);
            if !routed&&(!background||!app.state::<HostState>().tray_available.load(Ordering::SeqCst)){open_window(app.handle())?;}
            if startup_smoke(){
                let handle=app.handle().clone();
                std::thread::spawn(move||{
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    if handle.get_webview_window("main").is_some()||!handle.state::<HostState>().tray_available.load(Ordering::SeqCst){
                        if let Some(path)=smoke_output(){let _=std::fs::write(path,br#"{"status":"FAIL","scope":"Tray-only startup allocated a window or had no tray"}"#);}
                        handle.state::<HostState>().quitting.store(true,Ordering::SeqCst);handle.exit(1);return;
                    }
                    diagnostic_step("tray-only startup has no WebView");
                    let copy=handle.clone();let _=handle.run_on_main_thread(move||{let _=open_window(&copy);});
                });
            }
            Ok(())
        }).build(context).expect("Unable to initialize SoraFiles Desktop");
    app.run(|app,event| match event {
        RunEvent::ExitRequested { api, .. } => { let state=app.state::<HostState>();
            if state.processing_busy.load(Ordering::SeqCst) {api.prevent_exit();if state.quitting.swap(false,Ordering::SeqCst)||!state.tray_available.load(Ordering::SeqCst){let _=open_window(app);let _=app.emit_to("main","native-notice","Wait for processing to finish, or cancel it before quitting.");}}
            else if !state.quitting.load(Ordering::SeqCst)&&(state.tray_available.load(Ordering::SeqCst)||smoke_output().is_some()) { api.prevent_exit(); }
        }
        #[cfg(target_os="macos")]
        RunEvent::Reopen { .. } => { let _=open_window(app); }
        #[cfg(target_os="macos")]
        RunEvent::Opened { urls } => {
            let files:Vec<_>=urls.into_iter().filter_map(|url|url.to_file_path().ok()).map(|path|path.to_string_lossy().into_owned()).collect();
            receive_launch(app,&files);let _=open_window(app);
        }
        _=>{}
    });
}
