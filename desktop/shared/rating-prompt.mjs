// When the desktop app may ask for a star rating. Only after a successful run,
// never for a tool already rated, never twice in a session, with long quiet
// periods after any prompt or dismissal, and then only by chance.
const DAY=86_400_000;
export const RATING_PROMPT_RULES=Object.freeze({minSuccesses:2,sessionMax:1,afterPromptMs:3*DAY,afterAnyDismissMs:7*DAY,afterToolDismissMs:45*DAY,chance:0.35});

export function emptyPromptState(){return {rated:{},successes:{},dismissed:{},lastShown:0,lastDismissed:0};}
export function readPromptState(value){
 try{
  const state=typeof value==='string'?JSON.parse(value):value;const clean=emptyPromptState();
  if(!state||typeof state!=='object')return clean;
  for(const key of ['rated','successes','dismissed'])if(state[key]&&typeof state[key]==='object')for(const [tool,number] of Object.entries(state[key]))if(/^[a-z0-9-]{1,40}$/.test(tool)&&Number.isFinite(number)&&number>=0)clean[key][tool]=number;
  for(const key of ['lastShown','lastDismissed'])if(Number.isFinite(state[key])&&state[key]>=0)clean[key]=state[key];
  return clean;
 }catch{return emptyPromptState();}
}

export function eligibleForRatingPrompt(tool,state,{now=Date.now(),sessionShown=0,random=Math.random,rules=RATING_PROMPT_RULES}={}){
 if(!tool||state.rated[tool])return false;
 if((state.successes[tool]||0)<rules.minSuccesses)return false;
 if(sessionShown>=rules.sessionMax)return false;
 if(state.lastShown&&now-state.lastShown<rules.afterPromptMs)return false;
 if(state.lastDismissed&&now-state.lastDismissed<rules.afterAnyDismissMs)return false;
 if(state.dismissed[tool]&&now-state.dismissed[tool]<rules.afterToolDismissMs)return false;
 return random()<rules.chance;
}

export const recordSuccess=(state,tool)=>({...state,successes:{...state.successes,[tool]:(state.successes[tool]||0)+1}});
export const recordShown=(state,now=Date.now())=>({...state,lastShown:now});
export const recordDismissed=(state,tool,now=Date.now())=>({...state,lastDismissed:now,dismissed:{...state.dismissed,[tool]:now}});
export const recordRated=(state,tool,rating)=>({...state,rated:{...state.rated,[tool]:rating}});
