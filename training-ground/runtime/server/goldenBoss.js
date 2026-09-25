import {equipGoldenBossLoadout} from './enemyForces.js';

export const GOLDEN_BOSS_CHANCE=1/3;
export const GOLDEN_BOSS_WARNING_MS=7*60*1000;
export const GOLDEN_BOSS_SPAWN_MS=7.5*60*1000;

/* BC GOLDEN STARFALL 81
   Eagle-style 3-shot battery + delayed Star-Pact-style meteor impact. */
export const GOLDEN_STAR_SHOTS=3;
export const GOLDEN_STAR_SHOT_GAP_MS=750;
export const GOLDEN_STAR_TRAVEL_MS=1250;
export const GOLDEN_STAR_RELOAD_MS=10000;
/* Match the ordinary fixed extraction-zone footprint (default radius 5m).
   Shockwave reaches 1.5x the core radius. */
export const GOLDEN_STAR_CORE_RADIUS=5;
export const GOLDEN_STAR_RADIUS=GOLDEN_STAR_CORE_RADIUS*1.5;
export const GOLDEN_STAR_CORE_DAMAGE=60;
export const GOLDEN_STAR_SPLASH_DAMAGE=25;

function hash(value){let result=0;for(const char of String(value))result=(Math.imul(result,31)+char.charCodeAt(0))>>>0;return result;}
function roll(value){return hash(value)/4294967296;}
function testMode(){return process.env.BLUECAP_GOLDEN_BOSS_TEST===`1`;}

export function initGoldenBossEvent(raid){
 const zones=[...(raid.bossZones??[])].filter(z=>Number.isFinite(z.x)&&Number.isFinite(z.z));
 const forced=testMode();
 const planned=forced||roll(`${raid.id}:golden-boss:chance`)<GOLDEN_BOSS_CHANCE;
 if(!planned||!zones.length){raid.goldenBossEvent={planned:false,warned:false,spawned:false};return raid.goldenBossEvent;}
 const zone=zones[hash(`${raid.id}:golden-boss:zone`)%zones.length];
 const source=raid.enemies.get(zone.enemyId);
 raid.goldenBossEvent={planned:true,warned:false,spawned:false,warnAt:raid.startedAt+(forced?5000:GOLDEN_BOSS_WARNING_MS),spawnAt:raid.startedAt+(forced?10000:GOLDEN_BOSS_SPAWN_MS),zoneId:zone.id,zoneName:zone.name??zone.bossName??zone.id,x:zone.x,z:zone.z,radius:zone.radius??15,template:{weaponId:source?.weaponId,armor:source?.armor??.35,damage:source?.damage??30,speed:source?.speed??1.8,attackMs:source?.attackMs??1150,rangedRange:source?.rangedRange??16,aggroRadius:source?.aggroRadius??30}};
 return raid.goldenBossEvent;
}

function spawnGoldenBoss(raid,now,state){
 const angle=roll(`${raid.id}:golden-boss:offset`)*Math.PI*2;
 const x=state.x+Math.sin(angle)*1.7,z=state.z+Math.cos(angle)*1.7,t=state.template??{};
 const enemy={id:`golden-boss-${raid.id}`,kind:`golden-boss`,bossId:`golden-boss`,goldenBoss:true,name:`황금 보스`,zoneName:state.zoneName,x,z,yaw:0,hp:4000,maxHp:4000,armor:t.armor??.35,damage:t.damage??30,speed:t.speed??1.8,attackMs:t.attackMs??1150,rangedRange:t.rangedRange??16,aggroRadius:t.aggroRadius??30,targetId:null,nextAttackAt:now+1200,reactionReadyAt:now+700,stunnedUntil:0,alertState:`patrol`,homeX:x,homeZ:z,phase:1,ability:null,nextAbilityAt:Infinity,weaponId:t.weaponId};
 equipGoldenBossLoadout(raid,enemy);
 raid.enemies.set(enemy.id,enemy);
 raid.bossZones.push({id:`golden-boss`,enemyId:enemy.id,name:state.zoneName,bossName:enemy.name,x,z,radius:state.radius,color:`#ffd34d`,defeated:false});
 state.spawned=true;state.enemyId=enemy.id;
 state.starCombatStarted=false;
 state.starVolleySequence=0;
 state.starVolley=null;
 state.starNextVolleyAt=Infinity;
 state.starPendingImpacts=[];
 raid.event(`golden_boss_spawned`,{enemyId:enemy.id,bossId:enemy.bossId,name:enemy.name,zoneName:state.zoneName,x,z});
 return enemy;
}

function goldenStarPlayers(raid){
 return [...raid.players.values()].filter(player=>
  player?.alive &&
  !player.boarded &&
  !player.settlement
 );
}

function goldenStarTarget(raid){
 const players=goldenStarPlayers(raid).filter(player=>!player.downed);
 if(!players.length)return null;

 /* Eagle-style "heat map": prefer the player standing in the densest
    concentration of team HP. Solo naturally resolves to the only player. */
 const score=player=>{
  let total=0;
  for(const other of players){
   const d=Math.hypot(player.x-other.x,player.z-other.z);
   if(d<=8)total+=Math.max(1,Number(other.hp)||Number(other.maxHp)||100);
  }
  return total;
 };

 return players
  .map(player=>({player,score:score(player)}))
  .sort((a,b)=>b.score-a.score||String(a.player.id).localeCompare(String(b.player.id)))[0]?.player??null;
}

function goldenStarBeginVolley(raid,now,state,enemy){
 const target=goldenStarTarget(raid);
 if(!target)return false;

 const sequence=++state.starVolleySequence;
 state.starVolley={
  sequence,
  targetId:target.id,
  launched:0,
  nextShotAt:now
 };
 state.starNextVolleyAt=Infinity;

 raid.event(`golden_star_volley`,{
  enemyId:enemy.id,
  bossId:enemy.bossId,
  targetId:target.id,
  sequence,
  shots:GOLDEN_STAR_SHOTS,
  shotGapMs:GOLDEN_STAR_SHOT_GAP_MS,
  travelMs:GOLDEN_STAR_TRAVEL_MS
 });
 return true;
}

function goldenStarLaunch(raid,now,state,enemy){
 const volley=state.starVolley;
 if(!volley||volley.launched>=GOLDEN_STAR_SHOTS)return false;

 let target=raid.players.get(volley.targetId);
 if(!target?.alive||target.boarded||target.settlement){
  target=goldenStarTarget(raid);
  if(!target){state.starVolley=null;state.starNextVolleyAt=now+GOLDEN_STAR_RELOAD_MS;return false;}
  volley.targetId=target.id;
 }

 /* IMPORTANT: snapshot the target's position AT LAUNCH.
    The warning does not home after this point, so moving out is the dodge. */
 const x=Number(target.x),z=Number(target.z);
 const shotIndex=volley.launched;
 const shotId=`${enemy.id}:star:${volley.sequence}:${shotIndex}`;
 const impactAt=now+GOLDEN_STAR_TRAVEL_MS;

 state.starPendingImpacts.push({
  shotId,
  targetId:target.id,
  x,z,
  launchAt:now,
  impactAt,
  shotIndex,
  sequence:volley.sequence
 });

 raid.event(`golden_star_launch`,{
  enemyId:enemy.id,
  bossId:enemy.bossId,
  shotId,
  targetId:target.id,
  x,z,
  launchAt:now,
  impactAt,
  shotIndex,
  sequence:volley.sequence,
  bossX:Number(enemy.x),
  bossZ:Number(enemy.z),
  coreRadius:GOLDEN_STAR_CORE_RADIUS,
  radius:GOLDEN_STAR_RADIUS
 });

 volley.launched++;
 if(volley.launched<GOLDEN_STAR_SHOTS){
  volley.nextShotAt=now+GOLDEN_STAR_SHOT_GAP_MS;
 }else{
  state.starVolley=null;
  /* Eagle cadence: 10-second reload AFTER the third shot. */
  state.starNextVolleyAt=now+GOLDEN_STAR_RELOAD_MS;
 }
 return true;
}

function goldenStarResolve(raid,now,state){
 const pending=state.starPendingImpacts??=[];
 if(!pending.length)return false;
 let changed=false;
 const keep=[];

 for(const shot of pending){
  if(now<shot.impactAt){keep.push(shot);continue;}
  changed=true;
  const hits=[];

  for(const player of goldenStarPlayers(raid)){
   const d=Math.hypot(player.x-shot.x,player.z-shot.z);
   if(d>GOLDEN_STAR_RADIUS)continue;
   const damage=d<=GOLDEN_STAR_CORE_RADIUS
    ?GOLDEN_STAR_CORE_DAMAGE
    :GOLDEN_STAR_SPLASH_DAMAGE;
   raid.damagePlayer(player,damage,state.enemyId,now,`boss-special-explosive`);
   hits.push({playerId:player.id,damage,core:d<=GOLDEN_STAR_CORE_RADIUS});
  }

  raid.event(`golden_star_impact`,{
   enemyId:state.enemyId,
   bossId:`golden-boss`,
   shotId:shot.shotId,
   targetId:shot.targetId,
   x:shot.x,
   z:shot.z,
   shotIndex:shot.shotIndex,
   sequence:shot.sequence,
   coreRadius:GOLDEN_STAR_CORE_RADIUS,
   radius:GOLDEN_STAR_RADIUS,
   hits
  });
 }

 state.starPendingImpacts=keep;
 return changed;
}

function updateGoldenStarfall(raid,now,state){
 /* Already-fired meteors still land even if the boss dies mid-flight. */
 goldenStarResolve(raid,now,state);

 const enemy=raid.enemies.get(state.enemyId);
 if(!enemy||enemy.hp<=0)return false;

 if(!state.starCombatStarted){
  const engaged=
   !!enemy.targetId ||
   enemy.alertState===`combat` ||
   enemy.alertState===`investigate`;
  if(!engaged)return false;

  state.starCombatStarted=true;
  state.starNextVolleyAt=now;
  raid.event(`golden_star_armed`,{
   enemyId:enemy.id,
   bossId:enemy.bossId,
   name:enemy.name
  });
 }

 if(state.starVolley){
  if(now>=state.starVolley.nextShotAt)
   return goldenStarLaunch(raid,now,state,enemy);
  return false;
 }

 if(now>=state.starNextVolleyAt){
  if(goldenStarBeginVolley(raid,now,state,enemy))
   return goldenStarLaunch(raid,now,state,enemy);
 }
 return false;
}

export function updateGoldenBossEvent(raid,now){
 const state=raid.goldenBossEvent;
 if(!state?.planned)return false;

 if(!state.spawned){
  if(!state.warned&&now>=state.warnAt){
   state.warned=true;
   raid.event(`golden_boss_warning`,{
    zoneName:state.zoneName,
    x:state.x,
    z:state.z,
    spawnInMs:Math.max(0,state.spawnAt-now)
   });
  }
  if(now>=state.spawnAt){
   spawnGoldenBoss(raid,now,state);
   return true;
  }
  return false;
 }

 return updateGoldenStarfall(raid,now,state);
}

