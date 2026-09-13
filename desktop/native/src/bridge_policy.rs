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
        "getState" | "selectFiles" | "chooseFolder" | "startTrial" | "licenseStatus" | "refreshLicense" | "licenseDevices" | "checkUpdates" | "quit" => fields.is_empty(),
        "activate" => fields.len() == 1 && params["licenseKey"].as_str()
            .is_some_and(|key| !key.trim().is_empty() && key.len() <= 4096 && !key.chars().any(char::is_control)),
        "releaseSelection" => fields.len() == 1 && params["ids"].as_array().is_some_and(|ids|
            ids.len() <= 256 && ids.iter().all(|id| id.as_str().is_some_and(|text|
                text.len() == 32 && text.bytes().all(|b| b.is_ascii_hexdigit())))),
        "saveSettings" => fields.len() == 1 && (matches!(params["output"].as_str(), Some("source" | "downloads" | "custom" | "ask"))
            || matches!(params["theme"].as_str(), Some("system" | "light" | "dark"))),
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
        assert!(valid_request("saveSettings", &json!({"theme":"dark"}), false));
        assert!(valid_request("releaseSelection", &json!({"ids":["a".repeat(32)]}), false));
        for (method, params) in [("getState", json!({"path":"secret"})), ("activate", json!({"licenseKey":"key", "plan":"lifetime"})), ("activate", json!({"licenseKey":"\nkey"})), ("releaseSelection", json!({"ids":["invalid"]})), ("saveSettings", json!({"startup":true})), ("quit", json!({"force":true})), ("smokeReport", json!({"heading":null,"tools":6,"overflow":false,"error":null})), ("readFile", json!({"path":"secret"}))] {
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
}
