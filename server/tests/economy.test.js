import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID as byId,TALENTS} from '../../shared/catalog.ts';
import {getMetroMapLootWeight,METRO_PRICE_EVIDENCE} from '../../shared/metroEconomy.ts';
import {WORLD} from '../../shared/world.ts';
import {Raid,normalizeCatalog} from '../game.js';
import {SUPPLY_PACKS} from '../loot.js';

test('sourced Metro prices and save aliases are visible in final catalog',()=>{
 for(const [id,e]of Object.entries(METRO_PRICE_EVIDENCE)){if(e.price!==undefined)assert.equal(byId[id].price,e.price);if(e.sell!==undefined)assert.equal(byId[id].sell,e.sell);}
 assert.equal(byId['gold-bar'].sell,200000);assert.equal(byId.cpu.sell,13200);assert.equal(byId['graphics-card'].sell,128000);assert.equal(byId['water-filter'].sell,12000);
 assert.equal(ITEMS.filter(i=>i.id==='cpu').length,1);assert.equal(byId['cpu-processor'],undefined);
 assert.equal(byId['armor-gold-lead'].purchasable,false);assert.equal(byId['armor-gold-lead'].price,0);
 const normalGear=ITEMS.filter(i=>['armor','helmet','backpack'].includes(i.category)&&i.tier>=3&&i.tier<=5&&i.quality!=='gold');
 assert.ok(normalGear.every(i=>i.sell*1.25<SUPPLY_PACKS.armor.price),'ordinary supply outcomes must not guarantee instant resale profit');
});

test('backpack resale follows the equipment bands and gold variants derive from level-6 resale',()=>{
 const expected=[2700,7200,22500,45000,81000,121500];
 for(let level=1;level<=6;level++){
  const item=byId[`backpack-${level}`];
  assert.equal(item.sell,expected[level-1],`backpack-${level} sell`);
  assert.equal(METRO_PRICE_EVIDENCE[`backpack-${level}`].sell,expected[level-1]);
 }
 const base=byId['backpack-6'].sell;
 for(const trait of ['elastic','encryption','advanced-elastic','advanced-encryption','first-aid','module-search']){
  for(let level=1;level<=3;level++)assert.equal(byId[`backpack-gold-${trait}-l${level}`].sell,Math.round(base*(1.6+level*.2)),`gold ${trait} Lv.${level}`);
 }
 assert.equal(byId['backpack-gold-elastic'].sell,Math.round(base*1.8));
 assert.equal(byId['backpack-gold-advanced-elastic'].sell,Math.round(base*1.8));
});

test('map valuables exclude PvP trophies and unknown originals; exceptional loot needs radiation',()=>{
 for(const id of ['dog-tag','camera','old-radio','scrap','antique'])assert.equal(getMetroMapLootWeight(byId[id],{nodeTier:5,radiationZone:true}),0);
 assert.equal(getMetroMapLootWeight(byId['gold-brick'],{nodeTier:5,radiationZone:false}),0);
 assert.ok(getMetroMapLootWeight(byId['gold-brick'],{nodeTier:5,radiationZone:true})>0);
 assert.ok(getMetroMapLootWeight(byId['portable-microscope'],{nodeTier:5,radiationZone:true})<getMetroMapLootWeight(byId['gold-bar'],{nodeTier:5,radiationZone:true}));
 assert.equal(getMetroMapLootWeight(byId['gold-bar'],{nodeTier:2}),0);
 const raid=new Raid({id:'economy-map',room:{mode:'solo',members:new Map()},escrow:[],db:{},catalog:normalizeCatalog({items:ITEMS,talents:TALENTS}),world:WORLD,now:()=>1000,emit(){}});
 assert.ok(raid.containers.size>100);
 for(const container of raid.containers.values())for(const stack of container.items){
  const loot={...stack,id:container.id};
  const item=byId[loot.itemId];assert.ok(item);
  if(item.category!=='valuable')continue;
  const spawn=WORLD.lootSpawns.find(s=>s.id===loot.id);
  if(spawn.pool==='documents'){assert.equal(stack.quantity,1);assert.ok(['metro-2036','old-video-tape','torn-map','torn-blueprint','precision-blueprint','top-secret-intelligence','password-letter-white','password-letter-green','password-letter-yellow','password-letter-red','password-letter-black'].includes(item.id),'document cabinet explicit pool: '+item.id);continue;}
  const radiationZone=WORLD.radiationZones.some(z=>Math.hypot(spawn.x-z.x,spawn.z-z.z)<=z.radius);
  assert.ok(getMetroMapLootWeight(item,{nodeTier:radiationZone?Math.max(6,spawn.tier):spawn.tier,radiationZone})>0,loot.itemId);
 }
});

