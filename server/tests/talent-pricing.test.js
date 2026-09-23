import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TALENTS } from '../../shared/catalog.ts';
import {talentUpgradeCost} from '../../shared/talents.ts';
import { WORLD } from '../../shared/world.ts';
import { createGameServer } from '../app.js';

const prices=[50000,100000,200000,400000,800000];
test('all six talents use the same five upgrade prices',()=>{
 assert.equal(TALENTS.length,6);
 for(const talent of TALENTS){
  assert.equal(talent.baseCost,50000);assert.deepEqual(talent.levelCosts,prices);
  assert.deepEqual([0,1,2,3,4].map(level=>talentUpgradeCost(talent,level)),prices);
  assert.equal(talentUpgradeCost(talent,5),0);
 }
});

test('talent API charges catalog prices at every existing level and rejects underfunded or forged cheap purchases atomically',async()=>{
 const game=createGameServer({dbPath:':memory:',catalog:{items:ITEMS,talents:TALENTS},world:WORLD});
 const address=await game.listen(0);let cookie;
 const request=async(path,body)=>{
  const response=await fetch(`http://127.0.0.1:${address.port}/games/penguin-extraction/api${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  cookie??=response.headers.get('set-cookie')?.split(';')[0];
  return {status:response.status,body:await response.json()};
 };
 try{
  const account=await request('/auth/register',{username:'Talent_Price',password:'correct-horse-99'});
  const id=account.body.user.id;
  const published=await request('/catalog');
  for(const t of published.body.talents)assert.deepEqual(t.levelCosts,prices);
  // Model a returning player: preserve all six saved levels before any purchases.
  for(const t of TALENTS)game.db.db.prepare('INSERT INTO talents(user_id,talent_id,level) VALUES(?,?,?)').run(id,t.id,2);
  const me=await request('/me');
  for(const t of TALENTS)assert.equal(me.body.profile.talentLevels[t.id],2);
  for(const talent of TALENTS)for(let level=0;level<talent.maxLevel;level++){
   if(level===0)game.db.db.prepare('DELETE FROM talents WHERE user_id=? AND talent_id=?').run(id,talent.id);
   else game.db.db.prepare('UPDATE talents SET level=? WHERE user_id=? AND talent_id=?').run(level,id,talent.id);
   const cost=prices[level];
   game.db.db.prepare('UPDATE users SET currency=? WHERE id=?').run(cost-1,id);
   const before=game.db.profile(id);
   const rejected=await request('/talents/unlock',{talentId:talent.id,cost:1,baseCost:1});
   assert.equal(rejected.body.error?.code,'INSUFFICIENT_CURRENCY');
   assert.deepEqual(game.db.profile(id),before);
   game.db.db.prepare('UPDATE users SET currency=? WHERE id=?').run(cost+123,id);
   const purchased=await request('/talents/unlock',{talentId:talent.id,cost:1,level:5});
   assert.equal(purchased.body.ok,true);
   const after=game.db.profile(id);
   assert.equal(after.currency,123);
   assert.equal(after.talents.find(t=>t.talentId===talent.id).level,level+1);
  }
  const before=game.db.profile(id);
  assert.equal((await request('/talents/unlock',{talentId:'bargainer'})).body.error?.code,'TALENT_MAXED');
  assert.deepEqual(game.db.profile(id),before);
 }finally{await game.close();}
});
