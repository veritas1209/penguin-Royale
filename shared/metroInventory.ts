import type {ItemDef} from './catalog.ts';

/** Metro uses abstract inventory units, never kilograms. */
export const SECURE_CAPACITY = 40;
// Base pouch is provisional; unlike levelled bag additions it is not in the Metro guide.
export const BASE_CARRY_CAPACITY = 150;
export const EQUIPMENT_WEIGHTS = [0,50,50,60,60,80,100] as const;
export const BACKPACK_BONUSES = [0,150,200,250,300,400,500] as const;
export const METRO_ARMOR_SPECS = [null,
 {durability:400,penetrationResistance:10,damageReduction:.30},
 {durability:550,penetrationResistance:20,damageReduction:.40},
 {durability:700,penetrationResistance:40,damageReduction:.50},
 {durability:1000,penetrationResistance:80,damageReduction:.62},
 {durability:1200,penetrationResistance:140,damageReduction:.74},
 {durability:1600,penetrationResistance:220,damageReduction:.85},
] as const;
// Explicit provisional weights where a Metro-specific numeric table is unavailable.
// These are inventory units, not real-world mass or claimed official weapon stats.
export const PROVISIONAL_AMMO_WEIGHTS:Record<string,number>={
 'ammo-57':.3,'ammo-9':.375,'ammo-45':.4,'ammo-556':.5,'ammo-762':.6,
 'ammo-300':1,'ammo-50':1,'ammo-12':1.25,'ammo-bolt':2,'ammo-40':20,'ammo-flare':10
};
export function applyMetroInventory(items:ItemDef[]){
 for(const item of items){
  const base=item.baseId??item.id;
  if(item.id==='gold-upgrade-part'){item.weight=1;item.weightSource='user-specified';}
  else if(item.category==='valuable'){
   item.weight=base==='full-cash-crate'?.02:10;item.weightSource=base==='full-cash-crate'?'user-specified':'namu-metro';
  }else if(['armor','helmet','backpack'].includes(item.category)){
   const level=Math.min(6,Math.max(1,item.equipmentLevel??(Number(base.match(/-(\d+)$/)?.[1])||item.tier)));
   item.weight=EQUIPMENT_WEIGHTS[level]??100;item.weightSource='namu-metro';
   if(item.category==='backpack'){
    const advancedLevel=item.goldTraitLevels?.['backpack-advanced-elastic']??0,elasticLevel=item.goldTraitLevels?.['backpack-elastic']??0;
    const advancedBonus=[0,60,70,80][advancedLevel]??0,elasticBonus=[0,40,50,60][elasticLevel]??0;
    item.capacity=(BACKPACK_BONUSES[level]??500)+advancedBonus+elasticBonus;
   }else{
    const spec=METRO_ARMOR_SPECS[level];
    if(spec){item.durability=spec.durability;item.metroDamageReduction=spec.damageReduction;item.penetrationResistance=spec.penetrationResistance;}
   }
  }else if(item.category==='weapon'){
   item.weight=item.mode==='melee'?40:150;
   item.weightSource=item.mode==='melee'?'provisional-metro':'user-specified';
  }else if(item.category==='attachment'){
   item.weight=base==='lead-lined-fabric'?50:25;item.weightSource='user-specified';
  }else if(item.category==='ammo'){
   item.weight=PROVISIONAL_AMMO_WEIGHTS[item.caliber??item.id]??.5;item.weightSource='provisional-metro';
  }else{
   const weight:Record<string,number>={bandage:2,'first-aid':10,'med-kit':20,'energy-drink':4,painkiller:10,adrenaline:20,'frag-grenade':18,'smoke-grenade':14,molotov:16,flashbang:12};
   item.weight=weight[base]??(item.category==='medical'?10:18);
   item.weightSource='provisional-metro';
  }
 }
}
export function inventoryCapacity(bagCapacity=0,talentBonus=0,vestBonus=0){
 return BASE_CARRY_CAPACITY+bagCapacity+talentBonus+vestBonus;
}

/** Each firearm fitting belongs to its explicit primary/secondary host.
 * Group it under that host for display, but count every owned slot exactly once.
 * Unattached fittings still have weight and never create phantom equipment.
 */
export function equipmentWeights(equipped:Record<string,string|null|undefined>,lookup:(id:string)=>ItemDef|undefined,activeSlot='primary'){
 const bySlot:Record<string,number>={};
 for(const [slot,id] of Object.entries(equipped))if(id)bySlot[slot]=lookup(id)?.weight??0;
 const total=Object.values(bySlot).reduce((sum,weight)=>sum+weight,0);
 const gunSlot=['primary','secondary','pistol'].includes(activeSlot)&&equipped[activeSlot]?activeSlot:equipped.primary?'primary':equipped.secondary?'secondary':equipped.pistol?'pistol':null;
 let gunAttachments=0;
 for(const host of ['primary','secondary','pistol'])for(const part of ['scope','barrel','magazine','grip']){
  const key=`${host}:${part}`,weight=bySlot[key]??0;
  if(equipped[host]&&weight){bySlot[host]=(bySlot[host]??0)+weight;bySlot[key]=0;if(host===gunSlot)gunAttachments+=weight;}
 }
 for(const part of ['scope','barrel','magazine','grip'])if(equipped.primary&&bySlot[part]){const weight=bySlot[part];bySlot.primary=(bySlot.primary??0)+weight;bySlot[part]=0;if(gunSlot==='primary')gunAttachments+=weight;}
 const armorAttachment=equipped.armor?['vest','armor:0','armor:1','armor:2'].reduce((n,key)=>n+(bySlot[key]??0),0):0;
 if(armorAttachment){bySlot.armor=(bySlot.armor??0)+armorAttachment;for(const key of ['vest','armor:0','armor:1','armor:2'])bySlot[key]=0;}
 return {bySlot,total,gunSlot,gunAttachments,armorAttachment};
}
