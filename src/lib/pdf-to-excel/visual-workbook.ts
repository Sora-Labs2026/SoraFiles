import { strToU8, zipSync } from 'fflate';

export interface VisualWorksheetPage {
  png: Uint8Array;
  widthPixels: number;
  heightPixels: number;
  pageNumber: number;
}

const xml = (value: string) => strToU8(value);
const EMU_PER_PIXEL = 9525;

function workbookXml(pageCount: number) {
  const sheets = Array.from({ length: pageCount }, (_, index) =>
    `<sheet name="Page ${index + 1}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets}</sheets><calcPr calcId="191029"/></workbook>`;
}

function workbookRelationships(pageCount: number) {
  const relationships = Array.from({ length: pageCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

function contentTypes(pageCount: number) {
  const sheets = Array.from({ length: pageCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  const drawings = Array.from({ length: pageCount }, (_, index) =>
    `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}${drawings}</Types>`;
}

function worksheetXml(page: VisualWorksheetPage) {
  const orientation = page.widthPixels > page.heightPixels ? 'landscape' : 'portrait';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="75"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData/><pageMargins left="0" right="0" top="0" bottom="0" header="0" footer="0"/><pageSetup orientation="${orientation}" fitToWidth="1" fitToHeight="1"/><drawing r:id="rId1"/></worksheet>`;
}

function drawingXml(page: VisualWorksheetPage) {
  const cx = Math.max(1, Math.round(page.widthPixels * EMU_PER_PIXEL));
  const cy = Math.max(1, Math.round(page.heightPixels * EMU_PER_PIXEL));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="PDF page ${page.pageNumber}" descr="Exact visual of PDF page ${page.pageNumber}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

export function createVisualWorkbook(pages: VisualWorksheetPage[]): Blob {
  if (!pages.length) throw new Error('No PDF pages were available for the workbook.');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': xml(contentTypes(pages.length)),
    '_rels/.rels': xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': xml(workbookXml(pages.length)),
    'xl/_rels/workbook.xml.rels': xml(workbookRelationships(pages.length)),
  };

  pages.forEach((page, index) => {
    const number = index + 1;
    files[`xl/worksheets/sheet${number}.xml`] = xml(worksheetXml(page));
    files[`xl/worksheets/_rels/sheet${number}.xml.rels`] = xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${number}.xml"/></Relationships>`);
    files[`xl/drawings/drawing${number}.xml`] = xml(drawingXml(page));
    files[`xl/drawings/_rels/drawing${number}.xml.rels`] = xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page${number}.png"/></Relationships>`);
    files[`xl/media/page${number}.png`] = page.png;
  });

  const bytes = zipSync(files, { level: 6 });
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
