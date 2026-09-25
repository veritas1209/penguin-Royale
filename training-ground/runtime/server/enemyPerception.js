import {segmentObstacles} from './spatialObstacles.js';

// Visual perception is directional. Sound and direct damage can still reveal a target behind an enemy.
export const ENEMY_MEMORY_MS=30000;
export const SNIPER_VIEW_DISTANCE=80;
export const UNSCOPED_VIEW_DISTANCE=40;
export const PERIPHERAL_MIN_MS=500;
export const PERIPHERAL_MAX_MS=1000;
const memories=new WeakMap();
const awareness=new WeakMap();
const valid=p=>p&&p.alive&&!p.downed&&!p.boarded&&!p.settlement;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=value=>{let result=2166136261;for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619);}return result>>>0;};

export function enemyVisionProfile(enemy){
 if(enemy.responsePlatoonId&&enemy.kind==='sniper')return {range:96,primaryFov:40,peripheralFov:60};
 if(enemy.responsePlatoonId)return {range:52,primaryFov:70,peripheralFov:120};
 if(enemy.bossId)return {range:90,primaryFov:70,peripheralFov:110};
 if(enemy.kind==='sniper')return {range:SNIPER_VIEW_DISTANCE,primaryFov:40,peripheralFov:60};
 return {range:UNSCOPED_VIEW_DISTANCE,primaryFov:60,peripheralFov:90};
}
export function enemyLineOfSight(world,areas,a,b,now) {
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const o of segmentObstacles(world,a,b)){
  if(o.bulletPassable)continue;
  let near=0,far=1;
  for(const [p,d,lo,hi]of [[a.x,dx,o.x-(o.w??o.width??1)/2,o.x+(o.w??o.width??1)/2],[a.z,dz,o.z-(o.d??o.depth??1)/2,o.z+(o.d??o.depth??1)/2]]){
   if(Math.abs(d)<1e-9){if(p<lo||p>hi){near=2;break;}continue;}
   const t1=(lo-p)/d,t2=(hi-p)/d;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  }
  if(near<=far)return false;
 }
 const length2=dx*dx+dz*dz;
 for(const area of areas??[]){
  if(area.kind!=='smoke'||(area.expiresAt??Infinity)<=now)continue;
  const t=length2?Math.max(0,Math.min(1,((area.x-a.x)*dx+(area.z-a.z)*dz)/length2)):0;
  if(Math.hypot(area.x-a.x-dx*t,area.z-a.z-dz*t)<=area.radius)return false;
 }
 return true;
}
function setContact(enemy,player,now,seen=true){
 const previous=memories.get(enemy),newContact=!previous||previous.playerId!==player.id||seen&&!previous.seen;
 const memory={playerId:player.id,point:{x:player.x,z:player.z},expiresAt:now+ENEMY_MEMORY_MS,seen,arrivedAt:null};
 memories.set(enemy,memory);
 if(newContact){enemy.alertedAt=now;enemy.reactionReadyAt=Math.max(enemy.reactionReadyAt??0,now+(enemy.reactionMs??450));}
 return memory;
}
export function rememberEnemyPoint(enemy,playerId,point,now,{seen=true}={}){
 if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return;
 const previous=memories.get(enemy);
 // A squad broadcast or other indirect update must never downgrade fresh visual contact.
 // Doing so used to restart the acquisition delay every AI tick and prevented response units from firing.
 if(previous?.playerId===playerId&&previous.seen&&!seen&&now<previous.expiresAt)return;
 const newContact=!previous||previous.playerId!==playerId||seen&&!previous.seen;
 memories.set(enemy,{playerId,point:{x:point.x,z:point.z},expiresAt:now+ENEMY_MEMORY_MS,seen,arrivedAt:null});
 if(newContact){enemy.alertedAt=now;enemy.reactionReadyAt=Math.max(enemy.reactionReadyAt??0,now+(enemy.reactionMs??450));}
}
export function forgetEnemyTarget(enemy){memories.delete(enemy);awareness.delete(enemy);enemy.targetId=null;delete enemy.forcedTargetId;delete enemy.forcedTargetUntil;}
export function rememberEnemyThreat(enemy,player,now){if(valid(player))rememberEnemyPoint(enemy,player.id,player,now,{seen:true});}
export function forceEnemyThreat(enemy,player,now){
 if(!valid(player))return;
 const dx=player.x-enemy.x,dz=player.z-enemy.z;if(Math.hypot(dx,dz)>.001)enemy.yaw=Math.atan2(dx,dz);
 setContact(enemy,player,now,true);enemy.forcedTargetId=player.id;enemy.forcedTargetUntil=now+1500;enemy.returningHome=false;
}
function facingAmount(enemy,player){
 const dx=player.x-enemy.x,dz=player.z-enemy.z,length=Math.hypot(dx,dz);if(length<1e-6)return 1;
 const yaw=enemy.yaw??0;return (dx*Math.sin(yaw)+dz*Math.cos(yaw))/length;
}
function visionBand(enemy,player){
 const profile=enemyVisionProfile(enemy),facing=facingAmount(enemy,player);
 if(facing>=Math.cos(profile.primaryFov*Math.PI/360))return 'primary';
 if(facing>=Math.cos(profile.peripheralFov*Math.PI/360))return 'peripheral';
 return 'rear';
}
function peripheralReady(enemy,player,now,band){
 let states=awareness.get(enemy);if(!states)awareness.set(enemy,states=new Map());
 if(band==='primary'){states.delete(player.id);return true;}
 if(band!=='peripheral'){states.delete(player.id);return false;}
 let state=states.get(player.id);
 if(!state){states.set(player.id,{progress:0,lastAt:now});return false;}
 const elapsed=Math.max(0,Math.min(250,now-state.lastAt));state.lastAt=now;
 const delay=PERIPHERAL_MIN_MS+hash(enemy.id+':'+player.id)%(PERIPHERAL_MAX_MS-PERIPHERAL_MIN_MS+1);
 state.progress=Math.min(1,state.progress+elapsed/delay);
 if(state.progress>=1){states.delete(player.id);return true;}
 return false;
}
export function perceiveEnemy(world,areas,enemy,players,now) {
 let memory=memories.get(enemy),visible=null,visibleDistance=Infinity,heard=null;
 if(memory&&(!valid(players.get(memory.playerId))||now>=memory.expiresAt)){memories.delete(enemy);memory=null;}
 const forced=players.get(enemy.forcedTargetId);
 if(valid(forced)&&now<(enemy.forcedTargetUntil??0)){
  memory=setContact(enemy,forced,now,true);enemy.alertState='combat';return {target:forced,point:memory.point,observed:true};
 }
 if(now>=(enemy.forcedTargetUntil??0)){delete enemy.forcedTargetId;delete enemy.forcedTargetUntil;}
 const profile=enemyVisionProfile(enemy);
 for(const player of players.values()){
  if(!valid(player))continue;
  const d=distance(enemy,player),band=d<=profile.range?visionBand(enemy,player):'rear';
  const hasSight=d<=profile.range&&band!=='rear'&&enemyLineOfSight(world,areas,enemy,player,now);
  if(hasSight&&peripheralReady(enemy,player,now,band)&&d<visibleDistance){visible=player;visibleDistance=d;}
  else if(!hasSight)peripheralReady(enemy,player,now,'rear');
  const noise=player.noisePosition??player;
  if(now<(player.noiseUntil??0)&&distance(enemy,noise)<=(player.noiseRadius??0)&&(!heard||distance(enemy,noise)<distance(enemy,heard.noise)))heard={player,noise};
 }
 if(visible){
  memory=setContact(enemy,visible,now,true);enemy.alertState='combat';return {target:visible,point:memory.point,observed:true};
 }
 if(heard){
  const dx=heard.noise.x-enemy.x,dz=heard.noise.z-enemy.z;if(Math.hypot(dx,dz)>.001)enemy.yaw=Math.atan2(dx,dz);
  memory={playerId:heard.player.id,point:{x:heard.noise.x,z:heard.noise.z},expiresAt:now+ENEMY_MEMORY_MS,seen:false,arrivedAt:null};memories.set(enemy,memory);
 }
 if(memory){
  if(distance(enemy,memory.point)<.65)memory.arrivedAt??=now;
  if(memory.arrivedAt!==null&&now-memory.arrivedAt>=3000){memories.delete(enemy);memory=null;}
 }
 enemy.alertState=memory?'investigate':'idle';
 return {target:null,point:memory?.point??null,observed:!!heard};
}
