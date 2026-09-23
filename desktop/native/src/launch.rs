use std::path::PathBuf;

// OS argument vectors are consumed directly. No command strings, shell expansion,
// environment expansion or automatic file processing is permitted here.
pub fn selected_paths(args: &[String]) -> Result<Vec<PathBuf>, &'static str> {
    if args.is_empty() { return Ok(Vec::new()); }
    if args.len()==1&&args[0]=="--background"{return Ok(Vec::new());}
    // Reserved native diagnostic: does not act on user selections.
    if args.len() == 2 && args[0] == "--native-smoke" { return Ok(Vec::new()); }
    let files = if args[0] == "--open" { &args[1..] } else { args };
    if files.is_empty() || files.len() > 256 { return Err("Select between 1 and 256 files."); }
    files.iter().map(|value| {
        let path=PathBuf::from(value);
        if value.len()>32768 || value.contains('\0') || !path.is_absolute()
            || value.starts_with("\\\\") || value.starts_with("//") {
            return Err("Choose files on this device.");
        }
        Ok(path)
    }).collect()
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn shell_arguments_are_literal_and_bounded() {
        let file=std::env::temp_dir().join("quote ' space & $(literal).pdf").to_string_lossy().into_owned();
        assert_eq!(selected_paths(&["--open".into(),file.clone()]).unwrap(),vec![PathBuf::from(&file)]);
        assert_eq!(selected_paths(&[file.clone()]).unwrap(),vec![PathBuf::from(&file)]);
        for args in [vec!["--open".into()],vec!["--delete".into(),file.clone()],vec!["relative.pdf".into()],vec!["https://example.com/file.pdf".into()],vec!["\\\\server\\share\\file.pdf".into()],vec![file;257]] {
            assert!(selected_paths(&args).is_err());
        }
        assert!(selected_paths(&[]).unwrap().is_empty());
        assert!(selected_paths(&["--background".into()]).unwrap().is_empty());
        assert!(selected_paths(&["--background".into(),"relative.pdf".into()]).is_err());
    }
}
