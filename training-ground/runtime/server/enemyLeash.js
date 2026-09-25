export const ORDINARY_LEASH_EXIT=48;
export const ORDINARY_LEASH_REENGAGE=36;
export const BOSS_LEASH_EXIT=48;
export const BOSS_LEASH_REENGAGE=36;
export const LEASH_RETURN_COMPLETE=1.25;

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function rules(enemy){return enemy.bossId?{exit:BOSS_LEASH_EXIT,reengage:BOSS_LEASH_REENGAGE}:{exit:ORDINARY_LEASH_EXIT,reengage:ORDINARY_LEASH_REENGAGE};}

/**
 * Returns the homeward movement goal when this enemy must disengage. An omitted
 * threat performs only the distance check used before active-AI culling; null
 * means perception found no remaining threat and permits arrival completion.
 */
export function enemyLeashGoal(enemy,threat=undefined){
 if(!enemy||enemy.responsePlatoonId||enemy.ignorePursuitLeash)return null;
 const home={x:Number.isFinite(enemy.homeX)?enemy.homeX:enemy.x,z:Number.isFinite(enemy.homeZ)?enemy.homeZ:enemy.z};
 enemy.homeX=home.x;enemy.homeZ=home.z;
 const d=distance(enemy,home),{exit,reengage}=rules(enemy),threatDistance=threat?distance(threat,home):Infinity;
 if(enemy.returningHome){
  if(d<=LEASH_RETURN_COMPLETE&&threat!==undefined&&(!threat||threatDistance<=reengage)){enemy.returningHome=false;return null;}
  return home;
 }
 if(d>=exit){
  enemy.returningHome=true;enemy.repositionUntil=0;enemy.repositionPoint=null;return home;
 }
 return null;
}
