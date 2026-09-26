"""Synthetic QA only. Writes to ignored .artifacts; never reads user files."""
from pathlib import Path
import json, math, random
from PIL import Image, ImageDraw, ImageFilter
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
from docx import Document
from docx.shared import Inches
from openpyxl import Workbook

root = Path('.artifacts/astra-complex'); root.mkdir(parents=True, exist_ok=True)
random.seed(7631)
image = Image.new('RGB', (2400,1600), '#e0e7ff'); draw = ImageDraw.Draw(image)
for i in range(450):
    x,y=random.randrange(2350),random.randrange(1550)
    draw.ellipse((x,y,x+50,y+50),fill=tuple(random.randrange(256) for _ in range(3)))
draw.text((100,100),'SORAFILES SYNTHETIC GROUND TRUTH 7631',fill='black',font_size=55)
image.save(root/'detailed.jpg',quality=93)
image.save(root/'metadata.jpg',quality=93,exif=Image.Exif({}) if False else b'')

for kind in ['hair','product','thin','logo','signature','soft']:
    mask=Image.new('L',(1600,1000)); d=ImageDraw.Draw(mask)
    if kind in ['hair','soft']:
        d.ellipse((510,120,1090,940),fill=255)
        for i in range(100):
            x=490+i*6; d.line((800,350,x,70+random.randrange(240)),fill=230,width=2)
        if kind=='soft': mask=mask.filter(ImageFilter.GaussianBlur(15))
    elif kind=='product': d.rounded_rectangle((500,190,1100,880),radius=60,fill=255)
    elif kind=='thin':
        d.line((250,800,1350,200),fill=255,width=5); d.ellipse((670,380,930,640),outline=255,width=7)
    elif kind=='logo':
        d.regular_polygon((800,500,320),5,fill=255); d.ellipse((700,400,900,600),fill=0)
    else:
        points=[(200+i*8,500+int(170*math.sin(i*.14))) for i in range(150)];d.line(points,fill=255,width=5)
    source=Image.new('RGB',mask.size,'#f4e7d1');foreground=Image.new('RGB',mask.size,'#4338ca');source.paste(foreground,(0,0),mask)
    source.save(root/f'{kind}.png');mask.save(root/f'{kind}-mask.png')
    rgba=foreground.convert('RGBA');rgba.putalpha(mask);rgba.save(root/f'{kind}-alpha.png')

pdf=canvas.Canvas(str(root/'mixed-36.pdf'));pdf.setAuthor('Synthetic QA');pdf.setTitle('Synthetic mixed-layout QA')
for i in range(36):
    w,h=[(612,792),(842,595),(500,700)][i%3];pdf.setPageSize((w,h))
    pdf.bookmarkPage(f'page-{i+1}');pdf.addOutlineEntry(f'Page {i+1}',f'page-{i+1}')
    pdf.setFont('Helvetica-Bold',16);pdf.drawString(30,h-35,f'GROUND TRUTH PAGE {i+1:02d}')
    pdf.setFont('Helvetica',10)
    for j in range(16):pdf.drawString(35,h-75-j*16,f'Row {j+1:02d} | Item SF-{i:02d}-{j:02d} | Quantity {j+1} | Total {(i+1)*(j+1):.2f}')
    pdf.drawImage(str(root/'detailed.jpg'),35,45,width=w-70,height=170,preserveAspectRatio=True)
    pdf.linkURL('https://sorafiles.com/tools',(35,20,220,40));pdf.showPage()
pdf.save()
writer=PdfWriter();writer.append(str(root/'mixed-36.pdf'));writer.encrypt('SyntheticQA7631',algorithm='AES-256');writer.write(str(root/'protected-36.pdf'))
pdf=canvas.Canvas(str(root/'tables-12.pdf'))
for page in range(12):
    pdf.setFont('Helvetica-Bold',15);pdf.drawString(40,790,f'TABLE GROUND TRUTH {page+1}')
    for col,text in enumerate(['Product','Quantity','Amount']):pdf.drawString(40+col*160,740,text)
    pdf.setFont('Helvetica',11)
    for row in range(25):
        for col,text in enumerate([f'SKU-{page:02d}-{row:02d}',str(row+1),f'{(row+1)*3.25:.2f}']):pdf.drawString(40+col*160,710-row*24,text)
    pdf.showPage()
pdf.save()
doc=Document();doc.add_heading('Synthetic long DOCX 7631',0)
for i in range(8):
    doc.add_heading(f'Section {i+1}',1);doc.add_paragraph('Known content with bold, italic, lists, images and tables. '*10)
    table=doc.add_table(rows=1, cols=3)
    for cell,text in zip(table.rows[0].cells,['Product','Quantity','Amount']):cell.text=text
    for j in range(12):
        for cell,text in zip(table.add_row().cells,[f'SKU-{i}-{j}',str(j+1),f'{j*3.25:.2f}']):cell.text=text
    doc.add_picture(str(root/'detailed.jpg'),width=Inches(4));doc.add_page_break()
doc.save(root/'complex.docx')
wb=Workbook();wb.remove(wb.active)
for name in ['Sales','Unicode','Summary']:
    ws=wb.create_sheet(name);ws.append(['ID','Description','Quantity','Price','Total'])
    for i in range(1,101):ws.append([i,f'Known SKU {i} – café',i,3.25,f'=C{i+1}*D{i+1}'])
    ws.freeze_panes='A2';ws.auto_filter.ref='A1:E101';ws.column_dimensions['B'].width=30
wb.save(root/'complex.xlsx')
Image.new('RGB',(6000,6000),'#e5e7eb').save(root/'near-limit-36mp.png')
(root/'corrupt.png').write_bytes(b'\x89PNG\r\n\x1a\nBAD')
(root/'zero.png').write_bytes(b'')
manifest={'pdfPages':36,'pdfPageSizes':[[612,792],[842,595],[500,700]],'tablePages':12,'tableRowsPerPage':25,'imageSize':[2400,1600],'maskSize':[1600,1000],'password':'SyntheticQA7631','backgroundCategories':['hair','product','thin','logo','signature','soft'],'xlsxSheets':3,'xlsxDataRowsPerSheet':100}
(root/'expected.json').write_text(json.dumps(manifest,indent=2))
assert len(PdfReader(root/'mixed-36.pdf').pages)==36
print(json.dumps(manifest))
