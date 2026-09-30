//! Resolve a durable launcher instead of retaining an ephemeral AppImage mount.
use std::{
    io::Read,
    path::{Path, PathBuf},
};

fn validate_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .to_str()
            .map_or(true, |text| text.chars().any(char::is_control))
    {
        return Err("Application location unavailable".into());
    }
    Ok(())
}

pub fn resolve(
    executable: PathBuf,
    image: Option<PathBuf>,
    mount: Option<PathBuf>,
) -> Result<PathBuf, String> {
    validate_path(&executable)?;
    match (image, mount) {
        (None, None) => Ok(executable),
        // Incomplete AppImage context must not persist a temporary mounted path.
        (Some(_), None) | (None, Some(_)) => Err("AppImage location unavailable".into()),
        (Some(image), Some(mount)) => {
            validate_path(&image)?;
            validate_path(&mount)?;
            let mount = mount
                .canonicalize()
                .map_err(|_| "AppImage location unavailable")?;
            let executable_path = executable
                .canonicalize()
                .map_err(|_| "Application location unavailable")?;
            if !executable_path.starts_with(&mount) {
                return Ok(executable);
            }
            let image = image
                .canonicalize()
                .map_err(|_| "AppImage location unavailable")?;
            validate_path(&image)?;
            if image.starts_with(&mount) {
                return Err("AppImage location unavailable".into());
            }
            let mut header = [0u8; 11];
            std::fs::File::open(&image)
                .and_then(|mut file| file.read_exact(&mut header))
                .map_err(|_| "AppImage location unavailable")?;
            if &header[..4] != b"\x7fELF" || &header[8..] != b"AI\x02" {
                return Err("AppImage location unavailable".into());
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if std::fs::metadata(&image)
                    .map_err(|_| "AppImage location unavailable")?
                    .permissions()
                    .mode()
                    & 0o111
                    == 0
                {
                    return Err("AppImage location unavailable".into());
                }
            }
            Ok(image)
        }
    }
}

pub fn current() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|_| "Application location unavailable")?;
    #[cfg(target_os = "linux")]
    {
        resolve(
            executable,
            std::env::var_os("APPIMAGE").map(PathBuf::from),
            std::env::var_os("APPDIR").map(PathBuf::from),
        )
    }
    #[cfg(not(target_os = "linux"))]
    {
        resolve(executable, None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ordinary_install_uses_current_executable() {
        let exe = std::env::current_exe().unwrap();
        assert_eq!(resolve(exe.clone(), None, None).unwrap(), exe);
    }
    #[test]
    fn incomplete_appimage_environment_fails_closed() {
        assert!(resolve(
            std::env::current_exe().unwrap(),
            Some(PathBuf::from("image")),
            None
        )
        .is_err());
    }
    #[test]
    fn invalid_application_paths_are_rejected() {
        assert!(resolve(PathBuf::from("relative"), None, None).is_err());
        let path = std::env::temp_dir().join("bad\npath");
        assert!(resolve(path, None, None).is_err());
    }
    #[test]
    fn image_must_be_persistent_and_have_a_valid_header() {
        let root =
            std::env::temp_dir().join(format!("sorafiles-launcher-test-{}", std::process::id()));
        std::fs::create_dir_all(root.join("mount")).unwrap();
        let exe = root.join("mount/app");
        std::fs::write(&exe, b"application").unwrap();
        let image = root.join("Sora Files.AppImage");
        std::fs::write(&image, b"not-an-appimage").unwrap();
        assert!(resolve(exe.clone(), Some(image.clone()), Some(root.join("mount"))).is_err());
        std::fs::write(&image, b"\x7fELF\0\0\0\0AI\x02").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&image, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        assert_eq!(
            resolve(exe.clone(), Some(image.clone()), Some(root.join("mount"))).unwrap(),
            image.canonicalize().unwrap()
        );
        assert!(resolve(exe.clone(), Some(exe), Some(root.join("mount"))).is_err());
        std::fs::remove_file(image).unwrap();
        std::fs::remove_file(root.join("mount/app")).unwrap();
        std::fs::remove_dir(root.join("mount")).unwrap();
        std::fs::remove_dir(root).unwrap();
    }
}
