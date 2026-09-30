export class DurableRateLimiter {
 constructor(store,{limit=30,windowSeconds=60,maxKeys=10000,now=()=>Math.floor(Date.now()/1000)}={}){
  Object.assign(this,{store,limit,windowSeconds,maxKeys,now});
  store.db.exec('CREATE TABLE IF NOT EXISTS request_rates(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS request_rates_expiry ON request_rates(until);');
 }
 take(bucket){
  const allowed=this.store.transaction(()=>{
   const db=this.store.db,now=this.now();db.prepare('DELETE FROM request_rates WHERE until<=?').run(now);
   let row=db.prepare('SELECT count FROM request_rates WHERE bucket=?').get(bucket);
   if(!row){if(db.prepare('SELECT COUNT(*) AS n FROM request_rates').get().n>=this.maxKeys)return false;db.prepare('INSERT INTO request_rates VALUES(?,0,?)').run(bucket,now+this.windowSeconds);row={count:0};}
   if(row.count>=this.limit)return false;
   db.prepare('UPDATE request_rates SET count=count+1 WHERE bucket=?').run(bucket);return true;
  });
  if(!allowed)throw Error('Rate limited');
 }
}
