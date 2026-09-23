import {createContainer} from './containers.js';
/** Publish only forfeited items, retaining each body's associated fittings. */
export function createPlayerLoot(raidId,player,result){
 if(!result.applied||result.outcome!=='dead')return null;
 const entries=(result.lossReport?.lost??[]).filter(entry=>['equipment','bag'].includes(entry.source)&&typeof entry.itemId==='string'&&Number.isSafeInteger(entry.quantity)&&entry.quantity>0);
 const consumed=new Set(),items=[],totals=new Map();
 const addPlain=entry=>totals.set(entry.itemId,(totals.get(entry.itemId)??0)+entry.quantity);
 for(const root of entries){
  if(root.source!=='equipment'||!root.groupSlot||root.slot!==root.groupSlot)continue;
  const fittings={};
  for(const part of entries){
   if(part===root||part.source!=='equipment'||part.groupSlot!==root.groupSlot)continue;
   const prefix=root.slot+':';let key=part.slot?.startsWith(prefix)?part.slot.slice(prefix.length):part.slot==='vest'&&root.slot==='armor'?'0':null;
   if(!key||fittings[key])continue;
   fittings[key]=part.itemId;consumed.add(part);
  }
  consumed.add(root);
  if(Object.keys(fittings).length)items.push({itemId:root.itemId,quantity:root.quantity,fittings});else addPlain(root);
 }
 for(const entry of entries){
  if(consumed.has(entry)||entry.bundlePart)continue;
  if(entry.fittings&&Object.keys(entry.fittings).length)items.push({itemId:entry.itemId,quantity:entry.quantity,fittings:{...entry.fittings}});else addPlain(entry);
 }
 items.push(...[...totals].map(([itemId,quantity])=>({itemId,quantity})));
 if(!items.length)return null;
 const container=createContainer({id:`player-loot-${raidId}-${player.id}`,x:player.x,z:player.z,name:`${player.username}의 전리품`,visualType:'player-loot',searchSeconds:0},0,items.filter(stack=>!String(stack?.itemId??'').startsWith('legend-')));
 container.state='open';return container;
}