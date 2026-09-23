import {randomUUID} from 'node:crypto';
import {assertDesktopTool} from '../shared/tool-policy.mjs';
// Engine implementations are injected only by the trusted host, never by UI messages.
export class JobQueue {
 #jobs=new Map();#active=0;#pending=0;#engines;#authorize;#limit;#onChange;
 constructor({engines,authorize,concurrency=1,onChange=()=>{}}){if(!Number.isInteger(concurrency)||concurrency<1||concurrency>2)throw Error('Invalid concurrency');this.#engines=engines;this.#authorize=authorize;this.#limit=concurrency;this.#onChange=onChange;}
 list(){return [...this.#jobs.values()].map(({id,tool,state,result,error})=>({id,tool,state,result,error}));}
 async add(tool,input){assertDesktopTool(tool);if(!Object.hasOwn(this.#engines,tool))throw Error('Unknown tool');if(this.#jobs.size+this.#pending>=256)throw Error('Queue full');this.#pending++;try{await this.#authorize({tool,phase:'enqueue'});const job={id:randomUUID(),tool,input,state:'queued',controller:new AbortController()};this.#jobs.set(job.id,job);this.#emit();void this.#pump();return job.id;}finally{this.#pending--;}}
 cancel(id){const job=this.#jobs.get(id);if(!job||!['queued','running'].includes(job.state)||job.committing||job.committed)return false;job.controller.abort();if(job.state==='queued'){job.state='cancelled';job.input=undefined;}this.#emit();return true;}
 clearFinished(){for(const [id,j] of this.#jobs)if(['completed','failed','cancelled'].includes(j.state))this.#jobs.delete(id);this.#emit();}
 // View updates must never strand a job or turn a successful save into failure.
 #emit(){try{this.#onChange(this.list());}catch{}}
 async #pump(){while(this.#active<this.#limit){const job=[...this.#jobs.values()].find(j=>j.state==='queued');if(!job)return;job.state='running';this.#active++;this.#emit();void this.#run(job);}}
 async #run(job){try{
  // Recheck immediately before a job starts; expiry never kills work already authorized.
  assertDesktopTool(job.tool);await this.#authorize({tool:job.tool,phase:'start'});job.controller.signal.throwIfAborted();
  const result=await this.#engines[job.tool](job.input,{signal:job.controller.signal,commit:async publish=>{
   job.controller.signal.throwIfAborted();if(job.committing||job.committed)throw Error('Duplicate publication');job.committing=true;
   try{const result=await publish();job.committed=true;job.committedResult=result;return result;}finally{job.committing=false;}
  }});
  // Engines stage/validate before commit(); cancellation cannot report failure after publication.
  job.state=job.committed?'completed':job.controller.signal.aborted?'cancelled':'completed';if(job.state==='completed')job.result=job.committed?job.committedResult:result;
 }catch{job.state=job.committed?'completed':job.controller.signal.aborted?'cancelled':'failed';if(job.committed)job.result=job.committedResult;job.error=job.state==='failed'?'Processing could not finish. Check the file and try again.':undefined;}
 finally{job.input=undefined;job.committedResult=undefined;this.#active--;this.#emit();void this.#pump();}}
}
