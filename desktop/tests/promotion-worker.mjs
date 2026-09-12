import {parentPort,workerData as data} from 'node:worker_threads';import {LicenseStore} from '../license-service/store.mjs';import {PromotionStore} from '../license-service/promotions.mjs';
const db=new LicenseStore(data.file),store=new PromotionStore(db,{encryptionKey:Buffer.from(data.key,'hex')});let won=false;
try{store.reserve(data.code,{subjectHash:data.i.toString(16).padStart(64,'0'),customerId:'cus_'+data.i},data.time);won=true;}catch{}finally{db.close();parentPort.postMessage({won});}
