import type {ItemDef} from './catalog.ts';
export type ArmorVariant='one-eyed-snake'|'steel-front';
export const ARMOR_VARIANT_LABELS:Record<ArmorVariant,string>={'one-eyed-snake':'외눈뱀','steel-front':'강철전선'};
/** Apply after inventory normalization; variants keep level and gold options independent. */
export function applyArmorVariants(items:ItemDef[]){
 const bases=items.filter(i=>['armor','helmet'].includes(i.category)&&(i.equipmentLevel??i.tier)>=4);
 for(const base of bases)for(const variant of Object.keys(ARMOR_VARIANT_LABELS) as ArmorVariant[]){
  const steel=variant==='steel-front',level=base.equipmentLevel??base.tier;
  const item:ItemDef={...base,id:`${base.id}-${variant}`,baseId:base.quality==='gold'?`${base.category}-${level}-${variant}`:base.id,armorVariant:variant,purchasable:false,acquisition:'월드 드랍 · 고급 방어구 상자',name:base.name.replace(' [황금]','')+' · '+ARMOR_VARIANT_LABELS[variant]+(base.quality==='gold'?' [황금]':''),weight:steel?120:80,weightSource:'user-specified',optionIds:base.optionIds?[...base.optionIds]:undefined,traits:base.traits?[...base.traits]:undefined,description:base.description+` ${ARMOR_VARIANT_LABELS[variant]} · 중량 ${steel?120:80}${steel?' / 같은 레벨 기본 피해 감소 ×1.1':''}.`};
  if(steel){
   const normal=items.find(i=>i.id===`${base.category}-${level}`)!;
   item.reduction=Number(Math.min(.99,(normal.reduction??0)*1.1+(base.optionIds?.includes('thick')?.04:0)).toFixed(4));
   item.metroDamageReduction=Number(Math.min(.99,(normal.metroDamageReduction??0)*1.1).toFixed(4));
  }
  items.push(item);
 }
}
