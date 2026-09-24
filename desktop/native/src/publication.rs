//! Lock, verify and publish the engine's staged bytes on Windows.
use std::{fs::OpenOptions, io::{Read,Error}, os::windows::{fs::{OpenOptionsExt,MetadataExt},io::AsRawHandle,ffi::OsStrExt},path::{Path,PathBuf}};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
#[link(name="kernel32")]unsafe extern "system" {
    fn SetFileInformationByHandle(file:*mut std::ffi::c_void,class:i32,info:*const std::ffi::c_void,size:u32)->i32;
}
fn rename(file:&std::fs::File,target:&Path)->Result<(),Error>{
    let name:Vec<u16>=target.as_os_str().encode_wide().collect();
    let root=if std::mem::size_of::<usize>()==8{8}else{4};
    let length=root+std::mem::size_of::<usize>();let offset=length+4;
    // FileNameLength excludes NUL, but the Win32 path conversion also reads
    // FileName as a terminated string. Always reserve an explicit WCHAR NUL;
    // allocator alignment padding alone disappears for some filename lengths.
    let size=offset+(name.len()+1)*2;
    // Aligned FILE_RENAME_INFO, ReplaceIfExists = FALSE, RootDirectory = NULL.
    let mut storage=vec![0u64;(size+7)/8];
    let bytes=unsafe{std::slice::from_raw_parts_mut(storage.as_mut_ptr() as *mut u8,storage.len()*8)};
    bytes[length..length+4].copy_from_slice(&((name.len()*2) as u32).to_ne_bytes());
    for (index,unit) in name.iter().enumerate(){bytes[offset+index*2..offset+index*2+2].copy_from_slice(&unit.to_ne_bytes());}
    if unsafe{SetFileInformationByHandle(file.as_raw_handle(),3,storage.as_ptr() as *const _,size as u32)}==0{return Err(Error::last_os_error());}Ok(())
}
fn output_name(path:&Path)->bool{
    let Some(name)=path.file_name().and_then(|name|name.to_str())else{return false;};
    let stem=name.split('.').next().unwrap_or_default().to_ascii_uppercase();
    !name.is_empty()&&name.encode_utf16().count()<=240&&!name.contains([':', '<', '>', '"', '|', '?', '*','/','\\'])
        &&!name.chars().any(char::is_control)&&!name.ends_with(['.',' '])
        &&!matches!(stem.as_str(),"CON"|"PRN"|"AUX"|"NUL"|"CONIN$"|"CONOUT$")
        &&!((stem.starts_with("COM")||stem.starts_with("LPT"))&&stem.len()==4&&stem.as_bytes()[3].is_ascii_digit())
        &&matches!(path.extension().and_then(|extension|extension.to_str()),Some("pdf"|"png"|"jpg"|"jpeg"|"webp"|"zip"|"txt"|"xlsx"|"docx"|"pptx"))
}
pub fn publish(message:&Value,request:&Value)->Result<Value,String>{
    if message.as_object().is_none_or(|fields|fields.len()!=5){return Err("Invalid output publication".into());}
    let stage=Path::new(message["stage"].as_str().ok_or("Invalid staging file")?);
    let target=Path::new(message["target"].as_str().ok_or("Invalid output path")?);
    let bytes=message["bytes"].as_u64().filter(|size|*size>0&&*size<=256*1024*1024).ok_or("Invalid output size")?;
    let digest=message["sha256"].as_str().filter(|hash|hash.len()==64&&hash.bytes().all(|b|b.is_ascii_hexdigit())).ok_or("Invalid output verification")?;
    let folder=stage.parent().ok_or("Invalid staging folder")?;
    let allowed=if let Some(folder)=request["folder"].as_str(){vec![PathBuf::from(folder)]}else{
        request["paths"].as_array().ok_or("Invalid input paths")?.iter().filter_map(|value|Path::new(value.as_str()?).parent().map(Path::to_owned)).collect()
    };
    // Parents are already held by FilePins for the entire processing session.
    if !stage.is_absolute()||stage.as_os_str().len()>32767||target.as_os_str().len()>32767
        ||target.parent()!=Some(folder)||!allowed.iter().any(|allowed|allowed==folder)||!output_name(target){return Err("Output escaped its selected folder".into());}
    let stage_name=stage.file_name().and_then(|name|name.to_str()).ok_or("Invalid staging name")?;
    let id=stage_name.strip_prefix(".sorafiles-").and_then(|name|name.strip_suffix(".tmp")).ok_or("Invalid staging name")?;
    if uuid::Uuid::parse_str(id).is_err(){return Err("Invalid staging name".into());}
    let mut file=OpenOptions::new().access_mode(0x80010000).share_mode(1).custom_flags(0x00200000).open(stage)
        .map_err(|_|"Output staging file is busy or unavailable")?;
    let info=file.metadata().map_err(|_|"Output staging file unavailable")?;
    if !info.is_file()||info.file_attributes()&0x400!=0||info.len()!=bytes{return Err("Staged output changed".into());}
    let mut hash=Sha256::new();let mut buffer=[0u8;65536];let mut total=0;
    loop{let count=file.read(&mut buffer).map_err(|_|"Staged output could not be verified")?;if count==0{break;}total+=count as u64;if total>bytes{return Err("Staged output changed".into());}hash.update(&buffer[..count]);}
    if total!=bytes||format!("{:x}",hash.finalize())!=digest{return Err("Staged output changed after validation".into());}
    let stem=target.file_stem().unwrap().to_string_lossy();let extension=target.extension().unwrap().to_string_lossy();
    for suffix in 0..10000{
        let path=if suffix==0{target.to_owned()}else{folder.join(format!("{stem} ({suffix}).{extension}"))};
        match rename(&file,&path){Ok(())=>return Ok(json!({"type":"published","ok":true,"path":path})),Err(error) if matches!(error.raw_os_error(),Some(80|183))=>continue,Err(error)=>return Err(format!("Could not publish output in this folder (Windows error {})",error.raw_os_error().unwrap_or(0)))}
    }
    Err("Too many filename conflicts".into())
}

#[cfg(test)]mod tests{
    use super::*;use crate::file_pins::FilePins;
    fn fixture()->(PathBuf,PathBuf,PathBuf,Value){
        let base=std::env::temp_dir().join(format!("sorafiles-publish-{}",uuid::Uuid::new_v4()));std::fs::create_dir(&base).unwrap();
        let source=base.join("source.pdf");std::fs::write(&source,b"original").unwrap();
        let stage=base.join(format!(".sorafiles-{}.tmp",uuid::Uuid::new_v4()));std::fs::write(&stage,b"verified bytes").unwrap();
        let request=json!({"paths":[source],"folder":null});(base,source,stage,request)
    }
    fn message(stage:&Path,target:&Path)->Value{json!({"type":"publish","stage":stage,"target":target,"bytes":14,"sha256":format!("{:x}",Sha256::digest(b"verified bytes"))})}
    #[test]fn native_publication_keeps_originals_and_collision_outputs(){
        let (base,source,stage,request)=fixture();let pins=FilePins::for_request(&request).unwrap();
        let result=publish(&message(&stage,&source),&request).unwrap();let saved=PathBuf::from(result["path"].as_str().unwrap());
        assert_eq!(saved,base.join("source (1).pdf"));assert_eq!(std::fs::read(&source).unwrap(),b"original");assert_eq!(std::fs::read(&saved).unwrap(),b"verified bytes");assert!(!stage.exists());
        drop(pins);std::fs::remove_dir_all(base).unwrap();
    }
    #[test]fn changed_busy_or_escaped_staging_files_never_publish(){
        let (base,_source,stage,request)=fixture();let pins=FilePins::for_request(&request).unwrap();let target=base.join("result.pdf");
        std::fs::write(&stage,b"tampered bytes").unwrap();assert!(publish(&message(&stage,&target),&request).is_err());assert!(!target.exists());
        std::fs::write(&stage,b"verified bytes").unwrap();let writer=OpenOptions::new().write(true).open(&stage).unwrap();assert!(publish(&message(&stage,&target),&request).is_err());drop(writer);
        assert!(publish(&message(&stage,&base.parent().unwrap().join("escaped.pdf")),&request).is_err());
        assert!(publish(&message(&stage,&base.join("injected.exe")),&request).is_err());
        assert!(publish(&message(&stage,&base.join("result.pdf:stream")),&request).is_err());assert!(!target.exists());
        drop(pins);std::fs::remove_dir_all(base).unwrap();
    }
    #[test]fn office_outputs_publish_and_register_without_overwriting_existing_files(){
        for (stem,extension) in [("result","docx"),("invoice","xlsx"),("slides","pptx"),("a","pdf"),("ab","png"),("abc","webp"),("abcd","pdf"),("日本語 résumé","docx")] {
            let (base,_source,stage,request)=fixture();let pins=FilePins::for_request(&request).unwrap();
            let target=base.join(format!("{stem}.{extension}"));std::fs::write(&target,b"existing document").unwrap();
            let result=publish(&message(&stage,&target),&request).unwrap();let saved=PathBuf::from(result["path"].as_str().unwrap());
            assert_eq!(saved.canonicalize().unwrap(),base.join(format!("{stem} (1).{extension}")).canonicalize().unwrap());
            assert_eq!(std::fs::read(&target).unwrap(),b"existing document");
            assert_eq!(std::fs::read(&saved).unwrap(),b"verified bytes");
            let mut outputs=crate::outputs::Outputs::default();let id=outputs.register(&saved).unwrap();
            assert_eq!(outputs.resolve(&id).unwrap(),saved);
            drop(pins);std::fs::remove_dir_all(base).unwrap();
        }
    }
}
