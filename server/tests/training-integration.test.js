import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';

function setup(){
 let now=1000,beginRaidCalls=0;
 const profile={equipped:{primary:'m416-repaired',melee:'legend-araya'},packed:[{itemId:'ammo-556',quantity:60}],securePacked:[],instances:[],talents:[]};
 const db={profile:()=>profile,loadParties:()=>[],beginRaid(){beginRaidCalls++;throw Error('training touched persistent escrow');}};
 const manager=new RoomManager({db,catalog:{items:ITEMS,talents:TALENTS},world:{size:100,obstacles:[]},now:()=>now});
 const user={id:'trainer',username:'trainer'};
 return {manager,user,advance(ms){now+=ms;manager.tick(now);},get beginRaidCalls(){return beginRaidCalls;}};
}

test('training uses the real Raid combat path while leaving persistent escrow alone',()=>{
 const state=setup(),{manager,user}=state;
 manager.startTraining(user);
 const raid=manager.trainingRaid(user.id),player=raid.players.get(user.id);
 assert.equal(raid.world.id,'warehouse-training');
 assert.ok(raid.world.radiationZones[0]);
 assert.ok(Math.hypot(raid.world.radiationZones[0].x,raid.world.radiationZones[0].z)>raid.world.size);
 assert.equal(raid.trainingAiActive,false);
 assert.equal(player.gear.primary,'m416-repaired');
 assert.equal(player.gear.melee,'legend-araya');
 assert.equal(player.magazines.primary,30);
 assert.equal(player.reserveAmmo['ammo-556'],30);
 assert.equal(raid.snapshot(1000,user.id).world.id,'warehouse-training');
 const enemy=raid.enemies.get('training-left');
 player.x=-22;player.z=4;
 const original={x:enemy.x,z:enemy.z,hp:enemy.hp};
 state.advance(500);
 assert.deepEqual({x:enemy.x,z:enemy.z},{x:original.x,z:original.z});
 manager.handleCommand(user.id,{seq:1,type:'fire',weaponSlot:'primary',aimX:0,aimZ:-1});
 state.advance(50);
 assert.ok(enemy.hp<original.hp,'production firearm damage must apply');
 assert.equal(player.magazines.primary,29);
 assert.equal(player.reserveAmmo['ammo-556'],30);
 assert.ok(raid.events.some(event=>event.kind==='hit'&&event.data.enemyId===enemy.id));
 assert.equal(state.beginRaidCalls,0);
 manager.exitTraining(user.id);
 assert.equal(manager.trainingRaid(user.id),null);
});

test('training AI starts on command and target reset preserves an immortal DPS target',()=>{
 const state=setup(),{manager,user}=state;
 manager.startTraining(user);
 const raid=manager.trainingRaid(user.id),enemy=raid.enemies.get('training-heavy');
 const before={x:enemy.x,z:enemy.z};
 state.advance(500);
 assert.deepEqual({x:enemy.x,z:enemy.z},before);
 manager.setTrainingAi(user.id,true);
 state.advance(1000);
 assert.notDeepEqual({x:enemy.x,z:enemy.z},before);
 assert.equal(manager.resetTrainingTargets(user.id,'dps'),1);
 assert.equal(raid.trainingAiActive,false);
 const dummy=raid.enemies.get('training-dps'),hp=dummy.hp;
 raid.damageEnemy(raid.players.get(user.id),dummy,125,'m416-repaired');
 assert.equal(dummy.hp,hp);
 assert.ok(raid.events.some(event=>event.kind==='hit'&&event.data.enemyId===dummy.id));
 assert.equal(state.beginRaidCalls,0);
});

test('practice ammunition is finite and follows the equipped weapon magazine',()=>{
 const state=setup(),{manager,user}=state;
 manager.db.profile=()=>({equipped:{primary:'m416-repaired'},packed:[],securePacked:[],instances:[],talents:[]});
 manager.startTraining(user);
 const player=manager.trainingRaid(user.id).players.get(user.id);
 assert.equal(player.magazines.primary,30);
 assert.equal(player.reserveAmmo['ammo-556'],60);
});

test('training rejects unknown maps without opening a session',()=>{
 const {manager,user}=setup();
 assert.throws(()=>manager.startTraining(user,'missing-map'),error=>error.code==='INVALID_MAP');
 assert.equal(manager.trainingRaid(user.id),null);
});

test('training DPS reports rolling damage from the immortal target and resets',()=>{
 const state=setup(),{manager,user}=state;
 manager.startTraining(user);
 const raid=manager.trainingRaid(user.id);
 manager.resetTrainingTargets(user.id,'dps');
 const dummy=raid.enemies.get('training-dps'),player=raid.players.get(user.id);
 raid.damageEnemy(player,dummy,125,'m416-repaired');
 const firstApplied=raid.trainingDamage.total;
 assert.ok(firstApplied>0&&firstApplied<125,'DPS uses damage after target armor');
 assert.deepEqual(manager.trainingStats(user.id),{dps:Math.round(firstApplied),total:Math.round(firstApplied)});
 state.advance(2000);
 raid.damageEnemy(player,dummy,75,'m416-repaired');
 const totalApplied=raid.trainingDamage.total;
 assert.ok(totalApplied>firstApplied);
 assert.deepEqual(manager.trainingStats(user.id),{dps:Math.round(totalApplied/2),total:Math.round(totalApplied)});
 state.advance(5000);
 assert.deepEqual(manager.trainingStats(user.id),{dps:0,total:Math.round(totalApplied)});
 manager.resetTrainingTargets(user.id,'dps');
 assert.deepEqual(manager.trainingStats(user.id),{dps:0,total:0});
});
