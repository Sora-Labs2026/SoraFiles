//! Compile and exercise the production platform helpers without a GUI build.
//! Tests use disposable paths; no real login or file-manager entries are changed.
#[path = "../native/src/unix_startup.rs"]
pub mod startup;
#[cfg(unix)]
#[path = "../native/src/unix_process_group.rs"]
pub mod process_group;
