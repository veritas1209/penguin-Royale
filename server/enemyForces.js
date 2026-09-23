import {movementSegmentClear,advanceEnemyNavigation} from './enemyNavigation.js';
import {rememberEnemyPoint,rememberEnemyThreat} from './enemyPerception.js';
import {
 equipEnemy,
 ENEMY_WEAPON_QUALITIES,
} from './enemyCombat.js';

export const MAP_SNIPER_COUNT=10;
export const RESPONSE_PLATOON_SIZE=5;
export const RESPONSE_SNIPER_COUNT=1;
export const RESPONSE_DETECT_MARGIN=20;
export const RESPONSE_PATROL_RING=74;
export const RESPONSE_RENDER_ENTRY=68;
export const RESPONSE_RENDER_EXIT=92;
export const RESPONSE_VIRTUAL_SPEED=4.5;
export const ORDINARY_FORCE_MULTIPLIER=1.3;
export const REDUCED_RADIATION_GUARDS=Object.freeze(new Set(['silo-launch-guard-1','silo-factory-guard-1','silo-warehouse-guard-1','silo-dispatch-guard-0']));
const MAJOR_KINDS=new Set(['barracks','armory','support','silo','silo-sector','hydro','market','ruins','camp','industrial','village']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clampPoint=(world,point)=>{const half=world.size/2-1;return {x:Math.max(-half,Math.min(half,point.x)),z:Math.max(-half,Math.min(half,point.z))};};
const blockedSpawnTerrain=(world,point)=>(world.terrain??[]).some(t=>['river','reservoir'].includes(t.kind)&&Math.abs(point.x-t.x)<=t.w/2+.7&&Math.abs(point.z-t.z)<=t.d/2+.7);
function hash(value){let result=0;for(const char of String(value))result=(Math.imul(result,31)+char.charCodeAt(0))>>>0;return result;}
function safePoint(raid,origin,key,{minimumPlayerDistance=0,minimumEnemyDistance=.72,radii=[2.2,3.2,1.3,4.4]}={}){
 const phase=hash(key)/4294967296*Math.PI*2,players=[...raid.players.values()].filter(p=>p.alive&&!p.settlement);
 for(const radius of radii)for(let step=0;step<16;step++){
  const angle=phase+step*Math.PI*2/16,p={x:origin.x+Math.sin(angle)*radius,z:origin.z+Math.cos(angle)*radius};
  if(Math.abs(p.x)>raid.world.size/2-1||Math.abs(p.z)>raid.world.size/2-1||blockedSpawnTerrain(raid.world,p)||!movementSegmentClear(raid.world,p,p))continue;
  if(minimumPlayerDistance&&players.some(player=>distance(p,player)<minimumPlayerDistance))continue;
  if([...raid.enemies.values()].some(enemy=>distance(p,enemy)<minimumEnemyDistance))continue;
  return p;
 }
 return null;
}
function ordinaryTemplate(kind,x,z,now){
 const profiles={
  raider:{hp:115,speed:2.65,damage:15,attackMs:760,armor:.16,rangedRange:24,aggroRadius:34},
  heavy:{hp:190,speed:1.9,damage:21,attackMs:850,armor:.28,rangedRange:27,aggroRadius:36},
  sniper:{hp:105,speed:2.25,damage:43,attackMs:1500,armor:.25,rangedRange:76,aggroRadius:88},
 };
 const profile=profiles[kind]??profiles.raider;
 return {kind,x,z,...profile,maxHp:profile.hp,targetId:null,nextAttackAt:now+1200,stunnedUntil:now+700,alertState:'patrol',yaw:0};
}
function reinforceOrdinaryEnemies(raid){
 const zones=raid.world.radiationZones??[];
 const originals=[...raid.enemies.values()].filter(enemy=>!enemy.bossId&&!enemy.summonedBy&&!enemy.patrolSquadId&&!enemy.responsePlatoonId&&!enemy.mapSniper&&!zones.some(zone=>distance(enemy,zone)<=zone.radius));
 const extraCount=Math.round(originals.length*(ORDINARY_FORCE_MULTIPLIER-1));
 for(let index=0;index<extraCount;index++){
  const source=originals[Math.floor(index*originals.length/extraCount)];
  const id=source.id+'-reinforcement',point=safePoint(raid,source,id,{radii:[1.15,1.8,2.5,3.4],minimumEnemyDistance:.7});
  const clone={...source,id,x:point?.x??source.x+.75,z:point?.z??source.z+.75,hp:source.maxHp,maxHp:source.maxHp,targetId:null,nextAttackAt:raid.startedAt+700+(hash(id)%900),stunnedUntil:0,alertState:'patrol',reinforcement:true,reloadEndsAt:null,healEndsAt:null,shotsFired:0};
  equipEnemy(
 raid,
 clone,
 {qualities:ENEMY_WEAPON_QUALITIES.ordinary}
);raid.enemies.set(id,clone);
 }
 return {baseCount:originals.length,extraCount};
}
function sniperLandmarks(world){
 const preferred=['barracks','armory','support','hydro','market','camp','ruins','coal','fishing'];
 const radiation=world.radiationZones??[],outsideRadiation=point=>!radiation.some(zone=>distance(point,zone)<=zone.radius+24);
 const byId=new Map((world.landmarks??[]).map(point=>[point.id,point])),result=[];
 for(const id of preferred){const point=byId.get(id);if(point&&outsideRadiation(point))result.push(point);}
 for(const point of world.landmarks??[])if(result.length<MAP_SNIPER_COUNT&&!result.includes(point)&&MAJOR_KINDS.has(point.kind)&&outsideRadiation(point))result.push(point);
 return result.slice(0,MAP_SNIPER_COUNT);
}
function spawnMapSnipers(raid){
 const ids=[];
 for(const [index,landmark] of sniperLandmarks(raid.world).entries()){
  const id='map-sniper-'+(index+1),point=safePoint(raid,landmark,id,{radii:[12,16,20,24,8],minimumEnemyDistance:1});
  if(!point)continue;
  const enemy={id,name:'장거리 저격수',...ordinaryTemplate('sniper',point.x,point.z,raid.startedAt),mapSniper:true,homeX:point.x,homeZ:point.z};
  const sniperBase=index%3===0?'awm':index%3===1?'m24':'slr';
  const sniperQuality=ENEMY_WEAPON_QUALITIES.mapSniper[index%ENEMY_WEAPON_QUALITIES.mapSniper.length];
  const sniperWeaponId=sniperQuality==='intact'?sniperBase:`${sniperBase}-${sniperQuality}`;
  equipEnemy(raid,enemy,{
   kind:'sniper',
   scopeId:index%2?'scope-8x':'scope-6x',
   armorTier:index<6?4:5,
   weaponId:sniperWeaponId
  });
  raid.enemies.set(id,enemy);ids.push(id);
 }
 return ids;
}

const RADIATION_BOSS_IDS=new Set([
 'silo-warden',
 'radiation-tank',
]);

const BOSS_FALLBACK_WEAPONS=[
 'mk14',
 'groza',
 'aug',
 'slr',
];

function bossLoadoutRoll(
 raid,
 enemy,
 slot
){
 return hash(
  `${raid.id}:${enemy.id}:boss-loadout:${slot}`
 )/4294967296;
}

function bossPick(
 raid,
 enemy,
 slot,
 items
){
 if(!items.length)return null;

 let pool=[...items].sort(
  (a,b)=>String(a.id).localeCompare(String(b.id))
 );

 /*
  BC_BOSS_GOLD_3_PERCENT

  골드 장비 옵션 수 분포:
  1옵션 80%
  2옵션 15%
  3옵션  4%
  4옵션  1%

  기존 bossLoadoutRoll을 사용하므로
  같은 raid/enemy/slot은 재현 가능한 결과를 갖는다.
 */
 if(
  pool.length &&
  pool.every(item=>item?.quality===`gold`)
 ){
  const optionRoll=
   bossLoadoutRoll(
    raid,
    enemy,
    `${slot}:gold-option-count`
   );

  const optionCount=
   optionRoll<.80
    ?1
    :optionRoll<.95
     ?2
     :optionRoll<.99
      ?3
      :4;

  const exact=
   pool.filter(
    item=>
     Object.keys(
      item.goldTraitLevels??{}
     ).length===optionCount
   );

  /*
   해당 옵션 수 변형이 카탈로그에 있으면
   반드시 그 그룹 안에서만 선택.
  */
  if(exact.length)
   pool=exact;
 }

 return pool[
  hash(
   `${raid.id}:${enemy.id}:boss-pick:${slot}`
  )%pool.length
 ];
}

function bossGoldEligible(item){
 const count=
  Object.keys(
   item?.goldTraitLevels??{}
  ).length;

 return (
  item?.quality===`gold` &&
  count>=1 &&
  count<=4
 );
}

function bossEquipmentItem(
 raid,
 enemy,
 category,
 radiation
){
 const roll=
  bossLoadoutRoll(
   raid,
   enemy,
   `${category}:grade`
  );

 const gold=
  radiation
   ?roll>=.70
   :roll>=.97;

 const level=
  gold
   ?6
   :radiation
    ?6
    :roll<.57
     ?5
     :6;

 const pool=
  raid.catalog.items.filter(item=>{
   if(item.category!==category)
    return false;

   if(gold){
    return (
     bossGoldEligible(item) &&
     (item.equipmentLevel??6)===6
    );
   }

   return (
    item.quality!=='gold' &&
    (item.equipmentLevel??item.tier)===level
   );
  });

 return bossPick(
  raid,
  enemy,
  `${category}:item`,
  pool
 );
}

function bossWeaponAllowed(item){
 return (
  item?.category==='weapon' &&
  item.ammo &&
  !['flare','melee'].includes(item.mode) &&
  !['PISTOL','HG'].includes(
   item.family?.toUpperCase()??''
  )
 );
}

function bossWeaponBase(
 raid,
 enemy
){
 const current=
  raid.catalog.byId.get(enemy.weaponId);

 if(
  bossWeaponAllowed(current) &&
  (
   enemy.ability!=='robots' ||
   current.family==='SG'
  )
 ){
  return current.baseId??current.id;
 }

 if(enemy.ability==='robots'){
  const bases=[
   ...new Set(
    raid.catalog.items
     .filter(item=>
      bossWeaponAllowed(item) &&
      item.family==='SG'
     )
     .map(item=>item.baseId??item.id)
   )
  ].sort();

  if(bases.length)
   return bases[
    hash(
     `${raid.id}:${enemy.id}:robot-sg`
    )%bases.length
   ];
 }

 const available=
  BOSS_FALLBACK_WEAPONS.filter(base=>
   raid.catalog.items.some(item=>
    bossWeaponAllowed(item) &&
    (item.baseId??item.id)===base
   )
  );

 return available.length
  ?available[
    hash(
     `${raid.id}:${enemy.id}:boss-base`
    )%available.length
   ]
  :null;
}

function bossWeaponItem(
 raid,
 enemy,
 radiation
){
 const base=
  bossWeaponBase(raid,enemy);

 const roll=
  bossLoadoutRoll(
   raid,
   enemy,
   'weapon:grade'
  );

 const quality=
  radiation
   ?roll<.70
     ?'refined'
     :'gold'
   :roll<.50
    ?'improved'
    :roll<.97
     ?'refined'
     :'gold';

 let pool=
  raid.catalog.items.filter(item=>
   bossWeaponAllowed(item) &&
   (item.baseId??item.id)===base &&
   item.quality===quality &&
   (
    quality!=='gold' ||
    bossGoldEligible(item)
   )
  );

 /*
  해당 base에 골드 variant가 없는 특수 총기는
  같은 weapon family 안에서 fallback.
 */
 if(!pool.length){
  const current=
   raid.catalog.byId.get(enemy.weaponId);

  const family=
   enemy.ability==='robots'
    ?'SG'
    :current?.family;

  pool=
   raid.catalog.items.filter(item=>
    bossWeaponAllowed(item) &&
    item.quality===quality &&
    (
     !family ||
     item.family===family
    ) &&
    (
     quality!=='gold' ||
     bossGoldEligible(item)
    )
   );
 }

 return bossPick(
  raid,
  enemy,
  'weapon:item',
  pool
 );
}

export function equipBossLoadout(
 raid,
 enemy
){
 const radiation=
  RADIATION_BOSS_IDS.has(
   enemy.bossId
  );

 const weapon=
  bossWeaponItem(
   raid,
   enemy,
   radiation
  );

 const helmet=
  bossEquipmentItem(
   raid,
   enemy,
   'helmet',
   radiation
  );

 const armor=
  bossEquipmentItem(
   raid,
   enemy,
   'armor',
   radiation
  );

 const backpack=
  bossEquipmentItem(
   raid,
   enemy,
   'backpack',
   radiation
  );

 if(
  !weapon ||
  !helmet ||
  !armor ||
  !backpack
 ){
  throw new Error(
   `Incomplete boss loadout: ${enemy.bossId}`
  );
 }

 enemy.radiationBoss=radiation;

 equipEnemy(
  raid,
  enemy,
  {
   kind:enemy.kind,
   weaponId:weapon.id,
   helmetId:helmet.id,
   armorId:armor.id,
   backpackId:backpack.id,
   armorTier:
    armor.equipmentLevel??
    (armor.quality==='gold'
     ?6
     :armor.tier)
  }
 );

 enemy.bossLoadout={
  weaponId:enemy.weaponId,
  helmetId:enemy.helmetId,
  armorId:enemy.armorId,
  backpackId:enemy.backpackId,
  radiation
 };

 return enemy;
}



function goldenBossEquipmentItem(raid,enemy,category){
 const gold=bossLoadoutRoll(raid,enemy,`golden:${category}:grade`)>=.40;
 const pool=raid.catalog.items.filter(item=>{
  if(item.category!==category)return false;
  if(gold)return bossGoldEligible(item)&&(item.equipmentLevel??6)===6;
  return item.quality!==`gold`&&(item.equipmentLevel??item.tier)===6;
 });
 return bossPick(raid,enemy,`golden:${category}:item`,pool);
}

function goldenBossWeaponItem(raid,enemy){
 const base=bossWeaponBase(raid,enemy);
 const quality=bossLoadoutRoll(raid,enemy,`golden:weapon:grade`)<.40?`refined`:`gold`;
 let pool=raid.catalog.items.filter(item=>bossWeaponAllowed(item)&&(!base||(item.baseId??item.id)===base)&&item.quality===quality&&(quality!==`gold`||bossGoldEligible(item)));
 if(!pool.length){
  const family=raid.catalog.byId.get(enemy.weaponId)?.family;
  pool=raid.catalog.items.filter(item=>bossWeaponAllowed(item)&&item.quality===quality&&(!family||item.family===family)&&(quality!==`gold`||bossGoldEligible(item)));
 }
 return bossPick(raid,enemy,`golden:weapon:item`,pool);
}

export function equipGoldenBossLoadout(raid,enemy){
 const weapon=goldenBossWeaponItem(raid,enemy);
 const helmet=goldenBossEquipmentItem(raid,enemy,`helmet`);
 const armor=goldenBossEquipmentItem(raid,enemy,`armor`);
 const backpack=goldenBossEquipmentItem(raid,enemy,`backpack`);
 if(!weapon||!helmet||!armor||!backpack)throw new Error(`Incomplete golden boss loadout`);
 enemy.goldenBoss=true;
 enemy.radiationBoss=false;
 equipEnemy(raid,enemy,{kind:enemy.kind,weaponId:weapon.id,helmetId:helmet.id,armorId:armor.id,backpackId:backpack.id,armorTier:armor.equipmentLevel??(armor.quality===`gold`?6:armor.tier)});
 enemy.bossLoadout={weaponId:enemy.weaponId,helmetId:enemy.helmetId,armorId:enemy.armorId,backpackId:enemy.backpackId,radiation:false,golden:true};
 return enemy;
}

export function initEnemyForces(raid){
 for(const id of REDUCED_RADIATION_GUARDS)raid.enemies.delete(id);
 for(const enemy of raid.enemies.values()){
  /*
   보스는 initBosses에서 지정된 원래 무기 계열을 보존한다.
   등급만 improved/refined 범위로 올린다.
  */
  if(enemy.bossId){
   equipBossLoadout(
    raid,
    enemy
   );
  }else{
   equipEnemy(
    raid,
    enemy,
    {
     kind:enemy.kind,
     qualities:enemy.bossId
      ?ENEMY_WEAPON_QUALITIES.elite
      :ENEMY_WEAPON_QUALITIES.ordinary
    }
   );
  }
 }
 const reinforcement=reinforceOrdinaryEnemies(raid),sniperIds=spawnMapSnipers(raid);
 const radiation=raid.world.radiationZones?.[0]??{id:'map-center',name:'Map center',x:0,z:0,radius:58};
 const zone={id:'map-center',name:radiation.name??'Radiation perimeter',x:radiation.x??0,z:radiation.z??0,radius:radiation.radius??58};
 const angle=hash(raid.id+':response-egress')/4294967296*Math.PI*2;
 const response={id:'response-central',zone,deployed:false,defeated:false,ids:[],alertPoint:null,targetId:null,alertUntil:0,mode:'egress',virtual:true,virtualX:zone.x,virtualZ:zone.z,patrolAngle:angle,chaseUnlocked:false};
 raid.majorResponses=new Map([[zone.id,response]]);deployResponse(raid,response,raid.startedAt);
 raid.enemyForceSummary={baseOrdinary:reinforcement.baseCount,reinforcements:reinforcement.extraCount,multiplier:ORDINARY_FORCE_MULTIPLIER,sniperIds};
}
function responseFormationPoint(state,slot,radius=6){
 const angle=(slot??0)*Math.PI*2/RESPONSE_PLATOON_SIZE;
 return {x:state.virtualX+Math.sin(angle)*radius,z:state.virtualZ+Math.cos(angle)*radius};
}
function deployResponse(raid,state,now){
 if(state.deployed||state.defeated)return false;
 state.deployed=true;
 for(let i=0;i<RESPONSE_PLATOON_SIZE;i++){
  const sniper=i>=RESPONSE_PLATOON_SIZE-RESPONSE_SNIPER_COUNT,kind=sniper?'sniper':i%4===0?'heavy':'raider',id=state.id+'-'+i;
  const origin=responseFormationPoint(state,i,2.5),point=safePoint(raid,origin,id,{radii:[0,1.5,3,5],minimumPlayerDistance:10,minimumEnemyDistance:1})??origin;
  const enemy={id,name:sniper?'대응 소대 저격수':'대응 소대 전투원',...ordinaryTemplate(kind,point.x,point.z,now),responsePlatoonId:state.id,responseSlot:i,responseVirtual:true,homeX:point.x,homeZ:point.z};
  enemy.hp+=30;enemy.maxHp+=30;
  const armorTier=i<3?6:5,refined=sniper||i===0;
  const responseBase=sniper?'m24':refined?'mk14':([null,'mg3','groza','beryl-m762'][i]??'groza');
  const responseQuality=ENEMY_WEAPON_QUALITIES.elite[i%ENEMY_WEAPON_QUALITIES.elite.length];
  const responseWeaponId=`${responseBase}-${responseQuality}`;
  equipEnemy(raid,enemy,sniper
   ?{kind:'sniper',scopeId:'scope-8x',armorTier,weaponId:responseWeaponId}
   :{kind,armorTier,weaponId:responseWeaponId}
  );
  raid.enemies.set(id,enemy);state.ids.push(id);
 }
 raid.event('response_platoon_deployed',{platoonId:state.id,zoneId:state.zone.id,zoneName:state.zone.name,count:state.ids.length,snipers:state.ids.filter(id=>raid.enemies.get(id)?.kind==='sniper').length});
 return true;
}
function moveAbstractResponse(state,target,dt){
 const dx=target.x-state.virtualX,dz=target.z-state.virtualZ,d=Math.hypot(dx,dz);if(d<.001)return true;
 const step=Math.min(d,RESPONSE_VIRTUAL_SPEED*Math.max(0,Math.min(dt,.25)));state.virtualX+=dx/d*step;state.virtualZ+=dz/d*step;return step>=d-.001;
}
function materializeResponse(raid,state,members){
 for(const member of members){
  const origin=responseFormationPoint(state,member.responseSlot,6),point=safePoint(raid,origin,member.id+':materialize',{radii:[0,1.5,3,5],minimumPlayerDistance:8,minimumEnemyDistance:.7})??origin;
  member.x=point.x;member.z=point.z;member.responseVirtual=false;member.ignorePursuitLeash=state.chaseUnlocked;
 }
 state.virtual=false;
}
function virtualizeResponse(state,members){
 if(members.length){state.virtualX=members.reduce((sum,m)=>sum+m.x,0)/members.length;state.virtualZ=members.reduce((sum,m)=>sum+m.z,0)/members.length;}
 for(const member of members){member.responseVirtual=true;member.targetId=null;}
 state.virtual=true;
}
export function isVirtualResponseEnemy(enemy){return !!enemy?.responsePlatoonId&&enemy.responseVirtual===true;}
export function isResponseLeashExempt(enemy){return !!enemy?.responsePlatoonId&&enemy.ignorePursuitLeash===true;}
export function updateMajorResponseTracking(raid,now,dt=.1){
 const state=raid.majorResponses?.get('map-center');if(!state||state.defeated)return false;
 const members=state.ids.map(id=>raid.enemies.get(id)).filter(Boolean);
 if(!members.length){state.defeated=true;state.deployed=false;state.alertPoint=null;state.targetId=null;return false;}
 const players=[...raid.players.values()].filter(player=>player.alive&&!player.downed&&!player.boarded&&!player.settlement);
 if(!state.virtual){state.virtualX=members.reduce((sum,m)=>sum+m.x,0)/members.length;state.virtualZ=members.reduce((sum,m)=>sum+m.z,0)/members.length;}
 if(!state.chaseUnlocked){
  const detected=players.filter(player=>distance(player,state.zone)<=state.zone.radius+RESPONSE_DETECT_MARGIN).sort((a,b)=>distance(a,state.zone)-distance(b,state.zone))[0];
  if(detected){state.chaseUnlocked=true;state.mode='chase';state.targetId=detected.id;state.alertUntil=Infinity;state.alertPoint={x:detected.x,z:detected.z};for(const member of members)member.ignorePursuitLeash=true;}
 }
 if(state.chaseUnlocked){
  let target=raid.players.get(state.targetId);if(!players.includes(target)){const center={x:state.virtualX,z:state.virtualZ};target=players.reduce((best,p)=>!best||distance(p,center)<distance(best,center)?p:best,null);}
  if(target){state.targetId=target.id;state.alertPoint={x:target.x,z:target.z};}
 }
 if(state.virtual){
  if(state.mode==='egress'){
   const target={x:state.zone.x+Math.sin(state.patrolAngle)*RESPONSE_PATROL_RING,z:state.zone.z+Math.cos(state.patrolAngle)*RESPONSE_PATROL_RING};if(moveAbstractResponse(state,target,dt))state.mode='patrol';
  }else if(state.mode==='patrol'){
   state.patrolAngle+=RESPONSE_VIRTUAL_SPEED*Math.max(0,Math.min(dt,.25))/RESPONSE_PATROL_RING;
   state.virtualX=state.zone.x+Math.sin(state.patrolAngle)*RESPONSE_PATROL_RING;state.virtualZ=state.zone.z+Math.cos(state.patrolAngle)*RESPONSE_PATROL_RING;
  }else if(state.alertPoint)moveAbstractResponse(state,state.alertPoint,dt);
 }
 const minDistance=players.length?Math.min(...players.map(player=>Math.hypot(player.x-state.virtualX,player.z-state.virtualZ))):Infinity;
 if(state.virtual&&minDistance<=RESPONSE_RENDER_ENTRY)materializeResponse(raid,state,members);
 else if(!state.virtual&&minDistance>=RESPONSE_RENDER_EXIT)virtualizeResponse(state,members);
 if(!state.virtual&&state.chaseUnlocked&&state.alertPoint)for(const member of members)rememberEnemyPoint(member,state.targetId,state.alertPoint,now,{seen:false});
 return true;
}
export function alertMajorResponse(raid,_enemy,point,targetId,now){
 const state=raid.majorResponses?.get('map-center');if(!state||state.defeated||!point)return false;
 if(!state.chaseUnlocked&&distance(point,state.zone)>state.zone.radius+RESPONSE_DETECT_MARGIN)return false;
 state.chaseUnlocked=true;state.mode='chase';state.targetId=targetId;state.alertPoint={x:point.x,z:point.z};state.alertUntil=Infinity;
 for(const id of state.ids){const member=raid.enemies.get(id);if(member)member.ignorePursuitLeash=true;}
 return true;
}
export function advanceMajorResponse(raid,enemy,dt,now,budget){
 if(!enemy.responsePlatoonId)return false;
 const state=[...(raid.majorResponses?.values()??[])].find(item=>item.id===enemy.responsePlatoonId);if(!state||enemy.responseVirtual)return true;
 const slot=enemy.responseSlot??0,angle=slot*Math.PI*2/RESPONSE_PLATOON_SIZE,center=state.mode==='chase'&&state.alertPoint?state.alertPoint:{x:state.virtualX,z:state.virtualZ};
 const radius=state.mode==='chase'?(enemy.kind==='sniper'?38:enemy.kind==='heavy'?11:17+(slot%2)*3):6;
 const goal=clampPoint(raid.world,{x:center.x+Math.sin(angle)*radius,z:center.z+Math.cos(angle)*radius});
 enemy.alertState=state.mode==='chase'?'investigate':'patrol';advanceEnemyNavigation(raid.world,enemy,goal,dt,now,budget,{speedMultiplier:state.mode==='chase'?1.18:.7});return true;
}
export function broadcastEnemyThreat(raid,source,player,now){
 if(!player)return;
 for(const ally of raid.enemies.values()){
  if(ally===source||distance(ally,source)<=45||ally.patrolSquadId&&ally.patrolSquadId===source.patrolSquadId||ally.responsePlatoonId&&ally.responsePlatoonId===source.responsePlatoonId)rememberEnemyThreat(ally,player,now);
 }
 alertMajorResponse(raid,source,player,player.id,now);
}
function combatRole(enemy){
 if(enemy.kind==='sniper')return 'overwatch';
 if(enemy.kind==='heavy')return 'breach';
 const slot=enemy.responseSlot??enemy.patrolSlot??0;return slot%2?'flank':'suppress';
}
function groupCombatPoint(raid,enemy,target,now){
 const groupId=enemy.responsePlatoonId??enemy.patrolSquadId;if(!groupId)return null;
 const slot=enemy.responseSlot??enemy.patrolSlot??0,role=combatRole(enemy),cached=enemy.tacticalSlot;
 if(cached&&now<cached.expiresAt&&distance(cached.anchor,target)<6)return cached.point;
 const phase=hash(groupId)/4294967296*Math.PI*2,angle=phase+slot*Math.PI*2/5;
 const radius=role==='overwatch'?Math.min(48,enemy.preferredRange??42):role==='breach'?11:role==='flank'?20:16;
 const origin=clampPoint(raid.world,{x:target.x+Math.sin(angle)*radius,z:target.z+Math.cos(angle)*radius});
 const point=safePoint(raid,origin,enemy.id+':combat-slot:'+Math.floor(now/4000),{radii:[0,2.5,5,7],minimumEnemyDistance:.8})??origin;
 enemy.tacticalRole=role;enemy.tacticalSlot={point,anchor:{x:target.x,z:target.z},expiresAt:now+3500+hash(enemy.id)%1000};return point;
}
export function tacticalGoal(raid,enemy,target,now){
 const d=distance(enemy,target);
 if(enemy.bossId){if(d>enemy.rangedRange)return {point:target,move:true};return {point:null,move:false};}
 if(d<(enemy.minRange??0)){
  const dx=enemy.x-target.x,dz=enemy.z-target.z,length=Math.max(.001,Math.hypot(dx,dz)),origin={x:enemy.x+dx/length*9,z:enemy.z+dz/length*9};
  const point=safePoint(raid,origin,enemy.id+':retreat:'+Math.floor(now/3000),{radii:[0,2,4],minimumEnemyDistance:.4});
  return {point:point??origin,move:true};
 }
 if(now<(enemy.repositionUntil??0)&&enemy.repositionPoint)return {point:enemy.repositionPoint,move:true};
 if(now-(enemy.lastHitAt??0)<3500||enemy.kind==='sniper'&&d<(enemy.preferredRange??35)*.7){
  const side=(hash(enemy.id+':'+Math.floor(now/3500))&1?1:-1),dx=enemy.x-target.x,dz=enemy.z-target.z,length=Math.max(.001,d),radial=enemy.preferredRange??d;
  const origin={x:target.x+dx/length*radial-dz/length*side*5,z:target.z+dz/length*radial+dx/length*side*5};
  enemy.repositionPoint=safePoint(raid,origin,enemy.id+':flank:'+Math.floor(now/3500),{radii:[0,2.5,5],minimumEnemyDistance:.4})??origin;
  enemy.repositionUntil=now+2200;return {point:enemy.repositionPoint,move:true};
 }
 const groupPoint=groupCombatPoint(raid,enemy,target,now);
 if(groupPoint&&distance(enemy,groupPoint)>2.5)return {point:groupPoint,move:true};
 if(d>enemy.rangedRange)return {point:target,move:true};
 return {point:null,move:false};
}
export function separateEnemies(raid,enemies=raid.enemies.values()){
 const cells=new Map(),size=1.2;
 for(const enemy of enemies){
  const key=Math.floor(enemy.x/size)+','+Math.floor(enemy.z/size),near=[];
  const bx=Math.floor(enemy.x/size),bz=Math.floor(enemy.z/size);
  for(let x=bx-1;x<=bx+1;x++)for(let z=bz-1;z<=bz+1;z++)near.push(...(cells.get(x+','+z)??[]));
  for(const other of near){
   const dx=enemy.x-other.x,dz=enemy.z-other.z,d=Math.hypot(dx,dz);if(d>=.78)continue;
   const nx=d>.001?dx/d:(hash(enemy.id)&1?1:-1),nz=d>.001?dz/d:0,push=(.78-Math.max(d,.001))*.5;
   const a={x:enemy.x+nx*push,z:enemy.z+nz*push},b={x:other.x-nx*push,z:other.z-nz*push};
   if(movementSegmentClear(raid.world,enemy,a)){enemy.x=a.x;enemy.z=a.z;}
   if(movementSegmentClear(raid.world,other,b)){other.x=b.x;other.z=b.z;}
  }
  let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(enemy);
 }
}
