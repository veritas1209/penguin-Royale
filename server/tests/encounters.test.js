import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS,ITEM_BY_ID} from '../../shared/catalog.ts';
import {BOSS_ENCOUNTERS,updateBosses} from '../bosses.js';
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
function fixture(enemyId='target',obstacles=[]){
 const world={size:100,spawn:{x:0,z:0},obstacles,lootSpawns:[],enemySpawns:[{id:enemyId,kind:'heavy',x:0,z:5,radius:0}],extractions:[],radiationZones:[]};
 const room={mode:'solo',members:new Map([['p',{username:'p'}]])},db={profile:()=>({talents:[]}),updateRaidLoot(){},updateRaidInventoryState(){},settleRaidPlayer(){return {applied:true};},markRaidCompleteIfSettled(){}};
 const raid=new Raid({id:'encounter-test',room,escrow:[{userId:'p',gear:[]}],db,catalog,world,now:()=>1000,emit(){}}),player=raid.players.get('p');
 return {raid,player,enemy:raid.enemies.get(enemyId)};
}

test('all configured boss camps create zones, phases, and immediately collectible death loot exactly once',()=>{
 for(const config of BOSS_ENCOUNTERS){const {raid,player,enemy}=fixture(config.enemyId);assert.equal(enemy.bossId,config.id);assert.equal(raid.bossZones.length,1);
  enemy.hp=enemy.maxHp*.49;updateBosses(raid,1001);assert.equal(enemy.phase,2);
  const before=raid.containers.size;raid.damageEnemy(player,enemy,100000,'m416');raid.damageEnemy(player,enemy,100000,'m416');assert.equal(raid.containers.size,before+1);assert.equal(player.kills,1);
  const cache=raid.containers.get('remains-'+enemy.id);assert.equal(cache.state,'open');assert.equal(cache.searchSeconds,0);assert.ok(cache.items.length>=4);assert.equal(raid.bossZones[0].defeated,true);
  player.x=cache.x;player.z=cache.z;player.carryCapacity=1000;const stack={...cache.items[0]};raid.takeContainer(player,cache.id,stack.itemId,1);assert.equal(player.searching,null);assert.ok(player.inventory.some(s=>s.itemId===stack.itemId));assert.throws(()=>raid.takeContainer(player,cache.id,stack.itemId,stack.quantity+1),{code:'INSUFFICIENT_CONTAINER_ITEMS'});
  if(enemy.ability==='robots')assert.equal(ITEM_BY_ID[stack.itemId].family,'SG');
 }
});

test('ordinary enemy drops also have zero search delay',()=>{
 const {raid,player,enemy}=fixture();raid.damageEnemy(player,enemy,10000,'m416');const drop=raid.snapshot(1000,'p').containers[0];assert.equal(drop.state,'open');assert.equal(drop.searchSeconds,0);assert.ok(drop.items.length>0);
});

test('frost attack warns before damage, can be dodged, applies bounded cold duration, and cancels on boss death',()=>{
 const {raid,player,enemy}=fixture('armory-guard-2');enemy.targetId=player.id;enemy.nextAbilityAt=0;
 updateBosses(raid,2000);assert.equal(raid.bossWarnings.length,1);assert.equal(player.hp,100);updateBosses(raid,3599);assert.equal(player.hp,100);
 updateBosses(raid,3600);assert.ok(player.hp<100);assert.equal(player.coldUntil,7600);assert.equal(raid.snapshot(3600,'p').players[0].coldUntil,7600);
 enemy.nextAbilityAt=0;const hp=player.hp;updateBosses(raid,4000);player.x=12;updateBosses(raid,5600);assert.equal(player.hp,hp);
 player.x=0;enemy.nextAbilityAt=0;updateBosses(raid,6000);assert.ok(raid.bossWarnings.length);raid.damageEnemy(player,enemy,10000,'m416');assert.equal(raid.bossWarnings.length,0);
});

test('Robo summons a bounded destructible group without farmable corpse rewards',()=>{
 const {raid,player,enemy}=fixture('barracks-guard-2');enemy.targetId=player.id;
 for(let i=0;i<4;i++){enemy.nextAbilityAt=0;updateBosses(raid,2000+i*10000);}
 const drones=[...raid.enemies.values()].filter(e=>e.summonedBy===enemy.id);assert.equal(drones.length,3);const count=raid.containers.size;raid.damageEnemy(player,drones[0],10000,'m416');assert.equal(raid.containers.size,count);
});

test('window openings pass hitscan and fast projectiles; solid wall piers block both while all block movement and looting',()=>{
 for(const pass of [true,false]){
  const window={id:'window',x:0,z:2,w:2,d:.3,h:2.4,kind:pass?'interior-window':'interior-wall',bulletPassable:pass};
  const {raid,player,enemy}=fixture('target',[window]);const hp=enemy.hp;
  raid.hitscan(player,{...ITEM_BY_ID.m416,damage:20,penetration:0},{x:0,z:1});assert.equal(enemy.hp<hp,pass);assert.equal(raid.blocked({x:0,z:2}),true);
  enemy.hp=hp;raid.spawnProjectile(player,'bolt',{x:0,z:1},20,1300,.2,80,1000);raid.updateProjectiles(.05,1050);assert.equal(enemy.hp<hp,pass);
  const cache=raid.addContainer({id:'behind',x:0,z:2.3,pool:'medical'},[{itemId:'bandage',quantity:1}]);assert.throws(()=>raid.interact(player,cache.id,1000),{code:'NO_LINE_OF_SIGHT'});
 }
});

test('solid cover blocks explosion splash but its exposed side remains vulnerable',()=>{
 const wall={id:'wall',x:0,z:2,w:8,d:.3,h:3};
 const {raid,player,enemy}=fixture('target',[wall]);enemy.z=3;const hp=enemy.hp;
 const exposed={...enemy,id:'exposed',x:2,z:1};raid.enemies.set(exposed.id,exposed);
 raid.spawnProjectile(player,'grenade',{x:0,z:1},60,100,.5,10,1000,true);
 const projectile=[...raid.projectiles.values()][0];projectile.radius=5;
 raid.updateProjectiles(.05,1050);assert.equal(enemy.hp,hp);assert.ok(exposed.hp<hp);
});

test('radiation damage never interrupts field searches',()=>{
 for(const protectedPlayer of [false,true]){
  const {raid,player}=fixture();raid.world.radiationZones=[{x:0,z:0,radius:5,hpPerSecond:2,maxHpPerSecond:.35}];player.radiationProtected=protectedPlayer;
  const cache=raid.addContainer({id:'rad-cache',x:1,z:0},[{itemId:'bandage',quantity:1}]);raid.interact(player,cache.id,1000);raid.updateRadiation(player,.5,1500);
  assert.equal(!!player.searching,true);
 }
});
