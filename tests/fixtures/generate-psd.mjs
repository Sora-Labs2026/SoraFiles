import { writePsdBuffer } from 'ag-psd';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const {data,info}=await sharp('.artifacts/astra-formats/known.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const psd={width:info.width,height:info.height,imageData:{width:info.width,height:info.height,data:new Uint8ClampedArray(data)}};
await writeFile('.artifacts/astra-formats/known.psd',writePsdBuffer(psd));
