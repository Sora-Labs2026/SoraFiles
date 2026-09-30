import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
const result=spawnSync(process.env.ComSpec||'C:\\Windows\\System32\\cmd.exe',['/d','/c','desktop\\shell\\windows\\build.cmd'],{cwd,stdio:'inherit',windowsHide:true});
if(result.error||result.status!==0)throw Error('Windows file-manager component build failed');
