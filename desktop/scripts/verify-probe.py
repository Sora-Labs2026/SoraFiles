"""Independent readers and known-content checks for synthetic native-probe outputs."""
from pathlib import Path
import json, sys, subprocess
from pypdf import PdfReader
from PIL import Image
import numpy as np

root = Path(sys.argv[1]).resolve()
report = {}
pdf = PdfReader(root / 'pdf.pdf').pages
assert len(pdf) == 12
for i, page in enumerate(pdf):
    assert f'SoraFiles native PDF {i}' in page.extract_text()
    assert round(page.mediabox.width) == 612 and round(page.mediabox.height) == 792
report['pdf'] = {'pages': len(pdf), 'allKnownPageLabels': True}
poppler = sys.argv[2]
subprocess.run([poppler,'-f','1','-singlefile','-scale-to','1000','-png',str(root/'pdf.pdf'),str(root/'pdf-preview')],check=True,capture_output=True)
office = PdfReader(root / 'office.pdf').pages
text = '\n'.join(p.extract_text() for p in office)
assert 'Synthetic long DOCX 7631' in text
for i in range(8):
    assert f'Section {i+1}' in text
    for j in range(12):
        assert f'SKU-{i}-{j}' in text
assert sum(len(p.images) for p in office) >= 8
report['office'] = {'pages': len(office), 'all96TableIdentifiers': True, 'all8SectionLabels': True, 'images': sum(len(p.images) for p in office)}
# Contact sheet includes every page, with separate larger first pages for closer review.
sheet = Image.new('RGB', (4*306, 4*420), '#e2e8f0')
subprocess.run([poppler,'-scale-to','1000','-png',str(root/'office.pdf'),str(root/'office-page')],check=True,capture_output=True)
for i, page in enumerate(sorted(root.glob('office-page-*.png'))):
    thumb = Image.open(page).convert('RGB'); thumb.thumbnail((306,420))
    sheet.paste(thumb,(i%4*306,i//4*420))
sheet.save(root/'office-contact.png')
image = Image.open(root/'image.png').convert('RGB')
assert image.size == (1600,1000)
assert image.getpixel((10,10)) == (255,255,255)
assert image.getpixel((800,500)) == (0,68,255)
report['image'] = {'size': image.size, 'knownPixels': True}
assert 'SoraFiles invoice 7631' in (root/'ocr.txt').read_text()
report['ocr'] = {'knownPhrase': True}
bg = Image.open(root/'background.png').convert('RGBA')
mask = Image.open('.artifacts/astra-complex/product-mask.png').convert('L')
assert bg.size == mask.size
alpha = np.asarray(bg)[:,:,3]; truth = np.asarray(mask)>127; predicted = alpha>127
iou = float(np.logical_and(truth,predicted).sum()/np.logical_or(truth,predicted).sum())
assert iou > .97, f'Background mask IoU {iou}'
assert alpha[0,0] == 0 and alpha[500,800]>250
report['background'] = {'size': bg.size, 'maskIntersectionOverUnion': iou, 'transparentOutside': True}
(root/'independent-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
