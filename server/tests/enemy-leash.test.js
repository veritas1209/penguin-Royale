import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_LEASH_EXIT,ORDINARY_LEASH_EXIT,ORDINARY_LEASH_REENGAGE,enemyLeashGoal} from '../enemyLeash.js';
import {PERIPHERAL_MAX_MS,SNIPER_VIEW_DISTANCE,UNSCOPED_VIEW_DISTANCE,enemyVisionProfile,forceEnemyThreat,perceiveEnemy} from '../enemyPerception.js';
import {fireEnemyProjectile} from '../enemyCombat.js';
import {tacticalGoal} from '../enemyForces.js';

const player=(x,z,extra={})=>({id:'p',x,z,alive:true,downed:false,boarded:false,settlement:null,...extra});
const world={size:200,obstacles:[]};

test('ordinary enemies return home with separate exit and re-engage thresholds',()=>{
 const enemy={id:'guard',x:0,z:0,hp:63,armor:.25},hp=enemy.hp,armor=enemy.armor;
 assert.deepEqual(enemyLeashGoal(enemy,player(ORDINARY_LEASH_EXIT+1,0)),null);
 enemy.x=ORDINARY_LEASH_EXIT;
 assert.deepEqual(enemyLeashGoal(enemy,player(ORDINARY_LEASH_EXIT+5,0)),{x:0,z:0});
 enemy.x=0;
 assert.equal(enemyLeashGoal(enemy,player(ORDINARY_LEASH_REENGAGE,0)),null);
 assert.equal(enemy.returningHome,false);assert.equal(enemy.hp,hp);assert.equal(enemy.armor,armor);
});

test('bosses chase an attacker until they cross their own leash and response platoons are exempt',()=>{
 const attacker=player(100,0);
 const boss={id:'boss',bossId:'warden',x:0,z:0,yaw:0,returningHome:false};
 forceEnemyThreat(boss,attacker,1000);
 assert.equal(enemyLeashGoal(boss,attacker),null);
 boss.x=BOSS_LEASH_EXIT;
 assert.deepEqual(enemyLeashGoal(boss,attacker),{x:0,z:0});
 const response={id:'response',responsePlatoonId:'central',x:90,z:90,homeX:0,homeZ:0};
 assert.equal(enemyLeashGoal(response,player(150,150)),null);
});

test('vision profiles match the role-specific directional requirements',()=>{
 assert.deepEqual(enemyVisionProfile({kind:'raider'}),{range:UNSCOPED_VIEW_DISTANCE,primaryFov:60,peripheralFov:90});
 assert.deepEqual(enemyVisionProfile({bossId:'warden',kind:'commander'}),{range:90,primaryFov:70,peripheralFov:110});
 assert.deepEqual(enemyVisionProfile({responsePlatoonId:'central',kind:'sniper'}),{range:96,primaryFov:40,peripheralFov:60});
 assert.deepEqual(enemyVisionProfile({responsePlatoonId:'central',kind:'raider'}),{range:52,primaryFov:70,peripheralFov:120});
 assert.equal(SNIPER_VIEW_DISTANCE,80);
});

test('primary sight is immediate, peripheral sight fills awareness, and rear sight is disabled',()=>{
 const front={id:'front',kind:'raider',x:0,z:0,yaw:0,alertState:'idle'};
 const seen=player(0,UNSCOPED_VIEW_DISTANCE);
 assert.equal(perceiveEnemy(world,[],front,new Map([[seen.id,seen]]),1000).target,seen);
 const rear={id:'rear',kind:'raider',x:0,z:0,yaw:0,alertState:'idle'},behind=player(0,-5);
 assert.equal(perceiveEnemy(world,[],rear,new Map([[behind.id,behind]]),1000).target,null);
 const peripheral={id:'peripheral',kind:'raider',x:0,z:0,yaw:0,alertState:'idle'};
 const angle=40*Math.PI/180,side=player(Math.sin(angle)*20,Math.cos(angle)*20);
 const players=new Map([[side.id,side]]);
 assert.equal(perceiveEnemy(world,[],peripheral,players,1000).target,null);
 let acquired=null;
 for(let now=1100;now<=1000+PERIPHERAL_MAX_MS+300;now+=100){
  acquired=perceiveEnemy(world,[],peripheral,players,now).target;
  if(acquired)break;
 }
 assert.equal(acquired,side);
});

test('rear sound turns an enemy without granting an instant shot target',()=>{
 const enemy={id:'listener',kind:'raider',x:0,z:0,yaw:0,alertState:'idle'},heard=player(0,-20,{noiseUntil:2000,noiseRadius:25});
 const result=perceiveEnemy(world,[],enemy,new Map([[heard.id,heard]]),1000);
 assert.equal(result.target,null);assert.equal(result.observed,true);assert.deepEqual(result.point,{x:0,z:-20});
 assert.ok(Math.abs(Math.abs(enemy.yaw)-Math.PI)<.001);
});

test('new visual contact records alert time and blocks fire through reaction delay',()=>{
 const enemy={id:'react',kind:'raider',x:0,z:0,yaw:0,alertState:'idle',reactionMs:500,rangedRange:20,ammoInMagazine:3,nextAttackAt:0,attackMs:500,bulletSpeed:40,damage:10,aimSpread:0,shotsFired:0};
 const target=player(0,5);assert.equal(perceiveEnemy(world,[],enemy,new Map([[target.id,target]]),1000).target,target);
 assert.equal(enemy.alertedAt,1000);assert.equal(enemy.reactionReadyAt,1500);
 const raid={catalog:{byId:new Map()},projectiles:new Map(),perfStats:{},event(){}};
 assert.equal(fireEnemyProjectile(raid,enemy,target,1499),false);
 assert.equal(fireEnemyProjectile(raid,enemy,target,1500),true);
});

test('boss tactical goal never retreats or repositions away from a nearby player',()=>{
 const boss={id:'boss',bossId:'warden',kind:'commander',x:0,z:0,rangedRange:20,minRange:8,repositionUntil:9999,repositionPoint:{x:-30,z:0}};
 const close=player(0,2),far=player(0,25),raid={world,enemies:new Map([[boss.id,boss]]),players:new Map()};
 assert.deepEqual(tacticalGoal(raid,boss,close,1000),{point:null,move:false});
 assert.deepEqual(tacticalGoal(raid,boss,far,1000),{point:far,move:true});
});
