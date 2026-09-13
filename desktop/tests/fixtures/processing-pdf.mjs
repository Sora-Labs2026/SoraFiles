import {PDFDocument} from 'pdf-lib';import {writeFile,readFile} from 'node:fs/promises';
if(process.argv[2]==='create'){const doc=await PDFDocument.create();doc.addPage([200,300]);await writeFile(process.argv[3],await doc.save());}
else if(process.argv[2]==='verify'){const doc=await PDFDocument.load(await readFile(process.argv[3]));if(doc.getPageCount()!==1||doc.getPage(0).getRotation().angle!==90)throw Error('Unexpected PDF result');}
else throw Error('Choose a fixture action');
