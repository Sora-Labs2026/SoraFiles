import {readFile,writeFile} from 'node:fs/promises';import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';
const source=await readFile(new URL('../../src/lib/pdf-to-excel/table-extraction.ts',import.meta.url),'utf8');
const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.ES2022,target:ScriptTarget.ES2022}}).outputText;
await writeFile(new URL('../shared/pdf-tables.mjs',import.meta.url),'// Generated from src/lib/pdf-to-excel/table-extraction.ts by sync-pdf-tables.mjs.\n'+compiled);
