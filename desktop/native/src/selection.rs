use serde::Serialize;
use std::{collections::HashMap, fs::{self, File}, io::Read, path::{Component, Path, PathBuf}};
use uuid::Uuid;

#[derive(Clone, Serialize)]
pub struct Selected { pub id: String, pub name: String, pub format: Option<&'static str>, pub validated: bool, pub bytes: u64 }
#[derive(Default)]
pub struct Selection { entries: HashMap<String, (PathBuf, Selected)> }
#[derive(Clone, Serialize)]
pub struct SelectionResult { pub files: Vec<Selected>, pub rejected: bool }

fn local_file(path: &Path) -> Result<(PathBuf, File, u64), &'static str> {
    if !path.is_absolute() || path.to_string_lossy().starts_with("\\\\") || path.to_string_lossy().starts_with("//") { return Err("Choose a local file"); }
    let mut current = PathBuf::new();
    for part in path.components() {
        if matches!(part, Component::ParentDir) { return Err("Invalid file path"); }
        current.push(part);
        let metadata = fs::symlink_metadata(&current).map_err(|_| "File unavailable")?;
        if metadata.file_type().is_symlink() { return Err("Choose the original file"); }
        #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if metadata.file_attributes() & 0x400 != 0 { return Err("Choose a local original file"); } }
    }
    let canonical = fs::canonicalize(path).map_err(|_| "File unavailable")?;
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
            if let Some((_, item)) = self.entries.values().find(|(old, _)| old == &canonical) { result.files.push(item.clone()); continue; }
            if self.entries.len() >= 256 { result.rejected = true; continue; }
            let mut head = [0u8; 16];
            let Ok(count) = file.read(&mut head) else { result.rejected = true; continue; };
            let format = if head.starts_with(b"%PDF-") { Some("PDF") }
                else if count >= 8 && head.starts_with(b"\x89PNG\r\n\x1a\n") { Some("PNG") }
                else if count >= 3 && head.starts_with(b"\xff\xd8\xff") { Some("JPG") }
                else if count >= 12 && head.starts_with(b"RIFF") && &head[8..12] == b"WEBP" { Some("WebP") } else { None };
            let item = Selected { id: Uuid::new_v4().simple().to_string(), name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(), format, validated: format.is_some(), bytes };
            self.entries.insert(item.id.clone(), (canonical, item.clone())); result.files.push(item);
        }
        result
    }
    pub fn release(&mut self, ids: &[String]) -> Result<(), &'static str> {
        if ids.len() > 256 || ids.iter().any(|id| id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit())) { return Err("Invalid selection"); }
        for id in ids { self.entries.remove(id); } Ok(())
    }
    pub fn list(&self) -> Vec<Selected> { self.entries.values().map(|(_, item)| item.clone()).collect() }
    pub fn clear(&mut self) { self.entries.clear(); }
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn bounded_selection_and_release() {
        let directory = fs::canonicalize(std::env::temp_dir()).unwrap().join(format!("sorafiles-selection-{}", Uuid::new_v4())); fs::create_dir(&directory).unwrap();
        let path = directory.join("not-a-pdf.txt"); fs::write(&path, b"%PDF-1.7\nfixture").unwrap();
        let mut selection = Selection::default();
        for _ in 0..300 { let result = selection.add(vec![path.clone()]); assert_eq!(result.files[0].format, Some("PDF")); assert!(!result.rejected); selection.release(&[result.files[0].id.clone()]).unwrap(); assert!(selection.entries.is_empty()); }
        let result = selection.add(vec![path.clone(), directory.join("missing")]); assert!(result.rejected); assert_eq!(result.files.len(), 1);
        assert!(selection.release(&["bad".into()]).is_err()); assert_eq!(selection.entries.len(), 1);
        fs::remove_file(path).unwrap(); fs::remove_dir(directory).unwrap();
    }
}
