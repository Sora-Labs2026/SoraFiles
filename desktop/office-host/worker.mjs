import {officeImportProperties} from './import-policy.mjs';
const zeta = globalThis.zetajsStore.zetajs;
const css = zeta.uno.com.sun.star;
const desktop = css.frame.Desktop.create(zeta.getUnoComponentContext());
const property = (Name, Value) => new css.beans.PropertyValue({Name, Value});
const allowed = {writer:['docx','writer_pdf_Export'],calc:['xlsx','calc_pdf_Export']};
zeta.mainPort.onmessage = ({data}) => {
 const pair = allowed[data?.kind];
 if (data?.cmd !== 'convert' || !pair) return;
 let model,phase='import';
 try {
  model = desktop.loadComponentFromURL(`file:///tmp/input.${pair[0]}`, '_blank', 0, officeImportProperties(zeta, css));
  if (!model) throw Error('Office document did not load');
  phase='export';
  model.storeToURL(`file:///tmp/${data.kind}.pdf`, [property('Overwrite', false),property('FilterName', pair[1])]);
  zeta.mainPort.postMessage({cmd:'success',kind:data.kind});
 } catch {
  zeta.mainPort.postMessage({cmd:'error',kind:data.kind,phase});
 } finally { try { model?.close(false); } catch {} }
};
zeta.mainPort.postMessage({cmd:'ready'});
