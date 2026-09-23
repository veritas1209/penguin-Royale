import {goldEquipmentEffects} from '../shared/goldEquipment.ts';
import {randomUUID} from 'node:crypto';
import {initializeEnemyStamina} from './enemyStamina.js';
import {emitFirearmSound} from './firearmSound.js';
import {weaponAttachmentQualityEffects} from '../shared/attachmentQualities.ts';
import {firearmCadence,nextShotIntervalMs} from '../shared/firearmCadence.ts';
import {isPistolWeapon} from '../shared/weaponSlots.ts';

const WEAPON_BASES={
 scout:['ump45','mp5k','m416'],
 raider:['m416','akm','qbz','scar-l'],
 heavy:['mk14','m249','dp-28','slr'],
 commander:['mk14','groza','aug','slr'],
 sniper:['m24','awm','slr','mk12','kar98k'],
};

export const ENEMY_WEAPON_QUALITIES=Object.freeze({
 ordinary:Object.freeze(['broken','repaired','intact']),
 mapSniper:Object.freeze(['intact','improved']),
 patrol:Object.freeze(['intact','improved','refined']),
 elite:Object.freeze(['improved','refined']),
});

function qualityWeaponId(base,quality){
 return quality==='intact'?base:`${base}-${quality}`;
}

const PROFILES={
 scout:{range:22,vision:26,spread:.075,reaction:800,bulletSpeed:42,attackFloor:620,armorTier:2},
 raider:{range:30,vision:26,spread:.052,reaction:800,bulletSpeed:48,attackFloor:500,armorTier:3},
 heavy:{range:28,vision:26,spread:.045,reaction:900,bulletSpeed:46,attackFloor:650,armorTier:4},
 commander:{range:38,vision:26,spread:.035,reaction:900,bulletSpeed:54,attackFloor:500,armorTier:5},
 sniper:{range:76,vision:48,spread:.012,reaction:1200,bulletSpeed:78,attackFloor:1350,armorTier:4},
 drone:{range:10,vision:26,spread:.09,reaction:650,bulletSpeed:34,attackFloor:700,armorTier:2},
};
function hash(value){
 let result=2166136261;
 for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619);}
 return result>>>0;
}
function random01(value){return hash(value)/4294967296;}
function usableEnemyWeapon(item){
 return !!item &&
  item.category==='weapon' &&
  item.ammo &&
  !isPistolWeapon(item) &&
  !['flare','melee'].includes(item.mode);
}

function pickWeapon(
 catalog,
 kind,
 id,
 qualities=ENEMY_WEAPON_QUALITIES.ordinary
){
 const choices=WEAPON_BASES[kind]??WEAPON_BASES.raider;
 const seed=hash(id);

 const quality=
  qualities[seed%qualities.length]??'intact';

 const index=
  Math.floor(seed/qualities.length)%choices.length;

 for(let offset=0;offset<choices.length;offset++){
  const base=choices[(index+offset)%choices.length];

  const item=catalog.byId.get(
   qualityWeaponId(base,quality)
  );

  if(item)return item;
 }

 return catalog.items.find(item=>
  item.category==='weapon' &&
  item.ammo &&
  !['flare','melee'].includes(item.mode) &&
  !['PISTOL','HG'].includes(
   item.family?.toUpperCase()??''
  ) &&
  qualities.includes(item.quality??'intact')
 );
}

export const PLAYER_SPRINT_SPEED=9;

export function enemyCombatMoveSpeed(raid,enemy,now){
 if(enemy.alertState!=='combat'||now<(enemy.reactionReadyAt??0))return null;
 return PLAYER_SPRINT_SPEED;
}

export function equipEnemy(raid,enemy,{kind=enemy.kind,weaponId,scopeId,armorTier,helmetId,armorId,backpackId,damage,range,vision,name,qualities=ENEMY_WEAPON_QUALITIES.ordinary}={}){
 const profile=PROFILES[kind]??PROFILES.raider,
 requested=weaponId?raid.catalog.byId.get(weaponId):null,
 weapon=requested&&!isPistolWeapon(requested)
  ?requested
  :pickWeapon(raid.catalog,kind,enemy.id,qualities);
 enemy.weaponId=weapon?.id??null;

 enemy.helmetId=
  helmetId??enemy.helmetId??null;

 enemy.armorId=
  armorId??enemy.armorId??null;

 enemy.backpackId=
  backpackId??enemy.backpackId??null;

 enemy.scopeId=scopeId??(kind==='sniper'?(hash(enemy.id)&1?'scope-8x':'scope-6x'):null);
 enemy.attachments={...(enemy.attachments??{}),...(enemy.scopeId?{scope:enemy.scopeId}:{})};
 const equippedArmor=
  raid.catalog.byId.get(enemy.armorId);

 const actualArmorTier=
  equippedArmor
   ?Math.min(
     6,
     Math.max(
      1,
      equippedArmor.equipmentLevel??
       (equippedArmor.quality==='gold'
        ?6
        :equippedArmor.tier??profile.armorTier)
     )
    )
   :armorTier??profile.armorTier;

 enemy.armorTier=actualArmorTier;

 const tierArmor=
  [0,.03,.08,.16,.25,.34,.44]
   [enemy.armorTier]??.08;

 /*
  보스는 실제 장착 갑옷을 기준으로 tier 방어율 결정.
  일반 AI의 기존 armor 보정은 그대로 유지.
 */
 enemy.armor=
  enemy.bossId&&enemy.armorId
   ?tierArmor
   :Math.max(enemy.armor??0,tierArmor);

 const gold=
  goldEquipmentEffects(
   {
    helmet:enemy.helmetId,
    armor:enemy.armorId,
    backpack:enemy.backpackId
   },
   id=>raid.catalog.byId.get(id)
  );

 enemy.goldDamageReduction=
  gold.damageReduction;

 enemy.headshotFlatReduction=
  gold.headshotFlatReduction;

 enemy.bossSpecialReduction=
  gold.bossSpecialReduction;

 enemy.flatDamageReduction=
  gold.flatDamageReduction;

 enemy.fireReduction=
  gold.fireReduction;

 enemy.explosiveReduction=
  gold.explosiveReduction;

 enemy.flashImmune=
  gold.flashImmune;

 enemy.equipmentWeightInfluenceReduction=
  gold.equipmentWeightInfluenceReduction;

 enemy.secureCapacityBonus=
  gold.secureCapacityBonus;

 enemy.reviveTimeReduction=
  gold.reviveTimeReduction;

 enemy.bonusLootChance=
  gold.bonusLootChance;
 enemy.rangedRange=range??Math.max(enemy.rangedRange??0,Math.min(profile.range,(weapon?.range??profile.range)*(enemy.scopeId==='scope-8x'?1.4:enemy.scopeId==='scope-6x'?1.3:1)));
 enemy.aggroRadius=vision??profile.vision;
 enemy.reactionMs=Math.max(
  1,
  Math.round(
   profile.reaction*
   (weapon?.aimTimeMultiplier??1)
  )
 );
 enemy.visionFov=kind==='sniper'?170:110;
 enemy.bulletSpeed=profile.bulletSpeed;
 enemy.aimSpread=Math.min(
  profile.spread,
  weapon?.spread??profile.spread
 );
 enemy.magazineSize=Math.max(1,weapon?.magazine??(kind==='sniper'?5:20));
 enemy.ammoInMagazine=enemy.ammoInMagazine??enemy.magazineSize;
 enemy.reserveMagazines=enemy.reserveMagazines??4;
 enemy.reloadMs=Math.max(900,(weapon?.reload??2.5)*1000);
 enemy.reloadEndsAt=enemy.reloadEndsAt??null;
 enemy.attackMs=firearmCadence(weapon).intervalMs;
 enemy.damage=weapon?.damage??damage??enemy.damage??(kind==='sniper'?42:13);
 enemy.weaponArmorIgnore=weapon?.armorIgnore??0;
 enemy.preferredRange=kind==='sniper'?Math.min(enemy.rangedRange*.72,50):enemy.rangedRange*.68;
 enemy.minRange=kind==='sniper'?18:Math.max(3,enemy.rangedRange*.28);
 enemy.patrolRadius=30;
 enemy.medicalUses=enemy.medicalUses??(kind==='commander'||kind==='heavy'||kind==='sniper'?1:0);
 enemy.medicalItemId=enemy.medicalItemId??(enemy.medicalUses>0?'first-aid':null);
 enemy.shotsFired=enemy.shotsFired??0;
 enemy.yaw=enemy.yaw??(random01(enemy.id+'-yaw')*Math.PI*2-Math.PI);
 enemy.name=name??enemy.name;
 enemy.homeX=Number.isFinite(enemy.homeX)?enemy.homeX:enemy.x;enemy.homeZ=Number.isFinite(enemy.homeZ)?enemy.homeZ:enemy.z;
 initializeEnemyStamina(enemy);
 return enemy;
}
export function updateEnemyActions(raid,enemy,now,{hasTarget=false}={}){
 if(enemy.reloadEndsAt&&now>=enemy.reloadEndsAt){
  enemy.reloadEndsAt=null;
  if(enemy.reserveMagazines>0){enemy.reserveMagazines--;enemy.ammoInMagazine=enemy.magazineSize;}
  raid.event('enemy_reloaded',{enemyId:enemy.id,weaponId:enemy.weaponId});
 }
 if(enemy.healEndsAt&&now>=enemy.healEndsAt){
  enemy.healEndsAt=null;enemy.hp=Math.min(enemy.maxHp,enemy.hp+Math.max(22,enemy.maxHp*.24));
  raid.event('enemy_healed',{enemyId:enemy.id,hp:enemy.hp});
 }
 if(hasTarget&&enemy.healEndsAt)enemy.healEndsAt=null;
 if(!hasTarget){enemy.burstShotsRemaining=0;enemy.nextBurstShotAt=0;}
 if(!hasTarget&&!enemy.healEndsAt&&!enemy.reloadEndsAt&&enemy.medicalUses>0&&enemy.hp>0&&enemy.hp<enemy.maxHp*.38){
  enemy.medicalUses--;enemy.healEndsAt=now+2500;enemy.alertState='healing';
  raid.event('enemy_heal_started',{enemyId:enemy.id,endsAt:enemy.healEndsAt});
 }
}
export function faceEnemyTarget(enemy,target){
 const dx=target.x-enemy.x,dz=target.z-enemy.z;if(Math.hypot(dx,dz)>.001)enemy.yaw=Math.atan2(dx,dz);
}
function beginReload(raid,enemy,now){
 if(enemy.reloadEndsAt||enemy.reserveMagazines<=0)return false;
 enemy.burstShotsRemaining=0;enemy.nextBurstShotAt=0;
 enemy.reloadEndsAt=now+enemy.reloadMs;enemy.alertState='reloading';
 raid.event('enemy_reload_started',{enemyId:enemy.id,weaponId:enemy.weaponId,endsAt:enemy.reloadEndsAt});
 return true;
}
const CAMERA_HALF_HEIGHT=11.5,CAMERA_ASPECT=16/9,CAMERA_LOOK_AHEAD=1.6,CAMERA_GROUND_VERTICAL_SCALE=Math.hypot(21,19)/21,CAMERA_VISIBILITY_MARGIN=1,SCOPE_8X_EXPANSION=2.12;
export function enemyInsidePlayerViewport(enemy,player,aspect=CAMERA_ASPECT,expansion=SCOPE_8X_EXPANSION){
 const yaw=player.yaw??0,centerX=player.x+Math.sin(yaw)*CAMERA_LOOK_AHEAD,centerZ=player.z+Math.cos(yaw)*CAMERA_LOOK_AHEAD;
 const halfX=CAMERA_HALF_HEIGHT*aspect*expansion+CAMERA_VISIBILITY_MARGIN,halfZ=CAMERA_HALF_HEIGHT*CAMERA_GROUND_VERTICAL_SCALE*expansion+CAMERA_VISIBILITY_MARGIN;
 return Math.abs(enemy.x-centerX)<=halfX&&Math.abs(enemy.z-centerZ)<=halfZ;
}
export function fireEnemyProjectile(raid,enemy,target,now){
 const weapon=raid.catalog.byId.get(enemy.weaponId);
 const continuing=
  weapon?.mode==='burst' &&
  (enemy.burstShotsRemaining??0)>0;

 if(
  enemy.healEndsAt ||
  enemy.reloadEndsAt ||
  now<(enemy.reactionReadyAt??0) ||
  (!continuing&&now<(enemy.nextAttackAt??0)) ||
  (continuing&&now<(enemy.nextBurstShotAt??0))
 )return false;

 if(
  enemy.kind==='sniper' &&
  !enemy.responsePlatoonId &&
  !enemyInsidePlayerViewport(enemy,target)
 ){
  enemy.burstShotsRemaining=0;
  return false;
 }

 if((enemy.ammoInMagazine??0)<=0){
  enemy.burstShotsRemaining=0;
  beginReload(raid,enemy,now);
  return false;
 }

 const dx=target.x-enemy.x;
 const dz=target.z-enemy.z;
 const distance=Math.hypot(dx,dz);

 if(distance<.001)return false;

 const speed=enemy.bulletSpeed??48;
 const travel=distance/speed;
 const input=target.input??{};
 const moveLength=Math.hypot(
  input.moveX??0,
  input.moveZ??0
 );

 const moveScale=
  moveLength>1?1/moveLength:1;

 const playerSpeed=
  4.1*
  (target.moveMultiplier??1)*
  (input.sprint?1.55:1);

 const leadX=
  (input.moveX??0)*
  moveScale*
  playerSpeed*
  travel*.72;

 const leadZ=
  (input.moveZ??0)*
  moveScale*
  playerSpeed*
  travel*.72;

 let aim=Math.atan2(
  dx+leadX,
  dz+leadZ
 );

 const spread=
  (enemy.aimSpread??.05)*
  (
   1+
   Math.max(
    0,
    distance-(enemy.preferredRange??distance)
   )/
   Math.max(10,enemy.rangedRange)
  );

 aim+=
  (random01(
   enemy.id+':'+enemy.shotsFired
  )-.5)*2*spread;

 const direction={
  x:Math.sin(aim),
  z:Math.cos(aim)
 };

 const id=randomUUID();
 const roundsBeforeShot=enemy.ammoInMagazine;

 enemy.yaw=aim;
 enemy.shotsFired++;
 enemy.ammoInMagazine--;
 enemy.aimingUntil=now+250;

 const rule=firearmCadence(weapon);
 const cadence=rule.intervalMs;

 /*
  자동: 인위적인 AI 점사 없음.
  점사: 총기 자체 burst 값만 사용.
 */
 if(continuing){
  enemy.burstShotsRemaining--;
 }else if(weapon?.mode==='burst'){
  enemy.burstShotsRemaining=
   Math.min(
    Math.max(
     2,
     weapon?.burst??rule.burst??3
    )-1,
    enemy.ammoInMagazine
   );
 }else{
  enemy.burstShotsRemaining=0;
 }

 if(enemy.ammoInMagazine<=0)
  enemy.burstShotsRemaining=0;

 if(enemy.burstShotsRemaining>0){
  enemy.nextBurstShotAt=
   now+cadence;
 }else{
  enemy.nextAttackAt=
   now+
   nextShotIntervalMs(
    weapon,
    roundsBeforeShot
   );
 }

 const remaining=
  Math.max(
   (weapon?.range??enemy.rangedRange)+8,
   distance+3
  );

 raid.projectiles.set(id,{
  id,
  kind:'enemy-round',
  ownerId:enemy.id,
  sourceEnemyId:enemy.id,
  hostile:true,
  weaponId:enemy.weaponId,

  x:enemy.x+direction.x*.62,
  z:enemy.z+direction.z*.62,

  vx:direction.x*speed,
  vz:direction.z*speed,

  damage:weapon?.damage??enemy.damage,

  radius:.5,
  remaining,
  explosive:false,
  createdAt:now,

  expiresAt:
   now+
   Math.min(
    2200,
    remaining/speed*1000+300
   )
 });

 if(raid.perfStats)
  raid.perfStats.enemyShots=
   (raid.perfStats.enemyShots??0)+1;

 const barrelId=
  enemy.attachments?.barrel ??
  enemy.equipment?.barrel ??
  enemy.gear?.barrel;

 const barrel=
  barrelId
   ?raid.catalog.byId.get(barrelId)
   :undefined;

 const fitting=
  weaponAttachmentQualityEffects({barrel});

 const suppressed=fitting.suppressed;

 const noiseRadius=
  Math.max(
   38,
   (weapon?.range??25)*1.15
  )*
  fitting.noiseMultiplier;

 const ammo=
  raid.catalog.byId.get(
   weapon?.ammo
  );

 const gunshot=
  emitFirearmSound(raid,{
   sourceKind:'enemy',
   sourceId:enemy.id,
   enemyId:enemy.id,
   targetId:target.id,

   weapon,
   ammo,

   x:enemy.x,
   z:enemy.z,

   aimX:direction.x,
   aimZ:direction.z,

   suppressed,
   noiseRadius,
   now,
   projectileId:id
  });

 raid.event('enemy_shot',{
  enemyId:enemy.id,
  playerId:target.id,
  kind:enemy.kind,

  weaponId:enemy.weaponId,
  ammoId:ammo?.id??weapon?.ammo,

  suppressed,

  x:enemy.x,
  z:enemy.z,

  projectileId:id,
  aimX:direction.x,
  aimZ:direction.z,

  ...(gunshot??{})
 });

 if(enemy.ammoInMagazine<=0)
  enemy.reloadQueued=true;

 return true;
}

export function queueEnemyReload(raid,enemy,now){
 if(enemy.reloadQueued&&!enemy.reloadEndsAt){enemy.reloadQueued=false;beginReload(raid,enemy,now);}
}