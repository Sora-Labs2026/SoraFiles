// Score the already rendered Web/Desktop outputs against the independently
// generated masks. Agreement between two engines alone cannot prove quality.
import sharp from 'sharp';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const results=[];
for(const fixture of ['product','hair','soft-alpha']){
 const truthFile='.artifacts/astra-complex/'+(fixture==='soft-alpha'?'soft-alpha.png':fixture+'-mask.png'),truthBytes=await readFile(truthFile);
 const truth=fixture==='soft-alpha'?await sharp(truthBytes).ensureAlpha().extractChannel(3).raw().toBuffer():await sharp(truthBytes).greyscale().raw().toBuffer();
 for(const engine of ['web','desktop']){
  const output=await sharp(await readFile('.artifacts/parity-background-ui/'+fixture+'-'+engine+'.png')).ensureAlpha().extractChannel(3).raw().toBuffer();
  if(truth.length!==output.length)throw Error('Ground-truth dimensions differ');
  let absolute=0,missing=0,extra=0,mass=0,intersection=0,union=0;
  for(let i=0;i<truth.length;i++){absolute+=Math.abs(truth[i]-output[i]);missing+=Math.max(0,truth[i]-output[i]);extra+=Math.max(0,output[i]-truth[i]);mass+=truth[i];if(truth[i]>127&&output[i]>127)intersection++;if(truth[i]>127||output[i]>127)union++;}
  results.push({fixture,engine,truthSha256:createHash('sha256').update(truthBytes).digest('hex'),alphaMAE:absolute/truth.length,missingAlphaFraction:missing/mass,extraAlphaFraction:extra/mass,foregroundIoU:intersection/union});
 }
}
const report={status:'MEASURED',scope:'Existing three synthetic fixtures and CPU uint8 outputs, cleanup disabled. Independent generator mask is intended subject; metrics do not certify photographic quality.',results};
await writeFile('.artifacts/parity/background-ground-truth.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
