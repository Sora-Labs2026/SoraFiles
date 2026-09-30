fn trusted(value:&str)->bool{
 if value.len()>2048||value.chars().any(char::is_control){return false;}
 let Ok(url)=tauri::Url::parse(value) else{return false;};
 url.scheme()=="https"&&url.username().is_empty()&&url.password().is_none()&&url.port().is_none()
 &&matches!(url.host_str(),Some("checkout.dodopayments.com"|"test.checkout.dodopayments.com"))
}
pub fn open(value:&str)->Result<(),String>{
 if !trusted(value){return Err("Checkout unavailable".into());}
 open_url(value)
}
// Fixed first-party destination. No renderer-provided URL crosses this boundary.
pub fn open_release_notes()->Result<(),String>{open_url("https://sorafiles.com/desktop/releases")}
fn open_url(value:&str)->Result<(),String>{
 #[cfg(windows)]{
  #[link(name="shell32")]unsafe extern "system"{fn ShellExecuteW(window:*mut std::ffi::c_void,operation:*const u16,file:*const u16,parameters:*const u16,directory:*const u16,show:i32)->isize;}
  let operation:Vec<u16>="open".encode_utf16().chain(Some(0)).collect();let url:Vec<u16>=value.encode_utf16().chain(Some(0)).collect();
  if unsafe{ShellExecuteW(std::ptr::null_mut(),operation.as_ptr(),url.as_ptr(),std::ptr::null(),std::ptr::null(),1)}<=32{return Err("Checkout could not open".into());}
 }
 #[cfg(not(windows))]{
  let mut command=std::process::Command::new(if cfg!(target_os="macos"){"/usr/bin/open"}else{"xdg-open"});
  if cfg!(target_os="macos"){command.arg("--");}
  let mut child=command.arg(value).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).spawn().map_err(|_|"Checkout could not open")?;
  std::thread::spawn(move||{let _=child.wait();});
 }
 Ok(())
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn checkout_urls_are_fixed_https_origins(){
  assert!(trusted("https://checkout.dodopayments.com/session?x=1"));assert!(trusted("https://test.checkout.dodopayments.com/session"));
  for url in ["http://checkout.dodopayments.com/","https://checkout.dodopayments.com.evil.test/","https://evil.test/","https://user@checkout.dodopayments.com/","https://checkout.dodopayments.com:444/","file:///C:/x.exe","https://checkout.dodopayments.com/\n"]{assert!(!trusted(url));}
 }
}
