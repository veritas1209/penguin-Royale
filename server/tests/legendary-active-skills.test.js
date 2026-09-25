import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';

const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
function fixture(weaponId,obstacles=[]){
 let now=1000;
 const events=[];
 const db={profile(){return {talents:[]}},updateRaidLoot(){},updateRaidEquipment(){},updateRaidInventoryState(){},markRaidCompleteIfSettled(){}};
 const world={size:80,spawn:{x:0,z:0},obstacles,lootSpawns:[],enemySpawns:[],extractions:[],radiationZones:[],roads:[],terrain:[],landmarks:[],accessDoors:[]};
 const room={mode:'solo',members:new Map([['p',{username:'Test'}]])};
 const raid=new Raid({id:'skill-test',room,escrow:[{userId:'p',gear:[{slot:'melee',itemId:weaponId,quantity:1}]}],db,catalog,world,now:()=>now,emit(message){if(message.type==='event')events.push(message)},options:{initialEnemyDelayMs:0,raidLimitMs:60000}});
 raid.enemies.clear();raid.pendingInitialEnemies=null;raid.majorResponses.clear();
 raid.bossZones=[];raid.bossWarnings=[];raid.goldenBossEvent={planned:false,warned:false,spawned:false};raid.squadPatrol={routes:[],active:null,nextAt:Infinity,sequence:0};
 const player=raid.players.get('p');player.activeWeaponSlot='melee';
 const enemy=(id,x,z,hp=1000)=>{const e={id,kind:'raider',x,z,hp,maxHp:hp,armor:0,speed:0,damage:0,attackMs:800,rangedRange:0,aggroRadius:0,targetId:null,nextAttackAt:Infinity,stunnedUntil:Infinity,alertState:'patrol'};raid.enemies.set(id,e);return e};
 return{raid,player,events,enemy,get now(){return now},set now(value){now=value}};
}
test('Issen crosses walls and completes a full dash without an enemy',()=>{
 const f=fixture('legend-araya',[{x:0,z:8,w:8,d:1}]);
 f.raid.command('p',{type:'active_skill',seq:1,aimX:0,aimZ:1});
 assert.equal(f.player.arayaDash.travel,16);
 assert.equal(f.events.filter(e=>e.kind==='active_skill').length,1);
 f.now=1500;f.raid.updateArayaDash(f.player,f.now);
 assert.equal(f.player.z,16);
 assert.equal(f.player.arayaDash,null);
 f.raid.command('p',{type:'active_skill',seq:2,aimX:0,aimZ:1});
 assert.equal(f.events.filter(e=>e.kind==='active_skill').length,1);
});
test('Issen lands clear when the full-range endpoint overlaps a wall',()=>{
 const f=fixture('legend-araya',[{x:0,z:8,w:8,d:1},{x:0,z:16,w:8,d:1}]);
 f.raid.activeSkill(f.player,0,1,f.now);
 assert.ok(f.player.arayaDash.travel>8);
 f.now=1500;f.raid.updateArayaDash(f.player,f.now);
 assert.ok(f.player.z<15.05);
 assert.equal(f.player.arayaDash,null);
});

test('Issen hits every path target, burns, and strikes/stuns the last one',()=>{
 const f=fixture('legend-araya',[{x:0,z:7,w:8,d:1}]);
 const first=f.enemy('one',0,4),last=f.enemy('two',0,9);last.stunnedUntil=0;
 f.raid.activeSkill(f.player,0,1,f.now);
 assert.ok(f.player.arayaDash.travel>10);
 f.now=1500;f.raid.updateArayaDash(f.player,f.now);
 assert.equal(first.hp,970);
 assert.equal(last.hp,940);
 assert.equal(first.arayaBurnStacks,1);
 assert.equal(last.arayaBurnStacks,1);
 assert.ok(last.stunnedUntil>=2000);
 assert.ok(f.player.z>last.z);
});
test('Thunder hits only five nearest enemies and respects cooldown',()=>{
 const f=fixture('legend-thunder');
 const enemies=Array.from({length:6},(_,i)=>f.enemy(String(i),0,i+2,500));
 f.raid.activeSkill(f.player,0,1,f.now);
 assert.deepEqual(enemies.map(e=>e.hp),[300,300,300,300,300,500]);
 f.raid.activeSkill(f.player,0,1,f.now);
 assert.deepEqual(enemies.map(e=>e.hp),[300,300,300,300,300,500]);
});
test('Karambit triples server melee cadence for five seconds',()=>{
 const f=fixture('legend-karambit');f.enemy('target',0,2,5000);
 f.raid.activeSkill(f.player,0,1,f.now);
 f.raid.fire(f.player,'melee',0,1,f.now);
 assert.ok(Math.abs(f.player.nextFireAt-f.now-1000/9)<1);
 const hp=f.raid.enemies.get('target').hp;
 f.raid.fire(f.player,'melee',0,1,f.now+50);
 assert.equal(f.raid.enemies.get('target').hp,hp);
});
test('Arbiter freezes enemies in an 18 by 8 metre forward rectangle for five seconds',()=>{
 const f=fixture('legend-arbiter');
 const front=f.enemy('front',0,5),edge=f.enemy('edge',3.9,10);
 const behind=f.enemy('behind',0,-1),outside=f.enemy('outside',4.1,10),far=f.enemy('far',0,18.1);
 for(const enemy of [front,edge,behind,outside,far])enemy.stunnedUntil=0;
 f.raid.activeSkill(f.player,0,1,f.now);
 assert.equal(front.hp,950);assert.equal(edge.hp,950);
 assert.equal(front.stunnedUntil,6000);assert.equal(edge.stunnedUntil,6000);
 for(const enemy of [behind,outside,far])assert.equal(enemy.hp,1000);
 assert.equal(f.player.activeSkillReadyAt['legend-arbiter'],31000);
});
test('Araya melee hit has a fifty percent chance to reduce Issen cooldown by one second',()=>{
 const f=fixture('legend-araya');
 const enemy=f.enemy('target',0,2);
 f.player.activeSkillReadyAt['legend-araya']=10000;
 const original=Math.random;
 try{
  Math.random=()=>0;
  f.raid.legendaryMeleeHit(f.player,enemy,catalog.byId.get('legend-araya'));
 }finally{Math.random=original;}
 assert.equal(f.player.activeSkillReadyAt['legend-araya'],9000);
});
