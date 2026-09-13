#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod selection;
mod bridge_policy;
mod launch;
use bridge_policy::{DialogLease, local_navigation, valid_request};
use selection::Selection;
use serde_json::{json, Value};
use std::sync::{Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}};
use tauri::{Manager, Emitter, WebviewUrl, WebviewWindowBuilder, RunEvent, DragDropEvent, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use tauri_plugin_dialog::DialogExt;

struct HostState { selection: Mutex<Selection>, settings: Mutex<Value>, quitting: AtomicBool, tray_available: AtomicBool, smoke_count: AtomicUsize, window_generation: AtomicUsize, dialog_busy: AtomicBool }
impl Default for HostState {
    fn default() -> Self { Self { selection: Mutex::new(Selection::default()), settings: Mutex::new(json!({"output":"source","theme":"system","startup":false})), quitting: AtomicBool::new(false), tray_available: AtomicBool::new(false), smoke_count:AtomicUsize::new(0), window_generation:AtomicUsize::new(0), dialog_busy:AtomicBool::new(false) } }
}
fn smoke_output() -> Option<std::path::PathBuf> { let args:Vec<_>=std::env::args().collect();let index=args.iter().position(|arg| arg=="--native-smoke")?;args.get(index+1).map(std::path::PathBuf::from) }
fn receive_launch(app: &tauri::AppHandle, args: &[String]) {
    let Ok(paths)=launch::selected_paths(args) else { return; };
    if paths.is_empty() { return; }
    if let Ok(mut selection)=app.state::<HostState>().selection.lock() {
        let result=selection.add(paths);
        let _=app.emit_to("main","native-selection",result);
    }
}
fn state_value(app: &tauri::AppHandle) -> Result<Value,String> {
    let state = app.state::<HostState>();
    let mut value = state.settings.lock().map_err(|_| "Settings unavailable")?.clone();
    value.as_object_mut().unwrap().remove("customFolder");
    value["platform"] = json!(std::env::consts::OS);
    value["license"] = json!("not-activated"); value["version"] = json!("Development build 0.1.0");
    value["files"] = json!(state.selection.lock().map_err(|_| "Selection unavailable")?.list());
    Ok(value)
}
fn open_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") { window.show()?; window.unminimize()?; window.set_focus()?; return Ok(()); }
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
        tauri::WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
            if let Ok(mut selection) = handle.state::<HostState>().selection.lock() { let result=selection.add(paths.clone()); let _=handle.emit_to("main","native-selection",result); }
        }
        tauri::WindowEvent::Destroyed => {
            let state=handle.state::<HostState>();
            if state.window_generation.compare_exchange(generation,generation+1,Ordering::SeqCst,Ordering::SeqCst).is_ok() {
                if let Ok(mut selection)=state.selection.lock() { selection.clear(); }
            }
        }
        _ => {}
    });
    Ok(())
}

#[tauri::command]
async fn host_request(app: tauri::AppHandle, window: tauri::WebviewWindow, method: String, params: Value) -> Result<Value,String> {
    if window.label()!="main" || !valid_request(&method,&params,smoke_output().is_some()) { return Err("Invalid desktop request".into()); }
    let state=app.state::<HostState>();
    let generation=state.window_generation.load(Ordering::SeqCst);
    match method.as_str() {
        "getState" if params.as_object().unwrap().is_empty() => state_value(&app),
        "smokeReport" => {
            let Some(output)=smoke_output() else { return Err("Unknown action".into()); };
            let good=params["heading"]=="File tools for your desktop." && params["tools"]==6 && params["overflow"]==false && params["error"].is_null();
            let count=state.smoke_count.fetch_add(1,Ordering::SeqCst)+1;
            if !good || count>=3 {
                let report=json!({"status":if good {"PASS"}else{"FAIL"},"os":std::env::consts::OS,"arch":std::env::consts::ARCH,"nativeWindowLoads":count,"closeReopenCycles":count.saturating_sub(1),"ui":params,"scope":"Native UI load and WebView destruction/recreation only; no engine, licensing or installer certification"});
                if let Some(parent)=output.parent(){std::fs::create_dir_all(parent).map_err(|_| "Evidence folder unavailable")?;}
                std::fs::write(output,serde_json::to_vec_pretty(&report).unwrap()).map_err(|_| "Evidence write failed")?;
                state.quitting.store(true,Ordering::SeqCst);app.exit(if good {0}else{1});
            } else {
                window.close().map_err(|_| "Could not close native view")?;
                let handle=app.clone();std::thread::spawn(move || { std::thread::sleep(std::time::Duration::from_millis(800));let copy=handle.clone();let _=handle.run_on_main_thread(move||{let _=open_window(&copy);}); });
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
            let valid=match key.as_str() { "output"=>matches!(value.as_str(),Some("source"|"downloads"|"custom"|"ask")), "theme"=>matches!(value.as_str(),Some("system"|"light"|"dark")), _=>false };
            if !valid { return Err("This setting is not available in this build.".into()); }
            state.settings.lock().map_err(|_| "Settings unavailable")?[key]=value.clone(); state_value(&app)
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
                    settings["customFolder"]=json!(path); return Ok(json!({"selected":true})); }
                Ok(json!({"selected":false}))
            }).await.map_err(|_| "Folder picker unavailable")?
        }
        "startTrial"|"activate" => Err("License activation is not configured in this development build.".into()),
        "checkUpdates" => Ok(json!({"message":"No Desktop releases are published yet."})),
        "quit" => { state.quitting.store(true,Ordering::SeqCst);app.exit(0);Ok(json!({"quitting":true})) }
        _ => Err("This action is not available.".into())
    }
}

fn main() {
    let app=tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app,args,_| { receive_launch(app,&args.into_iter().skip(1).collect::<Vec<_>>()); let _=open_window(app); }))
        .plugin(tauri_plugin_dialog::init()).manage(HostState::default())
        .invoke_handler(tauri::generate_handler![host_request])
        .on_page_load(|view,payload| {
            if smoke_output().is_some() && payload.event()==tauri::webview::PageLoadEvent::Finished {
                let _=view.eval(include_str!("smoke-probe.js"));
            }
        })
        .setup(|app| {
            let open=MenuItem::with_id(app,"open","Open SoraFiles",true,None::<&str>)?;
            let quit=MenuItem::with_id(app,"quit","Quit SoraFiles",true,None::<&str>)?;
            let menu=Menu::with_items(app,&[&open,&quit])?;
            let tray=TrayIconBuilder::new().icon(app.default_window_icon().unwrap().clone()).menu(&menu)
                .on_menu_event(|app,event| match event.id.as_ref() {
                    "open"=>{let _=open_window(app);},
                    "quit"=>{app.state::<HostState>().quitting.store(true,Ordering::SeqCst);app.exit(0);},_=>{}
                }).build(app);
            app.state::<HostState>().tray_available.store(tray.is_ok(),Ordering::SeqCst);
            receive_launch(app.handle(),&std::env::args().skip(1).collect::<Vec<_>>());
            open_window(app.handle())?; Ok(())
        }).build(tauri::generate_context!()).expect("Unable to initialize SoraFiles Desktop");
    app.run(|app,event| match event {
        RunEvent::ExitRequested { api, .. } => { let state=app.state::<HostState>();if !state.quitting.load(Ordering::SeqCst)&&(state.tray_available.load(Ordering::SeqCst)||smoke_output().is_some()) { api.prevent_exit(); } }
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
