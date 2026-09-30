"""Read every generated structural PDF with pypdf; render representative pages via Poppler."""
from pathlib import Path
from pypdf import PdfReader
from PIL import Image
import hashlib,json,subprocess,sys
root=Path('.artifacts/desktop-pdf-core');source=PdfReader('.artifacts/astra-complex/mixed-36.pdf')
cases=[('merged.pdf',list(range(36))*2),('rotated.pdf',list(range(36))),('removed.pdf',[i for i in range(36) if i not in [0,2,35]])]
for i in range(6):cases.append((f'split-{i}.pdf',list(range(i*7,min(36,(i+1)*7)))))
def images(page):return sorted(hashlib.sha256(image.data).hexdigest() for image in page.images)
def links(page):return [str(ref.get_object().get('/A',{}).get('/URI','')) for ref in page.get('/Annots',[]) if ref.get_object().get('/Subtype')=='/Link']
checks=[]
for name,indices in cases:
    pdf=PdfReader(root/name);assert len(pdf.pages)==len(indices)
    for target,index in zip(pdf.pages,indices):
        original=source.pages[index]
        assert target.extract_text()==original.extract_text(), f'Text changed in {name} page {index}'
        assert target.mediabox==original.mediabox
        assert images(target)==images(original), f'Image changed in {name}'
        assert links(target)==links(original), f'Link changed in {name}'
        extra={0:90,1:180,35:270}.get(index,0) if name=='rotated.pdf' else 0
        assert target.rotation==(original.rotation+extra)%360
    checks.append({'file':name,'pages':len(indices),'text':'exact','dimensions':'exact','embeddedImages':'exact SHA256','links':'preserved','rotation':'expected'})
poppler=sys.argv[1]
for source_path,label in [(Path('.artifacts/astra-complex/mixed-36.pdf'),'source'),(root/'merged.pdf','merged'),(root/'rotated.pdf','rotated'),(root/'split-0.pdf','split')]:
    subprocess.run([poppler,'-f','1','-singlefile','-scale-to','1000','-png',str(source_path),str(root/label)],capture_output=True,check=True)
baseline=Image.open(root/'source.png').convert('RGB')
for name in ['merged','split']:
    candidate=Image.open(root/(name+'.png')).convert('RGB');assert candidate.size==baseline.size and candidate.tobytes()==baseline.tobytes()
report={'status':'PASS','scope':'Four headless PDF operations; synthetic mixed-layout 36-page source','outputs':checks,'totalOutputPages':sum(len(indices) for _,indices in cases),'representativeRendering':'Merged/split first pages exactly match source pixels; rotated page rendered for visual review','limits':['Document-level bookmarks/forms/signatures not certified by these fixtures','Not wired to the desktop license/native job host']}
(root/'independent-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
