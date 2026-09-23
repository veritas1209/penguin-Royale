export const ENEMY_STAMINA_MAX=50;
export const ENEMY_STAMINA_DRAIN_PER_SECOND=22;
export const ENEMY_STAMINA_RECOVERY_PER_SECOND=14;
export const ENEMY_STAMINA_RECOVERY_DELAY_MS=5000;
export const ENEMY_STAMINA_RESTART_RATIO=.25;

export function initializeEnemyStamina(enemy){
 if(!Number.isFinite(enemy.maxStamina))enemy.maxStamina=ENEMY_STAMINA_MAX;
 else enemy.maxStamina=Math.min(enemy.maxStamina,ENEMY_STAMINA_MAX);
 if(!Number.isFinite(enemy.stamina))enemy.stamina=enemy.maxStamina;
 else enemy.stamina=Math.max(0,Math.min(enemy.stamina,enemy.maxStamina));
 if(!Number.isFinite(enemy.staminaRecoveryAt))enemy.staminaRecoveryAt=0;
 if(typeof enemy.sprintExhausted!=='boolean')enemy.sprintExhausted=false;
 if(typeof enemy.sprintedLastTick!=='boolean')enemy.sprintedLastTick=false;
 return enemy;
}

export function updateEnemyStamina(enemy,dt,now){
 initializeEnemyStamina(enemy);
 const step=Math.max(0,Math.min(dt,.25));
 if(enemy.sprintedLastTick){enemy.sprintedLastTick=false;return;}
 if(now<enemy.staminaRecoveryAt)return;
 enemy.stamina=Math.min(enemy.maxStamina,enemy.stamina+ENEMY_STAMINA_RECOVERY_PER_SECOND*step);
 if(enemy.sprintExhausted&&enemy.stamina>=enemy.maxStamina*ENEMY_STAMINA_RESTART_RATIO)enemy.sprintExhausted=false;
}

export function enemyMovementSpeed(enemy,requestedSpeed){
 initializeEnemyStamina(enemy);
 if(requestedSpeed<=enemy.speed)return requestedSpeed;
 if(enemy.sprintExhausted||enemy.stamina<=0)return enemy.speed;
 return requestedSpeed;
}

export function consumeEnemySprint(enemy,{sprinting,distance,speed,now}){
 initializeEnemyStamina(enemy);
 if(!sprinting||distance<=1e-6||speed<=enemy.speed)return;
 enemy.stamina=Math.max(0,enemy.stamina-ENEMY_STAMINA_DRAIN_PER_SECOND*distance/Math.max(speed,.001));
 enemy.sprintedLastTick=true;
 if(enemy.stamina<=0){
  enemy.sprintExhausted=true;
  enemy.staminaRecoveryAt=now+ENEMY_STAMINA_RECOVERY_DELAY_MS;
 }
}
