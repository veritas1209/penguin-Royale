import test from 'node:test';
import assert from 'node:assert/strict';
import {GameDatabase} from '../db.js';

test('removed durability gold weapons migrate to same-level smart sight weapons exactly once',()=>{
 const db=new GameDatabase(':memory:');
 try{
  const old='mk14-gold-durable-l2',target='mk14-gold-smart-l2';
  const user=db.createUser('durability_migration',Buffer.alloc(16),Buffer.alloc(32),[{itemId:old,quantity:1}],{primary:old});
  db.db.prepare("INSERT INTO item_instances VALUES(?,?,?,'{}','equipped','primary')").run('legacy-host',user.id,old);
  db.db.prepare('INSERT INTO packed VALUES(?,?,?)').run(user.id,old,1);
  db.retireDurabilityGoldWeapons();
  assert.equal(db.inventoryQuantity(user.id,old),0);
  assert.equal(db.inventoryQuantity(user.id,target),1);
  assert.equal(db.db.prepare("SELECT item_id FROM equipped WHERE user_id=? AND slot='primary'").get(user.id).item_id,target);
  assert.equal(db.db.prepare("SELECT item_id FROM item_instances WHERE id='legacy-host'").get().item_id,target);
  assert.equal(db.db.prepare('SELECT item_id FROM packed WHERE user_id=?').get(user.id).item_id,target);
  db.retireDurabilityGoldWeapons();
  assert.equal(db.inventoryQuantity(user.id,target),1);
 }finally{db.close();}
});
