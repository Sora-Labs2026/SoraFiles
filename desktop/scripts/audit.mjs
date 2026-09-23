import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {liveTools} from '../../src/data/liveTools.ts';
import {isDesktopTool,desktopToolIds} from '../shared/tool-policy.mjs';
const root=new URL('../../',import.meta.url);const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const pkg=await read('package.json'),lock=await read('package-lock.json');
const pdf=['pdf-lib','pdfjs-dist'];
const image=['@jsquash/jpeg','@jsquash/webp','@jsquash/oxipng','@jsquash/resize'];
const paths={
 'compress-pdf':[...pdf,'@neslinesli93/qpdf-wasm','@okathira/ghostpdl-wasm'],
 'merge-pdf':pdf,'split-pdf':[...pdf,'fflate'],'rotate-pdf':pdf,'remove-pages':pdf,'pdf-to-jpg':[...pdf,'fflate'],'jpg-to-pdf':pdf,
 'pdf-to-word':[...pdf,'docx','tesseract.js','tesseract.js-core'], 'word-to-pdf':['zetajs'],
 'watermark-pdf':pdf,'page-numbers':pdf,'sign-pdf':pdf,
 'image-converter':[...image,'heic-to','utif','ag-psd','pdfjs-dist','fflate'],
 'compress-image':[...image,'heic-to','fflate'],'heic-to-jpg':['heic-to','fflate'],'edit-image':[],
 'remove-background':['@imgly/background-removal','onnxruntime-web'],
 'protect-pdf':[...pdf,'@pdfsmaller/pdf-encrypt'],'unlock-pdf':[...pdf,'@pdfsmaller/pdf-decrypt','fflate'],
 'repair-pdf':pdf,'metadata-remover':['pdf-lib','fflate'],
 'pdf-to-excel':[...pdf,'xlsx'],'excel-to-pdf':['zetajs','xlsx'],
 'pdf-ocr':[...pdf,'tesseract.js','tesseract.js-core'], 'resize-image':['@jsquash/resize'], 'doc-scanner':['scanic','pdf-lib'],
};
const limitations={
 'compress-pdf':'No guaranteed reduction; signed originals kept; eligible image compression can reduce detail.',
 'pdf-to-word':'Editable reconstruction changes layout; visual output uses page images.',
 'word-to-pdf':'Fonts and unsupported document features can change layout; current runtime is fetched from the ZetaJS CDN.',
 'excel-to-pdf':'Print areas, fonts, pagination and unsupported spreadsheet features require inspection; Office CDN runtime is not bundled.',
 'pdf-to-excel':'Inferred tables are not original spreadsheet formulas; visual mode is not editable table reconstruction.',
 'pdf-ocr':'Recognition errors; current added PDF text has restricted encoding and is not word aligned.',
 'remove-background':'Matting has difficult-edge limitations; solid cleanup can remove matching subject colors.',
 'image-converter':'Selected frame/page only; PSD flattened; exotic codec variants require independent checks.',
 'heic-to-jpg':'HEVC decoder/license and patent considerations; HDR/color conversion needs validation.',
 'metadata-remover':'Selected fields only; PDF dates reset; no visible redaction; JPEG orientation can change.',
 'repair-pdf':'Best-effort rewrite cannot reconstruct arbitrary missing bytes.',
 'sign-pdf':'Visual signature, not a certificate-backed digital signature.',
};
const packages=[];
for(const name of Object.keys(pkg.dependencies)){
 const p=await read(`node_modules/${name}/package.json`);const files=(await readdir(new URL(`node_modules/${name}/`,root))).filter(n=>/^(license|copying|notice|thirdparty)/i.test(n));
 let license=p.license||'UNRESOLVED';if(name==='@imgly/background-removal')license='AGPL-3.0; ISNET model MIT per ThirdPartyLicenses.json';
 const copyleft=/AGPL|GPL|MPL|SEE LICENSE/i.test(license);
 packages.push({name,version:p.version,license,source:p.repository?.url||p.repository||p.homepage||null,notices:files,
  commercialUse:copyleft?'Conditional on all applicable copyleft/source/notice obligations; not proprietary clearance.':'Permitted by identified license subject to its conditions; embedded codecs still require review.',
  redistribution:copyleft?'Source/rebuild/relinking and installation-information assessment required before release.':'Retain license/copyright and applicable NOTICE files.',
  releaseCleared:false});
}
const tools=liveTools.map(t=>({id:t.id,name:t.name,route:'/'+t.slug,availability:{web:true,desktop:isDesktopTool(t.id)},engine:t.engine||'Canvas / shared image adjustments',inputFormats:t.inputFormats,outputFormats:t.outputFormats,
 dependencies:paths[t.id].map(name=>packages.find(p=>p.name===name)),
 modelLicense:t.id==='remove-background'?'ISNET MIT per shipped third-party manifest; distributed model byte provenance still needs pinning.':t.id==='pdf-ocr'||t.id==='pdf-to-word'?'Tesseract traineddata Apache-2.0 notices must accompany packs.':null,
 behavior:'Browser JavaScript/Canvas plus WASM/workers where listed; DOM/workspace coupling must be separated.',
 offlineFeasibility:['word-to-pdf','excel-to-pdf'].includes(t.id)?'Blocked until complete pinned Office pack and redistribution/source bundle are obtained.':t.id==='remove-background'?'Requires complete pinned model/ONNX pack; current web proxy uses upstream resources.':'Feasible with local packaged code and assets; must prove in native host with network blocked.',
 packaging:paths[t.id].includes('zetajs')?'Optional full Office component pack; native LibreOffice sidecar is a candidate, not yet adopted.':paths[t.id].includes('tesseract.js')?'Install chosen OCR language packs before offline use.':t.id==='remove-background'?'Optional installed model pack; unload worker process after job.':'Bundle local assets; run only within authorized job boundary.',
 nativeReplacement:paths[t.id].includes('zetajs')?'Native LibreOffice may reduce browser constraints; benchmark before choosing.':t.id==='pdf-ocr'?'Native OCR plus positioned Unicode text layer is a candidate.':t.id==='remove-background'?'Native ONNX is a candidate; preserve alpha/quality benchmark.':'Reuse tested engine first; replace only with measured benefit.',
 limitations:limitations[t.id]||'Preserve input; check output structure and rendering; malformed, boundary, cancellation and repeat-run tests required.',
 desktopPath:!isDesktopTool(t.id)?'Intentionally excluded from Desktop and Dodo-powered paid offerings for payment-provider compliance. Free Web only.':'See capability-claims.json for current scoped engine evidence; not claimed shipped.',releaseCleared:false}));
const assets=[];async function walk(dir){for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else{const s=await stat(new URL(p,root));assets.push({path:p,bytes:s.size});}}}await walk('public');
const dependencies=Object.entries(lock.packages).filter(([path,p])=>path&&!p.dev).map(([path,p])=>({path,version:p.version,license:p.license||'UNRESOLVED',integrity:p.integrity||null,resolved:p.resolved||null}));
const result={recordedAt:new Date().toISOString(),webToolCount:liveTools.length,desktopEligibleToolCount:desktopToolIds.length,status:'RELEASE BLOCKED: source/compliance packs and native-host prototypes incomplete',registryHash:createHash('sha256').update(await readFile(new URL('src/data/liveTools.ts',root))).digest('hex'),tools,packages,productionLockEntries:dependencies,assets,localPublicBytes:assets.reduce((n,a)=>n+a.bytes,0)};
await mkdir(new URL('desktop/audit/',root),{recursive:true});await writeFile(new URL('desktop/audit/inventory.json',root),JSON.stringify(result,null,2)+'\n');
const lines=['# Desktop tool and dependency audit','',`Recorded ${result.recordedAt}. ${tools.length} Web tools; ${desktopToolIds.length} Desktop-eligible tools, ${packages.length} direct dependencies, ${dependencies.length} production lock entries. ${assets.length} local public assets total ${result.localPublicBytes} bytes. Remote Office/model payloads are additional; these are not installer-size measurements.`,'',result.status,'','The earlier engine matrix is historical: qpdf and GhostPDL are currently used, despite its old rejected/unshipped descriptions. Installed package metadata and current imports take precedence. A package license does not alone clear every embedded codec or model. No desktop redistribution is marked cleared until corresponding source, notices and reproducible pack provenance are assembled.','',...tools.flatMap(t=>[`## ${t.name} — ${t.route}`,`- Engine: ${t.engine}. ${t.behavior}`,`- Dependencies: ${t.dependencies.map(d=>`${d.name} ${d.version} (${d.license})`).join('; ')||'Browser Canvas / original project code (AGPL-3.0-only)'}.`,`- Model: ${t.modelLicense||'None separately identified.'}`,`- Commercial/redistribution: retain notices; apply each dependency’s conditions listed in inventory.json. Copyleft code must not be made proprietary through licensing enforcement.`,`- Offline: ${t.offlineFeasibility}`,`- Packaging: ${t.packaging}`,`- Replacement assessment: ${t.nativeReplacement}`,`- Current limits: ${t.limitations}`,`- Desktop path: ${t.desktopPath}`,''])];
await writeFile(new URL('desktop/audit/README.md',root),lines.join('\n'));console.log(JSON.stringify({tools:tools.length,directDependencies:packages.length,productionLockEntries:dependencies.length,localPublicBytes:result.localPublicBytes,status:result.status}));
