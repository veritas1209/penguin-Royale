import test from 'node:test';
import assert from 'node:assert/strict';
import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';
import {WORLD} from '../../shared/world.ts';
import {BOSS_ENCOUNTERS} from '../bosses.js';
import {ENEMY_MEMORY_MS,perceiveEnemy} from '../enemyPerception.js';
import {enemyInsidePlayerViewport,fireEnemyProjectile,enemyCombatMoveSpeed,PLAYER_SPRINT_SPEED} from '../enemyCombat.js';
import {advanceEnemyNavigation,NAVIGATION_POLICY} from '../enemyNavigation.js';
import {ENEMY_STAMINA_MAX,initializeEnemyStamina,updateEnemyStamina} from '../enemyStamina.js';
import {advanceEnemyPatrol} from '../enemyPatrol.js';
import {alertMajorResponse,ORDINARY_FORCE_MULTIPLIER,REDUCED_RADIATION_GUARDS,tacticalGoal,updateMajorResponseTracking} from '../enemyForces.js';
import {updateSquadPatrolEvent} from '../squadPatrolEvent.js';
import {planRadiationWeaponSpawns,RADIATION_WEAPON_CRATE_MIN,RADIATION_WEAPON_CRATE_MAX,inRadiation} from '../loot.js';

const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const db={profile:()=>({talents:[]}),updateRaidLoot(){},updateRaidInventoryState(){},settleRaidPlayer(){return {applied:true};},markRaidCompleteIfSettled(){}};
function raidFor(world=WORLD,options={}){
 const room={mode:'solo',members:new Map([['p',{username:'p'}]])};
 return new Raid({id:'ai-test',room,escrow:[{userId:'p',gear:[]}],db,catalog,world,now:()=>1000,emit(){},options});
}
function smallWorld(){
 return {size:200,spawn:{x:80,z:80},obstacles:[],lootSpawns:[],enemySpawns:[{id:'guard',kind:'raider',x:0,z:5,radius:20}],extractions:[],radiationZones:[],landmarks:[]};
}

test('initial forces use a 1.3 multiplier for non-boss spawns and add ten equipped map snipers',()=>{
 const raid=raidFor(),bossIds=new Set(BOSS_ENCOUNTERS.map(config=>config.enemyId));
 const zone=WORLD.radiationZones[0];
 const ordinary=WORLD.enemySpawns.filter(spawn=>!bossIds.has(spawn.id)&&!REDUCED_RADIATION_GUARDS.has(spawn.id)&&Math.hypot(spawn.x-zone.x,spawn.z-zone.z)>zone.radius).length,reinforcements=Math.round(ordinary*(ORDINARY_FORCE_MULTIPLIER-1));
 assert.equal(raid.enemyForceSummary.baseOrdinary,ordinary);
 assert.equal(raid.enemyForceSummary.reinforcements,reinforcements);
 assert.equal([...raid.enemies.values()].filter(enemy=>enemy.reinforcement).length,reinforcements);
 const snipers=[...raid.enemies.values()].filter(enemy=>enemy.mapSniper);
 assert.equal(snipers.length,10);
 for(const enemy of snipers){
  assert.equal(enemy.kind,'sniper');assert.ok(['scope-6x','scope-8x'].includes(enemy.scopeId));
  assert.ok(['DMR','SR'].includes(catalog.byId.get(enemy.weaponId).family));
  assert.ok(enemy.rangedRange>=60);assert.ok([4,5].includes(enemy.armorTier));
 }
 assert.equal(raid.enemies.size,WORLD.enemySpawns.length-REDUCED_RADIATION_GUARDS.size+reinforcements+10+5);
});

test('one central five-person response squad tracks players until wiped and never respawns',()=>{
 const raid=raidFor(),player=raid.players.get('p'),state=raid.majorResponses.get('map-center'),members=state.ids.map(id=>raid.enemies.get(id)).filter(Boolean);
 assert.equal(members.length,5);assert.equal(members.filter(enemy=>enemy.kind==='sniper').length,1);
 assert.ok(members.every(enemy=>[5,6].includes(enemy.armorTier)));assert.ok(members.filter(enemy=>enemy.armorTier===6).length<=3);
 assert.ok(members.filter(enemy=>catalog.byId.get(enemy.weaponId).quality==='refined').length<=2);
 assert.ok(members.every(enemy=>['improved','refined'].includes(catalog.byId.get(enemy.weaponId).quality)));
 player.x=43;player.z=-27;assert.equal(updateMajorResponseTracking(raid,2000),true);assert.deepEqual(state.alertPoint,{x:43,z:-27});
 for(const id of state.ids)raid.enemies.delete(id);
 assert.equal(updateMajorResponseTracking(raid,3000),false);assert.equal(state.defeated,true);assert.equal(alertMajorResponse(raid,null,player,player.id,4000),false);
 assert.equal([...raid.enemies.values()].filter(enemy=>enemy.responsePlatoonId).length,0);
});

test('last sight is fixed in place for thirty seconds and never follows a hidden player',()=>{
 const world=smallWorld(),enemy={id:'watch',kind:'raider',x:0,z:0,yaw:0,aggroRadius:20,reactionMs:0,alertState:'idle'},player={id:'p',x:0,z:5,alive:true,downed:false,boarded:false,settlement:null};
 const players=new Map([[player.id,player]]);
 const seen=perceiveEnemy(world,[],enemy,players,1000);assert.equal(seen.target,player);assert.deepEqual(seen.point,{x:0,z:5});
 player.x=70;player.z=70;
 const remembered=perceiveEnemy(world,[],enemy,players,1000+ENEMY_MEMORY_MS-1);assert.equal(remembered.target,null);assert.deepEqual(remembered.point,{x:0,z:5});
 const forgotten=perceiveEnemy(world,[],enemy,players,1000+ENEMY_MEMORY_MS);assert.equal(forgotten.point,null);
});

test('snipers use the player 8x scope 16:9 ground viewport as their fire boundary',()=>{
 const player={x:0,z:0,yaw:0};
 assert.equal(enemyInsidePlayerViewport({x:43,z:1.6},player),true);assert.equal(enemyInsidePlayerViewport({x:45,z:1.6},player),false);
 assert.equal(enemyInsidePlayerViewport({x:0,z:35},player),true);assert.equal(enemyInsidePlayerViewport({x:0,z:36},player),false);assert.equal(enemyInsidePlayerViewport({x:0,z:-33},player),false);
 const raid=raidFor(smallWorld()),target=raid.players.get('p'),enemy=raid.enemies.get('guard');for(const id of [...raid.enemies.keys()])if(id!==enemy.id)raid.enemies.delete(id);
 target.x=0;target.z=0;target.yaw=0;enemy.kind='sniper';enemy.x=0;enemy.z=30;enemy.rangedRange=76;enemy.nextAttackAt=0;enemy.reactionReadyAt=0;
 assert.equal(fireEnemyProjectile(raid,enemy,target,2000),true);assert.equal(raid.projectiles.size,1);
 enemy.burstShotsRemaining=0;enemy.nextAttackAt=0;enemy.x=0;enemy.z=40;
 assert.equal(fireEnemyProjectile(raid,enemy,target,4000),false);assert.equal(raid.projectiles.size,1);
});

test('automatic fire queues a slightly early cadence input instead of dropping its damage',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),weapon=catalog.byId.get('mk14');
 raid.enemies.clear();const enemy={id:'auto-target',kind:'commander',x:10,z:0,hp:1000,maxHp:1000,armor:0};raid.enemies.set(enemy.id,enemy);
 player.x=0;player.z=0;player.gear.primary=weapon.id;player.activeWeaponSlot='primary';player.magazines.primary=3;player.loadedAmmo.primary=weapon.ammo;player.nextFireAt=0;
 raid.fire(player,'primary',1,0,1000);const first=player.burstQueue.shift();assert.ok(first);raid.resolveShot(player,first,first.at);const afterFirst=enemy.hp;
 const cooldown=1000/weapon.fireRate;raid.fire(player,'primary',1,0,1000+cooldown-5);const second=player.burstQueue.shift();assert.ok(second);assert.ok(Math.abs(second.at-(1000+cooldown))<1e-9);
 raid.resolveShot(player,second,second.at);assert.equal(player.magazines.primary,1);assert.ok(enemy.hp<afterFirst);
});

test('automatic enemy weapons fire follow-up rounds at exact weapon cadence',()=>{
 const raid=raidFor(smallWorld()),target=raid.players.get('p'),enemy=raid.enemies.get('guard');
 for(const id of [...raid.enemies.keys()])if(id!==enemy.id)raid.enemies.delete(id);

 target.x=0;target.z=0;
 enemy.x=0;enemy.z=5;
 enemy.kind='raider';
 enemy.weaponId='m416-improved';
 enemy.ammoInMagazine=10;
 enemy.nextAttackAt=0;
 enemy.reactionReadyAt=0;
 enemy.aimSpread=0;

 const weapon=catalog.byId.get(enemy.weaponId);
 const cadence=1000/weapon.fireRate;

 assert.equal(fireEnemyProjectile(raid,enemy,target,2000),true);
 assert.equal(enemy.burstShotsRemaining??0,0);

 assert.equal(
  fireEnemyProjectile(
   raid,
   enemy,
   target,
   2000+cadence-1
  ),
  false
 );

 assert.equal(
  fireEnemyProjectile(
   raid,
   enemy,
   target,
   2000+cadence
  ),
  true
 );

 assert.equal(
  fireEnemyProjectile(
   raid,
   enemy,
   target,
   2000+cadence*2
  ),
  true
 );

 assert.equal(raid.projectiles.size,3);
 assert.equal(enemy.ammoInMagazine,7);
});

test('all combat-ready enemies use player sprint speed without a close-range multiplier',()=>{
 const raid=raidFor(smallWorld()),enemy=raid.enemies.get('guard');
 enemy.alertState='combat';enemy.reactionReadyAt=2000;enemy.weaponId='m416';assert.equal(enemyCombatMoveSpeed(raid,enemy,1999),null);assert.equal(enemyCombatMoveSpeed(raid,enemy,2000),PLAYER_SPRINT_SPEED);
 enemy.weaponId='mp5k';assert.equal(enemyCombatMoveSpeed(raid,enemy,2000),PLAYER_SPRINT_SPEED);enemy.weaponId=catalog.items.find(item=>item.family==='SG').id;assert.equal(enemyCombatMoveSpeed(raid,enemy,2000),PLAYER_SPRINT_SPEED);
 enemy.alertState='investigate';assert.equal(enemyCombatMoveSpeed(raid,enemy,2000),null);
 const mover={id:'combat-mover',x:0,z:0,yaw:0,speed:2};advanceEnemyNavigation({size:100,obstacles:[]},mover,{x:20,z:0},.1,2000,{remaining:1},{speedOverride:PLAYER_SPRINT_SPEED});assert.ok(Math.abs(mover.x-.9)<1e-9);
});

test('enemy sprint uses half player stamina, exhausts, waits five seconds, and resumes only after recovery',()=>{
 const world={size:200,obstacles:[]},enemy={id:'stamina-mover',x:0,z:0,yaw:0,speed:2};initializeEnemyStamina(enemy);
 assert.equal(enemy.maxStamina,ENEMY_STAMINA_MAX);assert.equal(enemy.stamina,50);
 let now=1000;
 for(let tick=0;tick<23;tick++){updateEnemyStamina(enemy,.1,now);advanceEnemyNavigation(world,enemy,{x:100,z:0},.1,now,{remaining:1},{speedOverride:PLAYER_SPRINT_SPEED});now+=100;}
 assert.equal(enemy.stamina,0);assert.equal(enemy.sprintExhausted,true);const recoveryAt=enemy.staminaRecoveryAt,x=enemy.x;
 updateEnemyStamina(enemy,.1,recoveryAt-1);advanceEnemyNavigation(world,enemy,{x:100,z:0},.1,recoveryAt-1,{remaining:1},{speedOverride:PLAYER_SPRINT_SPEED});assert.ok(Math.abs(enemy.x-x-.2)<1e-9);assert.equal(enemy.stamina,0);
 for(let tick=0;tick<8;tick++)updateEnemyStamina(enemy,.1,recoveryAt+tick*100);
 assert.equal(enemy.sprintExhausted,true);
 updateEnemyStamina(enemy,.1,recoveryAt+800);assert.equal(enemy.sprintExhausted,false);const resumedAt=enemy.x;
 advanceEnemyNavigation(world,enemy,{x:100,z:0},.1,recoveryAt+800,{remaining:1},{speedOverride:PLAYER_SPRINT_SPEED});assert.ok(Math.abs(enemy.x-resumedAt-.9)<1e-9);
});

test('blocked high-speed movement does not consume enemy stamina',()=>{
 const world={size:100,obstacles:[{x:1,z:0,w:1,d:100}]},enemy={id:'blocked-sprinter',x:0,z:0,yaw:0,speed:2};initializeEnemyStamina(enemy);
 advanceEnemyNavigation(world,enemy,{x:20,z:0},.1,1000,{remaining:0},{speedOverride:PLAYER_SPRINT_SPEED});assert.equal(enemy.x,0);assert.equal(enemy.stamina,50);
});

test('non-combat patrol multipliers below base speed remain deliberately slow',()=>{
 const world={size:100,obstacles:[]},enemy={id:'slow-patrol',x:0,z:0,yaw:0,speed:3};initializeEnemyStamina(enemy);
 advanceEnemyNavigation(world,enemy,{x:20,z:0},.1,1000,{remaining:1},{speedMultiplier:.7});assert.ok(Math.abs(enemy.x-.21)<1e-9);assert.equal(enemy.stamina,50);
});

test('raid item value includes equipped gear, fitted parts, bags, secure items, reserve and loaded ammunition',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),v=id=>catalog.byId.get(id).sell;
 player.gear={primary:'mk14','primary:scope':'scope-4x'};player.inventory=[{itemId:'gold-bar',quantity:2},{itemId:'m416',quantity:1,fittings:{scope:'red-dot'}}];player.secure=[{itemId:'cpu',quantity:3}];player.reserveAmmo={'ammo-762':10};player.magazines={primary:3};player.loadedAmmo={primary:'ammo-762'};
 const expected=v('mk14')+v('scope-4x')+v('gold-bar')*2+v('m416')+v('red-dot')+v('cpu')*3+v('ammo-762')*13;
 assert.equal(raid.itemValue(player),expected);assert.equal(raid.snapshot(2000,player.id).players[0].itemValue,expected);
});

test('enemy shots travel as projectiles before damaging the player',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),enemy=raid.enemies.get('guard');

 for(const id of [...raid.enemies.keys()])
  if(id!==enemy.id)
   raid.enemies.delete(id);

 player.x=0;
 player.z=0;
 player.hp=100;

 enemy.x=0;
 enemy.z=5;
 enemy.aimSpread=0;
 enemy.bulletSpeed=50;
 enemy.rangedRange=30;
 enemy.nextAttackAt=0;
 enemy.reactionReadyAt=0;

 const weapon=catalog.byId.get(enemy.weaponId);
 assert.ok(weapon);

 assert.equal(
  fireEnemyProjectile(
   raid,
   enemy,
   player,
   2000
  ),
  true
 );

 /*
  격발 순간에는 아직 피해 없음.
 */
 assert.equal(player.hp,100);
 assert.equal(raid.projectiles.size,1);

 const projectile=[
  ...raid.projectiles.values()
 ][0];

 /*
  AI 전용 고정 피해가 아니라
  실제 들고 있는 총기의 피해량 사용.
 */
 assert.equal(
  projectile.damage,
  weapon.damage
 );

 /*
  탄이 실제로 도달한 뒤 피해 적용.
 */
 raid.updateProjectiles(.2,2200);

 assert.ok(
  player.hp<100,
  `expected firearm damage, hp=${player.hp}`
 );

 assert.equal(
  raid.projectiles.size,
  0
 );
});

test('expired hostile projectiles cannot land as delayed invisible hits',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),enemy=raid.enemies.get('guard');
 for(const id of [...raid.enemies.keys()])if(id!==enemy.id)raid.enemies.delete(id);
 player.x=0;player.z=0;player.hp=100;enemy.x=0;enemy.z=5;enemy.aimSpread=0;enemy.bulletSpeed=1;enemy.damage=17;enemy.nextAttackAt=0;enemy.reactionReadyAt=0;
 assert.equal(fireEnemyProjectile(raid,enemy,player,2000),true);const projectile=[...raid.projectiles.values()][0];projectile.expiresAt=2100;
 raid.updateProjectiles(.2,2200);assert.equal(player.hp,100);assert.equal(raid.projectiles.size,0);
});

test('scheduled patrol is exactly five armored members and includes one long-range sniper',()=>{
 const world={...smallWorld(),landmarks:[{id:'barracks',name:'Barracks',kind:'barracks',x:0,z:0}]};
 const raid=raidFor(world,{patrolRng:()=>0});raid.squadPatrol.nextAt=0;updateSquadPatrolEvent(raid,2000);
 assert.ok(raid.squadPatrol.active);
 const members=raid.squadPatrol.active.ids.map(id=>raid.enemies.get(id));
 assert.equal(members.length,5);assert.equal(members.filter(enemy=>enemy.kind==='sniper').length,1);
 assert.ok(members.every(enemy=>[4,5].includes(enemy.armorTier)));
 assert.ok(members.every(enemy=>['intact','improved','refined'].includes(catalog.byId.get(enemy.weaponId).quality)));
});

test('radiation weapon chest planner fixes each raid to four or five weapon chests',()=>{
 for(let seed=0;seed<64;seed++){
  const plan=planRadiationWeaponSpawns(WORLD,WORLD.lootSpawns,seed);
  assert.ok(plan.size===RADIATION_WEAPON_CRATE_MIN||plan.size===RADIATION_WEAPON_CRATE_MAX,'seed '+seed+' => '+plan.size);
  assert.equal(plan.size,RADIATION_WEAPON_CRATE_MIN+seed%2);
 }
 const raid=raidFor(),radiationSpawns=WORLD.lootSpawns.filter(spawn=>spawn.pool!=='documents'&&inRadiation(WORLD,spawn));
 const weaponCount=radiationSpawns.filter(spawn=>raid.containers.get(spawn.id)?.kind==='military').length;
 assert.ok(weaponCount===4||weaponCount===5,'actual raid weapon chests '+weaponCount);
});
test('movement faces travel direction and ordinary patrols stay within thirty meters',()=>{
 const world={size:100,obstacles:[]},mover={id:'mover',x:0,z:0,yaw:0,speed:2};
 advanceEnemyNavigation(world,mover,{x:5,z:0},.25,1000,{remaining:1});
 assert.ok(mover.x>0);assert.ok(Math.abs(mover.yaw-Math.PI/2)<.001);
 const patrol={id:'patrol-radius',kind:'raider',x:0,z:0,yaw:0,speed:3,patrolRadius:30},budget={remaining:100};let farthest=0;
 for(let step=0;step<800;step++){advanceEnemyPatrol(world,patrol,.05,step*50,budget);farthest=Math.max(farthest,Math.hypot(patrol.x,patrol.z));budget.remaining=100;}
 assert.ok(farthest>20,'patrol reached '+farthest);assert.ok(farthest<=30.01,'patrol exceeded '+farthest);
});

test('unsuppressed long-range rifles create noise across their practical range',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),weapon=catalog.byId.get('m24');
 player.gear.primary=weapon.id;player.activeWeaponSlot='primary';player.magazines.primary=1;player.loadedAmmo.primary=weapon.ammo;
 raid.resolveShot(player,{slot:'primary',weapon,direction:{x:1,z:0}},2000);
 assert.ok(player.noiseRadius>=weapon.range,'noise radius '+player.noiseRadius+' / range '+weapon.range);
});

test('clear tactical movement bypasses A star without cover-seeking state',()=>{
 const world={size:100,obstacles:[]},enemy={id:'clear-route',x:0,z:0,yaw:0,speed:3},budget={remaining:1,searches:0,timeouts:0,spentMs:0};
 advanceEnemyNavigation(world,enemy,{x:20,z:0},.1,1000,budget);
 assert.equal(budget.remaining,1);assert.equal(budget.searches,0);assert.equal(budget.directs,1);assert.ok(enemy.x>0);
 assert.equal(NAVIGATION_POLICY.targetReplanDistance,8);
});

test('response squad keeps independent tactical roles and destinations around one player',()=>{
 const raid=raidFor(smallWorld()),player=raid.players.get('p'),state=raid.majorResponses.get('map-center');
 player.x=70;player.z=65;
 const members=state.ids.map(id=>raid.enemies.get(id)).filter(Boolean),goals=members.map(enemy=>{
  enemy.lastHitAt=-Infinity;enemy.repositionUntil=0;const result=tacticalGoal(raid,enemy,player,5000);
  assert.equal(result.move,true);return {enemy,point:result.point};
 });
 assert.equal(new Set(goals.map(({point})=>Math.round(point.x*10)+','+Math.round(point.z*10))).size,5);
 assert.equal(goals.filter(({enemy})=>enemy.tacticalRole==='overwatch').length,1);
 assert.equal(goals.filter(({enemy})=>enemy.tacticalRole==='breach').length,1);
 assert.ok(goals.every(({point})=>Math.hypot(point.x-player.x,point.z-player.z)>=8));
});

test('response squad loadouts vary by raid while keeping elite grade limits',()=>{
 const signatures=new Set();
 for(let index=0;index<8;index++){
  // Force initialization uses the raid id, so construct each raid with a distinct id.
  const room={mode:'solo',members:new Map([['p',{username:'p'}]])};
  const distinct=new Raid({id:`response-${index}`,room,escrow:[{userId:'p',gear:[]}],db,catalog,world:WORLD,now:()=>1000,emit(){},options:{}});
  const squad=[...distinct.enemies.values()].filter(enemy=>enemy.responsePlatoonId).sort((a,b)=>a.responseSlot-b.responseSlot);
  assert.equal(squad.length,5);
  assert.ok(squad.filter(enemy=>catalog.byId.get(enemy.weaponId).quality==='refined').length<=2);
  assert.ok(squad.filter(enemy=>enemy.armorTier===6).length<=3);
  signatures.add(squad.map(enemy=>`${enemy.weaponId}:${enemy.armorTier}`).join('|'));
 }
 assert.ok(signatures.size>1,'each raid must not receive the same fixed squad equipment');
});
