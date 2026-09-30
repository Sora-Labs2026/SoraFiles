from pathlib import Path
import json
import os
import numpy as np
from PIL import Image,ImageFilter
root=Path('.artifacts/astra-background-cleanup' if os.environ.get('SORA_BG_CLEANUP')=='1' else '.artifacts/astra-background')
rows=json.loads((root/'results.json').read_text())
for row in rows:
  if row['status']!='EXPORTED':continue
  kind=row['fixture'].replace('-alpha','')
  output=Image.open(row['output']).convert('RGBA');expected=Image.open(f'.artifacts/astra-complex/{kind}-mask.png').convert('L')
  if output.size!=expected.size:row['validation']='FAIL: dimensions changed';continue
  actual=np.array(output.getchannel('A'),dtype=float)/255;truth=np.array(expected,dtype=float)/255
  a=actual>=.5;t=truth>=.5;union=np.logical_or(a,t).sum()
  edge=np.array(expected.filter(ImageFilter.MaxFilter(9)))!=np.array(expected.filter(ImageFilter.MinFilter(9)))
  row['metrics']={'alphaIoU':round(float(np.logical_and(a,t).sum()/max(1,union)),4),'alphaMeanAbsoluteError':round(float(np.abs(actual-truth).mean()),4),'edgeBandMeanAbsoluteError':round(float(np.abs(actual-truth)[edge].mean()),4),'foregroundPixelsLost':int(np.logical_and(t,~a).sum()),'backgroundPixelsRetained':int(np.logical_and(~t,a).sum()),'alphaRange':list(output.getchannel('A').getextrema()),'dimensions':list(output.size)}
  if row['fixture'].endswith('-alpha'):row['metrics']['existingAlphaIncreasedPixels']=int((actual>truth+1/255).sum())
  row['validation']='TECHNICAL PASS' if actual.max()>.5 and actual.min()<.5 else 'FAIL: empty or opaque mask'
  for name,color in [('white','white'),('dark','#101827'),('color','#22d3ee')]:
    composite=Image.new('RGBA',output.size,color);composite.alpha_composite(output);composite.convert('RGB').resize((800,500)).save(root/f"{row['fixture']}-{name}.jpg",quality=92)
(root/'metrics.json').write_text(json.dumps(rows,indent=2))
print(json.dumps([{k:v for k,v in r.items() if k not in ['network']} for r in rows],indent=2))
