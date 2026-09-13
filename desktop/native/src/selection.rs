use serde::Serialize;
use std::{fs::{self, File}, path::{Component, Path, PathBuf}};
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub struct Selected { pub id: String, pub name: String, pub format: Option<&'static str>, pub validated: bool, pub validation: &'static str, pub bytes: u64 }
#[derive(Default)]
pub struct Selection { entries: Vec<(PathBuf, Selected)> }
#[derive(Clone, Serialize)]
pub struct SelectionResult { pub files: Vec<Selected>, pub rejected: bool }

fn local_file(path: &Path) -> Result<(PathBuf, File, u64), &'static str> {
    if !path.is_absolute() || path.to_string_lossy().starts_with("\\\\") || path.to_string_lossy().starts_with("//") { return Err("Choose a local file"); }
    let mut current = PathBuf::new();
    for part in path.components() {
        if matches!(part, Component::ParentDir) { return Err("Invalid file path"); }
        #[cfg(windows)]
        if let Component::Normal(name) = part {
            if name.to_string_lossy().contains(':') { return Err("Choose an ordinary local file"); }
        }
        current.push(part);
        let metadata = fs::symlink_metadata(&current).map_err(|_| "File unavailable")?;
        if metadata.file_type().is_symlink() { return Err("Choose the original file"); }
        #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if metadata.file_attributes() & 0x400 != 0 { return Err("Choose a local original file"); } }
    }
    let canonical = fs::canonicalize(path).map_err(|_| "File unavailable")?;
    // Refuse special files before opening; on Unix, opening a FIFO may block.
    if !fs::symlink_metadata(&canonical).map_err(|_| "File unavailable")?.is_file() { return Err("Choose an ordinary local file"); }
    let file = File::open(&canonical).map_err(|_| "File unavailable")?;
    let info = file.metadata().map_err(|_| "File unavailable")?;
    if !info.is_file() || info.len() == 0 || info.len() > 512 * 1024 * 1024 { return Err("File outside selection limits"); }
    Ok((canonical, file, info.len()))
}

impl Selection {
    pub fn add(&mut self, paths: Vec<PathBuf>) -> SelectionResult {
        let mut result = SelectionResult { files: Vec::new(), rejected: paths.len() > 256 };
        for path in paths.into_iter().take(256) {
            let Ok((canonical, mut file, bytes)) = local_file(&path) else { result.rejected = true; continue; };
            if let Some((_, item)) = self.entries.iter().find(|(old, _)| old == &canonical) { result.files.push(item.clone()); continue; }
            if self.entries.len() >= 256 { result.rejected = true; continue; }
            let before = file.metadata().ok();
            let Ok(format) = crate::classify::classify(&mut file, bytes) else { result.rejected = true; continue; };
            let unchanged = before.zip(file.metadata().ok()).is_some_and(|(old, now)| old.len() == now.len() && old.modified().ok() == now.modified().ok());
            if !unchanged { result.rejected = true; continue; }
            let item = Selected { id: Uuid::new_v4().simple().to_string(), name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), format, validated: format.is_some(), validation: "signature-only", bytes };
            self.entries.push((canonical, item.clone())); result.files.push(item);
        }
        result
    }
    pub fn release(&mut self, ids: &[String]) -> Result<(), &'static str> {
        if ids.len() > 256 || ids.iter().any(|id| id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit())) { return Err("Invalid selection"); }
        self.entries.retain(|(_, item)| !ids.contains(&item.id)); Ok(())
    }
    pub fn list(&self) -> Vec<Selected> { self.entries.iter().map(|(_, item)| item.clone()).collect() }
    pub fn resolve(&self, ids: &[String]) -> Result<Vec<PathBuf>, &'static str> {
        if ids.is_empty() || ids.len()>256 {return Err("Choose files first");}
        ids.iter().map(|id| {
            let (path,_)=self.entries.iter().find(|(_,item)| &item.id==id).ok_or("Selection expired. Choose the files again.")?;
            // Node's local-file boundary refuses UNC paths. Keep ordinary drive
            // paths while removing only Windows' canonical local-drive prefix.
            #[cfg(windows)] let canonical={let value=path.to_string_lossy();if let Some(rest)=value.strip_prefix(r"\\?\") {
                if rest.as_bytes().get(1)!=Some(&b':') {return Err("Choose a local file");}PathBuf::from(rest)
            }else{path.clone()}};
            #[cfg(not(windows))] let canonical=path.clone();
            local_file(&canonical)?;
            Ok(canonical)
        }).collect()
    }
    pub fn clear(&mut self) { self.entries.clear(); }
}

#[cfg(test)] mod tests {
    use super::*;
    fn fixture_directory() -> PathBuf {
        let base = std::env::temp_dir();
        #[cfg(unix)] let base = fs::canonicalize(base).unwrap();
        let directory=base.join(format!("sorafiles-selection-{}",Uuid::new_v4()));
        fs::create_dir(&directory).unwrap();directory
    }
    #[test] fn bounded_selection_and_release() {
        let directory = fixture_directory();
        let path = directory.join("not-a-pdf.txt"); fs::write(&path, b"%PDF-1.7\nfixture").unwrap();
        let mut selection = Selection::default();
        for _ in 0..300 { let result = selection.add(vec![path.clone()]); assert_eq!(result.files[0].format, Some("PDF")); assert!(!result.rejected); selection.release(&[result.files[0].id.clone()]).unwrap(); assert!(selection.entries.is_empty()); }
        let result = selection.add(vec![path.clone(), directory.join("missing")]); assert!(result.rejected); assert_eq!(result.files.len(), 1);
        assert!(selection.release(&["bad".into()]).is_err()); assert_eq!(selection.entries.len(), 1);
        let second=directory.join("second.pdf");fs::write(&second,b"%PDF-1.7\nsecond").unwrap();
        selection.add(vec![second.clone(),path.clone()]);
        assert_eq!(selection.list().iter().map(|item| item.name.as_str()).collect::<Vec<_>>(),vec!["not-a-pdf.txt","second.pdf"]);
        selection.release(&[result.files[0].id.clone()]).unwrap();selection.add(vec![path.clone()]);
        assert_eq!(selection.list()[0].name,"second.pdf");fs::remove_file(second).unwrap();
        fs::remove_file(path).unwrap(); fs::remove_dir(directory).unwrap();
    }
    #[test] fn rejected_inputs_never_create_selection_ids() {
        let directory=fixture_directory();let empty=directory.join("empty.pdf");fs::write(&empty,[]).unwrap();
        let mut selection=Selection::default();
        let result=selection.add(vec![empty.clone(),directory.clone(),PathBuf::from("relative.pdf"),directory.join("missing.pdf")]);
        assert!(result.rejected);assert!(result.files.is_empty());assert!(selection.list().is_empty());
        fs::remove_file(empty).unwrap();fs::remove_dir(directory).unwrap();
    }
    #[test] fn resolved_selection_preserves_order_and_rejects_expired_files() {
        let directory=fixture_directory();let first=directory.join("first.pdf");let second=directory.join("second.pdf");
        fs::write(&first,b"%PDF-1.7\nfirst").unwrap();fs::write(&second,b"%PDF-1.7\nsecond").unwrap();
        let mut selection=Selection::default();let added=selection.add(vec![first.clone(),second.clone()]);
        let ids=vec![added.files[1].id.clone(),added.files[0].id.clone()];let paths=selection.resolve(&ids).unwrap();
        assert_eq!(paths[0].file_name().unwrap(),"second.pdf");assert_eq!(paths[1].file_name().unwrap(),"first.pdf");
        #[cfg(windows)] assert!(!paths[0].to_string_lossy().starts_with(r"\\?\"));
        assert!(selection.resolve(&["a".repeat(32)]).is_err());assert!(selection.resolve(&[]).is_err());
        fs::remove_file(&second).unwrap();assert!(selection.resolve(&ids).is_err());
        selection.release(&[added.files[0].id.clone()]).unwrap();assert!(selection.resolve(&[added.files[0].id.clone()]).is_err());
        fs::remove_file(first).unwrap();fs::remove_dir(directory).unwrap();
    }
    #[test] fn selection_capacity_is_bounded_across_requests() {
        let directory=fixture_directory();let mut paths=Vec::new();
        for index in 0..257 { let path=directory.join(format!("{index}.pdf"));fs::write(&path,b"%PDF-1.7\nfixture").unwrap();paths.push(path); }
        let mut selection=Selection::default();let result=selection.add(paths.clone());
        assert!(result.rejected);assert_eq!(result.files.len(),256);assert_eq!(selection.list().len(),256);
        assert!(selection.add(vec![paths[256].clone()]).rejected);
        selection.release(&[result.files[0].id.clone()]).unwrap();
        assert!(!selection.add(vec![paths[256].clone()]).rejected);assert_eq!(selection.list().len(),256);
        selection.clear();assert!(selection.list().is_empty());
        for path in paths { fs::remove_file(path).unwrap(); }fs::remove_dir(directory).unwrap();
    }
    #[cfg(unix)]
    #[test] fn linked_files_and_ancestors_are_refused() {
        use std::os::unix::fs::symlink;
        let directory=fixture_directory();let original=directory.join("original.pdf");fs::write(&original,b"%PDF-1.7\nfixture").unwrap();
        let alias=directory.join("alias.pdf");let folder_alias=directory.join("folder-alias");
        symlink(&original,&alias).unwrap();symlink(&directory,&folder_alias).unwrap();
        let mut selection=Selection::default();let result=selection.add(vec![alias.clone(),folder_alias.join("original.pdf")]);
        assert!(result.rejected);assert!(result.files.is_empty());
        fs::remove_file(alias).unwrap();fs::remove_file(folder_alias).unwrap();fs::remove_file(original).unwrap();fs::remove_dir(directory).unwrap();
    }
}
