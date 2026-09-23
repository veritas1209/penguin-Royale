import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';
import {forceEnemyThreat} from '../enemyPerception.js';

const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const db={profile:()=>({talents:[]}),updateRaidLoot(){},updateRaidInventoryState(){},settleRaidPlayer(){return {applied:true};},markRaidCompleteIfSettled(){}};
const world={size:200,spawn:{x:80,z:80},obstacles:[],lootSpawns:[],enemySpawns:[{id:'guard',kind:'raider',x:0,z:5,radius:20}],extractions:[],radiationZones:[],landmarks:[]};
const raidFor=()=>new Raid({id:'response-fire-test',room:{mode:'solo',members:new Map([['p',{username:'p'}]])},escrow:[{userId:'p',gear:[]}],db,catalog,world,now:()=>2000,emit(){},options:{}});

test('a bullet hit makes a boss turn, acquire the attacker, and leave return-home state',()=>{
 const raid=raidFor(),player=raid.players.get('p'),enemy=raid.enemies.get('guard');
 player.x=0;player.z=-5;
 Object.assign(enemy,{bossId:'warden',x:0,z:0,yaw:0,hp:500,maxHp:500,armor:0,returningHome:true});
 raid.damageEnemy(player,enemy,10,'mk14');
 assert.equal(enemy.forcedTargetId,player.id);assert.equal(enemy.returningHome,false);
 assert.ok(Math.abs(Math.abs(enemy.yaw)-Math.PI)<.001);
});

test('response members can fire while advancing to their formation point',()=>{
 const raid=raidFor(),player=raid.players.get('p'),enemy=raid.enemies.get('guard');
 for(const id of [...raid.enemies.keys()])if(id!==enemy.id)raid.enemies.delete(id);
 player.x=0;player.z=0;
 Object.assign(enemy,{x:0,z:10,yaw:Math.PI,responsePlatoonId:'central',responseSlot:0,tacticalRole:'breach',rangedRange:30,ammoInMagazine:30,nextAttackAt:0,reactionReadyAt:0,stunnedUntil:0,healEndsAt:null,reloadEndsAt:null,aimSpread:0,weaponId:'m416-improved',responseVirtual:false});
 raid.majorResponses=new Map([['map-center',{id:'central',ids:[enemy.id],defeated:false,virtual:false,chaseUnlocked:true,alertPoint:{x:player.x,z:player.z},alertPlayerId:player.id}]]);
 forceEnemyThreat(enemy,player,1000);enemy.reactionReadyAt=0;
 raid.updateEnemies(.1,2000);
 const moved=enemy.x!==0||enemy.z!==10;
 raid.updateEnemies(.1,3000);
 assert.ok(raid.projectiles.size>0,'response member did not fire while moving');
 assert.ok(moved,'response member did not advance');
});
