export function imageOptions(value) {
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Error('Choose image options');
 const {action,format='png',quality=85,width,height,fit='inside',allowEnlargement=false,background='#ffffff',crop,rotation=0,flip=false,flop=false,page}=value;
 const fields=['action','format','quality','width','height','fit','allowEnlargement','background','crop','rotation','flip','flop','page'];
 if(Object.keys(value).some(key=>!fields.includes(key))||!['decode','convert','compress','resize','edit'].includes(action)||!['png','jpeg','webp'].includes(format)
  ||!Number.isInteger(quality)||quality<40||quality>100||!['inside','contain','cover'].includes(fit)||typeof allowEnlargement!=='boolean'
  ||typeof background!=='string'||!/^#[a-f0-9]{6}$/i.test(background)||![0,90,180,270].includes(rotation)||typeof flip!=='boolean'||typeof flop!=='boolean'
  ||page!==undefined&&(!Number.isSafeInteger(page)||page<0||page>999))throw Error('Choose valid image options');
 for(const n of [width,height])if(n!==undefined&&(!Number.isSafeInteger(n)||n<1||n>16000))throw Error('Choose dimensions from 1 to 16000 pixels');
 if(width&&height&&width*height>25_000_000||action==='resize'&&!width&&!height)throw Error('Choose a smaller image size');
 if(['decode','convert','compress'].includes(action)&&[width,height,crop].some(v=>v!==undefined)||action!=='edit'&&(rotation||flip||flop))throw Error('These edits need the image editor');
 if(crop&&(!['left','top','width','height'].every(k=>Number.isSafeInteger(crop[k]))||Object.keys(crop).length!==4||crop.left<0||crop.top<0||crop.width<1||crop.height<1))throw Error('Choose a valid crop');
 return {action,format,quality,width,height,fit,allowEnlargement,background,crop,rotation,flip,flop,page};
}
