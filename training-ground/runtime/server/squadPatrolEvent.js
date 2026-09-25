import {movementSegmentClear,advanceEnemyNavigation} from './enemyNavigation.js';
import {equipEnemy,ENEMY_WEAPON_QUALITIES} from './enemyCombat.js';

export const SQUAD_PATROL_RULES=Object.freeze({firstDelayMs:90000,cooldownMs:180000,retryMs:15000,playerClearance:32,maxSquads:1,maxMembers:5});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const slot=i=>({x:(i%2-.5)*2.2,z:-Math.floor(i/2)*2.2});
const at=(point,i)=>({x:point.x+slot(i).x,z:point.z+slot(i).z});
const activePlayer=p=>p.alive&&!p.boarded&&!p.settlement;
const clampPoint=(world,point)=>{const half=world.size/2-1;return {x:Math.max(-half,Math.min(half,point.x)),z:Math.max(-half,Math.min(half,point.z))};};
const blockedSpawnTerrain=(world,point)=>(world.terrain??[]).some(t=>['river','reservoir'].includes(t.kind)&&Math.abs(point.x-t.x)<=t.w/2+.7&&Math.abs(point.z-t.z)<=t.d/2+.7);

/** Fully body-clear loops for the five-member formation. Computed once per raid. */
export function createSquadPatrolRoutes(world){
 const routes=[];
 for(const base of world.landmarks??[]){
  if(!['barracks','armory'].includes(base.kind))continue;
  for(const radius of [10,6])for(let x=-42;x<=42;x+=14)for(let z=-42;z<=42;z+=14){
   if(Math.hypot(x,z)>50)continue;
   const points=[[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]].map(([dx,dz])=>({x:base.x+x+dx,z:base.z+z+dz}));
   if(points.every((p,j)=>Array.from({length:5},(_,i)=>i).every(i=>movementSegmentClear(world,at(p,i),at(points[(j+1)%points.length],i)))))routes.push({base,points});
  }
 }
 return routes;
}
export function initSquadPatrolEvent(raid){
 raid.squadPatrol={routes:createSquadPatrolRoutes(raid.world),active:null,nextAt:raid.startedAt+SQUAD_PATROL_RULES.firstDelayMs,sequence:0};
}
function safeSpawn(raid,point,count){
 const players=[...raid.players.values()].filter(activePlayer);
 return Array.from({length:count},(_,i)=>at(point,i)).every(p=>
  !blockedSpawnTerrain(raid.world,p)&&movementSegmentClear(raid.world,p,p)&&players.every(player=>distance(p,player)>=SQUAD_PATROL_RULES.playerClearance)&&
  [...raid.enemies.values()].every(enemy=>distance(p,enemy)>1.5)&&
  [...(raid.containers?.values()??[])].every(container=>distance(p,container)>1.5));
}
export function updateSquadPatrolEvent(raid,now){
 const state=raid.squadPatrol;if(!state||raid.complete)return;
 if(state.active){
  const members=state.active.ids.map(id=>raid.enemies.get(id)).filter(Boolean);
  if(!members.length){state.active=null;state.nextAt=now+SQUAD_PATROL_RULES.cooldownMs;return;}
  const squad=state.active;
  if(now>=squad.alertUntil&&members.every(e=>!e.targetId&&e.alertState!=='investigate'&&distance(e,at(squad.route.points[squad.waypoint],e.patrolSlot))<.7))squad.waypoint=(squad.waypoint+1)%squad.route.points.length;
  return;
 }
 if(now<state.nextAt||![...raid.players.values()].some(activePlayer))return;
 const rng=raid.options?.patrolRng??Math.random,count=5;
 const offset=Math.floor(rng()*Math.max(1,state.routes.length));let route=null;
 for(let i=0;i<state.routes.length;i++){const candidate=state.routes[(offset+i)%state.routes.length];if(safeSpawn(raid,candidate.points[0],count)){route=candidate;break;}}
 state.nextAt=now+SQUAD_PATROL_RULES.retryMs;if(!route)return;
 const id='patrol-'+(++state.sequence),ids=[],solo=raid.room?.mode!=='coop';
 for(let i=0;i<count;i++){
  const enemyId=id+'-'+i,p=at(route.points[0],i),sniper=i===count-1,kind=sniper?'sniper':i===0?'heavy':'raider';
  const hp=sniper?105:kind==='heavy'?165:solo?90:115,enemy={id:enemyId,kind,name:sniper?'순찰대 저격수':'정예 순찰대원',...p,hp,maxHp:hp,speed:sniper?2.25:kind==='heavy'?1.9:2.65,damage:sniper?42:kind==='heavy'?20:solo?13:16,attackMs:sniper?1500:760,armor:kind==='heavy'?.28:.25,rangedRange:sniper?76:28,aggroRadius:sniper?88:36,targetId:null,nextAttackAt:now+2000,stunnedUntil:now+1200,patrolSquadId:id,patrolSlot:i,alertState:'patrol'};
  const patrolQuality=ENEMY_WEAPON_QUALITIES.patrol[i%ENEMY_WEAPON_QUALITIES.patrol.length];
  const patrolBase=sniper?'m24':i%2?'m416':'mk14';
  const patrolWeaponId=patrolQuality==='intact'?patrolBase:`${patrolBase}-${patrolQuality}`;
  equipEnemy(raid,enemy,sniper
   ?{kind:'sniper',scopeId:'scope-8x',armorTier:5,weaponId:patrolWeaponId}
   :{kind,armorTier:i%2?4:5,weaponId:patrolWeaponId}
  );
  ids.push(enemyId);raid.enemies.set(enemyId,enemy);
 }
 state.active={id,ids,route,waypoint:1,alertUntil:0,alertPoint:null};
 raid.event('patrol_squad_started',{squadId:id,baseId:route.base.id,baseName:route.base.name,count,snipers:1,armorTier:'4-5'});
}
export function alertSquadPatrol(raid,enemy,point,now){
 const squad=raid.squadPatrol?.active;if(!squad||enemy.patrolSquadId!==squad.id||!point)return;
 squad.alertPoint={x:point.x,z:point.z};squad.alertUntil=now+30000;
}
export function advanceSquadPatrol(raid,enemy,dt,now,budget){
 const squad=raid.squadPatrol?.active;if(!squad||enemy.patrolSquadId!==squad.id)return false;
 const alerted=now<squad.alertUntil&&squad.alertPoint,slotIndex=enemy.patrolSlot??0;
 const angle=slotIndex*Math.PI*2/5,radius=enemy.kind==='sniper'?36:enemy.kind==='heavy'?10:16+(slotIndex%2)*3;
 const goal=alerted?clampPoint(raid.world,{x:squad.alertPoint.x+Math.sin(angle)*radius,z:squad.alertPoint.z+Math.cos(angle)*radius}):at(squad.route.points[squad.waypoint],slotIndex);
 enemy.alertState=alerted?'investigate':'patrol';
 advanceEnemyNavigation(raid.world,enemy,goal,dt,now,budget,{speedMultiplier:alerted?1.15:1});
 return true;
}
