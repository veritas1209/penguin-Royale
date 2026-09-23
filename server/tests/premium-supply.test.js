import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,TALENTS,ITEM_BY_ID} from '../../shared/catalog.ts';
import {SUPPLY_PACKS} from '../../shared/supplyPacks.ts';
import {rollSupply} from '../loot.js';
import {createGameServer} from '../app.js';
import {WORLD} from '../../shared/world.ts';
const rng=(...values)=>()=>values.shift()??0;
test('premium crates use exact 50 percent gold boundary and upper normal pools',()=>{
 for(const kind of ['premium-armor','premium-weapon']){
  const p=SUPPLY_PACKS[kind];assert.equal(p.goldChance,.5);
  assert.equal(p.price,kind==='premium-armor'?2000000:1600000);
  for(const index of [0,.5,.999999]){
   assert.equal(rollSupply(ITEMS,kind,rng(.499999,index)).quality,'gold');
   const item=rollSupply(ITEMS,kind,rng(.5,index));assert.notEqual(item.quality,'gold');
   assert.ok(item.tier>=p.minTier&&item.tier<=p.maxTier);
   assert.ok(p.category==='weapon'?item.category==='weapon':['armor','helmet','backpack'].includes(item.category));
   assert.notEqual(item.mode,'flare');
  }
 }
});
test('premium purchases authenticate, debit atomically and produce independent owned instances',async()=>{
 const game=createGameServer({dbPath:':memory:',catalog:{items:ITEMS,talents:TALENTS},world:WORLD});
 const addr=await game.listen(0),base=`http://127.0.0.1:${addr.port}/games/penguin-extraction/api`;
 let cookie;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  assert.equal((await post('/shop/crate',{kind:'premium-armor'})).status,401);
  const account=await post('/auth/register',{username:'Premium_Crates_Test',password:'correct-horse-99'});cookie=account.cookie;const user=account.body.user.id;
  const before=game.db.profile(user);
  assert.equal((await post('/shop/crate',{kind:'premium-armor'})).body.error.code,'INSUFFICIENT_CURRENCY');
  assert.deepEqual(game.db.profile(user),before);
  game.db.db.prepare('UPDATE users SET currency=? WHERE id=?').run(3600100,user);
  for(const kind of ['premium-armor','premium-weapon']){
   const prior=game.db.profile(user),oldIds=new Set(game.db.instanceRows(user).map(r=>r.id)),result=await post('/shop/crate',{kind,itemId:'signal-flare',price:1,goldChance:1});
   assert.equal(result.status,200);assert.equal(result.body.profile.currency,prior.currency-SUPPLY_PACKS[kind].price);
   const item=ITEM_BY_ID[result.body.reward.itemId];assert.ok(item);assert.notEqual(item.mode,'flare');
   assert.ok(SUPPLY_PACKS[kind].category==='weapon'?item.category==='weapon':['armor','helmet','backpack'].includes(item.category));
   assert.equal(game.db.inventoryQuantity(user,item.id),(prior.stash.find(s=>s.itemId===item.id)?.quantity??0)+1);
   assert.ok(game.db.instanceRows(user).some(r=>r.itemId===item.id&&!oldIds.has(r.id)));
  }
  assert.equal(game.db.profile(user).currency,100);
 }finally{await game.close();}
});


test('premium armor normal pool is exclusively Lv6 including both faction variants',()=>{
 const eligible=ITEMS.filter(i=>['armor','helmet','backpack'].includes(i.category)&&i.quality!=='gold'&&i.tier===6);
 assert.equal(SUPPLY_PACKS['premium-armor'].minTier,6);assert.equal(SUPPLY_PACKS['premium-armor'].maxTier,6);
 for(let n=0;n<eligible.length;n++)assert.equal(rollSupply(ITEMS,'premium-armor',rng(.5,(n+.1)/eligible.length)).id,eligible[n].id);
 for(const variant of ['one-eyed-snake','steel-front'])for(const category of ['armor','helmet'])assert.ok(eligible.some(i=>i.id===`${category}-6-${variant}`));
});

test('premium weapon normal result is always refined while gold remains exactly fifty percent',()=>{
 const pack=SUPPLY_PACKS['premium-weapon'];assert.equal(pack.minTier,5);assert.equal(pack.maxTier,5);assert.equal(pack.goldChance,.5);
 for(const index of [0,.25,.5,.75,.999999]){
  const gold=rollSupply(ITEMS,'premium-weapon',rng(.499999,index));assert.equal(gold.quality,'gold');
  const normal=rollSupply(ITEMS,'premium-weapon',rng(.5,index));assert.equal(normal.quality,'refined');assert.equal(normal.tier,5);
 }
});
