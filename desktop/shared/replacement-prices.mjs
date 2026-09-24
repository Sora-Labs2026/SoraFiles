// Fixed USD amounts, independent of license discounts or promotional campaigns.
export const replacementPrices = Object.freeze(Object.fromEntries([
 ['personal-monthly',99],['personal-annual',999],['personal-lifetime',4999],
 ['team-monthly',399],['team-annual',3999],['team-lifetime',19999],
].map(([plan,amount])=>[plan,Object.freeze({plan,amount,currency:'USD',formatted:`$${(amount/100).toFixed(2)}`,perSeat:plan.startsWith('team-')})])));
export function replacementPrice(plan){const price=replacementPrices[plan];if(!price)throw Error('Replacement pricing unavailable for this plan');return price;}
