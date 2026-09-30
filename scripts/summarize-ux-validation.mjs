import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {liveTools} from '../src/data/liveTools.ts';
const j=async p=>JSON.parse(await readFile(`.artifacts/${p}`,'utf8'));
const desktop=await j('astra-ux-final-desktop/results.json'),mobile=await j('astra-ux-final-mobile/results.json'),stress=await j('astra-ux-stress/results.json'),footer=await j('astra-footer/results.json');
for(const rows of [desktop,mobile]){assert.equal(rows.length,26);assert.ok(rows.every(r=>r.status==='PASS'));assert.ok(rows.every(r=>r.journey?.some(s=>s.stage==='reset')));}
assert.equal(stress.length,52);assert.ok(stress.every(r=>r.status==='PASS'));assert.equal(footer.length,6);
const findings={
pdf:'Strength and preserved-content guidance are grouped; preview/options tabs and result download remain distinct. Reset verified after the closing transition.',
'merge-pdf':'Page reorder/duplicate/remove actions now wrap instead of hiding beyond a horizontal edge; 44px mobile targets. Adjust displays the page preview.',
'split-pdf':'Custom groups and pages-per-file fields appear only for the selected split mode; no irrelevant settings in the default flow.',
'rotate-pdf':'Page selection stays on Pages; Adjust now displays the affected page rather than duplicating the page rail. Duplicate mobile history controls removed.',
'remove-pages':'Page range stays beside the preview; page selection and output summary remain separate. No selected-state ambiguity was inferred from the range-based test.',
'pdf-to-jpg':'Resolution, output format, page range and quality are grouped; result download is separate and reachable.',
'jpg-to-pdf':'Mobile file cards put reorder/rotate/remove controls on a second row, preserving filename space and touch target size.',
'pdf-to-word':'Visible editable/appearance choices explain the result before conversion; output limitations remain beside the result download.',
'word-to-pdf':'Removed the empty Options journey; file and conversion action share one view. Desktop uses a compact surface. Mobile regression caught and corrected during retest.',
'watermark-pdf':'Mobile Adjust retains the actual page and watermark preview above its settings; page rail no longer occupies that space.',
'page-numbers':'Mobile Adjust retains the actual page preview above numbering settings; final download remains reachable.',
'sign-pdf':'Placement hint is constrained to its preview instead of covering mobile panel navigation. Signature upload/type/draw and result guidance retained.',
'image-converter':'Format/quality controls remain beside preview on desktop and in labeled mobile tabs; JPEG 2000 decoding and stale-file generations fixed.',
'compress-image':'Preview/options split remains; result download and before/after imagery stay together. Core strength setting is visible.',
'heic-to-jpg':'Source and before previews now use decoded pixels rather than a HEIC blob unsupported by the browser. Copy describes conversion to JPG.',
'edit-image':'Desktop preview and independently scrolling settings are now side by side. Preview remains visible when changing adjustments and inspecting the result.',
'remove-background':'Explicit Original/Transparent result mobile controls replace the undiscoverable swipe-only comparison. Completion selects the result and puts download beside it. Tabs corrected to normal height after visual retest.',
'protect-pdf':'Password/permission options remain grouped in a compact dialog; result action follows processing. Long filename and dark/narrow viewport checks pass.',
'unlock-pdf':'File/password requirements precede processing; result and another-file action are adjacent. No new placement change was justified.',
'repair-pdf':'Compact file/action/result flow retained, with recovery limitations attached to the output rather than a separate screen.',
'metadata-remover':'Detailed checkboxes appear only after choosing selective PDF details; default removal no longer exposes inactive choices.',
'pdf-to-excel':'Editable-table versus visual output is explicit before processing; result download remains beside its fidelity explanation.',
'excel-to-pdf':'Simple file-to-PDF flow retained; worker cancellation and retry now release the runtime. No extra settings/navigation added.',
'pdf-ocr':'Language/output requirements remain grouped before OCR; progress/cancel and result download stay in the same workspace.',
'resize-image':'Desktop preview remains alongside the independently scrolling dimension/crop controls. Mobile retains its preview above adjustments.',
'doc-scanner':'Page list, corner editor, preview, save format and output remain in their existing panels; mobile save/download proximity retained. Perspective output independently verified.'
};
const lines=['## Adversarial UI/UX review — 2026-09-10','',
'Tools-directory feedback: replaced the oversized green banner with a semantic two-item list, using the existing privacy icons, independent labels, a subtle divider and natural wrapping. The two benefits no longer run together. Desktop/mobile, light/dark and narrow French/Arabic layout checks are recorded separately.','',
'Latest homepage feedback: “See How It Works” now scrolls to the on-device section, with deferred layout resolved before navigation. The WebAssembly callout and source-inspection CTA were removed; offline and background-loading messages use plain language across 19 locales. Required license attribution remains on the Open Source page. The featured badge was removed at the user’s final request. The subtle creator credit remains. Desktop, narrow mobile, French and Arabic homepage checks cover the scroll destination, absence of the featured badge, and footer layout.','',
'Hero feedback: replaced the ambiguous document-shaped symbol beside On Your Device with the same lock used in the trust row. The red Document.pdf tile now uses a clear PDF label. Both were checked in the rendered hero. The six Guides and hub passed 14 desktop/narrow-screen reading cases, including bounded scrollable tables, visible heading anchors, schema, links and published tool relationships.', '',
'This review gives workflow placement and discoverability separate evidence from engine correctness. All 26 tools completed arrival → file selection → configuration → processing → result inspection → download → reset on desktop and mobile. Journey screenshots and control geometry were recorded at each stage. Result contact sheets for all tools were visually reviewed, with full-size inspection of discovered friction and changed screens. No numerical UX score was assigned.','',
'Final coverage: 26/26 desktop journeys, 26/26 mobile journeys; 52/52 additional long-filename/dark/reduced-motion checks at desktop 1440×900 and constrained 320×500. The short viewport probes reachability with reduced space; it is not a physical mobile keyboard or thumb-reach measurement. Frame settling was added to avoid reporting animation timing as a stale result or covered button.','',
'| Tool | Concrete review / fix |','|---|---|',...liveTools.map(t=>`| ${t.name} | ${findings[t.slug]} |`),'',
'Shared fixes: closing a workspace no longer restarts the page entrance animation; mobile history/zoom/close buttons are at least 44px; core SoraFiles tokens, typography, theme and native control styles were retained. Controls were not moved for visual novelty.','',
'Footer: added exactly “Made with ❤️ by Drishya Thapa” as subtle secondary meta text. Only the name links to https://x.com/Dri_shy_a, with target="_blank" and rel="noopener noreferrer". Six checks passed (1440/390/320 × light/dark), including keyboard focus, wrapping and no horizontal overflow. Footer screenshots were visually inspected.','',
'Evidence: tests/e2e/ux-journey.mjs with complex-quality-audit.mjs; tests/e2e/ux-stress.mjs; tests/e2e/footer-credit.mjs; ignored .artifacts/astra-ux-final-*/journeys, astra-ux-stress/results.json and astra-footer/results.json. All changed tools were rerun on both viewports with real exported outputs; independent validation is reported in the release section.',''];
const path='docs/tool-verification-report.md';let report=await readFile(path,'utf8');const start='<!-- adversarial-ux-start -->',end='<!-- adversarial-ux-end -->';const block=start+'\n'+lines.join('\n')+'\n'+end;
if(report.includes(start))report=report.slice(0,report.indexOf(start))+block+report.slice(report.indexOf(end)+end.length);else report=block+'\n\n'+report;
await writeFile(path,report.trimEnd()+'\n');console.log('Recorded 26/26 desktop and mobile UX journeys, 52/52 stress cases, 6/6 footer checks.');
