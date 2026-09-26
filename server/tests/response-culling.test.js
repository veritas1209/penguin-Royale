import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';
import {WORLD} from '../../shared/world.ts';
import {REDUCED_RADIATION_GUARDS,updateMajorResponseTracking} from '../enemyForces.js';

const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const db={profile:()=>({talents:[]}),updateRaidLoot(){},updateRaidInventoryState(){},settleRaidPlayer(){return {applied:true};},markRaidCompleteIfSettled(){}};
function raidFor(world){
 const room={mode:'solo',members:new Map([['p',{username:'p'}]])};
 return new Raid({id:'culling-test',room,escrow:[{userId:'p',gear:[]}],db,catalog,world,now:()=>1000,emit(){}});
}
function smallWorld(){return {size:260,spawn:{x:110,z:110},obstacles:[],lootSpawns:[],enemySpawns:[],extractions:[],radiationZones:[{id:'rad',x:0,z:0,radius:58}],landmarks:[]};}

test('radiation residents are reduced without removing either radiation boss',()=>{
 const raid=raidFor(WORLD),zone=WORLD.radiationZones[0];
 for(const id of REDUCED_RADIATION_GUARDS)assert.equal(raid.enemies.has(id),false);
 assert.equal(raid.enemies.get('silo-launch-guard-0')?.bossId,'silo-warden');
 assert.equal(raid.enemies.get('silo-dispatch-guard-1')?.bossId,'radiation-tank');
 const residents=[...raid.enemies.values()].filter(enemy=>!enemy.responsePlatoonId&&Math.hypot(enemy.x-zone.x,enemy.z-zone.z)<=zone.radius);
 assert.equal(residents.length,4);
 assert.equal([...raid.enemies.values()].some(enemy=>enemy.reinforcement&&Math.hypot(enemy.x-zone.x,enemy.z-zone.z)<=zone.radius),false);
});

test('response platoon stays abstract while far and materializes with entry and exit hysteresis',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),state=raid.majorResponses.get('map-center');
 assert.equal(state.virtual,true);
 assert.equal(raid.snapshot(1000,player.id).enemies.some(enemy=>enemy.responsePlatoonId),false);
 player.x=state.virtualX;player.z=state.virtualZ;
 updateMajorResponseTracking(raid,1100,.1);
 assert.equal(state.virtual,false);
 assert.equal(raid.snapshot(1100,player.id).enemies.filter(enemy=>enemy.responsePlatoonId).length,5);
 player.x=state.virtualX+80;player.z=state.virtualZ;
 updateMajorResponseTracking(raid,1200,.1);
 assert.equal(state.virtual,false);
 player.x=state.virtualX+93;
 updateMajorResponseTracking(raid,1300,.1);
 assert.equal(state.virtual,true);
 assert.equal(raid.snapshot(1300,player.id).enemies.some(enemy=>enemy.responsePlatoonId),false);
});

test('dynamic entity visibility uses a sprint-safe hysteresis band',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p');
 raid.enemies.clear();player.x=0;player.z=0;
 const enemy={id:'edge',kind:'raider',x:59,z:0,hp:10,maxHp:10,yaw:0};
 raid.enemies.set(enemy.id,enemy);
 assert.equal(raid.snapshot(1000,player.id).enemies.length,1);
 enemy.x=70;
 assert.equal(raid.snapshot(1100,player.id).enemies.length,1);
 enemy.x=83;
 assert.equal(raid.snapshot(1200,player.id).enemies.length,0);
 enemy.x=70;
 assert.equal(raid.snapshot(1300,player.id).enemies.length,0);
 enemy.x=60;
 assert.equal(raid.snapshot(1400,player.id).enemies.length,1);
});

test('all squad members remain in every snapshot across the map',()=>{
 const world=smallWorld(),room={mode:'coop',members:new Map([['p',{username:'p'}],['q',{username:'q'}]])};
 const raid=new Raid({id:'squad-visibility-test',room,escrow:[{userId:'p',gear:[]},{userId:'q',gear:[]}],db,catalog,world,now:()=>1000,emit(){}});
 const first=raid.players.get('p'),second=raid.players.get('q');
 first.x=-110;first.z=-110;second.x=110;second.z=110;second.hp=42;
 const view=raid.snapshot(1000,'p');
 assert.equal(view.players.length,2);
 assert.equal(view.players.find(player=>player.id==='q').hp,42);
 assert.equal(view.players.find(player=>player.id==='q').x,110);
});
