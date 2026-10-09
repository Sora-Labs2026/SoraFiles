// Fit an encoded image under a byte limit, like the website's fitImageToBytes:
// lossy formats lower quality first (binary search, highest quality that fits),
// then pixels; a scale step can overshoot, so bisect back toward the last size
// that failed and keep the largest fit. encodeAt(width,height,quality) resolves
// to the encoded bytes; quality is a whole percent.
export async function fitToBytes(size,encodeAt,maxBytes,{lossy=true,startQuality=90,minQuality=40,minSide=16}={}) {
 const atQuality=async(width,height)=>{
  if(!lossy){const bytes=await encodeAt(width,height,100);return {bytes,quality:100,fits:bytes.length<=maxBytes};}
  const first=await encodeAt(width,height,startQuality);
  if(first.length<=maxBytes)return {bytes:first,quality:startQuality,fits:true};
  const floor=await encodeAt(width,height,minQuality);
  if(floor.length>maxBytes)return {bytes:floor,quality:minQuality,fits:false};
  let best={bytes:floor,quality:minQuality},low=minQuality+1,high=startQuality-1;
  while(low<=high){const mid=(low+high)>>1,bytes=await encodeAt(width,height,mid);if(bytes.length<=maxBytes){best={bytes,quality:mid};low=mid+1;}else high=mid-1;}
  return {...best,fits:true};
 };
 const at=scale=>({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))});
 let {width,height}=size,failedScale=1;
 for(let step=0;step<8;step++){
  const attempt=await atQuality(width,height);
  if(attempt.fits&&step===0)return {...attempt,width,height,scaled:false};
  if(attempt.fits){
   let best={...attempt,width,height},low=width/size.width,high=failedScale;
   for(let probe=0;probe<3;probe++){
    const mid=(low+high)/2,dims=at(mid);if(dims.width===best.width)break;
    const tried=await atQuality(dims.width,dims.height);
    if(tried.fits){best={...tried,...dims};low=mid;}else high=mid;
   }
   return {...best,scaled:true};
  }
  failedScale=width/size.width;
  const next=at(failedScale*Math.min(.9,Math.sqrt(maxBytes/attempt.bytes.length)*.95));
  if(Math.min(next.width,next.height)<minSide)return {...attempt,width,height,scaled:step>0,fits:false};
  ({width,height}=next);
 }
 const bytes=await encodeAt(width,height,lossy?minQuality:100);
 return {bytes,quality:lossy?minQuality:100,fits:bytes.length<=maxBytes,width,height,scaled:true};
}
