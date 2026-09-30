import {LicenseLedger} from '../ledger.mjs';

// Cloudflare forbids SQL BEGIN/COMMIT; transactionSync provides atomic rollback.
// Consume cursors immediately: no lazy cursor may survive across an await.
export class DurableLicenseStore extends LicenseLedger {
 constructor(storage){
  const sql=storage.sql;
  const all=(query,args)=>sql.exec(query,...args).toArray();
  super({
   exec(query){all(query,[]);},
   prepare(query){return {
    all(...args){return all(query,args);},
    get(...args){return all(query,args)[0];},
    run(...args){
     all(query,args);
     // rowsWritten includes index writes; changes() matches SQLite run().changes.
     return sql.exec('SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid').one();
    }
   };},
   transactionSync(fn){return storage.transactionSync(fn);}
  });
 }
}
