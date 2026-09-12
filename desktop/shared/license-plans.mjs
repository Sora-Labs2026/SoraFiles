import {plans} from './plans.mjs';
// Promotional access is separate from the six paid SKUs. Only a server campaign
// may select these IDs; no giveaway code is accepted by the offline verifier.
export const promotionDurations = Object.freeze({'30-days':30, '90-days':90, '1-year':365, lifetime:null});
export const promotionalPlans = Object.freeze(Object.fromEntries(['Personal','Team'].flatMap(edition =>
 Object.keys(promotionDurations).map(duration => {
  const id=`promo-${edition.toLowerCase()}-${duration}`;
  return [id,Object.freeze({id,edition,duration,maxDevices:edition==='Personal'?1:5,interval:duration==='lifetime'?'lifetime':'promotional'})];
 }))));
export const licensePlans = Object.freeze({...plans,...promotionalPlans});
