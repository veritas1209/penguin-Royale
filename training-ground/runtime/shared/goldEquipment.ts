import type {ItemDef} from './catalog.ts';

export type EquipmentLookup=(id:string)=>ItemDef|undefined;
export interface GoldEquipmentEffects {
 damageReduction:number;
 headshotFlatReduction:number;
 bossSpecialReduction:number;
 flatDamageReduction:number;
 fireReduction:number;
 explosiveReduction:number;
 flashImmune:boolean;
 equipmentWeightInfluenceReduction:number;
 secureCapacityBonus:number;
 reviveTimeReduction:number;
 bonusLootChance:number;
}

const value=(values:readonly number[],level=0)=>level>0?(values[Math.min(values.length-1,level-1)]??0):0;
const level=(item:ItemDef|undefined,key:string)=>item?.goldTraitLevels?.[key]??0;

export function goldEquipmentEffects(equipped:Record<string,string|null|undefined>,lookup:EquipmentLookup):GoldEquipmentEffects{
 const helmet=lookup(equipped.helmet??''),armor=lookup(equipped.armor??''),backpack=lookup(equipped.backpack??'');
 const helmetArmor=level(helmet,'helmet-armor-set'),armorSet=level(armor,'armor-armor-set');
 const helmetThick=level(helmet,'helmet-thick'),composite=level(helmet,'helmet-composite-fiber');
 const armorThick=level(armor,'armor-thick'),ergonomics=level(armor,'armor-ergonomics');
 const fireproof=level(armor,'armor-fireproof'),blastproof=level(armor,'armor-blastproof');
 const encryption=level(backpack,'backpack-encryption'),advancedEncryption=level(backpack,'backpack-advanced-encryption');
 const firstAid=level(backpack,'backpack-first-aid'),moduleSearch=level(backpack,'backpack-module-search');
 return {
  damageReduction:value([.05,.10,.15],helmetArmor)+value([.05,.10,.15],armorSet),
  headshotFlatReduction:value([3,4,5],composite),
  bossSpecialReduction:value([.30,.40,.50],helmetThick),
  flatDamageReduction:value([5,6,7],armorThick),
  fireReduction:value([.30,.40,.50],fireproof),
  explosiveReduction:value([.30,.40,.50],blastproof),
  flashImmune:level(helmet,'helmet-tactical-lens')>0,
  equipmentWeightInfluenceReduction:value([.10,.20,.30],ergonomics),
  secureCapacityBonus:value([10,15,20],encryption)+value([30,35,40],advancedEncryption),
  reviveTimeReduction:value([.40,.50,.60],firstAid),
  bonusLootChance:value([.10,.125,.15],moduleSearch),
 };
}

export function secureCapacityForGear(equipped:Record<string,string|null|undefined>,lookup:EquipmentLookup,base=40){
 return base+goldEquipmentEffects(equipped,lookup).secureCapacityBonus;
}

export function equipmentWeightMobilityBonus(equipped:Record<string,string|null|undefined>,lookup:EquipmentLookup,totalWeight:number){
 const reduction=goldEquipmentEffects(equipped,lookup).equipmentWeightInfluenceReduction;
 return reduction*Math.min(.12,Math.max(0,totalWeight)/5000);
}


export function legacyGoldEquipmentAliases(items:ItemDef[]):[string,ItemDef][]{
 const canonical=new Map(items.map(item=>[item.id,item]));
 return [
  ['helmet-gold-tactical-lens-l1','helmet-gold-tactical-lens'],['helmet-gold-tactical-lens-l2','helmet-gold-tactical-lens'],['helmet-gold-tactical-lens-l3','helmet-gold-tactical-lens'],
  ['armor-gold-lead-l1','armor-gold-lead'],['armor-gold-lead-l2','armor-gold-lead'],['armor-gold-lead-l3','armor-gold-lead'],
 ].flatMap(([alias,target])=>{const item=canonical.get(target);return item?[[alias,{...item,id:alias,purchasable:false}] as [string,ItemDef]]:[];});
}
