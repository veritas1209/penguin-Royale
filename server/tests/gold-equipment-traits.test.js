import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID,GOLD_OPTIONS,TALENTS} from '../../shared/catalog.ts';
import {goldEquipmentEffects} from '../../shared/goldEquipment.ts';
import {normalizeCatalog,Raid} from '../game.js';
import {GameDatabase} from '../db.js';
import {startRevive} from '../revival.js';

const lookup=id=>ITEM_BY_ID[id];

test('helmet, vest, and backpack gold traits expose levels one to three with exact requested ranges',()=>{
 const leveled=['helmet-armor-set','helmet-composite-fiber','helmet-thick','armor-ergonomics','armor-armor-set','armor-fireproof','armor-blastproof','armor-thick','backpack-elastic','backpack-encryption','backpack-advanced-elastic','backpack-advanced-encryption','backpack-first-aid','backpack-module-search'];
 for(const trait of leveled)for(const level of [1,2,3])assert.ok(GOLD_OPTIONS[trait+'-l'+level],trait+' '+level);
 for(const trait of ['helmet-tactical-lens','armor-lead']){assert.ok(GOLD_OPTIONS[trait]);for(const level of [1,2,3])assert.equal(GOLD_OPTIONS[trait+'-l'+level],undefined);}
 assert.equal(ITEM_BY_ID['helmet-gold-tactical-lens'].optionIds[0],'helmet-tactical-lens');
 assert.equal(ITEM_BY_ID['armor-gold-lead'].optionIds[0],'armor-lead');
 assert.ok(!ITEMS.some(item=>/^helmet-gold-tactical-lens-l[123]$/.test(item.id)||/^armor-gold-lead-l[123]$/.test(item.id)));
 for(const alias of ['helmet-gold-tactical-lens-l1','helmet-gold-tactical-lens-l2','helmet-gold-tactical-lens-l3','armor-gold-lead-l1','armor-gold-lead-l2','armor-gold-lead-l3'])assert.ok(ITEM_BY_ID[alias]);
 assert.deepEqual([1,2,3].map(level=>ITEM_BY_ID['backpack-gold-elastic-l'+level].capacity),[540,550,560]);
 assert.deepEqual([1,2,3].map(level=>ITEM_BY_ID['backpack-gold-advanced-elastic-l'+level].capacity),[560,570,580]);
 assert.equal(ITEM_BY_ID['armor-gold-lead-l1'].traits.includes('radiation-immunity'),true);
 assert.equal(ITEM_BY_ID['armor-gold-lead-l3'].traits.includes('radiation-immunity'),true);
 for(const removed of ['assembly-material','durable-material','tactical-detector','cushion','limb-protector','gas-resistant'])assert.equal(leveled.includes(removed),false);
});

test('gold equipment effect calculator applies combat, utility, and binary traits without leaking effects to ordinary gear',()=>{
 assert.deepEqual(goldEquipmentEffects({armor:'armor-6',helmet:'helmet-6',backpack:'backpack-6'},lookup),{
  damageReduction:0,headshotFlatReduction:0,bossSpecialReduction:0,flatDamageReduction:0,fireReduction:0,explosiveReduction:0,flashImmune:false,equipmentWeightInfluenceReduction:0,secureCapacityBonus:0,reviveTimeReduction:0,bonusLootChance:0,
 });
 const combat=goldEquipmentEffects({helmet:'helmet-gold-thick-l3',armor:'armor-gold-blastproof-l2'},lookup);
 assert.equal(combat.bossSpecialReduction,.5);assert.equal(combat.explosiveReduction,.4);
 const utility=goldEquipmentEffects({backpack:'backpack-gold-advanced-encryption-l3'},lookup);
 assert.equal(utility.secureCapacityBonus,40);
 assert.equal(goldEquipmentEffects({backpack:'backpack-gold-first-aid-l2'},lookup).reviveTimeReduction,.5);
 assert.equal(goldEquipmentEffects({backpack:'backpack-gold-module-search-l3'},lookup).bonusLootChance,.15);
 assert.equal(goldEquipmentEffects({helmet:'helmet-gold-tactical-lens'},lookup).flashImmune,true);
});

function fixture(gear=[],options={}){
 const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS}),room={mode:'coop',members:new Map([['p',{username:'p'}],['q',{username:'q'}]])};
 const world={size:60,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[{id:'box',x:0,z:0,pool:'supplies',tier:1,searchSeconds:1}],extractions:[],radiationZones:[]};
 const db={profile:()=>({talents:[]}),settleRaidPlayer:()=>({applied:true}),markRaidCompleteIfSettled(){}};
 const raid=new Raid({id:'gold-gear',room,escrow:[{userId:'p',gear},{userId:'q',gear:[]}],db,catalog,world,now:()=>1000,emit(){},options});
 return {raid,p:raid.players.get('p'),q:raid.players.get('q')};
}

test('boss, explosive, and flat reductions are applied by the authoritative damage path',()=>{
 const {raid,p}=fixture([{slot:'helmet',itemId:'helmet-gold-thick-l3'},{slot:'armor',itemId:'armor-gold-blastproof-l2'}]);
 p.armorReduction=0;raid.damagePlayer(p,100,'boss',1000,'boss-special:explosive');
 assert.equal(p.hp,70);
 const thick=fixture([{slot:'armor',itemId:'armor-gold-thick-l3'}]);thick.p.armorReduction=0;thick.raid.damagePlayer(thick.p,20,'enemy',1000);
 assert.equal(thick.p.hp,87);
});

test('gold backpack shortens revives and can add one bonus chest item',()=>{
 const first=fixture([{slot:'backpack',itemId:'backpack-gold-first-aid-l3'}]);first.q.downed=true;first.q.downedUntil=21000;startRevive(first.raid,first.p,first.q,1000);assert.equal(first.p.reviving.completeAt,5000);
 const bonus=fixture([{slot:'backpack',itemId:'backpack-gold-module-search-l3'}],{random:()=>0});
 const c=bonus.raid.containers.get('box');c.items=[{itemId:'bandage',quantity:1,stackId:'one'}];bonus.raid.interact(bonus.p,'box',1000);bonus.raid.updateContainerSearches(2000);
 assert.equal(c.items[0].quantity,2);assert.ok(bonus.raid.events.some(e=>e.kind==='container_bonus_item'));
});

test('advanced encryption backpack expands lobby and raid secure capacity',()=>{
 const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS}),db=new GameDatabase(':memory:');db.instanceCatalog=catalog.byId;
 try{
  const item='backpack-gold-advanced-encryption-l3',u=db.createUser('gold-secure',Buffer.from('s'),Buffer.from('h'),[{itemId:item,quantity:1}],{backpack:item});
  assert.equal(db.profile(u.id).secureCapacity,80);
  const [entry]=db.beginRaid('gold-secure-raid','room',[u.id]);
  const raid=new Raid({id:'gold-secure-raid',room:{mode:'solo',members:new Map([[u.id,{username:'u'}]])},escrow:[entry],db,catalog,world:{size:30,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[],radiationZones:[]},now:()=>1000,emit(){}});
  assert.equal(raid.players.get(u.id).secureCapacity,80);
 }finally{db.close();}
});

