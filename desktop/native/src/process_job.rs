//! Windows process-tree cleanup. This is not a file or network sandbox.
use std::{ffi::c_void, mem::size_of, os::windows::io::AsRawHandle, process::Child};
type Handle = *mut c_void;
#[repr(C)] #[derive(Default)]
struct BasicLimits { process_time:i64, job_time:i64, flags:u32, minimum:usize, maximum:usize, active:u32, affinity:usize, priority:u32, scheduling:u32 }
#[repr(C)] #[derive(Default)]
struct IoCounters { reads:u64, writes:u64, other:u64, read_bytes:u64, write_bytes:u64, other_bytes:u64 }
#[repr(C)] #[derive(Default)]
struct ExtendedLimits { basic:BasicLimits, io:IoCounters, process_memory:usize, job_memory:usize, peak_process:usize, peak_job:usize }
#[link(name="kernel32")]
unsafe extern "system" {
    fn CreateJobObjectW(attributes:*const c_void,name:*const u16)->Handle;
    fn SetInformationJobObject(job:Handle,class:i32,info:*const c_void,length:u32)->i32;
    fn AssignProcessToJobObject(job:Handle,process:Handle)->i32;
    fn CloseHandle(handle:Handle)->i32;
}
pub struct ProcessJob(Handle);
impl ProcessJob {
    /// Attach before delivering any private state or processing request.
    /// The bundled entry points wait for that request before starting workers.
    pub fn attach(child:&mut Child)->Result<Self,String>{
        let result=(||{
            let handle=unsafe{CreateJobObjectW(std::ptr::null(),std::ptr::null())};
            if handle.is_null(){return Err("Process cleanup could not initialize".into());}
            let job=Self(handle);
            let mut limits=ExtendedLimits::default();limits.basic.flags=0x2000; // KILL_ON_JOB_CLOSE
            if unsafe{SetInformationJobObject(job.0,9,&limits as *const _ as *const c_void,size_of::<ExtendedLimits>() as u32)}==0
                ||unsafe{AssignProcessToJobObject(job.0,child.as_raw_handle())}==0 {
                return Err("Process cleanup could not protect this job".into());
            }
            Ok(job)
        })();
        if result.is_err(){let _=child.kill();let _=child.wait();}
        result
    }
}
impl Drop for ProcessJob {fn drop(&mut self){unsafe{CloseHandle(self.0);}}}

#[cfg(test)]mod tests{
    use super::*;
    use std::{io::{BufRead,BufReader},process::{Command,Stdio}};
    #[link(name="kernel32")]unsafe extern "system" {
        fn OpenProcess(access:u32,inherit:i32,id:u32)->Handle;
        fn WaitForSingleObject(handle:Handle,milliseconds:u32)->u32;
    }
    #[test]fn closing_job_terminates_the_child_and_its_worker(){
        // Worker starts only after attachment, matching the private-pipe protocol.
        let script="process.stdin.once('data',()=>{const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});console.log(c.pid);setInterval(()=>{},1000);});";
        let mut child=Command::new("node").args(["-e",script]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().unwrap();
        let job=ProcessJob::attach(&mut child).unwrap();
        use std::io::Write;child.stdin.as_mut().unwrap().write_all(b"start\n").unwrap();
        let mut pid=String::new();BufReader::new(child.stdout.take().unwrap()).read_line(&mut pid).unwrap();
        let worker=unsafe{OpenProcess(0x00100000,0,pid.trim().parse().unwrap())};assert!(!worker.is_null());
        assert_eq!(unsafe{WaitForSingleObject(worker,0)},258);
        drop(job);
        assert_eq!(unsafe{WaitForSingleObject(worker,5000)},0,"Worker survived job closure");
        assert_eq!(unsafe{WaitForSingleObject(child.as_raw_handle(),5000)},0,"Parent survived job closure");
        unsafe{CloseHandle(worker);}let _=child.wait();
    }
}
