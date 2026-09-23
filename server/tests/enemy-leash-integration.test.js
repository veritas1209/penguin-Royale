import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';

const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const db={profile:()=>({talents:[]}),updateRaidLoot(){},updateRaidInventoryState(){},settleRaidPlayer(){return {applied:true};},markRaidCompleteIfSettled(){}};
const world={size:200,spawn:{x:80,z:80},obstacles:[],lootSpawns:[],enemySpawns:[{id:'guard',kind:'raider',x:0,z:0,radius:20}],extractions:[],radiationZones:[],landmarks:[]};

test('the live enemy loop returns a leashed enemy without healing and still permits in-range fire',()=>{
 const room={mode:'solo',members:new Map([['p',{username:'p'}]])};
 const raid=new Raid({id:'leash-loop',room,escrow:[{userId:'p',gear:[]}],db,catalog,world,now:()=>2000,emit(){},options:{}});
 const enemy=raid.enemies.get('guard'),target=raid.players.get('p');
 for(const id of [...raid.enemies.keys()])if(id!==enemy.id)raid.enemies.delete(id);
 Object.assign(enemy,{x:49,z:0,homeX:0,homeZ:0,yaw:-Math.PI/2,hp:20,armor:.25,medicalUses:1,healEndsAt:null,reloadEndsAt:null,nextAttackAt:0,reactionReadyAt:0,ammoInMagazine:3,stunnedUntil:0});
 Object.assign(target,{x:45,z:0,alive:true,downed:false,boarded:false,settlement:null});
 const hp=enemy.hp,armor=enemy.armor;
 raid.updateEnemies(.1,2000);
 raid.updateEnemies(.1,2900);
 assert.ok(enemy.x<49);assert.equal(enemy.returningHome,true);
 assert.equal(enemy.hp,hp);assert.equal(enemy.armor,armor);assert.equal(enemy.healEndsAt,null);
 assert.equal(raid.projectiles.size,1);
});
