import {link,unlink} from 'node:fs/promises';

// Trusted writer adapter only. Once the destination link exists, cleanup failure
// must not report a failed save or invite a retry that creates duplicate outputs.
export async function publishStagedOutput(stage,target,{linkFile=link,removeStage=unlink}={}){
 await linkFile(stage,target);
 try{await removeStage(stage);return {cleanupPending:false};}
 catch(error){return {cleanupPending:error?.code!=='ENOENT'};}
}
