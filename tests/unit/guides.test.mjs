import test from 'node:test';
import assert from 'node:assert/strict';
import { guides, publishedGuides, isPublicGuide, guideSitemapUrls, relatedGuidesForTool, guideSchema } from '../../src/data/guides.ts';
import { validateGuides, safeGuideUrl } from '../../src/lib/guide-validation.ts';
import { filterIndexNowUrls, indexNowBatches } from '../../src/lib/indexnow.ts';
import { parseCsv, importSearchConsole, analyzeSearchConsole } from '../../scripts/lib/search-console.mjs';
import { letterbox, LatestJob, backgroundProviders, backgroundPixelLimit, backgroundModel } from '../../src/lib/background-removal.ts';

// One synthetic in-memory fixture; never included in routes or production content.
const fixture = () => ({ slug: 'test-fixture', title: 'Validation fixture', description: 'Test-only metadata', primaryQuery: 'fixture validation', secondaryQueries: [], searchIntent: 'informational', funnelStage: 'awareness', category: 'PDF', tags: [], targetTool: 'merge-pdf', relatedTools: [], relatedGuides: [], author: { type: 'Organization', name: 'Sora Labs' }, publisher: { name: 'Sora Labs', url: 'https://sorafiles.com/' }, status: 'draft', canonical: 'https://sorafiles.com/guides/test-fixture', indexable: false, references: [], locale: 'en', introduction: 'Synthetic test.', body: [{ type: 'heading', level: 2, id: 'test', text: 'Test' }] });
test('empty registry is valid and sitemap excludes the empty hub', () => { assert.deepEqual(guideSitemapUrls([]), []); assert.deepEqual(validateGuides([]).errors, []); });
test('publication and indexability gates are independent and English-only', () => {
  const g = fixture(); assert.equal(isPublicGuide(g), false); assert.deepEqual(publishedGuides([g]), []);
  g.status = 'published'; g.publishedAt = '2026-09-01'; assert.equal(isPublicGuide(g), true); assert.deepEqual(publishedGuides([g]), []);
  g.indexable = true; assert.deepEqual(guideSitemapUrls([g]), ['https://sorafiles.com/guides', g.canonical]);
  g.locale = 'fr'; assert.deepEqual(guideSitemapUrls([g]), []); assert.ok(validateGuides([g]).errors.length);
});
test('draft indexability is a blocking error; archive has no route', () => { const g = fixture(); g.indexable = true; assert.match(validateGuides([g]).errors.join(), /only published/); g.status = 'archived'; assert.equal(isPublicGuide(g), false); });
test('all duplicate identity fields block publication', () => { assert.equal(validateGuides([fixture(), fixture()]).errors.filter(e => e.includes('duplicate')).length, 5); });
test('normalized duplicate query and title are rejected', () => { const a = fixture(), b = fixture(); b.slug = 'different'; b.canonical += '-different'; b.title = ' VALIDATION—FIXTURE '; b.primaryQuery = 'FIXTURE   validation'; assert.match(validateGuides([a,b]).errors.join(), /duplicate title/); assert.match(validateGuides([a,b]).errors.join(), /duplicate primaryQuery/); });
test('similar titles, same intent and tool intent conflict warn', () => { const a = fixture(), b = fixture(); a.primaryQuery = 'Merge PDF'; b.slug = 'other'; b.canonical += '-other'; b.title += ' checks'; b.primaryQuery = 'other fixture'; assert.ok(validateGuides([a,b]).warnings.length >= 2); });
test('dates, references, headings and missing assets fail validation', () => { const g = fixture(); g.publishedAt = '2026-02-30'; g.relatedTools = ['missing']; g.relatedGuides = ['missing']; g.translationOf = 'missing'; g.socialImage = '/missing.png'; g.body = [{ type:'heading', level:3, text:'Invalid jump', id:'jump' }, {type:'image', src:'/missing.png', alt:'', width:1, height:1}]; const errors = validateGuides([g], () => false).errors.join(); for (const value of ['publishedAt','unknown tool','guide reference','social image','heading structure','image requires']) assert.ok(errors.includes(value)); });
test('guide schema derives dates and identity only from visible record', () => { const g = fixture(); const [article, breadcrumb] = guideSchema(g); assert.equal(article.datePublished, undefined); assert.equal(article.publisher.name, 'Sora Labs'); assert.equal(article.headline, g.title); assert.equal(breadcrumb.itemListElement[2].item, g.canonical); });
test('unsafe links are rejected', () => { for(const value of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'data:text/html,test']) assert.equal(safeGuideUrl(value), false); });
test('related modules exclude drafts and noindex records', () => { const g = fixture(); assert.deepEqual(relatedGuidesForTool('merge-pdf',[g]),[]); g.status='published'; g.indexable=true; assert.equal(relatedGuidesForTool('merge-pdf',[g]).length,1); });
test('IndexNow filters aliases, staging, junk, query strings, credentials and drafts', () => { const valid='https://sorafiles.com/merge-pdf'; assert.deepEqual(filterIndexNowUrls([valid,valid,'https://sorafiles.com/compress-pdf','https://sorafiles.com/guides','https://sorafiles.com/fr/guides/test','https://localhost/merge-pdf',valid+'?x=1',valid+'#a','http://sorafiles.com/merge-pdf','https://user@sorafiles.com/merge-pdf','invalid']),[valid,'https://sorafiles.com/guides']); });
test('IndexNow batches obey protocol size bounds', () => { assert.deepEqual(indexNowBatches(['a','b','c'],2),[['a','b'],['c']]); assert.throws(()=>indexNowBatches([],10001)); });
test('CSV handles quoted commas, escaped quotes, newlines and BOM', () => { assert.deepEqual(parseCsv('\uFEFFQuery,Clicks\r\n"a,""b""\nc",2\r\n'),[['Query','Clicks'],['a,"b"\nc','2']]); for (const value of ['a,b\n1', 'a,b\n"bad,1', 'a,b\n"x"q,1']) assert.throws(()=>parseCsv(value)); });
test('GSC missing metrics stay null and malformed metrics fail', () => { const rows=importSearchConsole('Top queries,Clicks,Impressions,CTR,Position\nhello,2,100,2%,\n'); assert.equal(rows[0].averagePosition,null); assert.equal(rows[0].page,null); assert.equal(rows[0].ctr,.02); assert.throws(()=>importSearchConsole('Query,Clicks,Impressions\nx,no,2')); });
test('GSC flags possible overlap only for known canonical query/page pairs', () => { const pages=['https://sorafiles.com/pdf','https://sorafiles.com/merge-pdf']; const rows=pages.map(page=>({query:'same query',page,clicks:1,impressions:200})); const analysis=analyzeSearchConsole(rows,{canonicalUrls:pages,knownQueries:['expected'],minimumImpressions:150,maximumClicks:2}); assert.equal(analysis.possibleCannibalization.length,1); assert.equal(analysis.opportunities.length,2); assert.equal(analysis.unexpectedQueries.length,1); assert.equal(analyzeSearchConsole(rows.map(r=>({...r,page:null}))).possibleCannibalization.length,0); });
test('letterbox preserves wide/tall aspect ratio and bounded mask mapping', () => { assert.deepEqual(letterbox(4000,2000),{x:0,y:256,width:1024,height:512,size:1024}); assert.deepEqual(letterbox(2000,4000),{x:256,y:0,width:512,height:1024,size:1024}); assert.throws(()=>letterbox(0,10)); });
test('provider fallback, constrained-device limit and stale job tokens', () => { assert.deepEqual(backgroundProviders(true),['gpu','cpu']); assert.deepEqual(backgroundProviders(false),['cpu']); assert.equal(backgroundModel(4),'isnet_quint8'); assert.equal(backgroundModel(8),'isnet_fp16'); assert.equal(backgroundPixelLimit(4),12_000_000); const job=new LatestJob(), old=job.next(); assert.ok(job.current(old)); job.next(); assert.equal(job.current(old),false); });

test('commissioned guides preserve dates and relationships without inventing Desktop publication dates', () => {
  assert.equal(guides.length,12); assert.equal(publishedGuides().length,12);
  assert.deepEqual(validateGuides(guides),{errors:[],warnings:[]}); assert.equal(guideSitemapUrls().length,13);
  for(const g of guides){
    assert.ok(g.references.length); assert.ok(g.body.some(b=>b.type==='linked-paragraph'));
    if(g.category==='SoraFiles Desktop'){
      assert.equal(g.publishedAt,undefined); assert.equal(g.modifiedAt,undefined); assert.equal(g.reviewedAt,undefined);
      assert.equal(guideSchema(g)[0].datePublished,undefined);
    } else {
      assert.equal(g.publishedAt,'2026-09-10'); assert.ok(g.body.some(b=>b.type==='table'));
    }
  }
});
