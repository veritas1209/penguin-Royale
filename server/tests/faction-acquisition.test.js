import test from 'node:test';import assert from 'node:assert/strict';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';
import {isFactionArmor,isDirectShopItem} from '../../shared/shopAvailability.ts';
import {rollSupply,rollMapGold,SUPPLY_PACKS} from '../loot.js';
import {createGameServer} from '../app.js';import {Raid,normalizeCatalog} from '../game.js';import {enemyRewardStacks} from '../bosses.js';
const factions=ITEMS.filter(isFactionArmor),rng=(a,b)=>{let n=0;return ()=>n++?b:a;};

test('all faction armor/helmet levels and gold options remain catalogued but are never direct shop items',()=>{
 assert.ok(factions.length>12);
 for(const variant of ['one-eyed-snake','steel-front'])for(const category of ['armor','helmet'])for(const level of [4,5,6])assert.ok(factions.some(i=>i.armorVariant===variant&&i.category===category&&i.equipmentLevel===level&&i.quality!=='gold'));
 for(const i of factions){assert.equal(i.purchasable,false);assert.equal(isDirectShopItem(i),false);assert.equal(isDirectShopItem({...i,purchasable:true}),false);assert.equal(i.acquisition,'월드 드랍 · 고급 방어구 상자');assert.ok(i.sell>0);}
 assert.equal(isDirectShopItem(ITEMS.find(i=>i.id==='armor-4')),true);
});

test('ordinary crates exclude every faction including gold; premium armor keeps Lv6/50 percent and all faction eligibility',()=>{
 for(const [kind,pack]of Object.entries(SUPPLY_PACKS))for(const gold of [false,true]){
  const expected=ITEMS.filter(i=>i.id!=='signal-flare'&&i.baseId!=='signal-flare'&&i.mode!=='flare'&&(pack.category==='weapon'?i.category==='weapon'&&!!i.baseId:['armor','helmet','backpack'].includes(i.category))&&(!isFactionArmor(i)||kind==='premium-armor')&&(gold?i.quality==='gold'&&Object.keys(i.goldTraitLevels??{}).length<=4&&!i.id.includes('-gold-levels-'):i.quality!=='gold'&&i.tier>=pack.minTier&&i.tier<=pack.maxTier));
  for(let index=0;index<expected.length;index++){const actual=rollSupply(ITEMS,kind,rng(gold?0:pack.goldChance,(index+.1)/expected.length));assert.equal(actual.id,expected[index].id);if(kind!=='premium-armor')assert.equal(isFactionArmor(actual),false);}
 }
 assert.equal(SUPPLY_PACKS['premium-armor'].price,2000000);assert.equal(SUPPLY_PACKS['premium-armor'].goldChance,.5);assert.equal(SUPPLY_PACKS['premium-armor'].minTier,6);assert.equal(SUPPLY_PACKS['premium-armor'].maxTier,6);
 const normals=ITEMS.filter(i=>['armor','helmet','backpack'].includes(i.category)&&i.quality!=='gold'&&i.tier===6);for(const i of factions.filter(i=>i.quality!=='gold'&&i.tier===6))assert.ok(normals.some(n=>n.id===i.id));
});

test('faction armor is still obtainable from level-appropriate military map loot and boss rewards',()=>{
 for(const item of factions){
  const catalog=normalizeCatalog({items:[item],talents:[]});
  if(item.quality==='gold'){assert.equal(rollMapGold([item],{pool:'military',tier:5},()=>0).id,item.id);continue;}
  const world={size:100,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[{id:'military-drop',x:10,z:10,pool:'military',tier:item.tier-1}],extractions:[],radiationZones:[]};
  const raid=new Raid({id:'acquisition',room:{mode:'solo',members:new Map()},escrow:[],db:{},catalog,world,now:()=>1000,emit(){}});assert.equal(raid.containers.get('military-drop').items[0].itemId,item.id);
  if(item.tier===6){
 const boss={
  id:'boss-'+item.id,
  kind:'heavy',
  bossId:'boss',
  weaponId:'mk14-refined',
  helmetId:
   item.category==='helmet'
    ?item.id
    :'helmet-5',
  armorId:
   item.category==='armor'
    ?item.id
    :'armor-5',
  backpackId:'backpack-5',
  medicalUses:0
 };

 assert.ok(
  enemyRewardStacks(
   catalog,
   boss,
   0
  ).some(stack=>
   stack.itemId===item.id
  )
 );
};
 }
});

test('authenticated direct buy rejects all factions while owned faction equipment can equip and sell',async()=>{
 const game=createGameServer({dbPath:':memory:',rateLimitMax:factions.length+20,catalog:{items:ITEMS,talents:TALENTS},world:{size:100,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[],radiationZones:[]}});const addr=await game.listen(0),base=`http://127.0.0.1:${addr.port}/games/penguin-extraction/api`;let cookie;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const account=await post('/auth/register',{username:'Faction_Acquisition',password:'correct-horse-99'});cookie=account.cookie;const id=account.body.user.id;game.db.db.prepare('UPDATE users SET currency=? WHERE id=?').run(10000000,id);const before=game.db.profile(id);
  for(const item of factions){const response=await post('/shop/buy',{itemId:item.id,quantity:1,purchasable:true,price:1});assert.equal(response.body.error.code,'NOT_FOR_SALE');}
  assert.deepEqual(game.db.profile(id),before);
  const item=factions.find(i=>i.category==='armor'&&i.tier===4);game.db.addInventory(id,item.id,1);assert.equal((await post('/loadout/equip',{slot:'armor',itemId:item.id})).status,200);assert.equal(game.db.profile(id).equipped.armor,item.id);assert.equal((await post('/loadout/equip',{slot:'armor',itemId:null})).status,200);assert.equal((await post('/shop/sell',{itemId:item.id,quantity:1})).status,200);assert.equal(game.db.inventoryQuantity(id,item.id),0);
 }finally{await game.close();}
});