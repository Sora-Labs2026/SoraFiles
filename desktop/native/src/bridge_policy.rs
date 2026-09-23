use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};

pub fn local_navigation(url: &tauri::Url) -> bool {
    url.username().is_empty() && url.password().is_none() && url.port().is_none()
        && matches!((url.scheme(), url.host_str()),
            ("tauri", Some("localhost")) | ("http", Some("tauri.localhost")))
}

pub fn valid_request(method: &str, params: &Value, diagnostic: bool) -> bool {
    let Some(fields) = params.as_object() else { return false; };
    if params.to_string().len() > 16384 { return false; }
    match method {
        "getState" | "selectFiles" | "chooseFolder" | "startTrial" | "licenseStatus" | "refreshLicense" | "licenseDevices" | "supportDetails" | "checkUpdates" | "quit" | "cancelProcessing" | "processingStatus" => fields.is_empty(),
        "processFiles" => fields.len()==3 && params["options"].is_object()
            && matches!(params["tool"].as_str(),Some("remove-background"|"doc-scanner"|"repair-pdf"|"compress-pdf"|"heic-to-jpg"|"pdf-to-word"|"pdf-to-excel"|"metadata-remover"|"protect-pdf"|"pdf-ocr"|"pdf-to-jpg"|"merge-pdf"|"split-pdf"|"rotate-pdf"|"remove-pages"|"page-numbers"|"watermark-pdf"|"sign-pdf"|"jpg-to-pdf"|"image-converter"|"compress-image"|"resize-image"|"edit-image"))
            && params["selectionIds"].as_array().is_some_and(|ids|!ids.is_empty()&&ids.len()<=256&&ids.iter().all(|id|id.as_str().is_some_and(|text|text.len()==32&&text.bytes().all(|b|b.is_ascii_hexdigit())))),
        "activate" => fields.len() == 1 && params["licenseKey"].as_str()
            .is_some_and(|key| !key.trim().is_empty() && key.len() <= 4096 && !key.chars().any(char::is_control)),
        "openOutput"|"revealOutput"=>fields.len()==1&&params["id"].as_str().is_some_and(|id|id.len()==32&&id.bytes().all(|b|b.is_ascii_hexdigit())),
        "releaseSelection" => fields.len() == 1 && params["ids"].as_array().is_some_and(|ids|
            ids.len() <= 256 && ids.iter().all(|id| id.as_str().is_some_and(|text|
                text.len() == 32 && text.bytes().all(|b| b.is_ascii_hexdigit())))),
        "saveSettings" => fields.len() == 1 && (matches!(params["output"].as_str(), Some("source" | "downloads" | "custom" | "ask"))
            || matches!(params["theme"].as_str(), Some("system" | "light" | "dark")) || params["startup"].is_boolean() || params["shellEntry"].is_boolean()),
        "smokeReport" => diagnostic && fields.len() == 5 && ["heading", "tools", "overflow", "error", "layout"].iter().all(|key| fields.contains_key(*key)),
        _ => false,
    }
}

pub struct DialogLease<'a>(&'a AtomicBool);
impl<'a> DialogLease<'a> {
    pub fn acquire(busy: &'a AtomicBool) -> Result<Self, &'static str> {
        busy.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| Self(busy)).map_err(|_| "Finish the open file or folder dialog first.")
    }
}
impl Drop for DialogLease<'_> { fn drop(&mut self) { self.0.store(false, Ordering::SeqCst); } }

#[cfg(test)] mod tests {
    use super::*;
    use serde_json::json;
    #[test] fn navigation_stays_on_packaged_origins() {
        for value in ["tauri://localhost/index.html", "http://tauri.localhost/index.html#tools"] {
            assert!(local_navigation(&tauri::Url::parse(value).unwrap()));
        }
        for value in ["http://localhost:8788", "http://localhost", "https://sorafiles.com", "https://tauri.localhost", "http://tauri.localhost:8788", "tauri://user@localhost", "file:///tmp/index.html", "https://tauri.localhost.example.com"] {
            assert!(!local_navigation(&tauri::Url::parse(value).unwrap()), "{value}");
        }
    }
    #[test] fn ipc_rejects_unknown_fields_and_actions() {
        assert!(!valid_request("deactivateLicense", &json!({}), false));
        assert!(valid_request("getState", &json!({}), false));
        assert!(valid_request("supportDetails", &json!({}), false));
        assert!(valid_request("openOutput",&json!({"id":"a".repeat(32)}),false));
        assert!(!valid_request("openOutput",&json!({"path":"C:/injected.exe"}),false));
        assert!(!valid_request("supportDetails", &json!({"deviceId":"injected"}), false));
        assert!(valid_request("saveSettings", &json!({"theme":"dark"}), false));
        assert!(valid_request("saveSettings", &json!({"startup":true}), false));
        assert!(valid_request("saveSettings", &json!({"shellEntry":true}), false));
        assert!(!valid_request("saveSettings", &json!({"shellEntry":"yes"}), false));
        assert!(!valid_request("saveSettings", &json!({"shellEntry":true,"path":"C:/injected.exe"}), false));
        assert!(!valid_request("saveSettings", &json!({"startup":"yes"}), false));
        assert!(valid_request("releaseSelection", &json!({"ids":["a".repeat(32)]}), false));
        for (method, params) in [("getState", json!({"path":"secret"})), ("activate", json!({"licenseKey":"key", "plan":"lifetime"})), ("activate", json!({"licenseKey":"\nkey"})), ("releaseSelection", json!({"ids":["invalid"]})), ("quit", json!({"force":true})), ("smokeReport", json!({"heading":null,"tools":6,"overflow":false,"error":null})), ("readFile", json!({"path":"secret"}))] {
            assert!(!valid_request(method, &params, false), "{method}");
        }
    }
    #[test] fn dialog_lease_rejects_overlap_and_releases_on_error() {
        let busy = AtomicBool::new(false);
        let first = DialogLease::acquire(&busy).unwrap();
        assert!(DialogLease::acquire(&busy).is_err());
        drop(first);
        assert!(DialogLease::acquire(&busy).is_ok());
        assert!(!busy.load(Ordering::SeqCst));
    }
    #[test] fn processing_accepts_only_known_tools_and_opaque_selection_ids() {
        let valid=json!({"tool":"pdf-to-jpg","selectionIds":["b".repeat(32)],"options":{"dpi":150}});
        assert!(valid_request("processFiles",&valid,false));
        assert!(valid_request("processFiles",&json!({"tool":"protect-pdf","selectionIds":["b".repeat(32)],"options":{"password":"synthetic-password"}}),false));
        assert!(valid_request("processFiles",&json!({"tool":"metadata-remover","selectionIds":["b".repeat(32)],"options":{}}),false));
        assert!(valid_request("processFiles",&json!({"tool":"pdf-to-excel","selectionIds":["b".repeat(32)],"options":{}}),false));
        assert!(valid_request("processFiles",&json!({"tool":"pdf-to-word","selectionIds":["b".repeat(32)],"options":{"direction":"ltr"}}),false));
        for params in [json!({"tool":"unknown", "selectionIds":["b".repeat(32)],"options":{}}),
            json!({"tool":"unlock-pdf", "selectionIds":["b".repeat(32)],"options":{}}),
            json!({"tool":"pdf-to-jpg","selectionIds":["C:/private.pdf"],"options":{}}),
            json!({"tool":"pdf-to-jpg","selectionIds":[],"options":{}}),
            json!({"tool":"pdf-to-jpg","selectionIds":["b".repeat(32)],"options":{},"path":"private"})] {
            assert!(!valid_request("processFiles",&params,false));
        }
        assert!(valid_request("cancelProcessing",&json!({}),false));
        assert!(!valid_request("cancelProcessing",&json!({"kill":true}),false));
    }
}
