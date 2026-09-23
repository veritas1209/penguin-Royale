import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID,TALENTS} from '../../shared/catalog.ts';
import {applyMetroEconomy,getMetroWeaponPriceEstimate,METRO_PRICE_EVIDENCE,METRO_WEAPON_REFINED_ANCHORS,METRO_WEAPON_VALUE_OBSERVATIONS} from '../../shared/metroEconomy.ts';
import {normalizeCatalog} from '../game.js';

test('all existing ordinary ranged weapon qualities use explicit model estimates',()=>{
 const firearms=ITEMS.filter(item=>getMetroWeaponPriceEstimate(item));
 assert.equal(Object.keys(METRO_WEAPON_REFINED_ANCHORS).length,52);
 assert.equal(firearms.length,260);
 for(const item of firearms){
  const estimate=getMetroWeaponPriceEstimate(item);
  assert.equal(estimate.certainty,'estimated');assert.equal(estimate.source,'project-metro-scale-estimate');
  assert.equal(item.price,estimate.price);assert.equal(item.sell,estimate.sell);
  assert.ok(Number.isSafeInteger(item.price)&&item.price>item.sell&&item.sell>0,item.id);
 }
 assert.equal(ITEM_BY_ID['mk14-refined'].price,900000);assert.equal(ITEM_BY_ID['lynx-amr-refined'].price,1400000);
 assert.notEqual(ITEM_BY_ID.akm.price/ITEM_BY_ID['akm-refined'].price,ITEM_BY_ID.mg3.price/ITEM_BY_ID['mg3-refined'].price,'families must not collapse into a universal multiplier');
});

test('inventory observations are not interpreted as verified trade quotes',()=>{
 assert.equal(METRO_WEAPON_VALUE_OBSERVATIONS[0].inventoryValue,222000);
 assert.equal(METRO_WEAPON_VALUE_OBSERVATIONS[1].quality,'gold-steel');
 assert.ok(METRO_WEAPON_VALUE_OBSERVATIONS.every(entry=>entry.tradePriceVerified===false&&!('price' in entry)&&!('sell' in entry)));
 assert.equal(METRO_PRICE_EVIDENCE['mg3-cobra'],undefined);assert.equal(METRO_PRICE_EVIDENCE['famas-steel'],undefined);
 assert.equal(getMetroWeaponPriceEstimate({id:'unknown',category:'weapon',baseId:'unknown',quality:'refined',family:'AR'}),undefined);
});

test('exact evidence retains precedence, unrelated trade records stay unchanged, estimates are idempotent',()=>{
 const copies=[{...ITEM_BY_ID.akm,price:1,sell:1},{...ITEM_BY_ID['helmet-6'],price:1,sell:1},{id:'unmatched-medical',name:'test',category:'medical',price:1234,sell:123,weight:1,tier:1,description:''}];
 applyMetroEconomy(copies);const first=copies.map(item=>[item.id,item.price,item.sell]);applyMetroEconomy(copies);
 assert.deepEqual(copies.map(item=>[item.id,item.price,item.sell]),first);
 assert.equal(copies.find(item=>item.id==='helmet-6').price,750000);assert.equal(copies.find(item=>item.id==='helmet-6').sell,150000);
 assert.equal(copies.find(item=>item.id==='unmatched-medical').price,1234);assert.equal(copies.find(item=>item.id==='unmatched-medical').sell,123);
});

test('server catalog and gold loot resale inherit the same final firearm economy',()=>{
 const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
 for(const item of ITEMS.filter(item=>item.category==='weapon'&&METRO_WEAPON_REFINED_ANCHORS[item.baseId??item.id])){
  assert.equal(catalog.byId.get(item.id).sell,item.sell);assert.equal(catalog.byId.get(item.id).price,item.price);
  if(item.quality==='gold'){
   assert.equal(item.purchasable,false);assert.equal(item.price,0);
   assert.equal(item.sell,Math.round(ITEM_BY_ID[item.baseId+'-refined'].sell*1.8));
  }
 }
});
