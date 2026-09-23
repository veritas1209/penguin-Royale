import type {ItemDef} from './catalog.ts';
import {attachmentTradePrice} from './attachmentPrices.ts';
export const ATTACHMENT_QUALITIES=[
 {id:'broken',label:'파손',factor:.5,color:'#9ba0a9'},
 {id:'repaired',label:'수리',factor:.75,color:'#a4cc55'},
 {id:'intact',label:'양호',factor:1,color:'#579de0'},
 {id:'improved',label:'개량',factor:1.25,color:'#a67cdb'},
 {id:'refined',label:'정밀',factor:1.5,color:'#e675b1'},
] as const;
export const QUALITY_ATTACHMENT_BASE_IDS=['suppressor','vertical-grip','extended-mag','steel-plate','exoskeleton','tactical-pouch'] as const;
export const FIXED_OPTIC_BASE_IDS=['red-dot','scope-2x','scope-3x','scope-4x','scope-6x','scope-8x'] as const;
export function isFixedOptic(item:Pick<ItemDef,'id'|'baseId'>|undefined|null){return !!item&&FIXED_OPTIC_BASE_IDS.includes((item.baseId??item.id) as typeof FIXED_OPTIC_BASE_IDS[number]);}
export function opticMagnification(item:Pick<ItemDef,'id'|'baseId'>|undefined|null){const id=item?.baseId??item?.id;return id==='red-dot'?1:isFixedOptic(item)?Number(id!.split('-')[1].replace('x','')):0;}
export const ATTACHMENT_TUNING_SOURCE='provisional: quality bonuses .5/.75/1/1.25/1.5; original-quality prices unverified';
export const attachmentBaseId=(item:Pick<ItemDef,'id'|'baseId'>)=>item.baseId??item.id;
export function attachmentQualityFactor(item:ItemDef|undefined|null){return item?isFixedOptic(item)?1:ATTACHMENT_QUALITIES.find(q=>q.id===item.quality)?.factor??1:0;}
export function attachmentCapacityBonus(item:ItemDef){
 if(item.effect!=='capacity')return 0;
 if(attachmentBaseId(item)!=='tactical-pouch')return 10*attachmentQualityFactor(item);
 const index=ATTACHMENT_QUALITIES.findIndex(q=>q.id===item.quality);
 return [10,20,30,40,50][index<0?2:index];
}
export function attachmentQualityLabel(item:ItemDef){return isFixedOptic(item)||attachmentBaseId(item)==='underbarrel-launcher'?'':ATTACHMENT_QUALITIES.find(q=>q.id===item.quality)?.label??'양호';}
export function applyAttachmentQualities(items:ItemDef[]){
 const scope=items.find(i=>i.id==='scope-4x');
 if(scope)for(const magnification of [2,3,4,6,8]){
  const id=`scope-${magnification}x`,existing=items.find(i=>i.id===id),price=Math.round(18000*magnification/4);
  const item=existing??{...scope,id,name:`${magnification}배율 스코프`,price,sell:Math.round(price*.46)};
  Object.assign(item,{baseId:id,price,sell:Math.floor(price/3),tier:magnification<=3?2:magnification<=6?3:4,description:`${magnification}배율 조준경. 총기 탄퍼짐 10% 감소 · 사거리 ${magnification*5}% 증가.`});delete item.quality;
  if(!existing)items.push(item);
 }
 const dot=items.find(i=>i.id==='red-dot');if(dot){Object.assign(dot,{baseId:dot.id,price:9000,sell:3000,tier:2,description:'총기 탄퍼짐 10% 감소.'});delete dot.quality;}
 const fabric=items.find(i=>i.id==='lead-lined-fabric');
 if(fabric){const trade=attachmentTradePrice(fabric.id,4);Object.assign(fabric,{baseId:fabric.id,quality:'refined',tier:5,price:trade.price,sell:trade.sell,qualityPriceSource:trade.source,description:attachmentEffectDescription(fabric)});}
 for(const id of QUALITY_ATTACHMENT_BASE_IDS){
  const base=items.find(i=>i.id===id);if(!base)continue;
  const name=base.name,description=base.description,trade=attachmentTradePrice(id,2);
  Object.assign(base,{baseId:id,quality:'intact',tier:3,price:trade.price,sell:trade.sell,qualityPriceSource:trade.source,tuningSource:ATTACHMENT_TUNING_SOURCE});
  for(const [index,q] of ATTACHMENT_QUALITIES.entries()){
   if(q.id==='intact'||items.some(i=>i.id===`${id}-${q.id}`))continue;
   const trade=attachmentTradePrice(id,index);
   items.push({...base,id:`${id}-${q.id}`,name:`${name} · ${q.label}`,description,quality:q.id,tier:index+1,price:trade.price,sell:trade.sell,qualityPriceSource:trade.source});
  }
 }
 for(const i of items)if(i.id==='underbarrel-launcher'||i.id==='ammo-40'){i.tier=3;delete i.quality;}
 for(const i of items)if(i.category==='attachment'&&QUALITY_ATTACHMENT_BASE_IDS.includes(attachmentBaseId(i) as typeof QUALITY_ATTACHMENT_BASE_IDS[number]))i.description=attachmentEffectDescription(i);
}
export function attachmentEffectDescription(item:ItemDef){
 const f=attachmentQualityFactor(item),id=attachmentBaseId(item),pct=(v:number)=>`${Number((v*100).toFixed(1))}%`;
 if(id==='red-dot')return `총기 탄퍼짐 ${pct(.1*f)} 감소.`;
 if(isFixedOptic(item)&&id!=='red-dot')return `${opticMagnification(item)}배율 조준경. 총기 탄퍼짐 10% 감소 · 사거리 ${opticMagnification(item)*5}% 증가.`;
 if(id==='vertical-grip')return `총기 탄퍼짐 ${pct(.2*f)} 감소.`;
 if(id==='extended-mag')return `장탄수 ${pct(.3*f)} 증가(올림) · 재장전 시간 ${pct(.15*f)} 감소.`;
 if(id==='suppressor')return `총성 감지 범위 ${pct(1-weaponAttachmentQualityEffects({barrel:item}).noiseMultiplier)} 감소.`;
 if(id==='steel-plate')return `방탄조끼의 피해 감소율 ${Number((5*f).toFixed(2))}%p 증가.`;
 if(id==='exoskeleton')return `이동 속도 ${pct(.1*f)} 증가.`;
 if(id==='tactical-pouch')return `배낭 휴대 용량 ${attachmentCapacityBonus(item)} 증가.`;
 if(id==='lead-lined-fabric')return '방탄조끼에 장착하면 방사능으로 인한 현재 체력·최대 체력 감소에 완전히 면역됩니다.';
 return item.description;
}
export function weaponAttachmentQualityEffects(parts:Partial<Record<'scope'|'barrel'|'grip'|'magazine',ItemDef|undefined>>,baselineNoiseMultiplier=12/38){
 const scope=parts.scope,grip=parts.grip,mag=parts.magazine,barrel=parts.barrel;
 const accuracyBonus=(scope&&isFixedOptic(scope)?.1*attachmentQualityFactor(scope):0)+(grip?.effect==='accuracy'?.2*attachmentQualityFactor(grip):0);
 const magazineFactor=mag?.effect==='magazine'?attachmentQualityFactor(mag):0;
 const suppressed=barrel?.effect==='quiet';
 return {accuracyBonus,rangeMultiplier:scope?.effect==='range'?1+(isFixedOptic(scope)?opticMagnification(scope)*.05:.2*attachmentQualityFactor(scope)):1,magazineMultiplier:1+.3*magazineFactor,reloadMultiplier:1-.15*magazineFactor,noiseMultiplier:suppressed?Math.max(.05,1-(1-baselineNoiseMultiplier)*attachmentQualityFactor(barrel)):1,suppressed};
}

/** Lookup-only compatibility: old owned fabric and optic IDs resolve without saved-ID rewrites without changing saved data. */
export function legacyFabricAliases(items:ItemDef[]):[string,ItemDef][]{
 const fabric=items.find(i=>i.id==='lead-lined-fabric');
 const aliases:[string,ItemDef][]=fabric?ATTACHMENT_QUALITIES.map(q=>{const id=`lead-lined-fabric-${q.id}`;return [id,{...fabric,id,purchasable:false}] as [string,ItemDef];}):[];
 for(const baseId of FIXED_OPTIC_BASE_IDS){const base=items.find(i=>i.id===baseId);if(base)for(const q of ATTACHMENT_QUALITIES){const id=`${baseId}-${q.id}`;aliases.push([id,{...base,id,baseId,purchasable:false}]);}}
 return aliases;
}
