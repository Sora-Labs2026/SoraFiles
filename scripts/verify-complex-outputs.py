"""Independent invariants: pypdf/PDFium, python-docx, openpyxl, Pillow, NumPy."""
from pathlib import Path
from io import BytesIO
import json,zipfile,math,os
import numpy as np
from PIL import Image
from pypdf import PdfReader
from docx import Document
from openpyxl import load_workbook
root=Path('.artifacts');report=[]
prefix=os.environ.get('SORA_QA_PREFIX','astra-complex')
def readpdf(blob):
  p=PdfReader(BytesIO(blob))
  if p.is_encrypted:assert p.decrypt('SyntheticQA7631')
  return p
for viewport in ['desktop','mobile']:
  rows=json.loads((root/f'{prefix}-{viewport}'/'results.json').read_text())
  for row in rows:
    route=row['route'];out={'route':route,'viewport':viewport,'status':'FAIL','checks':[]}
    try:
      assert row['status']=='PASS',row.get('failure')
      assert row['outputs']
      data=Path(row['outputs'][0]).read_bytes()
      if data.startswith(b'%PDF'):
        p=readpdf(data);text='\n'.join(page.extract_text() or '' for page in p.pages)
        count={'merge-pdf':48,'remove-pages':35,'jpg-to-pdf':2,'pdf-ocr':2,'doc-scanner':4}.get(route,36)
        if route not in ['word-to-pdf','excel-to-pdf']:assert len(p.pages)==count
        if route not in ['jpg-to-pdf','word-to-pdf','excel-to-pdf','pdf-ocr','doc-scanner']:
          expected=[i for i in range(1,37) if not(route=='remove-pages' and i==2)]
          for index,n in enumerate(expected):assert f'GROUND TRUTH PAGE {n:02d}' in (p.pages[index].extract_text() or '')
          out['checks'].append('every expected native page marker appears on its correct page')
          if route=='rotate-pdf':assert [page.rotation for page in p.pages]==[0,90]+[0]*34
          else:
            for index,n in enumerate(expected):
              size=[(612,792),(842,595),(500,700)][(n-1)%3]
              assert tuple(round(float(v)) for v in [p.pages[index].mediabox.width,p.pages[index].mediabox.height])==size
            out['checks'].append('mixed page dimensions preserved')
        if route=='merge-pdf':
          for i,page in enumerate(p.pages[36:]):assert f'TABLE GROUND TRUTH {i+1}' in page.extract_text()
        if route=='watermark-pdf':assert all('SYNTHETIC WATERMARK 7631' in page.extract_text() for page in p.pages)
        if route=='page-numbers':assert all(f'Page {i+1} of 36' in page.extract_text() for i,page in enumerate(p.pages))
        if route=='metadata-remover':assert p.metadata.get('/Author')!='Synthetic QA';assert p.metadata.get('/Title')!='Synthetic mixed-layout QA'
        if route=='word-to-pdf':
          for i in range(1,9):assert f'Section {i}' in text
          assert 'SKU-7-11' in text;out['checks'].append('all 8 sections and final table cell survived')
        if route=='excel-to-pdf':
          assert text.count('Known SKU 100')==3,text.count('Known SKU 100')
          assert text.count('325')>=3;out['checks'].append('last row and computed value from all 3 source sheets survive')
        if route=='pdf-ocr':assert '8675309' in text and '12345' in text;out['checks'].append('known OCR numbers independently extractable')
        if route=='protect-pdf':assert p.is_encrypted;assert not PdfReader(BytesIO(data)).decrypt('wrong')
        if route=='unlock-pdf':assert not p.is_encrypted
        if route=='sign-pdf':assert len(p.pages[0].images)>len(PdfReader('.artifacts/astra-complex/mixed-36.pdf').pages[0].images)
        out['checks'].append(f'PDF: {len(p.pages)} pages, {len(text)} text characters')
      elif data.startswith(b'PK'):
        z=zipfile.ZipFile(BytesIO(data));assert z.testzip() is None
        if route=='pdf-to-word':
          doc=Document(BytesIO(data));text=' '.join(p.text for p in doc.paragraphs)+' '.join(c.text for t in doc.tables for r in t.rows for c in r.cells)
          for i in range(1,37):assert f'GROUND TRUTH PAGE {i:02d}' in text
          out['checks'].append('all 36 source-page markers in DOCX document body/tables')
        elif route=='pdf-to-excel':
          wb=load_workbook(BytesIO(data),read_only=True);cells='|'.join(str(v) for ws in wb for row in ws.values for v in row)
          for p in range(12):
            for r in range(25):assert f'SKU-{p:02d}-{r:02d}' in cells
          wb.close();out['checks'].append('all 300 distinct table-row identifiers in editable cells')
        elif route=='split-pdf':
          names=[n for n in z.namelist() if n.endswith('.pdf')];assert len(names)==3
          for name,n in zip(sorted(names),[1,18,36]):
            p=readpdf(z.read(name));assert len(p.pages)==1;assert f'GROUND TRUTH PAGE {n:02d}' in p.pages[0].extract_text()
          out['checks'].append('exactly the 3 selected pages in ZIP')
        elif route=='pdf-to-jpg':
          names=[n for n in z.namelist() if n.endswith('.jpg')];assert len(names)==36
          for name in names:
            image=Image.open(BytesIO(z.read(name)));image.load();assert image.format=='JPEG';assert np.array(image).std()>10
          out['checks'].append('all 36 page JPEGs independently decode with nonuniform pixels')
        else:raise ValueError('Unknown ZIP output')
      else:
        image=Image.open(BytesIO(data));image.load();arr=np.asarray(image)
        assert arr.std()>5
        sizes={'image-converter':(2400,1600),'compress-image':(2400,1600),'edit-image':(1600,2400),'resize-image':(1200,800),'remove-background':(1600,1000),'heic-to-jpg':(1280,854)}
        assert image.size==sizes[route]
        if route=='remove-background':assert image.mode=='RGBA';assert image.getchannel('A').getextrema()==(0,255)
        if route=='compress-image':
          source=Path('.artifacts/astra-complex/detailed.jpg');assert len(data)<=source.stat().st_size
          original=np.asarray(Image.open(source)).astype(float);rmse=float(np.sqrt(np.mean((original-arr.astype(float))**2)));out['pixelRMSE']=round(rmse,3)
        out['checks'].append(f'{image.format}: independently decoded {image.width}x{image.height}')
      out['status']='PASS'
    except Exception as e:out['error']=str(e)
    report.append(out)
(root/f'{prefix}-independent.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'checked':len(report),'passed':sum(r['status']=='PASS' for r in report),'failures':[r for r in report if r['status']!='PASS']},indent=2))
