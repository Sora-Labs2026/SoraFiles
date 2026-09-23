import {readFile,writeFile} from 'node:fs/promises';import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
const source=await readFile(new URL('../../src/lib/ocr/text-items.ts',import.meta.url),'utf8');
const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.ES2022,target:ScriptTarget.ES2022}}).outputText;
await writeFile(new URL('../shared/pdf-text.mjs',import.meta.url),'// Generated from src/lib/ocr/text-items.ts by sync-pdf-text.mjs.\n'+compiled);
