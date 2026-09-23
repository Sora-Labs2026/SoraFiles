import {parentPort,workerData} from 'node:worker_threads';
import {LicenseStore} from '../license-service/store.mjs';
const store=new LicenseStore(workerData.file);let won=false;
try{store.activate('license',workerData.deviceId,'replacement-'+workerData.deviceId,workerData.now);won=true;}
catch{}finally{store.close();parentPort.postMessage({won});}
