import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_BY_ID as byId, TALENTS, rarityColor, RARITY_COLORS } from '../../shared/catalog.ts';
import { WORLD } from '../../shared/world.ts';
import { rollSupply, rollMapGold, SUPPLY_PACKS } from '../loot.js';
import { GameDatabase } from '../db.js';
import { createGameServer } from '../app.js';

test('all firearm grades use requested colors and gold variants carry functional options',()=>{
 const bases=ITEMS.filter(i=>i.category==='weapon'&&i.quality==='intact');
 assert.equal(bases.length,52);
 for(const base of bases){
  for(const [index,suffix]of ['-broken','-repaired','','-improved','-refined'].entries()){
   const item=byId[base.id+suffix];assert.equal(item.tier,index+1);assert.equal(rarityColor(item),RARITY_COLORS[index]);assert.equal(item.purchasable,true);
  }
  const refined=byId[base.id+'-refined'];
  for(const gold of ITEMS.filter(i=>i.baseId===base.id&&i.quality==='gold')){
   assert.equal(gold.purchasable,false);assert.equal(rarityColor(gold),RARITY_COLORS[6]);assert.ok(gold.optionIds.length>0);
   if(gold.optionIds.includes('precision'))assert.ok(gold.damage>refined.damage);
   if(gold.optionIds.includes('penetration'))assert.ok(gold.penetration>refined.penetration);
   if(gold.optionIds.includes('magazine'))assert.ok(gold.magazine>refined.magazine);
   if(gold.optionIds.includes('reload'))assert.ok(gold.reload<refined.reload);
  }
 }
 for(let lv=1;lv<=6;lv++)assert.equal(rarityColor(byId['armor-'+lv]),RARITY_COLORS[lv-1]);
 assert.equal(byId['armor-gold-lead'].equipmentLevel,6);
 assert.equal(byId['armor-gold-lead'].tier,7);
 assert.ok(byId['backpack-gold-elastic'].capacity>byId['backpack-6'].capacity);
 assert.equal(byId['armor-gold-thick'].goldTraitLevels['armor-thick'],2);
 assert.equal(byId['armor-6-lead'],undefined);
 assert.equal(TALENTS.some(t=>t.id==='radiation-resistance'),false);
});

test('supply and map rewards obey explicit rarity boundaries and eligible pools',()=>{
 const rng=(...values)=>()=>values.shift()??0;
 for(const kind of ['weapon','armor']){
  assert.equal(rollSupply(ITEMS,kind,rng(.019999,0)).quality,'gold');
  const normal=rollSupply(ITEMS,kind,rng(.02,.999999));
  assert.notEqual(normal.quality,'gold');assert.ok(normal.tier>=3&&normal.tier<=5);
 }
 for(const pool of ['rare','military']){
  assert.equal(rollMapGold(ITEMS,{pool,tier:4},rng(.009999,0)).quality,'gold');
  assert.equal(rollMapGold(ITEMS,{pool,tier:4},rng(.01)),null);
 }
 assert.equal(rollMapGold(ITEMS,{pool:'rare',tier:3},rng(0)),null);
 assert.equal(rollMapGold(ITEMS,{pool:'medical',tier:5},rng(0)),null);
});

test('legacy migration converts stash and active escrow, refunds once, and removes radiation training',()=>{
 const db=new GameDatabase(':memory:');
 try{
  const user=db.createUser('Legacy',Buffer.alloc(16),Buffer.alloc(64),[{itemId:'armor-6-lead',quantity:2},{itemId:'armor-6',quantity:1}],{armor:'armor-6-lead'});
  db.db.prepare('INSERT INTO talents VALUES (?,?,?)').run(user.id,'radiation-resistance',1);
  db.beginRaid('old-raid','old-room',[user.id],new Map(),100);
  db.retireLegacyRadiationEquipment();
  const p=db.profile(user.id);
  assert.equal(p.currency,2500+28000+26000);
  assert.equal(p.equipped.armor,'armor-6');assert.equal(p.talents.length,0);
  assert.equal(db.inventoryQuantity(user.id,'armor-6-lead'),0);assert.equal(db.inventoryQuantity(user.id,'armor-6'),2);
  const escrow=JSON.parse(db.db.prepare('SELECT gear_json FROM raid_escrow').get().gear_json);
  assert.equal(escrow[0].itemId,'armor-6');
  db.retireLegacyRadiationEquipment();assert.deepEqual(db.profile(user.id),p);
 }finally{db.close();}
});

test('gold and removed items cannot be bought; supply purchases charge atomically and ignore client reward',async()=>{
 const game=createGameServer({dbPath:':memory:',catalog:{items:ITEMS,talents:TALENTS},world:WORLD});
 const addr=await game.listen(0);const base=`http://127.0.0.1:${addr.port}/games/penguin-extraction/api`;
 let cookie;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const account=await post('/auth/register',{username:'Rarity_Test',password:'correct-horse-99'});cookie=account.cookie;
  const user=account.body.user.id;
  for(const id of ['m416-gold-precision','armor-gold-lead'])assert.equal((await post('/shop/buy',{itemId:id,quantity:1})).body.error?.code,'NOT_FOR_SALE');
  assert.equal((await post('/shop/buy',{itemId:'armor-6-lead',quantity:1})).body.error?.code,'ITEM_NOT_FOUND');
  assert.equal((await post('/talents/unlock',{talentId:'radiation-resistance'})).body.error?.code,'TALENT_NOT_FOUND');
  const before=game.db.profile(user);
  assert.equal((await post('/shop/crate',{kind:'weapon'})).body.error?.code,'INSUFFICIENT_CURRENCY');
  assert.deepEqual(game.db.profile(user),before);
  assert.equal((await post('/shop/crate',{kind:'constructor'})).body.error?.code,'INVALID_PACK');
  game.db.db.prepare('UPDATE users SET currency=? WHERE id=?').run(SUPPLY_PACKS.weapon.price+100000,user);
  const result=await post('/shop/crate',{kind:'weapon',itemId:'armor-gold-lead'});
  assert.equal(result.status,200);assert.equal(result.body.profile.currency,100000);
  assert.equal(byId[result.body.reward.itemId].category,'weapon');
  const prior=before.stash.find(s=>s.itemId===result.body.reward.itemId)?.quantity??0;
  assert.equal(game.db.inventoryQuantity(user,result.body.reward.itemId),prior+1);
 }finally{await game.close();}
});
