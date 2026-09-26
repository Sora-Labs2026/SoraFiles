from pathlib import Path
from PIL import Image
import json,numpy as np,zipfile,io
formats=json.loads(Path('.artifacts/astra-formats/results.json').read_text())
for row in formats:
 if 'output' not in row:continue
 im=Image.open(row['output']);im.load();assert im.format=='PNG'
 rgb=np.array(im.convert('RGB'));h,w=rgb.shape[:2]
 assert rgb[int(h*.35),int(w*.25),0]>170 and rgb[int(h*.35),int(w*.25),1]<100,row['fixture']
 row['independent']='Pillow PNG decoding and known red region preserved'
Path('.artifacts/astra-formats/independent.json').write_text(json.dumps(formats,indent=2))
rows=json.loads(Path('.artifacts/astra-perspective/results.json').read_text())
expected=[(.1,.1),(.9,.1),(.9,.9),(.1,.9)]
for row in rows:
 assert row['status']=='EXPORTED',row
 path=Path(row['output'])
 if zipfile.is_zipfile(path):
  with zipfile.ZipFile(path) as z:im=Image.open(io.BytesIO(z.read(z.namelist()[0]))).convert('RGB')
 else:im=Image.open(path).convert('RGB')
 a=np.array(im).astype(float);r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
 masks=[(r>150)&(g<100)&(b<100),(g>120)&(r<100)&(b<100),(b>150)&(r<100)&(g<100),(r>120)&(b>120)&(g<100)]
 errors=[]
 for mask,(x,y) in zip(masks,expected):
  yy,xx=np.where(mask);assert len(xx)>30
  errors.append(float(np.hypot(xx.mean()-x*im.width,yy.mean()-y*im.height)))
 row['markerErrorPixels']=errors;row['maxNormalizedError']=max(errors)/max(im.size)
 assert row['maxNormalizedError']<.015,row
 row['status']='PASS'
Path('.artifacts/astra-perspective/independent.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({'formatsDecoded':len([r for r in formats if 'output' in r]),'perspective':rows},indent=2))
