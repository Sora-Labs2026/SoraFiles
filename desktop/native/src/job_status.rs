use serde_json::{json,Value};

/// One bounded in-memory job snapshot; no passwords, options, paths or keys.
#[derive(Default)]
pub struct JobStatus { tool: Option<String>, sources: Vec<String>, result: Option<Value>, error: bool }
impl JobStatus {
    pub fn start(&mut self, tool: &str, names: Vec<String>) {
        self.tool=Some(tool.to_owned());self.sources=names;self.result=None;self.error=false;
    }
    pub fn finish(&mut self, outcome: &Result<Value,String>) {
        match outcome { Ok(value)=>self.result=Some(value.clone()),Err(_)=>self.error=true }
    }
    pub fn sources(&mut self, names: Vec<String>) { self.sources=names; }
    pub fn snapshot(&self, busy: bool) -> Value {
        json!({"busy":busy,"tool":self.tool,"sources":self.sources,"result":self.result,
            "error":if self.error {Some("Processing could not finish. Check your saved folder and selected files before trying again.")}else{None}})
    }
    pub fn clear(&mut self) { *self=Self::default(); }
}

#[cfg(test)]mod tests{
    use super::*;
    #[test]fn status_retains_public_results_for_a_recreated_view(){
        let mut job=JobStatus::default();job.start("rotate-pdf",vec!["document.pdf".into()]);
        assert_eq!(job.snapshot(true)["busy"],true);assert!(job.snapshot(true)["result"].is_null());
        job.finish(&Ok(json!({"state":"completed","name":"result.pdf","outputId":"a".repeat(32)})));
        assert_eq!(job.snapshot(false)["sources"][0],"document.pdf");assert_eq!(job.snapshot(false)["result"]["state"],"completed");
        job.start("protect-pdf",vec!["other.pdf".into()]);job.finish(&Err("private internal detail".into()));
        assert!(!job.snapshot(false).to_string().contains("private internal detail"));assert!(job.snapshot(false)["result"].is_null());
        job.clear();assert!(job.snapshot(false)["tool"].is_null());
    }
}
