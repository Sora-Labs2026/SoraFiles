// Coordinates are PDF points in the visible, rotated crop box. Callers use a
// bottom-left origin; the native preview converts pointer coordinates once.
export function visiblePage(page) {
 const crop=page.getCropBox(),media=page.getMediaBox();
 const left=Math.max(crop.x,media.x),bottom=Math.max(crop.y,media.y);
 const width=Math.min(crop.x+crop.width,media.x+media.width)-left,height=Math.min(crop.y+crop.height,media.y+media.height)-bottom;
 const angle=((page.getRotation().angle%360)+360)%360;
 if(![0,90,180,270].includes(angle)||![left,bottom,width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('Unsupported page geometry');
 return {width:angle%180?height:width,height:angle%180?width:height,angle,
  point(x,y){const raw=angle===90?[width-y,x]:angle===180?[width-x,height-y]:angle===270?[y,height-x]:[x,y];return {x:left+raw[0],y:bottom+raw[1]};}};
}
