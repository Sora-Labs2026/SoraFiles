from pathlib import Path
from PIL import Image, ImageDraw
import json
root=Path('.artifacts/astra-formats');root.mkdir(parents=True,exist_ok=True)
im=Image.new('RGB',(640,480),'#efe4cf');d=ImageDraw.Draw(im)
d.rectangle((80,70,300,300),fill='#e02030');d.ellipse((340,100,590,360),fill='#2050e0')
d.text((100,390),'FORMAT GROUND TRUTH 7631',fill='black',font_size=23)
formats={'jpg':'JPEG','png':'PNG','webp':'WEBP','bmp':'BMP','gif':'GIF','avif':'AVIF','tiff':'TIFF','jp2':'JPEG2000'}
for ext,fmt in formats.items():im.save(root/f'known.{ext}',format=fmt)
im.save(root/'multipage.tiff',save_all=True,append_images=[Image.new('RGB',im.size,'green')],compression='tiff_lzw')
im.save(root/'animated.gif',save_all=True,append_images=[Image.new('RGB',im.size,'green')],duration=300,loop=0)
im.resize((256,256)).save(root/'known.ico',sizes=[(256,256)])
(root/'known.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#efe4cf"/><rect x="80" y="70" width="220" height="230" fill="#e02030"/><circle cx="465" cy="230" r="120" fill="#2050e0"/></svg>')
for ext in ['psd','tiff','jp2','png','svg']:(root/f'corrupt.{ext}').write_bytes(b'corrupt fixture 7631')
print(json.dumps({'formats':list(formats),'dimensions':[640,480]}))
