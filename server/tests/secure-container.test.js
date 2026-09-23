import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,TALENTS,ITEM_BY_ID} from '../../shared/catalog.ts';
import {SECURE_CAPACITY,inventoryCapacity} from '../../shared/metroInventory.ts';
import {planSecureTransfer} from '../secureContainer.js';
import {GameDatabase} from '../db.js';
import {normalizeCatalog,Raid} from '../game.js';
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const state=(result)=>({inventory:result.nextInventory,reserveAmmo:result.nextReserveAmmo,secure:result.nextSecure,carryCapacity:650});
function actor(){return {inventory:[{itemId:'postcard',quantity:5},{itemId:'armor-6',quantity:1}],reserveAmmo:{'ammo-556':100},secure:[],carryCapacity:650};}
function fixture(){const db=new GameDatabase(':memory:');const user=db.createUser('Secure_Test',Buffer.from('salt'),Buffer.from('hash'),[{itemId:'postcard',quantity:5},{itemId:'ammo-556',quantity:400},{itemId:'armor-6',quantity:1}]);return{db,id:user.id};}

test('Metro equipment weights, capacity additions, and all sale items use inventory units',()=>{
 assert.equal(SECURE_CAPACITY,40);
 for(const i of ITEMS.filter(i=>i.category==='valuable'))assert.equal(i.weight,i.id==='full-cash-crate'?.02:10,i.id);
 for(const category of ['armor','helmet'])for(let lv=1;lv<=6;lv++)assert.equal(ITEM_BY_ID[`${category}-${lv}`].weight,[30,30,40,40,60,80][lv-1]);
 for(let lv=1;lv<=6;lv++){assert.equal(ITEM_BY_ID[`backpack-${lv}`].weight,[50,50,60,60,80,100][lv-1]);assert.equal(ITEM_BY_ID[`backpack-${lv}`].capacity,[150,200,250,300,400,500][lv-1]);}
 assert.equal(ITEM_BY_ID['armor-gold-lead'].weight,80);
 assert.equal(ITEM_BY_ID['backpack-gold-elastic'].capacity,550);
 assert.equal(inventoryCapacity(500,5,10),665);
 assert.ok(ITEMS.every(i=>Number.isFinite(i.weight)&&i.weight>0));
});
test('four valuables exactly fit; fifth and level-6 armor are rejected without mutation',()=>{
 const original=actor(),copy=structuredClone(original),full=state(planSecureTransfer(original,'postcard',4,'deposit',catalog));
 assert.deepEqual(original,copy);assert.equal(full.secure[0].quantity,4);
 assert.throws(()=>planSecureTransfer(full,'postcard',1,'deposit',catalog),{code:'SECURE_OVER_CAPACITY'});
 assert.throws(()=>planSecureTransfer(original,'armor-6',1,'deposit',catalog),{code:'SECURE_OVER_CAPACITY'});
});
test('ammo transfers use per-round weight and exact source quantities',()=>{
 const first=state(planSecureTransfer(actor(),'postcard',3,'deposit',catalog));
 const full=state(planSecureTransfer(first,'ammo-556',20,'deposit',catalog));
 assert.equal(full.reserveAmmo['ammo-556'],80);
 assert.throws(()=>planSecureTransfer(full,'ammo-556',1,'deposit',catalog),{code:'SECURE_OVER_CAPACITY'});
 const back=state(planSecureTransfer(full,'ammo-556',4,'withdraw',catalog));
 assert.equal(back.reserveAmmo['ammo-556'],84);assert.equal(back.secure.find(i=>i.itemId==='ammo-556').quantity,16);
 assert.throws(()=>planSecureTransfer({...back,carryCapacity:0},'ammo-556',1,'withdraw',catalog),{code:'OVER_CAPACITY'});
});
test('capacity permits five distinct light stacks; no hidden four-type limit',()=>{
 const ids=['ammo-9','ammo-45','ammo-556','ammo-762','ammo-57'];let p={...actor(),reserveAmmo:Object.fromEntries(ids.map(id=>[id,1]))};
 for(const id of ids)p=state(planSecureTransfer(p,id,1,'deposit',catalog));
 assert.equal(p.secure.length,5);
 for(const n of [0,-1,1.5,NaN,Infinity,10001])assert.throws(()=>planSecureTransfer(actor(),'postcard',n,'deposit',catalog),{code:'INVALID_QUANTITY'});
 assert.throws(()=>planSecureTransfer(actor(),'missing',1,'deposit',catalog),{code:'ITEM_NOT_FOUND'});
 assert.throws(()=>planSecureTransfer(actor(),'postcard',1,'else',catalog),{code:'INVALID_DIRECTION'});
 assert.throws(()=>planSecureTransfer({...actor(),inventory:[],gear:{armor:'armor-6'}},'armor-6',1,'deposit',catalog),{code:'INSUFFICIENT_ITEMS'});
});
test('preparation reserves actual stash items and matches raid capacity',()=>{
 const {db,id}=fixture();try{
  db.secure(id,'postcard',4,catalog);assert.throws(()=>db.secure(id,'postcard',5,catalog),{code:'SECURE_OVER_CAPACITY'});
  db.secure(id,'postcard',0,catalog);db.secure(id,'ammo-556',80,catalog);
  assert.throws(()=>db.pack(id,'ammo-556',321,catalog),{code:'INSUFFICIENT_ITEMS'});
  db.pack(id,'ammo-556',300,catalog);assert.equal(db.profile(id).secureCapacity,40);
  assert.throws(()=>db.pack(id,'ammo-556',301,catalog),{code:'OVER_CAPACITY'});
  const raid=new Raid({id:'capacity',room:{mode:'solo',members:new Map([[id,{username:'t'}]])},escrow:[{userId:id,gear:[]}],db,catalog,world:{size:50,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[]},now:()=>1000,emit(){}});
  assert.equal(raid.players.get(id).carryCapacity,db.packedCapacity(db.profile(id),catalog));
 }finally{db.close();}
});
for(const outcome of ['dead','extracted'])test(`secure refund survives ${outcome} exactly once`,()=>{
 const {db,id}=fixture();try{
  db.secure(id,'postcard',4,catalog);db.beginRaid('r','room',[id]);assert.equal(db.inventoryQuantity(id,'postcard'),1);
  assert.equal(db.settleRaidPlayer('r',id,outcome).applied,true);assert.equal(db.inventoryQuantity(id,'postcard'),5);assert.equal(db.profile(id).securePacked.length,0);
  assert.equal(db.settleRaidPlayer('r',id,outcome).applied,false);assert.equal(db.inventoryQuantity(id,'postcard'),5);
 }finally{db.close();}
});
test('durable deposit and withdrawal survive interrupted raid recovery without duplication',()=>{
 const {db,id}=fixture();try{
  db.secure(id,'postcard',1,catalog);db.beginRaid('r','room',[id]);
  db.updateRaidSecure('r',id,[{itemId:'postcard',quantity:1}],[{itemId:'postcard',quantity:3}]);
  assert.equal(db.recoverActiveRaids(),1);assert.equal(db.inventoryQuantity(id,'postcard'),7);
  assert.equal(db.recoverActiveRaids(),0);assert.equal(db.inventoryQuantity(id,'postcard'),7);
  assert.throws(()=>db.updateRaidSecure('r',id,[],[]),{code:'ESCROW_MISSING'});
 }finally{db.close();}
});

test('legacy overweight plans can be reduced without destroying owned items',()=>{
 const {db,id}=fixture();try{
  db.db.prepare('INSERT INTO secure_packed VALUES (?,?,?)').run(id,'postcard',5);
  db.db.prepare('INSERT INTO secure_packed VALUES (?,?,?)').run(id,'armor-6',1);
  db.secure(id,'postcard',0,catalog);assert.equal(db.inventoryQuantity(id,'postcard'),5);
  db.secure(id,'armor-6',0,catalog);assert.equal(db.profile(id).securePacked.length,0);
 }finally{db.close();}
});

test('failed secure persistence leaves the running player unchanged',()=>{
 const {db,id}=fixture();try{
  const raid=new Raid({id:'missing-escrow',room:{mode:'solo',members:new Map([[id,{username:'t'}]])},escrow:[{userId:id,gear:[]}],db,catalog,world:{size:50,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[]},now:()=>1000,emit(){}});
  const p=raid.players.get(id);p.inventory=[{itemId:'postcard',quantity:4}];
  assert.throws(()=>raid.transferSecure(p,'postcard',4,'deposit'),{code:'ESCROW_MISSING'});
  assert.deepEqual(p.inventory,[{itemId:'postcard',quantity:4}]);assert.deepEqual(p.secure,[]);
 }finally{db.close();}
});

test('authenticated secure route enforces capacity; raid intent persists and death returns only protected loot',async()=>{
 const {createGameServer}=await import('../app.js');
 const world={size:50,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[]};
 const game=createGameServer({dbPath:':memory:',catalog:{items:ITEMS,talents:TALENTS},world});const address=await game.listen(0);
 let cookie;const post=async(path,body)=>{const response=await fetch(`http://127.0.0.1:${address.port}/games/penguin-extraction/api${path}`,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return{response,data:await response.json()};};
 try{
  assert.equal((await post('/loadout/secure',{itemId:'postcard',quantity:1})).response.status,401);
  const reg=await post('/auth/register',{username:'Secure_Api',password:'test-password-only'});cookie=reg.response.headers.get('set-cookie').split(';')[0];const user=reg.data.user;
  game.db.addInventory(user.id,'postcard',5);
  assert.equal((await post('/loadout/secure',{itemId:'postcard',quantity:4})).data.profile.secureCapacity,40);
  assert.equal((await post('/loadout/secure',{itemId:'postcard',quantity:5})).data.error.code,'SECURE_OVER_CAPACITY');
  const room=game.manager.createRoom(user,'solo');game.manager.rooms.get(room.id).members.get(user.id).connected=true;
  const raid=game.manager.raids.get(game.manager.startRoom(user.id)),p=raid.players.get(user.id);
  raid.transferSecure(p,'postcard',1,'withdraw');assert.equal(p.secure[0].quantity,3);assert.equal(p.inventory.find(s=>s.itemId==='postcard').quantity,1);
  assert.equal((await post('/loadout/secure',{itemId:'postcard',quantity:0})).data.error.code,'RAID_ACTIVE');
  raid.killPlayer(p,'test',Date.now());assert.equal(game.db.inventoryQuantity(user.id,'postcard'),4);
  assert.equal(raid.snapshot(Date.now(),user.id).players.find(q=>q.id===user.id).secureCapacity,40);
 }finally{await game.close();}
});

test('user-defined gun and attachment weights apply to all qualities and fitted equipment exactly once',async()=>{
 const {equipmentWeights}=await import('../../shared/metroInventory.ts');
 for(const i of ITEMS.filter(i=>i.category==='weapon'&&i.mode!=='melee')){const family=(i.family??'').toUpperCase();assert.equal(i.weight,family==='PISTOL'||family==='HG'?75:family==='DMR'||family==='SR'?150:100,i.id);}
 for(const i of ITEMS.filter(i=>i.category==='attachment'))assert.equal(i.weight,(i.baseId??i.id)==='lead-lined-fabric'?50:15,i.id);
 const equipped={primary:'m416',secondary:'mk14',scope:'red-dot',barrel:'suppressor',grip:'vertical-grip',magazine:'extended-mag',armor:'armor-6',vest:'lead-lined-fabric'};
 const lookup=id=>ITEM_BY_ID[id];const a=equipmentWeights(equipped,lookup);
 assert.equal(a.bySlot.primary,160);assert.equal(a.bySlot.secondary,150);assert.equal(a.bySlot.armor,130);assert.equal(a.total,440);
 assert.equal(Object.values(a.bySlot).reduce((n,v)=>n+v,0),a.total);
 const switched=equipmentWeights(equipped,lookup,'secondary');assert.equal(switched.bySlot.secondary,150);assert.equal(switched.bySlot.primary,160);assert.equal(switched.total,a.total);
 const removed=equipmentWeights({...equipped,barrel:null,vest:null},lookup);assert.equal(removed.bySlot.primary,145);assert.equal(removed.bySlot.armor,80);assert.equal(removed.total,375);
 const loose=equipmentWeights({scope:'red-dot',vest:'lead-lined-fabric'},lookup);assert.equal(loose.total,65);assert.equal(loose.bySlot.scope,15);assert.equal(loose.bySlot.vest,50);
});

test('full cash crates fit 500 units in ten capacity and keep 500 unit sale price',()=>{const cash=ITEM_BY_ID['full-cash-crate'];assert.equal(cash.weight,.02);assert.equal(cash.sell,500);assert.equal(cash.weight*500,10);});
