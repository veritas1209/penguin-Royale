export const REVIVE_MS=10000;
const fail=(code,message)=>Object.assign(new Error(message),{code});
const active=p=>p&&p.connected&&p.alive&&!p.downed&&!p.boarded&&!p.settlement;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function cancelRevive(raid,rescuer,reason='cancelled',now){
 const action=rescuer.reviving;if(!action)return false;now??=raid.now();
 rescuer.reviving=null;
 const target=raid.players.get(action.targetId);
 if(target?.beingRevivedBy===rescuer.id){
  target.beingRevivedBy=null;
  if(target.downed&&!target.settlement)target.downedUntil=now+action.remainingBleedMs;
 }
 raid.event('revive_cancelled',{playerId:rescuer.id,targetId:action.targetId,reason});return true;
}
export function cancelRevivesFor(raid,player,reason,now){
 if(!player.reviving&&!player.beingRevivedBy)return;now??=raid.now();
 cancelRevive(raid,player,reason,now);
 if(!player.beingRevivedBy)return;
 const owner=raid.players.get(player.beingRevivedBy);if(owner)cancelRevive(raid,owner,reason,now);
}
export function isBeingRevived(raid,target){const owner=raid.players.get(target.beingRevivedBy);return active(owner)&&owner.reviving?.targetId===target.id;}
export function startRevive(raid,rescuer,target,now){
 if(raid.room.mode!=='coop'||!active(rescuer)||!target||rescuer.id===target.id||!target.alive||!target.downed||target.settlement||!target.connected)throw fail('INVALID_REVIVE','지금 구조할 수 없는 동료입니다.');
 if(distance(rescuer,target)>2.5)throw fail('TOO_FAR','동료에게 더 가까이 다가가세요.');
 if(!raid.reviveReach(rescuer,target))throw fail('REVIVE_BLOCKED','벽이나 창문 너머에서는 구조할 수 없습니다.');
 if(target.beingRevivedBy&&target.beingRevivedBy!==rescuer.id)throw fail('REVIVE_BUSY','다른 동료가 구조 중입니다.');
 if(rescuer.reviving?.targetId===target.id)return;
 if(now>=target.downedUntil){raid.killPlayer(target,'bled_out',now);throw fail('REVIVE_EXPIRED','구조 가능 시간이 지났습니다.');}
 if(rescuer.reloadEndsAt>now)throw fail('RELOADING','재장전 중입니다.');
 cancelRevive(raid,rescuer,'changed_target',now);raid.cancelSearch(rescuer,'revive');rescuer.medicalUse=null;
 if(rescuer.extracting){const extractionId=rescuer.extracting.extractionId;rescuer.extracting=null;raid.event('extraction_cancelled',{playerId:rescuer.id,extractionId,reason:'revive'});}
 const remainingBleedMs=target.downedUntil-now,reviveMs=Math.max(1000,Math.round(REVIVE_MS*(rescuer.reviveTimeMultiplier??1)));
 rescuer.reviving={targetId:target.id,startedAt:now,completeAt:now+reviveMs,remainingBleedMs,x:rescuer.x,z:rescuer.z};
 target.beingRevivedBy=rescuer.id;target.downedUntil=now+reviveMs+remainingBleedMs;
 raid.event('revive_started',{playerId:rescuer.id,targetId:target.id,completeAt:now+reviveMs});
}
export function updateRevives(raid,now){
 for(const rescuer of raid.players.values()){
  const action=rescuer.reviving;if(!action)continue;
  const target=raid.players.get(action.targetId);
  if(!active(rescuer)||!target?.connected||!target.alive||!target.downed||target.settlement||target.beingRevivedBy!==rescuer.id||distance(rescuer,target)>2.5||Math.hypot(rescuer.x-action.x,rescuer.z-action.z)>.08||!raid.reviveReach(rescuer,target)){
   cancelRevive(raid,rescuer,'interrupted',now);continue;
  }
  if(now<action.completeAt)continue;
  raid.updateBoost(target,now);target.medicalUse=null;target.downed=false;target.downedUntil=null;target.beingRevivedBy=null;target.hp=Math.min(target.maxHp,30);rescuer.reviving=null;
  raid.event('revived',{playerId:target.id,by:rescuer.id});
 }
}
