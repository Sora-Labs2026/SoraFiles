// Synthetic HTTP service used only by the Rust private-pipe integration test.
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {LicenseStore} from '../../license-service/store.mjs';
import {RequestGuard} from '../../license-service/request-guard.mjs';
import {LicenseService} from '../../license-service/service.mjs';
import {createLicenseHttpServer} from '../../license-service/http.mjs';
const pair=generateKeyPairSync('ed25519'),kid='native-pipe-test';
const store=new LicenseStore(':memory:');
const service=new LicenseService({store,guard:new RequestGuard({store,secret:randomBytes(32)}),signing:{kid,privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'})},dodo:{},authority:{}});
const server=createLicenseHttpServer({service,webhooks:{},rateSecret:randomBytes(32)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.stdout.write(JSON.stringify({runtime:process.execPath,config:{origin:'http://127.0.0.1:'+server.address().port,allowLocalTesting:true,keys:{[kid]:pair.publicKey.export({type:'spki',format:'pem'})}}})+'\n');
process.stdin.resume();process.stdin.on('end',()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});});
