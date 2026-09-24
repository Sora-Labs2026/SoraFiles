type HostWindow = Window & {chrome?:{webview?:{postMessage:(message:unknown)=>void;postMessageWithAdditionalObjects?:(message:unknown,objects:File[])=>void;addEventListener:(name:string,listener:(event:{data:any})=>void)=>void}}};
const bridge=(window as HostWindow).chrome?.webview;
type TauriWindow=Window&{__TAURI__?:{core:{invoke:(command:string,args:Record<string,unknown>)=>Promise<any>};event:{listen:(event:string,callback:(event:{payload:any})=>void)=>Promise<()=>void>}}};
const native=(window as TauriWindow).__TAURI__;
export function onNativeSelection(callback:(selection:any)=>void){if(native)void native.event.listen('native-selection',event=>callback(event.payload));}
export function onNativeNotice(callback:(message:string)=>void){if(native)void native.event.listen('native-notice',event=>{if(typeof event.payload==='string')callback(event.payload);});}
const pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
bridge?.addEventListener('message',({data})=>{if(data?.protocol!==1||typeof data.id!=='string')return;const request=pending.get(data.id);if(!request)return;clearTimeout(request.timer);pending.delete(data.id);data.ok?request.resolve(data.result):request.reject(Error(typeof data.error==='string'?data.error:'This action could not finish.'));});
export function host(method:string,params:Record<string,unknown>={},files?:File[]):Promise<any>{
 if(native){if(files)return Promise.reject(Error('Use Choose files if native file drop is unavailable.'));return native.core.invoke('host_request',{method,params}).catch(error=>{throw Error(typeof error==='string'?error:'This action could not finish.');});}
 if(!bridge)return Promise.reject(Error('Open SoraFiles Desktop in its native desktop host.'));
 const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('This action is taking longer than expected. Please try again.'));},method==='selectFiles'||method==='chooseFolder'?600000:30000);pending.set(id,{resolve,reject,timer});
  try{const message={protocol:1,id,method,params};if(files){if(!bridge.postMessageWithAdditionalObjects)throw Error('File drop is unavailable. Use Choose files.');bridge.postMessageWithAdditionalObjects(message,files);}else bridge.postMessage(message);}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
 });
}

export function onNativeLaunch(callback:()=>void){if(native)void native.event.listen('native-launch',callback);}
