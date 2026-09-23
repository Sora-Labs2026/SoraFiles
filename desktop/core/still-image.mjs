import {runImageProcess} from './image-decode.mjs';
// Broader still-image workflows include WebP. Signatures are a format gate;
// the isolated decoder performs the complete decode and rejects animation.
export async function decodeStillImage(input,{signal}={}){
 signal?.throwIfAborted();
 if(!(input instanceof Uint8Array)||!input.length||input.length>64*1024*1024)throw Error('Choose a still JPG, PNG or WebP up to 64 MB');
 const bytes=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
 const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),jpg=bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex'));
 const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!png&&!jpg&&!webp)throw Error('Choose a still JPG, PNG or WebP');
 return runImageProcess(input,{action:'convert',format:'png',quality:100},{signal});
}
