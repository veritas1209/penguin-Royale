import {equipBossLoadout as __equipBossLoadout29} from '../enemyForces.js';
import __assert29 from 'node:assert/strict';
import {ITEMS as __ITEMS29} from '../../shared/catalog.ts';
import {WORLD as __WORLD29} from '../../shared/world.ts';
import {
 enemyRewardStacks as __enemyRewardStacks29
} from '../bosses.js';
import {
 rollWeaponCrateContents as __rollWeaponCrateContents29,
 rollWorldContainer as __rollWorldContainer29,
 planRadiationWeaponSpawns as __planRadiationWeaponSpawns29,
 inRadiation as __inRadiation29
} from '../loot.js';
import {
 Raid as __Raid29,
 normalizeCatalog as __normalizeCatalog29
} from '../game.js';
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {ITEMS,TALENTS} from '../../shared/catalog.ts';import {WORLD} from '../../shared/world.ts';import {normalizeCatalog,Raid} from '../game.js';import {rollWorldContainer,lootQuantity,inRadiation} from '../loot.js';import {enemyRewardStacks} from '../bosses.js';import {isPasswordLetter} from '../access.js';
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});function seeded(seed){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
test('boss equipment slots independently follow normal and radiation grade policies',()=>{
 const catalog=
  __normalizeCatalog29({
   items:__ITEMS29,
   talents:[]
  });

 const normal={
  weapon:{},
  helmet:{},
  armor:{},
  backpack:{}
 };

 const radiation={
  weapon:{},
  helmet:{},
  armor:{},
  backpack:{}
 };

 const grade=item=>
  item?.quality==='gold'
   ?'gold'
   :String(
     item?.equipmentLevel??
     item?.tier
    );

 const add=(stats,key,value)=>{
  stats[key][value]=
   (stats[key][value]??0)+1;
 };

 const N=4000;

 for(let i=0;i<N;i++){
  for(const [radiationBoss,stats] of [
   [false,normal],
   [true,radiation]
  ]){
   const raid={
    id:
     (radiationBoss?'radiation-':'normal-')+
     i,
    catalog
   };

   const enemy={
    id:'boss',
    bossId:
     radiationBoss
      ?'silo-warden'
      :'armory-command',
    ability:'barrage',
    kind:'commander',
    weaponId:'mk14',
    x:0,
    z:0,
    hp:1000,
    maxHp:1000,
    speed:2,
    armor:0
   };

   __equipBossLoadout29(
    raid,
    enemy
   );

   const weapon=
    catalog.byId.get(
     enemy.weaponId
    );

   const helmet=
    catalog.byId.get(
     enemy.helmetId
    );

   const armor=
    catalog.byId.get(
     enemy.armorId
    );

   const backpack=
    catalog.byId.get(
     enemy.backpackId
    );

   __assert29.ok(weapon);
   __assert29.ok(helmet);
   __assert29.ok(armor);
   __assert29.ok(backpack);

   add(
    stats,
    'weapon',
    weapon.quality
   );

   add(
    stats,
    'helmet',
    grade(helmet)
   );

   add(
    stats,
    'armor',
    grade(armor)
   );

   add(
    stats,
    'backpack',
    grade(backpack)
   );
  }
 }

 const rate=(stats,slot,key)=>
  (stats[slot][key]??0)/N;

 for(const slot of [
  'helmet',
  'armor',
  'backpack'
 ]){
  __assert29.ok(
   Math.abs(
    rate(normal,slot,'5')-.50
   )<.04,
   slot+' normal 5'
  );

  __assert29.ok(
   Math.abs(
    rate(normal,slot,'6')-.40
   )<.04,
   slot+' normal 6'
  );

  __assert29.ok(
   Math.abs(
    rate(normal,slot,'gold')-.10
   )<.03,
   slot+' normal gold'
  );

  __assert29.equal(
   rate(radiation,slot,'5'),
   0
  );

  __assert29.ok(
   Math.abs(
    rate(radiation,slot,'6')-.70
   )<.04,
   slot+' radiation 6'
  );

  __assert29.ok(
   Math.abs(
    rate(radiation,slot,'gold')-.30
   )<.04,
   slot+' radiation gold'
  );
 }

 __assert29.ok(
  Math.abs(
   rate(normal,'weapon','improved')-.50
  )<.04
 );

 __assert29.ok(
  Math.abs(
   rate(normal,'weapon','refined')-.40
  )<.04
 );

 __assert29.ok(
  Math.abs(
   rate(normal,'weapon','gold')-.10
  )<.03
 );

 __assert29.equal(
  rate(radiation,'weapon','improved'),
  0
 );

 __assert29.ok(
  Math.abs(
   rate(radiation,'weapon','refined')-.70
  )<.04
 );

 __assert29.ok(
  Math.abs(
   rate(radiation,'weapon','gold')-.30
  )<.04
 );
});
test('boss corpse preserves exact equipped weapon helmet armor and backpack',()=>{
 const catalog={
  items:__ITEMS29,
  byId:new Map(
   __ITEMS29.map(i=>[i.id,i])
  )
 };

 const cases=[
  {
   weaponId:'mk14-refined',
   helmetId:'helmet-5',
   armorId:'armor-6',
   backpackId:'backpack-5'
  },
  {
   weaponId:'groza-improved',
   helmetId:'helmet-6',
   armorId:'armor-5',
   backpackId:'backpack-6'
  },
  {
   weaponId:
    __ITEMS29.find(i=>
     i.category==='weapon' &&
     i.quality==='gold' &&
     Object.keys(
      i.goldTraitLevels??{}
     ).length<=4
    )?.id,

   helmetId:
    __ITEMS29.find(i=>
     i.category==='helmet' &&
     i.quality==='gold' &&
     Object.keys(
      i.goldTraitLevels??{}
     ).length<=4
    )?.id,

   armorId:
    __ITEMS29.find(i=>
     i.category==='armor' &&
     i.quality==='gold' &&
     Object.keys(
      i.goldTraitLevels??{}
     ).length<=4
    )?.id,

   backpackId:
    __ITEMS29.find(i=>
     i.category==='backpack' &&
     i.quality==='gold' &&
     Object.keys(
      i.goldTraitLevels??{}
     ).length<=4
    )?.id
  }
 ];

 for(
  const [index,equipment]
  of cases.entries()
 ){
  for(const id of Object.values(equipment))
   __assert29.ok(
    id&&catalog.byId.has(id),
    'missing equipment '+id
   );

  const enemy={
   id:'boss-corpse-'+index,
   bossId:'boss-test',
   kind:'commander',
   ...equipment,
   medicalUses:1,
   medicalItemId:'first-aid'
  };

  const stacks=
   __enemyRewardStacks29(
    catalog,
    enemy,
    2900+index,
    false
   );

  const ids=
   stacks.map(
    stack=>stack.itemId
   );

  __assert29.equal(
   ids[0],
   equipment.weaponId
  );

  for(const id of [
   equipment.weaponId,
   equipment.helmetId,
   equipment.armorId,
   equipment.backpackId
  ]){
   __assert29.equal(
    ids.filter(x=>x===id).length,
    1,
    'exact equipped drop '+id
   );
  }

  __assert29.ok(
   stacks.some(
    stack=>
     stack.itemId==='first-aid' &&
     stack.quantity===1
   )
  );

  const weapon=
   catalog.byId.get(
    equipment.weaponId
   );

  __assert29.ok(
   stacks.some(
    stack=>
     catalog.byId.get(
      stack.itemId
     )?.category==='ammo' &&
     (
      catalog.byId.get(
       stack.itemId
      )?.caliber??
      stack.itemId
     )===weapon.ammo
   )
  );
 }
});
test('map chests keep 2-3 items except mixed weapon crates using the new 1-6 contract',()=>{
 const catalog={
  items:__ITEMS29,
  byId:new Map(__ITEMS29.map(i=>[i.id,i]))
 };

 const plan=
  __planRadiationWeaponSpawns29(
   __WORLD29,
   __WORLD29.lootSpawns,
   29
  );

 const makeRng=seed=>{
  let value=seed>>>0;
  return ()=>{
   value=(
    Math.imul(value,1664525)+1013904223
   )>>>0;
   return value/4294967296;
  };
 };

 for(
  const [index,spawn]
  of __WORLD29.lootSpawns.entries()
 ){
  const result=
   __rollWorldContainer29(
    catalog,
    __WORLD29,
    spawn,
    makeRng(index+29001),
    {
     radiationWeaponSpawns:plan
    }
   );

  const ids=result.items.map(s=>s.itemId);

  __assert29.equal(
   new Set(ids).size,
   ids.length,
   spawn.id+' duplicate item ID'
  );

  if(result.lootType==='weapon'){
   __assert29.ok(
    result.items.length>=1 &&
    result.items.length<=6,
    spawn.id+':'+result.items.length
   );

   const defs=result.items.map(
    s=>catalog.byId.get(s.itemId)
   );

   const parts=defs.filter(
    i=>i?.category==='attachment'
   );

   const guns=defs.filter(
    i=>
     i?.category==='weapon' &&
     i.mode!=='flare'
   );

   __assert29.ok(
    parts.length>=1 &&
    parts.length<=2
   );

   __assert29.ok(guns.length<=1);

   if(guns[0]){
    __assert29.ok(
     defs.some(i=>
      i?.category==='ammo' &&
      (i.caliber??i.id)===guns[0].ammo
     )
    );
   }

   if(
    result.items.some(
     s=>s.itemId==='signal-flare'
    )
   ){
    __assert29.ok(
     result.items.some(
      s=>s.itemId==='ammo-flare'
     )
    );
   }
  }else{
   __assert29.ok(
    result.items.length>=2 &&
    result.items.length<=3,
    spawn.id+':'+result.items.length
   );
  }
 }
});
test('weapon crate rates, qualities, parts, ammunition and flare policy match configured weights',()=>{
 const catalog={
  items:__ITEMS29,
  byId:new Map(__ITEMS29.map(i=>[i.id,i]))
 };

 let value=0x29c0ffee;
 const rng=()=>{
  value=(
   Math.imul(value,1664525)+1013904223
  )>>>0;
  return value/4294967296;
 };

 const total=20000;

 let guns=0;
 let flares=0;
 let partTotal=0;

 const gunQuality={};
 const partQuality={};

 for(let n=0;n<total;n++){
  const stacks=
   __rollWeaponCrateContents29(
    catalog,
    rng
   );

  const defs=stacks.map(s=>({
   stack:s,
   item:catalog.byId.get(s.itemId)
  }));

  const weapon=defs
   .map(x=>x.item)
   .find(i=>
    i?.category==='weapon' &&
    i.mode!=='flare'
   );

  const parts=defs
   .map(x=>x.item)
   .filter(i=>i?.category==='attachment');

  __assert29.ok(
   parts.length===1 ||
   parts.length===2
  );

  for(const part of parts){
   partTotal++;
   partQuality[part.quality]=
    (partQuality[part.quality]??0)+1;

   __assert29.ok(
    [
     'repaired',
     'intact',
     'improved',
     'refined'
    ].includes(part.quality)
   );
  }

  if(weapon){
   guns++;

   gunQuality[weapon.quality]=
    (gunQuality[weapon.quality]??0)+1;

   __assert29.ok(
    [
     'repaired',
     'intact',
     'improved',
     'refined',
     'gold'
    ].includes(weapon.quality)
   );

   const ammo=defs
    .map(x=>x.item)
    .find(i=>
     i?.category==='ammo' &&
     (i.caliber??i.id)===weapon.ammo
    );

   __assert29.ok(
    ammo,
    weapon.id+' missing matching ammo'
   );

   const high=[
    'improved',
    'refined',
    'gold'
   ].includes(weapon.quality);

   __assert29.ok(
    high
     ?['explosive','incendiary']
       .includes(ammo.ammoGrade)
     :['normal','polished']
       .includes(ammo.ammoGrade),
    weapon.id+' / '+ammo.id
   );
  }

  if(
   stacks.some(
    s=>s.itemId==='signal-flare'
   )
  ){
   flares++;

   __assert29.ok(
    stacks.some(
     s=>s.itemId==='ammo-flare'
    )
   );
  }
 }

 const gunRate=guns/total;
 const flareRate=flares/total;

 __assert29.ok(
  gunRate>.68&&gunRate<.72,
  'gun rate '+gunRate
 );

 __assert29.ok(
  flareRate>.13&&flareRate<.17,
  'flare rate '+flareRate
 );

 const gunExpected={
  repaired:.40,
  intact:.30,
  improved:.15,
  refined:.10,
  gold:.05
 };

 for(const [quality,expected]
     of Object.entries(gunExpected)){
  const actual=
   (gunQuality[quality]??0)/guns;

  __assert29.ok(
   Math.abs(actual-expected)<.035,
   quality+' gun rate '+actual
  );
 }

 const partExpected={
  repaired:.40,
  intact:.30,
  improved:.20,
  refined:.10
 };

 for(const [quality,expected]
     of Object.entries(partExpected)){
  const actual=
   (partQuality[quality]??0)/partTotal;

  __assert29.ok(
   Math.abs(actual-expected)<.035,
   quality+' part rate '+actual
  );
 }
});
test('full cash crate generation uses inclusive 40 to 90 quantity',()=>{const item=catalog.byId.get('full-cash-crate');assert.equal(lootQuantity(item,()=>0),40);assert.equal(lootQuantity(item,()=>.999999),90);});
test('actual radioactive weapon containers keep mixed military loot and public snapshot kind',()=>{
 const catalog=
  __normalizeCatalog29({
   items:__ITEMS29,
   talents:[]
  });

 const db={
  profile:()=>({talents:[]}),
  updateRaidLoot(){},
  updateRaidInventoryState(){},
  settleRaidPlayer(){
   return {applied:true};
  },
  markRaidCompleteIfSettled(){}
 };

 const raid=new __Raid29({
  id:'world-loot-29',
  room:{
   mode:'solo',
   members:new Map([
    ['p',{username:'p'}]
   ])
  },
  escrow:[{
   userId:'p',
   gear:[]
  }],
  db,
  catalog,
  world:__WORLD29,
  now:()=>1000,
  emit(){}
 });

 const player=
  raid.players.get('p');

 let military=0;

 for(const spawn of __WORLD29.lootSpawns){
  const radiation=__inRadiation29(__WORLD29,spawn);

  if(!radiation)continue;

  const container=
   raid.containers.get(spawn.id);

  if(!container)continue;

  player.x=container.x;
  player.z=container.z;

  const publicContainer=
   raid.snapshot(1000,'p')
    .containers.find(
     c=>c.id===spawn.id
    );

  __assert29.ok(
   publicContainer,
   spawn.id+' missing from nearby snapshot'
  );

  __assert29.equal(
   publicContainer.kind,
   container.kind
  );

  if(container.kind!=='military')
   continue;

  military++;

  const categories=container.items.map(
   stack=>
    catalog.byId.get(stack.itemId)?.category
  );

  __assert29.ok(
   categories.every(category=>
    [
     'weapon',
     'attachment',
     'ammo'
    ].includes(category)
   ),
   spawn.id+': '+categories.join(',')
  );

  const attachments=categories.filter(
   category=>category==='attachment'
  ).length;

  __assert29.ok(
   attachments===1 ||
   attachments===2
  );
 }

 __assert29.ok(
  military===4||military===5,
  'military radiation chests '+military
 );
});



test('square radiation includes indoor corner crates and all radioactive crates search for six seconds',()=>{
 const zone=WORLD.radiationZones[0];
 const corners=WORLD.lootSpawns.filter(spawn=>spawn.buildingId&&spawn.pool!=='documents'&&
  Math.abs(spawn.x-zone.x)<=zone.w/2&&Math.abs(spawn.z-zone.z)<=zone.d/2&&
  Math.hypot(spawn.x-zone.x,spawn.z-zone.z)>zone.radius);
 assert.ok(corners.length>=2,'expected the two missed indoor crates');
 const raid=new Raid({id:'radiation-rect-crates',room:{mode:'solo',members:new Map()},escrow:[],db:{},catalog,world:WORLD,now:()=>1000,emit(){}});
 for(const spawn of WORLD.lootSpawns.filter(spawn=>spawn.pool!=='documents'&&inRadiation(WORLD,spawn))){
  const container=raid.containers.get(spawn.id);
  assert.ok(container,spawn.id+' missing');
  assert.ok(['rare','military'].includes(container.kind),spawn.id+' wrong kind');
  assert.equal(container.searchSeconds,6,spawn.id+' search duration');
 }
 for(const spawn of corners)assert.ok(['rare','military'].includes(raid.containers.get(spawn.id)?.kind),spawn.id);
});
test('radiation sale crates contain one or two password letters total while black vault and military crates contain none',()=>{
 const raid=new Raid({id:'radiation-letter-cap',room:{mode:'solo',members:new Map()},escrow:[],db:{},catalog,world:WORLD,now:()=>1000,emit(){}});
 let saleLetters=0;
 for(const spawn of WORLD.lootSpawns){
  const container=raid.containers.get(spawn.id);if(!container)continue;
  const letters=container.items.filter(stack=>isPasswordLetter(stack.itemId));
  if(spawn.accessDoorId==='access-door-black')assert.equal(letters.length,0,'black vault '+spawn.id);
  const radioactive=inRadiation(WORLD,spawn);
  if(!radioactive)continue;
  if(container.kind==='military')assert.equal(letters.length,0,'military '+spawn.id);
  else if(container.kind==='rare'&&spawn.accessDoorId!=='access-door-black')saleLetters+=letters.length;
 }
 assert.ok(saleLetters>=1&&saleLetters<=2,'radiation sale letter count '+saleLetters);
});
test('black encrypted-room rolls never contain password letters',()=>{
 const world={radiationZones:[{x:0,z:0,radius:10}],accessDoors:[{id:'access-door-black',color:'black',itemId:'password-letter-black'}]};
 const spawn={id:'black-vault',x:0,z:0,pool:'rare',tier:6,accessDoorId:'access-door-black'},rng=seeded(991);
 for(let n=0;n<1000;n++)assert.equal(rollWorldContainer(catalog,world,spawn,rng).items.some(stack=>isPasswordLetter(stack.itemId)),false);
});


test('radiation weapon crates enforce improved-or-better equipment',()=>{
 const catalog={
  items:__ITEMS29,
  byId:new Map(
   __ITEMS29.map(i=>[i.id,i])
  )
 };

 let state=0x29abc123;

 const rng=()=>{
  state=(
   Math.imul(state,1664525)+
   1013904223
  )>>>0;

  return state/4294967296;
 };

 for(let n=0;n<5000;n++){
  const stacks=
   __rollWeaponCrateContents29(
    catalog,
    rng,
    {radiation:true}
   );

  const defs=
   stacks.map(
    stack=>
     catalog.byId.get(
      stack.itemId
     )
   );

  const weapon=
   defs.find(item=>
    item?.category==='weapon' &&
    item.mode!=='flare'
   );

  if(weapon){
   __assert29.ok(
    [
     'improved',
     'refined',
     'gold'
    ].includes(
     weapon.quality
    )
   );

   const ammo=
    defs.find(item=>
     item?.category==='ammo' &&
     (
      item.caliber??
      item.id
     )===weapon.ammo
    );

   __assert29.ok(ammo);

   __assert29.ok(
    [
     'explosive',
     'incendiary'
    ].includes(
     ammo.ammoGrade
    )
   );
  }

  const parts=
   defs.filter(item=>
    item?.category===
    'attachment'
   );

  __assert29.ok(
   parts.length===1 ||
   parts.length===2
  );

  for(const part of parts){
   __assert29.ok(
    [
     'improved',
     'refined'
    ].includes(
     part.quality
    )
   );
  }
 }
});
