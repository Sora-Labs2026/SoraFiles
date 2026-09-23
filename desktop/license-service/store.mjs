import {DatabaseSync} from 'node:sqlite';
import {LicenseLedger} from './ledger.mjs';

export class LicenseStore extends LicenseLedger {
 constructor(file){
  const db=new DatabaseSync(file);
  try {
   db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
   super(db);
  } catch(error) { db.close(); throw error; }
 }
}
