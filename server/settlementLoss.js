export const EQUIPMENT_LOSS_CHANCE=.25;

function roll(random,chance){
 const value=random();
 if(!Number.isFinite(value)||value<0||value>=1)throw new Error('Loss RNG must return a number in [0,1)');
 return value<chance;
}

export function equipmentLossPlan(gear,bag,secure,random=Math.random,bagLossChance=1){
 const lost=[],retained=[],finalEquipped={},returned=[];
 const equipment=gear.filter(s=>!['ammo','packed'].includes(s.slot)).sort((a,b)=>a.slot.localeCompare(b.slot));
 const hosts=new Set(equipment.map(s=>s.slot));
 const decisions=new Map();
 for(const stack of equipment){
  const parent=stack.slot.includes(':')?stack.slot.split(':')[0]:stack.slot==='vest'?'armor':null;
  const groupSlot=parent&&hosts.has(parent)?parent:stack.slot;
  if(!decisions.has(groupSlot))decisions.set(groupSlot,roll(random,EQUIPMENT_LOSS_CHANCE));
  const entry={itemId:stack.itemId,quantity:stack.quantity??1,slot:stack.slot,groupSlot,source:'equipment'};
  if(decisions.get(groupSlot))lost.push(entry);
  else{retained.push(entry);returned.push({itemId:entry.itemId,quantity:entry.quantity});finalEquipped[entry.slot]=entry.itemId;}
 }
 for(const [slot] of Object.entries(finalEquipped)){
  const parent=slot.includes(':')?slot.split(':')[0]:slot==='vest'?'armor':null;
  if(parent&&!finalEquipped[parent])delete finalEquipped[slot];
 }
 for(const stack of bag){
  let lostCount=0;
  if(bagLossChance===1)lostCount=stack.quantity;
  else if(bagLossChance>0)for(let i=0;i<stack.quantity;i++)if(roll(random,bagLossChance))lostCount++;
  const kept=stack.quantity-lostCount;
  if(lostCount){lost.push({itemId:stack.itemId,quantity:lostCount,slot:'bag',source:'bag',...(stack.fittings?{fittings:{...stack.fittings}}:{})});for(const itemId of Object.values(stack.fittings??{}))lost.push({itemId,quantity:lostCount,slot:'bag',source:'bag',bundlePart:true});}
  if(kept){retained.push({itemId:stack.itemId,quantity:kept,slot:'bag',source:'bag',...(stack.fittings?{fittings:stack.fittings}:{})});returned.push({itemId:stack.itemId,quantity:kept});for(const itemId of Object.values(stack.fittings??{})){retained.push({itemId,quantity:kept,slot:'bag',source:'bag'});returned.push({itemId,quantity:kept});}}
 }
 const protectedItems=secure.map(s=>({itemId:s.itemId,quantity:s.quantity,slot:'secure',source:'secure'}));
 return {returned,finalEquipped,lossReport:{lossChance:EQUIPMENT_LOSS_CHANCE,bagLossChance,lost,retained,protected:protectedItems,recovery:[]}};
}
