//! Per-action Unix process cleanup, not a filesystem or network sandbox.
//!
//! Bundled components and workers must remain in this group (no setsid or
//! detached spawn). The group leader is not reaped before group termination,
//! so its identifier cannot be recycled while we still own the group.
use std::{
    io::{self, Read},
    os::{fd::AsRawFd, unix::process::CommandExt},
    process::{Child, ChildStdout, Command},
    sync::{atomic::{AtomicBool, Ordering}, mpsc, Arc},
    thread::{self, JoinHandle},
    time::Duration,
};

unsafe extern "C" {
    fn kill(pid: i32, signal: i32) -> i32;
    fn poll(fds: *mut PollFd, count: usize, timeout: i32) -> i32;
}

#[repr(C)]
struct PollFd { fd: i32, events: i16, revents: i16 }

pub struct ProcessGroup { child: Child, active: bool }

impl ProcessGroup {
    pub fn spawn(command: &mut Command) -> io::Result<Self> {
        // setpgid runs in the child before exec, before any worker can start.
        let child = command.process_group(0).spawn()?;
        Ok(Self { child, active: true })
    }

    pub fn cleanup(&mut self) {
        if !self.active { return; }
        self.active = false;
        // The PID comes only from our unreaped child, never from IPC or files.
        // Kill all ordinary descendants before waiting or closing pipe readers.
        if let Ok(pid) = i32::try_from(self.child.id()) {
            if pid > 1 { unsafe { kill(-pid, 9); } }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl std::ops::Deref for ProcessGroup {
    type Target = Child;
    fn deref(&self) -> &Child { &self.child }
}
impl std::ops::DerefMut for ProcessGroup {
    fn deref_mut(&mut self) -> &mut Child { &mut self.child }
}
impl Drop for ProcessGroup { fn drop(&mut self) { self.cleanup(); } }

/// A stoppable, bounded pipe reader. Even a descendant which incorrectly
/// escapes its group and retains stdout cannot block action cleanup forever.
pub struct FrameReader { stop: Arc<AtomicBool>, thread: Option<JoinHandle<()>> }

impl FrameReader {
    pub fn start(mut output: ChildStdout, maximum: usize) -> (mpsc::Receiver<Vec<u8>>, Self) {
        let stop = Arc::new(AtomicBool::new(false));
        let stopped = Arc::clone(&stop);
        let (sender, receiver) = mpsc::sync_channel(2);
        let thread = thread::spawn(move || {
            let mut pending = Vec::new();
            let mut chunk = [0; 8192];
            while !stopped.load(Ordering::Acquire) {
                let mut fd = PollFd { fd: output.as_raw_fd(), events: 1, revents: 0 };
                // poll(2) has no other reader competing for this pipe. Once
                // readable (or hung up), a single read cannot wait for bytes.
                let ready = unsafe { poll(&mut fd, 1, 100) };
                if ready < 0 {
                    if io::Error::last_os_error().kind() == io::ErrorKind::Interrupted { continue; }
                    break;
                }
                if ready == 0 { continue; }
                match output.read(&mut chunk) {
                    Ok(0) => {
                        if !pending.is_empty() { let _ = send_frame(&sender, pending, &stopped); }
                        break;
                    }
                    Ok(count) => {
                        for byte in &chunk[..count] {
                            pending.push(*byte);
                            if pending.len() > maximum { return; }
                            if *byte == b'\n' && !send_frame(&sender, std::mem::take(&mut pending), &stopped) { return; }
                        }
                    }
                    Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
                    Err(_) => break,
                }
            }
        });
        (receiver, Self { stop, thread: Some(thread) })
    }
}

fn send_frame(sender: &mpsc::SyncSender<Vec<u8>>, mut frame: Vec<u8>, stop: &AtomicBool) -> bool {
    while !stop.load(Ordering::Acquire) {
        match sender.try_send(frame) {
            Ok(()) => return true,
            Err(mpsc::TrySendError::Disconnected(_)) => return false,
            Err(mpsc::TrySendError::Full(value)) => {
                frame = value;
                thread::sleep(Duration::from_millis(10));
            }
        }
    }
    false
}

impl Drop for FrameReader {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() { let _ = thread.join(); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{process::Stdio, time::Instant};

    fn component(script: &str) -> ProcessGroup {
        ProcessGroup::spawn(Command::new("node").args(["-e", script])
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())).unwrap()
    }

    #[test]
    fn cleanup_terminates_descendants_that_hold_the_output_pipe() {
        let mut child = component("const cp=require('node:child_process');const worker=cp.spawn(process.execPath,['-e',\"console.log('ready');setInterval(()=>{},1000)\"],{stdio:['ignore',1,'ignore']});setInterval(()=>{},1000);");
        let (receiver, reader) = FrameReader::start(child.stdout.take().unwrap(), 1024);
        assert_eq!(receiver.recv_timeout(Duration::from_secs(5)).unwrap(), b"ready\n");
        child.cleanup();
        // EOF proves the worker no longer holds the inherited stdout handle.
        assert!(matches!(receiver.recv_timeout(Duration::from_secs(5)), Err(mpsc::RecvTimeoutError::Disconnected)));
        assert!(!child.try_wait().unwrap().unwrap().success());
        drop(reader);
    }

    #[test]
    fn reader_shutdown_does_not_wait_for_eof_or_a_full_channel() {
        for script in ["setInterval(()=>{},1000)", "process.stdout.write('one\\ntwo\\nthree\\nfour\\n');setInterval(()=>{},1000)"] {
            let mut child = component(script);
            let (_receiver, reader) = FrameReader::start(child.stdout.take().unwrap(), 1024);
            thread::sleep(Duration::from_millis(200));
            let started = Instant::now();
            drop(reader);
            assert!(started.elapsed() < Duration::from_secs(2));
            assert!(child.try_wait().unwrap().is_none());
        }
    }

    #[test]
    fn frames_are_bounded_and_truncated_final_frames_are_delivered() {
        let mut child = component("process.stdout.write('ok\\nlast')");
        let (receiver, _reader) = FrameReader::start(child.stdout.take().unwrap(), 4);
        assert_eq!(receiver.recv_timeout(Duration::from_secs(5)).unwrap(), b"ok\n");
        assert_eq!(receiver.recv_timeout(Duration::from_secs(5)).unwrap(), b"last");
        let mut child = component("process.stdout.write('12345')");
        let (receiver, _reader) = FrameReader::start(child.stdout.take().unwrap(), 4);
        assert!(matches!(receiver.recv_timeout(Duration::from_secs(5)), Err(mpsc::RecvTimeoutError::Disconnected)));
    }
}
