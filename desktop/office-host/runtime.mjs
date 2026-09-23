// Synthetic diagnostic entry only. This is not reachable from Desktop tools.
import {ZetaHelperMain} from '/vendor/zetaHelper.js';
const send = value => window.chrome.webview.postMessage(value);
const helper = new ZetaHelperMain('/worker.mjs', {threadJsType:'module',wasmPkg:'url:/engine/',blockPageScroll:false});
let phase='isolation';
try {
 if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw Error('isolation');
 // The native resource allowlist must reject even same-origin, unlisted URLs.
 if ((await fetch('/not-in-manifest')).status !== 403) throw Error('allowlist');
 // External access is blocked by CSP before any network request is attempted.
 phase='network-policy';
 await new Promise((resolve,reject)=>{
  const blockedURI='https://office-network-test.invalid/blocked';
  const timer=setTimeout(()=>{removeEventListener('securitypolicyviolation',violation);reject(Error('network-policy'));},3000);
  function violation(event){if(event.effectiveDirective==='connect-src'&&event.blockedURI===blockedURI){clearTimeout(timer);removeEventListener('securitypolicyviolation',violation);resolve();}}
  addEventListener('securitypolicyviolation',violation);
  fetch(blockedURI).catch(()=>{});
 });
 phase='initialization';
 await new Promise((resolve,reject) => {
  const timer = setTimeout(() => reject(Error('initialization')), 120000);
  helper.start(() => {helper.thrPort.onmessage = ({data}) => {
   if (data.cmd === 'ready') {clearTimeout(timer);resolve();}
  };});
 });
 for (const [kind,extension] of [['writer','docx'],['calc','xlsx']]) {
  phase=kind+'-fixture';
  const input = await fetch(`/fixture/input.${extension}`);
  if (!input.ok) throw Error('fixture');
  helper.FS.writeFile(`/tmp/input.${extension}`, new Uint8Array(await input.arrayBuffer()));
  await new Promise((resolve,reject) => {
   phase=kind+'-conversion';
   const timer = setTimeout(() => {phase=kind+'-timeout';reject(Error('conversion'));}, 60000);
   helper.thrPort.onmessage = ({data}) => {
    if (data.kind !== kind) return;
    clearTimeout(timer);if(data.cmd==='success')resolve();else{phase=kind+'-'+data.phase;reject(Error('conversion'));}
   };
   helper.thrPort.postMessage({cmd:'convert',kind});
  });
  const bytes = helper.FS.readFile(`/tmp/${kind}.pdf`);
  if (!bytes.length || bytes.length > 32*1024*1024) throw Error('output');
  let binary = '';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  send({type:'output',id:kind,data:btoa(binary)});
  helper.FS.unlink(`/tmp/input.${extension}`);helper.FS.unlink(`/tmp/${kind}.pdf`);
 }
 send({type:'complete',isolated:crossOriginIsolated});
} catch {send({type:'failed',phase});}
