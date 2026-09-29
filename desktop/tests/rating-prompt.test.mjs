import test from 'node:test';
import assert from 'node:assert/strict';
import {RATING_PROMPT_RULES as R,eligibleForRatingPrompt,emptyPromptState,readPromptState,recordDismissed,recordRated,recordShown,recordSuccess} from '../shared/rating-prompt.mjs';

const DAY=86_400_000,t0=Date.UTC(2026,8,30);
const lucky=()=>0,unlucky=()=>0.99;
const used=(times,tool='compress-pdf',state=emptyPromptState())=>{for(let i=0;i<times;i++)state=recordSuccess(state,tool);return state;};

test('asks only after enough successful runs, and only by chance',()=>{
 assert.equal(eligibleForRatingPrompt('compress-pdf',used(0),{now:t0,random:lucky}),false,'never before a successful run');
 assert.equal(eligibleForRatingPrompt('compress-pdf',used(R.minSuccesses-1),{now:t0,random:lucky}),false);
 assert.equal(eligibleForRatingPrompt('compress-pdf',used(R.minSuccesses),{now:t0,random:lucky}),true);
 assert.equal(eligibleForRatingPrompt('compress-pdf',used(R.minSuccesses),{now:t0,random:unlucky}),false,'random, not every time');
 let shown=0;for(let seed=0;seed<1000;seed++){const random=()=>((seed*7919)%1000)/1000;if(eligibleForRatingPrompt('compress-pdf',used(5),{now:t0,random}))shown++;}
 assert.ok(shown>250&&shown<450,`roughly ${R.chance*100}% of eligible moments (${shown}/1000)`);
});

test('stops after rating, at most once per session, and spaces prompts out',()=>{
 const ready=used(3);
 assert.equal(eligibleForRatingPrompt('compress-pdf',recordRated(ready,'compress-pdf',5),{now:t0,random:lucky}),false,'never after rating that tool');
 assert.equal(eligibleForRatingPrompt('compress-pdf',ready,{now:t0,sessionShown:1,random:lucky}),false,'one prompt per session');
 const afterPrompt=recordShown(used(3,'merge-pdf',ready),t0);
 assert.equal(eligibleForRatingPrompt('merge-pdf',afterPrompt,{now:t0+DAY,random:lucky}),false,'no prompts close together, even for another tool');
 assert.equal(eligibleForRatingPrompt('merge-pdf',afterPrompt,{now:t0+R.afterPromptMs,random:lucky}),true);
});

test('dismissals buy a long quiet period',()=>{
 const dismissed=recordDismissed(used(3,'merge-pdf',used(3)),'compress-pdf',t0);
 assert.equal(eligibleForRatingPrompt('merge-pdf',dismissed,{now:t0+R.afterAnyDismissMs-1,random:lucky}),false,'no prompt of any kind soon after a dismissal');
 assert.equal(eligibleForRatingPrompt('merge-pdf',dismissed,{now:t0+R.afterAnyDismissMs,random:lucky}),true);
 assert.equal(eligibleForRatingPrompt('compress-pdf',dismissed,{now:t0+R.afterAnyDismissMs,random:lucky}),false,'the dismissed tool waits longer');
 assert.equal(eligibleForRatingPrompt('compress-pdf',dismissed,{now:t0+R.afterToolDismissMs,random:lucky}),true);
});

test('stored state survives restarts and ignores damaged values',()=>{
 const state=recordDismissed(recordRated(used(2),'split-pdf',4),'compress-pdf',t0);
 assert.deepEqual(readPromptState(JSON.stringify(state)),state);
 assert.deepEqual(readPromptState('{not json'),emptyPromptState());
 assert.deepEqual(readPromptState({rated:{'../x':5,'ok-tool':'5'},lastShown:-4}),emptyPromptState());
});
