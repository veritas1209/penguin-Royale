import test from 'node:test';
import assert from 'node:assert/strict';
import {GameDatabase} from '../db.js';
import {ITEMS,materializeGoldItem} from '../../shared/catalog.ts';

const catalog={items:ITEMS,byId:new Map(ITEMS.map(i=>[i.id,i])),talents:[]};
const sequence=values=>{let index=0;return()=>values[Math.min(index++,values.length-1)]??.99;};
function fixture(values=[.1,.9,0,.1],goldItem=null){
 const db=new GameDatabase(':memory:',{upgradeRandom:sequence(values)});db.instanceCatalog=catalog.byId;
 const gold=goldItem??ITEMS.find(i=>i.quality==='gold'&&i.category==='weapon'&&Object.keys(i.goldTraitLevels??{}).length===1&&Object.values(i.goldTraitLevels??{})[0]===1);
 const user=db.createUser('gold-user',Buffer.from('s'),Buffer.from('h'),[{itemId:gold.id,quantity:1},{itemId:'gold-upgrade-part',quantity:2},{itemId:'gold-bar',quantity:2},{itemId:'password-letter-red',quantity:1}],{});
 return{db,user,gold};
}
function upgrade(values,goldItem=null){
 const state=fixture(values,goldItem);
 const instance=state.db.profile(state.user.id).instances.find(i=>i.itemId===state.gold.id);
 return{...state,instance,result:state.db.upgradeGold(state.user.id,state.gold.id,instance.id,catalog)};
}

test('gold names are normalized and one instance stores independent add and level results',()=>{
 assert.ok(ITEMS.some(i=>i.id==='gold-upgrade-part'));
 for(const item of ITEMS.filter(i=>i.quality==='gold')){assert.match(item.name,/\[골드\]$/);assert.doesNotMatch(item.name,/Lv\./);}
 const {db,user,instance,result}=upgrade([.1,.4,0,0,.9]);
 try{
  assert.equal(result.outcome,'added_and_leveled');
  assert.equal(result.afterTraits[result.addedTrait],3);
  assert.equal(result.leveledTraits.length,1);
  const stored=db.profile(user.id).instances.find(i=>i.id===instance.id);
  assert.equal(stored.itemId,result.itemId);
  assert.deepEqual(stored.goldTraitLevels,result.afterTraits);
  const effective=materializeGoldItem(catalog.byId.get(stored.itemId),stored.goldTraitLevels);
  assert.deepEqual(effective.goldTraitLevels,result.afterTraits);
 }finally{db.close();}
});

test('new trait uses independent level odds at 50, 30, and 20 percent boundaries',()=>{
 for(const [levelRoll,expected] of [[0,1],[.499999,1],[.5,2],[.799999,2],[.8,3],[.999999,3]]){
  const {db,result}=upgrade([.1,.9,0,levelRoll]);
  try{assert.equal(result.outcome,'added');assert.equal(result.afterTraits[result.addedTrait],expected);}
  finally{db.close();}
 }
});

test('15 percent add and 50 percent level rolls use strict independent boundaries',()=>{
 const {db,result}=upgrade([.15,.5]);
 try{assert.equal(result.outcome,'unchanged');assert.equal(result.addedTrait,null);assert.deepEqual(result.leveledTraits,[]);}
 finally{db.close();}
});

test('gold equipment never adds a fifth trait',()=>{
 const four=ITEMS.find(i=>i.quality==='gold'&&i.category==='weapon'&&Object.keys(i.goldTraitLevels??{}).length===4&&Object.values(i.goldTraitLevels??{}).some(level=>level<3));
 const {db,result}=upgrade([0,.99],four);
 try{assert.equal(result.outcome,'unchanged');assert.equal(Object.keys(result.afterTraits).length,4);}
 finally{db.close();}
});

test('dismantle removes only the gold body and yields one part',()=>{
 const {db,user,gold}=fixture();try{const before=db.inventoryQuantity(user.id,'gold-upgrade-part'),instance=db.profile(user.id).instances.find(i=>i.itemId===gold.id);db.dismantleGold(user.id,gold.id,instance.id,catalog);assert.equal(db.inventoryQuantity(user.id,gold.id),0);assert.equal(db.inventoryQuantity(user.id,'gold-upgrade-part'),before+1);}finally{db.close();}
});

test('bulk collectible sale excludes password letters and upgrade parts',()=>{
 const {db,user}=fixture();try{const result=db.sellCollectibles(user.id,catalog,0);assert.equal(result.sold,2);assert.equal(db.inventoryQuantity(user.id,'password-letter-red'),1);assert.equal(db.inventoryQuantity(user.id,'gold-upgrade-part'),2);assert.equal(db.inventoryQuantity(user.id,'gold-bar'),0);}finally{db.close();}
});
