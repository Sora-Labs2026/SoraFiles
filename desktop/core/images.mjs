import {runImageProcess} from './image-decode.mjs';import {imageOptions} from './image-options.mjs';
export async function processImage(input,{signal,...options}) {
 const result=await runImageProcess(input,imageOptions(options),{signal});
 return {...result,extension:result.format==='jpeg'?'jpg':result.format,warnings:result.unchanged?['This image is already smaller. The original file was kept.']:[]};
}
