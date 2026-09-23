import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID as byId,TALENTS,AMMO_GRADE_COLORS,rarityColor,rarityLabel} from '../../shared/catalog.ts';
import {chooseAmmo,loadMagazine,ammoShot} from '../ammo.js';
import {GameDatabase} from '../db.js';
import {normalizeCatalog,RoomManager,Raid,recoveryLoadout} from '../game.js';
import {createGameServer} from '../app.js';
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const world={size:120,spawn:{x:0,z:0},obstacles:[],loot:[],enemies:[],extractions:[]};
function fixture(){
 const db=new GameDatabase(':memory:');
 const stacks=[{itemId:'m416',quantity:1},{itemId:'ammo-556',quantity:60},{itemId:'ammo-556-polished',quantity:45},{itemId:'ammo-556-explosive',quantity:20},{itemId:'ammo-556-incendiary',quantity:20},{itemId:'bandage',quantity:3},{itemId:'frag-grenade',quantity:2}];
 const user=db.createUser('AmmoTester',Buffer.alloc(16),Buffer.alloc(64),stacks,{primary:'m416'});
 for(const stack of stacks.filter(s=>byId[s.itemId]?.category==='ammo'))db.pack(user.id,stack.itemId,stack.quantity,catalog);
 db.pack(user.id,'bandage',2,catalog);
 const manager=new RoomManager({db,catalog,world,now:()=>1000});
 const room=manager.createRoom(user,'solo');manager.rooms.get(room.id).members.get(user.id).connected=true;
 const id=manager.startRoom(user.id),raid=manager.raids.get(id),p=raid.players.get(user.id);
 return {db,user,manager,raid,p};
}
test('eight firearm calibers have five distinct grades with requested colors and normalized Metro damage ratios',()=>{
 const base=ITEMS.filter(i=>i.category==='ammo'&&i.ammoGrade==='normal');assert.equal(base.length,8);
 for(const ammo of base){
  const set=ITEMS.filter(i=>i.category==='ammo'&&i.caliber===ammo.id);assert.equal(set.length,5);
  assert.equal(ammo.id,ammo.caliber);assert.equal(ammo.tier,2);
  for(const item of set){assert.equal(rarityColor(item),AMMO_GRADE_COLORS[item.ammoGrade]);assert.ok(['부식','일반','광택','폭발','연소'].includes(rarityLabel(item)));}
  assert.equal(byId[ammo.id+'-explosive'].tier,byId[ammo.id+'-incendiary'].tier);
  assert.ok(Math.abs(ammoShot(byId.m416,byId[ammo.id+'-polished']).damage/byId.m416.damage-1.48/1.24)<1e-9);
 }
 for(const id of ['ammo-bolt','ammo-40','ammo-flare'])assert.equal(byId[id].ammoGrade,undefined);
 assert.notEqual(recoveryLoadout(catalog).equipped.primary?.includes('gold'),true);
});

test('packed rounds alone enter raid; changing magazine grade preserves exact IDs and quantities on extraction',()=>{
 const {db,user,raid,p}=fixture();try{
  assert.equal(db.inventoryQuantity(user.id,'bandage'),1);assert.equal(p.inventory.find(s=>s.itemId==='bandage').quantity,2);
  assert.equal(p.loadedAmmo.primary,'ammo-556');assert.equal(p.magazines.primary,30);assert.equal(p.reserveAmmo['ammo-556'],30);
  const expectedWeight=p.inventory.reduce((n,s)=>n+byId[s.itemId].weight*s.quantity,0)+Object.entries(p.reserveAmmo).reduce((n,[id,q])=>n+byId[id].weight*q,0);assert.equal(raid.carriedWeight(p),expectedWeight);assert.ok(expectedWeight<=p.carryCapacity);
  raid.selectAmmo(p,'primary','ammo-556-polished',1000);raid.finishReload(p);
  assert.equal(p.loadedAmmo.primary,'ammo-556-polished');assert.equal(p.reserveAmmo['ammo-556'],60);assert.equal(p.reserveAmmo['ammo-556-polished'],15);
  raid.loot.set('ammo-cache',{id:'ammo-cache',itemId:'ammo-556-polished',quantity:5,x:p.x,z:p.z});raid.interact(p,'ammo-cache',1050);assert.equal(p.inventory.some(s=>s.itemId==='ammo-556-polished'),false);
  const before=structuredClone({m:p.magazines,r:p.reserveAmmo});
  assert.throws(()=>raid.selectAmmo(p,'primary','ammo-762',1000),{code:'INCOMPATIBLE_AMMO'});assert.deepEqual({m:p.magazines,r:p.reserveAmmo},before);
  raid.resolveShot(p,{slot:'primary',weapon:byId.m416,direction:{x:1,z:0}},1100);
  p.hp=10;raid.useMedical(p,'bandage');raid.finishRadiationMedicine(p,p.medicalUse.endsAt);
  const own=raid.snapshot(1100,user.id).players[0];assert.equal(own.loadedAmmo.primary,'ammo-556-polished');assert.equal(own.ammoId,'ammo-556-polished');
  raid.settle(p,'extracted',2000);
  assert.equal(db.inventoryQuantity(user.id,'ammo-556'),60);assert.equal(db.inventoryQuantity(user.id,'ammo-556-polished'),49);assert.equal(db.inventoryQuantity(user.id,'bandage'),2);
  raid.settle(p,'extracted',2100);assert.equal(db.inventoryQuantity(user.id,'ammo-556-polished'),49);
 }finally{db.close();}
});

test('grade selection fallback and reload never blend two grades or manufacture rounds',()=>{
 const p={magazines:{primary:7},loadedAmmo:{primary:'ammo-556-polished'},reserveAmmo:{'ammo-556-polished':0,'ammo-556':12}};
 assert.equal(chooseAmmo(catalog,'ammo-556',p.reserveAmmo,'ammo-556-polished'),'ammo-556');
 loadMagazine(p,'primary','ammo-556',30);
 assert.equal(p.magazines.primary,12);assert.equal(p.reserveAmmo['ammo-556-polished'],7);assert.equal(p.reserveAmmo['ammo-556'],0);
 loadMagazine(p,'primary','ammo-556-polished',30);
 assert.equal(p.magazines.primary,7);assert.equal(p.reserveAmmo['ammo-556'],12);
});

test('polished penetration, bounded blast and nonstacking burn are server-authoritative',()=>{
 const {db,raid,p}=fixture();try{
  const enemy=(id,x,z)=>({id,x,z,hp:1000,armor:.5});
  raid.enemies.set('target',enemy('target',10,0));raid.enemies.set('near',enemy('near',10,1));raid.enemies.set('far',enemy('far',10,4));
  const normal=ammoShot(byId.m416,byId['ammo-556']);raid.hitscan(p,normal,{x:1,z:0});const normalDamage=1000-raid.enemies.get('target').hp;
  raid.enemies.get('target').hp=1000;raid.hitscan(p,ammoShot(byId.m416,byId['ammo-556-polished']),{x:1,z:0});assert.ok(1000-raid.enemies.get('target').hp>normalDamage);
  raid.hitscan(p,ammoShot(byId.m416,byId['ammo-556-explosive']),{x:1,z:0},true,1000);assert.ok(raid.enemies.get('near').hp<1000);assert.equal(raid.enemies.get('far').hp,1000);
  const target=raid.enemies.get('target');raid.hitscan(p,ammoShot(byId.m416,byId['ammo-556-incendiary']),{x:1,z:0},true,1000);
  assert.equal(target.burn.nextAt,1500);raid.hitscan(p,ammoShot(byId.m416,byId['ammo-556-incendiary']),{x:1,z:0},true,1200);assert.equal(target.burn.nextAt,1500);
  const hp=target.hp;raid.updateAreas(1500);assert.ok(target.hp<hp);const ticked=target.hp;raid.updateAreas(1500);assert.equal(target.hp,ticked);
  raid.updateAreas(4200);assert.equal(target.burn,undefined);
 }finally{db.close();}
});

test('packing API validates quantity, capacity, ownership and raid state, and sale reconciles the plan',async()=>{
 const game=createGameServer({dbPath:':memory:',catalog,world});const address=await game.listen(0);const base=`http://127.0.0.1:${address.port}/games/penguin-extraction/api`;let cookie;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return {r,b:await r.json()};};
 try{
  const reg=await post('/auth/register',{username:'PackTester',password:'password-good-123'});cookie=reg.r.headers.get('set-cookie').split(';')[0];const user=reg.b.user.id;
  assert.equal(reg.b.profile.packed.find(s=>s.itemId==='ammo-556').quantity,90);
  assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:200})).b.error.code,'INSUFFICIENT_ITEMS');
  assert.equal((await post('/loadout/pack',{itemId:'m416-repaired',quantity:1})).b.error.code,'INVALID_PACK_ITEM');
  assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:-1})).b.error.code,'INVALID_QUANTITY');
  game.db.addInventory(user,'ammo-556',10000);assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:10000})).b.error.code,'OVER_CAPACITY');
  game.db.addInventory(user,'backpack-6',1);await post('/loadout/equip',{slot:'backpack',itemId:'backpack-6'});await post('/loadout/pack',{itemId:'ammo-556',quantity:1000});
  assert.equal((await post('/loadout/equip',{slot:'backpack',itemId:'backpack-1'})).b.error.code,'OVER_CAPACITY');assert.equal(game.db.profile(user).equipped.backpack,'backpack-6');
  assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:40})).b.profile.packed.find(s=>s.itemId==='ammo-556').quantity,40);
  assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:0})).b.profile.packed.some(s=>s.itemId==='ammo-556'),false);
  await post('/loadout/pack',{itemId:'bandage',quantity:3});await post('/shop/sell',{itemId:'bandage',quantity:2});assert.equal(game.db.profile(user).packed.find(s=>s.itemId==='bandage').quantity,1);
  const room=game.manager.createRoom(reg.b.user,'solo');game.manager.rooms.get(room.id).members.get(user).connected=true;const id=game.manager.startRoom(user),raid=game.manager.raids.get(id);
  assert.equal(raid.players.get(user).magazines.primary,0); // Unpacked ammunition in stash must never be brought automatically.
  assert.equal((await post('/loadout/pack',{itemId:'ammo-556',quantity:1})).b.error.code,'RAID_ACTIVE');
  assert.equal((await post('/loadout/equip',{slot:'primary',itemId:null})).b.error.code,'RAID_ACTIVE');
 }finally{await game.close();}
});
