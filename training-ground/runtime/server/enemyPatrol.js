import {advanceEnemyNavigation,movementSegmentClear} from './enemyNavigation.js';

// Private route state stays off snapshots and retains the original post during combat.
const patrols=new WeakMap();
function hash(id){let value=0;for(const c of String(id??''))value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return value;}
export function initializeEnemyPatrol(enemy){
 if(enemy.bossId||enemy.summonedBy||enemy.patrolSquadId||enemy.responsePlatoonId||patrols.has(enemy))return;
 patrols.set(enemy,{home:{x:enemy.x,z:enemy.z},radius:enemy.patrolRadius??30,phase:hash(enemy.id),points:null,index:0,pauseUntil:0,progressAt:0,lastPosition:null});
}
function localPoints(world,state){
 const points=[],angle=state.phase/4294967296*Math.PI*2;
 // Connected spokes keep ordinary patrols local, including guards inside rooms.
 for(let i=0;i<4;i++){
  const a=angle+i*Math.PI/2;
  for(const radius of [Math.min(30,state.radius??30),24,18,12,6,3]){
   const point={x:state.home.x+Math.cos(a)*radius,z:state.home.z+Math.sin(a)*radius};
   if(movementSegmentClear(world,state.home,point)){points.push(point);break;}
  }
 }
 return points;
}
export function advanceEnemyPatrol(world,enemy,dt,now,budget){
 initializeEnemyPatrol(enemy);
 const state=patrols.get(enemy);
 if(!state||enemy.patrolSquadId)return;
 if(state.source!==world.obstacles){state.points=localPoints(world,state);state.source=world.obstacles;state.index=0;state.progressAt=now;state.lastPosition={x:enemy.x,z:enemy.z};}
 if(!state.points.length||now<state.pauseUntil)return;
 const point=state.points[state.index];
 if(Math.hypot(enemy.x-point.x,enemy.z-point.z)<.2){
  state.index=(state.index+1)%state.points.length;state.pauseUntil=now+1000+state.phase%1000;
  state.progressAt=now;state.lastPosition={x:enemy.x,z:enemy.z};return;
 }
 // A newly locked door or unreachable post must not pin an idle guard forever.
 if(Math.hypot(enemy.x-state.lastPosition.x,enemy.z-state.lastPosition.z)>.3){state.progressAt=now;state.lastPosition={x:enemy.x,z:enemy.z};}
 else if(now-state.progressAt>6000){state.index=(state.index+1)%state.points.length;state.progressAt=now;return;}
 enemy.alertState='patrol';
 advanceEnemyNavigation(world,enemy,point,dt*.55,now,budget);
}
