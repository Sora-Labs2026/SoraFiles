import {writeFile} from 'node:fs/promises';import {capabilities} from '../shared/capabilities.mjs';
const extracted=new Set(['merge-pdf','split-pdf','rotate-pdf','remove-pages']);
const map=capabilities.map(tool=>({id:tool.id,webAvailable:true,desktopReleased:false,nativeQuickActionReleased:false,headlessPort:extracted.has(tool.id)?'implemented and independently tested':'not certified',evidence:extracted.has(tool.id)?['desktop/tests/pdf-core.test.mjs','desktop/tests/pdf-jobs.test.mjs','.artifacts/desktop-pdf-core/independent-validation.json']:[],verifiedEngineImprovementOverWeb:false,permittedPublicClaim:'Desktop in development; no superiority claim.'}));
await writeFile('desktop/audit/capability-claims.json',JSON.stringify({recordedAt:new Date().toISOString(),scope:'Implementation evidence, not platform or release certification',tools:map},null,2)+'\n');
console.log(`Recorded ${map.length} tool claim boundaries`);
