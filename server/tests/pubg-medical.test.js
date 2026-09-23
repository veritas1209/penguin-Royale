import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid} from '../game.js';
import {ITEMS} from '../../shared/catalog.ts';
function fixture(id,hp=10,maxHp=100){
 const raid=Object.create(Raid.prototype);let now=1000;
 raid.now=()=>now;raid.catalog={byId:new Map(ITEMS.map(i=>[i.id,i]))};raid.db={updateRaidEquipment(){}};raid.cancelSearch=()=>{};raid.event=()=>{};
 const p={id:'p',alive:true,inventory:[{itemId:id,quantity:2}],gear:{},hp,maxHp};
 return {raid,p,complete(){now=p.medicalUse.endsAt;raid.finishRadiationMedicine(p,now);return now;}};
}
test('first aid restores to 80 percent of the current maximum and cannot heal above its cap',()=>{
 const f=fixture('first-aid',10,120);f.raid.useMedical(f.p,'first-aid');assert.equal(f.p.medicalUse.endsAt-f.p.medicalUse.startedAt,6000);assert.equal(f.p.hp,10);
 f.complete();assert.equal(f.p.hp,96);assert.equal(f.p.inventory[0].quantity,1);f.raid.useMedical(f.p,'first-aid');assert.equal(f.p.medicalUse,null);
 const reduced=fixture('first-aid',10,60);reduced.raid.useMedical(reduced.p,'first-aid');reduced.complete();assert.equal(reduced.p.hp,48);
});
test('medkit fills current maximum; drink adds 40 boost with delayed capped regeneration',()=>{
 const med=fixture('med-kit',20,120);med.raid.useMedical(med.p,'med-kit');med.complete();assert.equal(med.p.hp,120);
 const f=fixture('energy-drink',75);f.raid.useMedical(f.p,'energy-drink');assert.equal(f.p.medicalUse.endsAt-f.p.medicalUse.startedAt,4000);
 const at=f.complete();assert.equal(f.p.hp,75);assert.equal(f.p.boost,40);assert.equal(f.p.inventory[0].quantity,1);
 f.raid.updateBoost(f.p,at+7999);assert.equal(f.p.hp,75);f.raid.updateBoost(f.p,at+8000);assert.equal(f.p.hp,77);
 f.raid.updateBoost(f.p,at+120000);assert.equal(f.p.boost,0);assert.ok(f.p.hp>90&&f.p.hp<=100);
 const full=fixture('energy-drink',100);full.raid.useMedical(full.p,'energy-drink');full.complete();assert.equal(full.p.boost,40);assert.equal(full.p.hp,100);
});
test('boost caps at 100 and timed medical persistence failure grants no healing',()=>{
 const f=fixture('energy-drink');f.p.boost=90;f.raid.useMedical(f.p,'energy-drink');f.complete();assert.equal(f.p.boost,100);
 f.raid.useMedical(f.p,'energy-drink');assert.equal(f.p.medicalUse,null);
 const med=fixture('first-aid');med.raid.db.updateRaidEquipment=()=>{throw new Error('disk');};med.raid.useMedical(med.p,'first-aid');assert.throws(()=>med.complete(),/disk/);assert.equal(med.p.hp,10);assert.equal(med.p.inventory[0].quantity,2);
});

test('downed boost decays without accumulating healing for revival',()=>{
 const f=fixture('energy-drink',30);f.raid.useMedical(f.p,'energy-drink');const at=f.complete();
 f.p.downed=true;f.raid.updateBoost(f.p,at+16000);assert.equal(f.p.hp,30);assert.ok(f.p.boost<40);assert.equal(f.p.nextBoostHealAt,at+24000);
 f.p.downed=false;f.raid.updateBoost(f.p,at+16001);assert.equal(f.p.hp,30);f.raid.updateBoost(f.p,at+24000);assert.equal(f.p.hp,32);
});
test('bandage takes two seconds, rejects inactive players and persists before consuming',()=>{
 const f=fixture('bandage');f.raid.talentValue=()=>0;f.raid.event=()=>{};
 f.p.downed=true;f.raid.useMedical(f.p,'bandage');assert.equal(f.p.inventory[0].quantity,2);assert.equal(f.p.hp,10);
 f.p.downed=false;f.p.settlement='dead';f.raid.useMedical(f.p,'bandage');assert.equal(f.p.hp,10);
 f.p.settlement=null;f.raid.db.updateRaidEquipment=()=>{throw new Error('disk');};f.raid.useMedical(f.p,'bandage');assert.equal(f.p.medicalUse.endsAt-f.p.medicalUse.startedAt,2000);assert.equal(f.p.inventory[0].quantity,2);assert.throws(()=>f.complete(),/disk/);assert.equal(f.p.hp,10);assert.equal(f.p.inventory[0].quantity,2);
 f.raid.db.updateRaidEquipment=()=>{};f.complete();assert.equal(f.p.inventory[0].quantity,1);assert.equal(f.p.hp,35);
});
