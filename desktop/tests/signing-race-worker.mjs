import {parentPort,workerData} from 'node:worker_threads';
import {LicenseStore} from '../license-service/store.mjs';
const store=new LicenseStore(workerData.file),flags=new Int32Array(workerData.shared);
parentPort.postMessage('ready');
parentPort.once('message',()=>{
 Atomics.store(flags,0,1);Atomics.notify(flags,0);
 try{store.revokeDevice('license','device');Atomics.store(flags,1,1);parentPort.postMessage('revoked');}
 catch{parentPort.postMessage('failed');}
 finally{store.close();}
});
