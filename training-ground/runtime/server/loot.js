import {getMetroMapLootWeight} from '../shared/metroEconomy.ts';
import {isFactionArmor} from '../shared/shopAvailability.ts';
import { randomInt } from 'node:crypto';
import {SUPPLY_PACKS} from '../shared/supplyPacks.ts';
import {isPasswordLetter} from './access.js';
export {SUPPLY_PACKS};
export const MAP_GOLD_CHANCE=.01;
export const RADIATION_WEAPON_CRATE_MIN=4;
export const RADIATION_WEAPON_CRATE_MAX=5;
export const isAcquirableGold=item=>item?.quality==='gold'&&Object.keys(item.goldTraitLevels??{}).length<=4;
export function lootCandidateItems(items){return items;}
function radiationSpawnCandidate(world,spawn){
 if(spawn.pool==='documents'||!inRadiation(world,spawn))return false;
 return !(world.accessDoors??[]).some(door=>door.id===spawn.accessDoorId&&(door.color==='black'||door.itemId==='password-letter-black'));
}
function seededSpawnRank(seed,id,index){
 let value=((seed??0)^(Math.imul(index+1,2654435761)))>>>0;
 for(const char of String(id??index))value=(Math.imul(value^char.charCodeAt(0),16777619))>>>0;
 value=(Math.imul(value^value>>>16,2246822507)^Math.imul(value^value>>>13,3266489909))>>>0;
 return value;
}
export function planRadiationWeaponSpawns(world,spawns=world.lootSpawns??[],seed=0){
 const candidates=spawns.map((spawn,index)=>({spawn,index})).filter(({spawn})=>radiationSpawnCandidate(world,spawn));
 const count=Math.min(candidates.length,RADIATION_WEAPON_CRATE_MIN+((seed>>>0)%(RADIATION_WEAPON_CRATE_MAX-RADIATION_WEAPON_CRATE_MIN+1)));
 candidates.sort((a,b)=>seededSpawnRank(seed,a.spawn.id,a.index)-seededSpawnRank(seed,b.spawn.id,b.index)||String(a.spawn.id??a.index).localeCompare(String(b.spawn.id??b.index)));
 return new Set(candidates.slice(0,count).map(({spawn,index})=>spawn.id??'loot-'+index));
}
const random=()=>randomInt(1_000_000)/1_000_000;
export function rollSupply(items,kind,rng=random){
 items=lootCandidateItems(items);const pack=SUPPLY_PACKS[kind];if(!pack)throw new Error('Unknown supply pack');
 const category=i=>i.id!=='signal-flare'&&i.baseId!=='signal-flare'&&i.mode!=='flare'&&(pack.category==='weapon'?i.category==='weapon'&&!!i.baseId:['armor','helmet','backpack'].includes(i.category));
 const gold=rng()<pack.goldChance;
 const pool=items.filter(i=>category(i)&&(!isFactionArmor(i)||kind==='premium-armor')&&(gold?isAcquirableGold(i):i.quality!=='gold'&&i.tier>=pack.minTier&&i.tier<=pack.maxTier));
 if(!pool.length)throw new Error('Empty supply pool');return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
}
export function rollMapGold(items,spawn,rng=random){
 items=lootCandidateItems(items);if(!((spawn.pool==='rare'||spawn.pool==='military')&&spawn.tier>=4)||rng()>=MAP_GOLD_CHANCE)return null;
 const pool=items.filter(isAcquirableGold);return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]??null;
}

/** New world-generated launcher loot only; never call for player-owned drops. */
export function pairWorldFlareLoot(stacks,catalog){
 const items=stacks.map(s=>({...s}));
 const launchers=items.reduce((n,s)=>n+((s.itemId==='signal-flare'||catalog.byId.get(s.itemId)?.mode==='flare')?s.quantity:0),0);
 if(launchers&&catalog.byId.has('ammo-flare')){const ammo=items.find(s=>s.itemId==='ammo-flare'),missing=launchers-(ammo?.quantity??0);if(missing>0){if(ammo)ammo.quantity+=missing;else items.push({itemId:'ammo-flare',quantity:missing});}}
 return items;
}


// Ammo uses its grade color rather than the ordinary item tier color.
export function isPurpleLoot(item){return !!item&&(item.ammoGrade?['explosive','incendiary'].includes(item.ammoGrade):item.quality==='gold'||item.tier>=4);}
export function inRadiation(world,position){return (world.radiationZones??[]).some(zone=>zone.w&&zone.d?Math.abs(position.x-zone.x)<=zone.w/2&&Math.abs(position.z-zone.z)<=zone.d/2:Math.hypot(position.x-zone.x,position.z-zone.z)<=zone.radius);}
export function worldLootPool(candidates,spawn,radiationZone=false){
 const nodeTier=radiationZone?Math.max(4,spawn.tier??1):spawn.tier??1;
 const category=item=>spawn.pool==='medical'?item.category==='medical':spawn.pool==='ammo'?item.category==='ammo':spawn.pool==='supplies'?['medical','ammo'].includes(item.category):spawn.pool==='military'?['weapon','armor','helmet','ammo'].includes(item.category):item.category==='valuable';
 const eligible=item=>item.tier<=nodeTier+1&&(spawn.pool!=='rare'||item.tier>=3)&&(!radiationZone||isPurpleLoot(item));
 let pool=candidates.filter(item=>!isPasswordLetter(item.id)&&category(item)&&eligible(item));
 if(!radiationZone&&!['rare','military'].includes(spawn.pool))pool=pool.filter(item=>item.category!=='ammo'||!item.ammoGrade||['corroded','normal'].includes(item.ammoGrade));
 const weighted=items=>items.map(item=>({item,weight:item.category==='valuable'?getMetroMapLootWeight(item,{nodeTier,radiationZone}):1})).filter(entry=>entry.weight>0);
 let result=weighted(pool);
 // Medical nodes currently have no purple medicines. Supply a legal local valuable, never a low-grade fallback.
 if(radiationZone&&!result.length)result=weighted(candidates.filter(item=>item.category==='valuable'&&eligible(item)));
 return result;
}
export function lootQuantity(item,rng=Math.random){return item.id==='full-cash-crate'?40+Math.min(50,Math.floor(rng()*51)):item.category==='ammo'?item.packSize??1:1;}
const weightedItem=(entries,rng)=>{let roll=rng()*entries.reduce((n,e)=>n+e.weight,0);for(const entry of entries){roll-=entry.weight;if(roll<0)return entry.item;}return entries.at(-1)?.item;};

const WEAPON_CRATE_WEAPON_QUALITY=[
 ['repaired',.40],
 ['intact',.30],
 ['improved',.15],
 ['refined',.10],
 ['gold',.05],
];

/*
 Radiation weapon crates:
 redistribute repaired + intact probability
 proportionally across improved/refined/gold (3:2:1).
*/
const RADIATION_WEAPON_CRATE_WEAPON_QUALITY=[
 ['improved',.50],
 ['refined',1/3],
 ['gold',1/6],
];

const WEAPON_CRATE_PART_QUALITY=[
 ['repaired',.40],
 ['intact',.30],
 ['improved',.20],
 ['refined',.10],
];

/*
 Radiation weapon-crate attachments:
 repaired + intact probability is redistributed
 across improved/refined in the original 2:1 ratio.
*/
const RADIATION_WEAPON_CRATE_PART_QUALITY=[
 ['improved',2/3],
 ['refined',1/3],
];

const WEAPON_CRATE_FIREARM_PARTS=new Set([
 'suppressor',
 'vertical-grip',
 'extended-mag',
]);

function weightedQuality(rng,table){
 const roll=rng();
 let cursor=0;

 for(const [quality,chance] of table){
  cursor+=chance;
  if(roll<cursor)return quality;
 }

 return table.at(-1)[0];
}

function randomChoice(items,rng){
 if(!items.length)return null;
 return items[Math.min(
  items.length-1,
  Math.floor(rng()*items.length)
 )];
}

export function rollWeaponCrateContents(
 catalog,
 rng=Math.random,
 {radiation=false}={}
){
 const stacks=[];

 const add=(item,quantity=1)=>{
  if(!item)return;
  const existing=stacks.find(stack=>stack.itemId===item.id);
  if(existing)existing.quantity+=quantity;
  else stacks.push({itemId:item.id,quantity});
 };

 /*
  일반 총기: 70% 한 자루 / 30% 없음.
 */
 if(rng()>=.30){
  const quality=weightedQuality(
   rng,
   radiation
    ?RADIATION_WEAPON_CRATE_WEAPON_QUALITY
    :WEAPON_CRATE_WEAPON_QUALITY
  );

  const weapons=catalog.items.filter(item=>
   item.category==='weapon' &&
   item.ammo &&
   !['ammo-bolt','ammo-40','ammo-flare'].includes(item.ammo) &&
   !['flare','melee'].includes(item.mode) &&
   (
    quality==='gold'
     ? isAcquirableGold(item)
     : item.quality===quality
   )
  );

  const weapon=randomChoice(weapons,rng);

  if(weapon){
   add(weapon);

   const high=[
    'improved',
    'refined',
    'gold'
   ].includes(weapon.quality);

   const grades=high
    ? ['explosive','incendiary']
    : ['polished','normal'];

   const grade=grades[rng()<.5?0:1];

   const ammoId=
    grade==='normal'
     ? weapon.ammo
     : `${weapon.ammo}-${grade}`;

   const ammo=
    catalog.byId.get(ammoId) ??
    catalog.byId.get(weapon.ammo);

   add(ammo,30);
  }
 }

 /*
  총기 파츠: 항상 1~2개.
 */
 const partCount=1+(rng()<.5?0:1);
 const usedBases=new Set();

 for(let index=0;index<partCount;index++){
  const quality=weightedQuality(
   rng,
   radiation
    ?RADIATION_WEAPON_CRATE_PART_QUALITY
    :WEAPON_CRATE_PART_QUALITY
  );

  const parts=catalog.items.filter(item=>{
   if(item.category!=='attachment')return false;
   if(item.quality!==quality)return false;

   const base=item.baseId??item.id;

   return (
    WEAPON_CRATE_FIREARM_PARTS.has(base) &&
    !usedBases.has(base)
   );
  });

  const part=randomChoice(parts,rng);

  if(part){
   usedBases.add(part.baseId??part.id);
   add(part);
  }
 }

 /*
  플레어건: 위 판정과 완전히 독립적인 15%.
 */
 if(rng()<.15){
  add(catalog.byId.get('signal-flare'));
  add(catalog.byId.get('ammo-flare'));
 }

 return stacks;
}

/** Map-generated chests only: owned drops and boss corpses retain their separate contracts. */
export function rollWorldContainer(catalog,world,spawn,rng=Math.random,{passwordLetterBudget=null,radiationWeaponSpawns=null}={}){
 const radiation=inRadiation(world,spawn),black=(world.accessDoors??[]).some(d=>d.id===spawn.accessDoorId&&(d.color==='black'||d.itemId==='password-letter-black'));
 const plannedWeapon=radiationWeaponSpawns?.has(spawn.id);
 const lootType=black?'valuable':radiation?(radiationWeaponSpawns?(plannedWeapon?'weapon':'valuable'):(rng()<.8?'valuable':'weapon')):null;

 if(lootType==='weapon'){
  return {
   items:rollWeaponCrateContents(
    catalog,
    rng,
    {radiation}
   ),
   lootType
  };
 }

 const target=2+Math.min(1,Math.floor(rng()*2)),stacks=[],used=new Set();
 const lootItems=lootCandidateItems(catalog.items),candidates=lootItems.filter(i=>!isPasswordLetter(i.id)&&i.id!=='ammo-flare'&&i.caliber!=='ammo-flare'&&i.quality!=='gold'&&['valuable','medical','ammo','weapon','armor','helmet'].includes(i.category));
 for(let attempt=0;attempt<100&&stacks.length<target;attempt++){
  let entries;
  if(lootType){const grade=black?6:lootType==='weapon'?(rng()<.7?4:null):null;let qualityTier=grade;
   if(!black&&lootType==='weapon'&&grade===null)qualityTier=rng()<2/3?5:'gold';
   if(!black&&lootType==='valuable'){const roll=rng();qualityTier=roll<.5?4:roll<.8?5:6;}
   entries=lootItems.filter(i=>!isPasswordLetter(i.id)&&i.category===lootType&&!used.has(i.id)&&(lootType!=='weapon'||(i.ammo&&!['flare','melee'].includes(i.mode)))&&(qualityTier==='gold'?isAcquirableGold(i):i.tier===qualityTier&&i.quality!=='gold')).map(item=>({item,weight:lootType==='valuable'?getMetroMapLootWeight(item,{nodeTier:Math.max(6,spawn.tier??1),radiationZone:radiation}):1})).filter(e=>e.weight>0);
  }else entries=worldLootPool(candidates,spawn,false).filter(e=>!used.has(e.item.id));
  const gold=!lootType?rollMapGold(lootItems.filter(i=>!used.has(i.id)),spawn,rng):null;const item=gold??weightedItem(entries,rng);if(!item)continue;
  used.add(item.id);stacks.push({itemId:item.id,quantity:lootQuantity(item,rng)});
 }
 if(radiation&&!black&&lootType==='valuable'&&passwordLetterBudget?.remaining>0){
  const letters=catalog.items.filter(i=>isPasswordLetter(i.id));
  const letter=letters[Math.min(letters.length-1,Math.floor(rng()*letters.length))];
  if(letter&&stacks.length){stacks[stacks.length-1]={itemId:letter.id,quantity:1};passwordLetterBudget.remaining--;}
 }
 const paired=pairWorldFlareLoot(stacks,catalog); // Pair counts toward the same 2–3 unique budget.
 while(paired.length>3){const removable=paired.findIndex(s=>catalog.byId.get(s.itemId)?.mode!=='flare'&&s.itemId!=='ammo-flare');if(removable<0)break;paired.splice(removable,1);}
 return {items:paired,lootType};
}