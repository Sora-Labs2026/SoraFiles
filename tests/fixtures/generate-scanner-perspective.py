from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
root=Path('.artifacts/astra-perspective');root.mkdir(parents=True,exist_ok=True)
page=Image.new('RGB',(800,1000),'white');draw=ImageDraw.Draw(page)
points=[(80,100),(720,100),(720,900),(80,900)]
colors=['#ed2020','#20c030','#2030ed','#cf20cf']
for (x,y),color in zip(points,colors):draw.ellipse((x-24,y-24,x+24,y+24),fill=color)
for y in range(200,850,60):draw.line((120,y,680,y),fill='#202020',width=3)
source=[(0,0),(800,0),(800,1000),(0,1000)];quad=[(160,130),(1050,230),(1000,1070),(90,990)]
matrix=[];values=[]
for (x,y),(u,v) in zip(quad,source):matrix.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);values.extend([u,v])
coeff=np.linalg.solve(matrix,values)
page.save(root/'flat.png');page.transform((1200,1200),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC,fillcolor='#785e45').save(root/'perspective.png')
(root/'expected.json').write_text(json.dumps({'quad':quad,'normalizedMarkers':[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]}))
