//! Microsoft Store (MSIX) package support. A packaged install receives its
//! Explorer command and sign-in startup task from the package manifest
//! (desktop/scripts/build-msix.mjs), so the registry paths are skipped: Windows
//! redirects a packaged app's per-user registry writes, and Explorer would
//! never see them. Startup uses the package's StartupTask instead of Run.

/// Must match the StartupTask TaskId in desktop/scripts/build-msix.mjs.
pub const STARTUP_TASK_ID: &str = "SoraFilesStartup";

#[cfg(windows)]
mod imp {
    use std::sync::OnceLock;
    use ::windows::{
        core::HSTRING,
        ApplicationModel::{Activation::ActivationKind, AppInstance, StartupTask, StartupTaskState},
        Win32::System::Com::CoIncrementMTAUsage,
    };

    pub fn packaged() -> bool {
        static PACKAGED: OnceLock<bool> = OnceLock::new();
        *PACKAGED.get_or_init(|| {
            #[link(name = "kernel32")]
            extern "system" { fn GetCurrentPackageFullName(length: *mut u32, name: *mut u16) -> i32; }
            const APPMODEL_ERROR_NO_PACKAGE: i32 = 15700;
            let mut length = 0u32;
            // With an empty buffer a packaged process gets ERROR_INSUFFICIENT_BUFFER.
            unsafe { GetCurrentPackageFullName(&mut length, std::ptr::null_mut()) != APPMODEL_ERROR_NO_PACKAGE }
        })
    }

    // WinRT calls may run on threads that never initialised COM; keep an
    // implicit multithreaded apartment alive for the whole process.
    fn apartment() {
        static MTA: OnceLock<()> = OnceLock::new();
        MTA.get_or_init(|| { let _ = unsafe { CoIncrementMTAUsage() }; });
    }

    fn task() -> Result<StartupTask, String> {
        apartment();
        StartupTask::GetAsync(&HSTRING::from(super::STARTUP_TASK_ID)).and_then(|operation| operation.get())
            .map_err(|_| "Windows startup setting unavailable".into())
    }

    pub fn startup_enabled() -> Result<bool, String> {
        let state = task()?.State().map_err(|_| "Windows startup setting could not be read")?;
        Ok(state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy)
    }

    pub fn set_startup(enabled: bool) -> Result<bool, String> {
        let task = task()?;
        if !enabled {
            task.Disable().map_err(|_| "Sign-in setting could not be removed")?;
            return Ok(false);
        }
        let state = task.RequestEnableAsync().and_then(|operation| operation.get())
            .map_err(|_| "Sign-in setting could not be saved")?;
        if state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy { return Ok(true); }
        if state == StartupTaskState::DisabledByPolicy {
            return Err("Your organization has turned off startup for SoraFiles Desktop.".into());
        }
        // DisabledByUser: only the user can turn it back on in Windows Settings.
        Err("Enable SoraFiles Desktop in Windows Settings > Apps > Startup, then try again.".into())
    }

    /// True when Windows started this process through the package's startup task.
    pub fn launched_by_startup_task() -> bool {
        if !packaged() { return false; }
        apartment();
        AppInstance::GetActivatedEventArgs()
            .and_then(|args| args.Kind())
            .map(|kind| kind == ActivationKind::StartupTask)
            .unwrap_or(false)
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn packaged() -> bool { false }
    pub fn startup_enabled() -> Result<bool, String> { Ok(false) }
    pub fn set_startup(_enabled: bool) -> Result<bool, String> { Err("Startup tasks are available on Windows only".into()) }
    pub fn launched_by_startup_task() -> bool { false }
}

pub use imp::{launched_by_startup_task, packaged, set_startup, startup_enabled};

#[cfg(test)]
mod tests {
    #[test]
    fn unpackaged_processes_keep_the_registry_paths() {
        // cargo test never runs inside an MSIX package.
        assert!(!super::packaged());
        assert!(!super::launched_by_startup_task());
    }
}
