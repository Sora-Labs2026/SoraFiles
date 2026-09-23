import {cp,mkdtemp,realpath,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createRequire} from 'node:module';import {createCanvas} from '@napi-rs/canvas';
const run=promisify(execFile),temporary=await realpath(tmpdir());
const directory=await mkdtemp(join(temporary,'sf-ocr-fallbacks-'));
try{
 const pack=join(directory,'pack');await cp(resolve('.artifacts/desktop-license-host'),pack,{recursive:true});
 const probe=join(directory,'probe.cjs');await cp(new URL('../tests/fixtures/ocr-core-probe.cjs',import.meta.url),probe);
 const canvas=createCanvas(1000,180),context=canvas.getContext('2d');
 context.fillStyle='white';context.fillRect(0,0,1000,180);context.fillStyle='black';context.font='48px sans-serif';context.fillText('SoraFiles invoice 4827',35,100);
 const image=join(directory,'invoice.png');await writeFile(image,await canvas.encode('png'));
 const fromPack=createRequire(join(pack,'package.json')),features=fromPack('wasm-feature-detect');
 const simd=await features.simd(),relaxed=await features.relaxedSimd(),results=[];
 for(const suffix of ['','-lstm','-simd','-simd-lstm','-relaxedsimd','-relaxedsimd-lstm']){
  const variant='tesseract-core'+suffix;
  // Require both external files even when this CPU cannot execute a variant.
  await readFile(fromPack.resolve('tesseract.js-core/'+variant+'.js'));
  await readFile(fromPack.resolve('tesseract.js-core/'+variant+'.wasm'));
  if(suffix.includes('relaxedsimd')?!relaxed:suffix.includes('simd')&&!simd){results.push({variant,status:'UNSUPPORTED_ON_TEST_CPU'});continue;}
  const {stdout}=await run(join(pack,process.platform==='win32'?'node.exe':'node'),[probe,pack,variant,image],{cwd:directory,windowsHide:true,timeout:120000,maxBuffer:16384,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>['systemroot','windir','temp','tmp','tmpdir'].includes(key.toLowerCase())))});
  const result=JSON.parse(stdout.trim());if(result.status!=='PASS'||result.variant!==variant)throw Error('Invalid core probe result');results.push(result);console.log(JSON.stringify(result));
 }
 const report={recordedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,status:results.every(row=>row.status==='PASS')?'PASS':'PARTIAL',scope:'Isolated bundled Node, real English recognition in each retained CPU/WASM core; not another CPU or language certification',results};
 await writeFile('.artifacts/ocr-fallback-verification.json',JSON.stringify(report,null,2));
}finally{
 const target=await realpath(directory);
 if(!target.startsWith(temporary+sep)||!target.startsWith(join(temporary,'sf-ocr-fallbacks-')))throw Error('Fixture cleanup escaped temporary directory');
 await rm(target,{recursive:true,force:true});
}
