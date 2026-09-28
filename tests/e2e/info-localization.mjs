import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const locales=['en','ja','ko','es','fr','de','pt','zh-cn','zh-tw','hi','ar','ru','id','it','nl','tr','vi','th','pl'];
const expectedSections={about:3,privacy:6,terms:5,'open-source':3};
const dist=path.resolve(process.argv[2]??'dist');
let checked=0;
for(const locale of locales){
  for(const slug of [...Object.keys(expectedSections),'contact']){
    const file=path.join(dist,...(locale==='en'?[]:[locale]),slug,'index.html');
    const html=await readFile(file,'utf8');
    assert.match(html,/<main id="main" data-prototype-info>/,`${locale}/${slug}: prototype main`);
    assert.doesNotMatch(html,/class="v10-info sf-container/,`${locale}/${slug}: old alternate layout`);
    if(slug==='contact'){
      assert.equal((html.match(/data-contact-form/g)??[]).length,1,`${locale}: one working form`);
      assert.match(html,/action="https:\/\/formsubmit\.co\/soralabs2026@gmail\.com"/,`${locale}: delivery action`);
      assert.match(html,new RegExp(`https://sorafiles\\.com${locale==='en'?'':'/'+locale}/contact\\?sent=1`),`${locale}: localized return URL`);
    }else{
      assert.equal((html.match(/class="doc-section"/g)??[]).length,expectedSections[slug],`${locale}/${slug}: prototype section count`);
      assert.equal((html.match(/class="toc__link"/g)??[]).length,expectedSections[slug],`${locale}/${slug}: linked table of contents`);
      if(slug==='about')assert.equal((html.match(/class="feature"/g)??[]).length,3,`${locale}: prototype feature count`);
    }
    if(locale!=='en'){
      assert.doesNotMatch(html,/<p class="eyebrow eyebrow--plain toc__title">On this page<\/p>/,`${locale}/${slug}: localized navigation`);
      assert.doesNotMatch(html,/<span class="line-reveal__inner">Say hello\.<\/span>/,`${locale}: localized contact title`);
    }
    checked++;
  }
}
console.log(`Localized information/contact structure: ${checked} pages passed.`);
