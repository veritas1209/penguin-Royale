import {isPurpleLoot,inRadiation,lootQuantity,isAcquirableGold,lootCandidateItems} from './loot.js';
import {pairWorldFlareLoot} from './loot.js';
import {createContainer} from './containers.js';
import {enemyLineOfSight} from './enemyPerception.js';
import {isPistolWeapon} from '../shared/weaponSlots.ts';

// Arctic-inspired original encounters. Numeric combat/drop tuning is project-owned.
export const BOSS_ENCOUNTERS = [
 {enemyId:'barracks-guard-2',id:'barracks-robo',name:'로보',zoneName:'특수 병영',hp:1100,armor:.34,damage:27,ability:'robots',radius:30,color:'#a79e82'},
 {enemyId:'silo-dispatch-guard-1',id:'radiation-tank',name:'방사능 중장갑 탱크',zoneName:'사일로 하부 방어선',hp:1650,armor:.55,damage:29,ability:'shockwave',radius:24,color:'#bd9a73'},
 {enemyId:'armory-guard-2',id:'armory-command',name:'아틱 커맨더',zoneName:'무기고 전초기지',hp:950,armor:.32,damage:23,ability:'frost',radius:30,color:'#cfa75f'},
 {enemyId:'support-guard-2',id:'support-bulwark',name:'코브라 지휘관',zoneName:'지원센터',hp:1200,armor:.42,damage:27,ability:'barrage',radius:30,color:'#d78864'},
 {enemyId:'silo-launch-guard-0',id:'silo-warden',name:'사일로 감시관',zoneName:'미사일 사일로',hp:1450,armor:.38,damage:25,ability:'barrage',radius:32,color:'#aa91c1'},
];
export function initBosses(raid){
 raid.bossZones=[];raid.bossWarnings=[];
 const scale=1+Math.max(0,raid.players.size-1)*.45;
 for(const config of BOSS_ENCOUNTERS){
  const enemy=raid.enemies.get(config.enemyId);if(!enemy)continue;
  Object.assign(enemy,{kind:'commander',bossId:config.id,bossLetterId:'password-letter-'+({'barracks-robo':'yellow','radiation-tank':'black','armory-command':'red','support-bulwark':'green','silo-warden':'white'}[config.id]),name:config.name,zoneName:config.zoneName,hp:Math.round(config.hp*scale),maxHp:Math.round(config.hp*scale),armor:config.armor,damage:config.damage,aggroRadius:22,rangedRange:16,speed:1.8,attackMs:1150,phase:1,homeX:enemy.x,homeZ:enemy.z,nextAbilityAt:raid.startedAt+5000,ability:config.ability});
  raid.bossZones.push({id:config.id,enemyId:enemy.id,name:config.zoneName,bossName:config.name,x:enemy.x,z:enemy.z,radius:config.radius,color:config.color,defeated:false});
 }
}
function clearLine(world,a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 return !(world.obstacles??[]).some(o=>{
  if(o.bulletPassable)return false;
  let near=0,far=1;
  for(const [start,delta,low,high]of [[a.x,dx,o.x-o.w/2,o.x+o.w/2],[a.z,dz,o.z-o.d/2,o.z+o.d/2]]){
   if(Math.abs(delta)<1e-8){if(start<low||start>high)return false;continue;}
   let t1=(low-start)/delta,t2=(high-start)/delta;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);if(near>far)return false;
  }
  return near<1&&far>0;
 });
}
export function updateBosses(raid,now){
 for(const enemy of raid.enemies.values()){
  if(!enemy.bossId)continue;
  if(enemy.phase===1&&enemy.hp<=enemy.maxHp*.5){enemy.phase=2;enemy.attackMs=820;enemy.speed=2.25;raid.event('boss_phase',{enemyId:enemy.id,name:enemy.name,phase:2});}
  const target=raid.players.get(enemy.targetId);
  if(!target||!target.alive||target.downed||target.boarded||now<enemy.stunnedUntil||now<enemy.nextAbilityAt)continue;
  if(Math.hypot(target.x-enemy.x,target.z-enemy.z)>30||!enemyLineOfSight(raid.world,raid.areas,enemy,target,now))continue;
  enemy.nextAbilityAt=now+(enemy.phase===2?6500:9500);
  if(enemy.ability==='robots'){
   const active=[...raid.enemies.values()].filter(e=>e.summonedBy===enemy.id).length;
   const count=Math.min(3-active,6-(enemy.totalSummons??0));
   for(let i=0;i<count;i++){const angle=i*Math.PI*2/3+now/1000,x=enemy.x+Math.sin(angle)*3,z=enemy.z+Math.cos(angle)*3;if(raid.blocked({x,z}))continue;
    const id=enemy.id+'-robot-'+(enemy.totalSummons=(enemy.totalSummons??0)+1);
    raid.enemies.set(id,{id,kind:'drone',name:'로보 경비 로봇',x,z,hp:60,maxHp:60,armor:.1,speed:3,damage:8,rangedRange:2.3,attackMs:850,aggroRadius:20,targetId:target.id,nextAttackAt:now+1600,stunnedUntil:now+1600,summonedBy:enemy.id});
    raid.event('robot_deployed',{enemyId:id,x,z,readyAt:now+1600});
   }
  }
  const points=enemy.ability==='robots'?[]:enemy.ability==='shockwave'?[{x:enemy.x,z:enemy.z,radius:5.2}]:[{x:target.x,z:target.z,radius:3},...(enemy.phase===2?[{x:target.x+4,z:target.z-2,radius:2.4},{x:target.x-4,z:target.z+2,radius:2.4}]:[])];
  for(let i=0;i<points.length;i++){
   const p=points[i],warning={id:`${enemy.id}-attack-${now}-${i}`,enemyId:enemy.id,kind:enemy.ability,...p,startedAt:now,completeAt:now+1600+i*200,damage:enemy.ability==='shockwave'?35:31};
   raid.bossWarnings.push(warning);raid.event('boss_warning',{...warning,name:enemy.name});
  }
 }
 raid.bossWarnings=raid.bossWarnings.filter(w=>{
  if(!raid.enemies.has(w.enemyId))return false;
  if(now<w.completeAt)return true;
  for(const p of raid.players.values())if(p.alive&&!p.downed&&!p.boarded&&Math.hypot(p.x-w.x,p.z-w.z)<=w.radius&&clearLine(raid.world,w,p)){raid.damagePlayer(p,w.damage,w.enemyId,now,'boss-special'+(['shockwave','barrage'].includes(w.kind)?':explosive':''));if(w.kind==='frost')p.coldUntil=Math.max(p.coldUntil??0,now+4000);}
  raid.event('explosion',{kind:'boss',x:w.x,z:w.z,radius:w.radius});return false;
 });
}
function randomFor(seed,id){let value=(seed??0)>>>0;for(const c of id)value=(Math.imul(value,31)+c.charCodeAt(0))>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function legacyEnemyRewardStacks(catalog,enemy,seed,radiationZone=false){
 const rng=randomFor(seed,enemy.id),boss=!!enemy.bossId,heavy=enemy.kind==='heavy'||enemy.kind==='commander',tier=radiationZone?Math.max(4,boss?5:heavy?3:1):boss?5:heavy?3:1;
 const pick=source=>{const pool=radiationZone?source.filter(isPurpleLoot):source;return pool.length?pool[Math.floor(rng()*pool.length)]:null;},items=lootCandidateItems(catalog.items),stacks=[];
 const add=(item,quantity=1)=>{if(item&&(!radiationZone||isPurpleLoot(item)))stacks.push({itemId:item.id,quantity:item.id==='full-cash-crate'?lootQuantity(item,rng):quantity});};
 const weapon=pick(items.filter(i=>i.category==='weapon'&&(boss&&!radiationZone?i.tier>=4&&i.tier<=5:i.tier===tier)&&i.quality!=='gold'&&i.ammo&&(!radiationZone||items.some(a=>a.category==='ammo'&&(a.caliber??a.id)===i.ammo&&isPurpleLoot(a)))&&!['flare','melee'].includes(i.mode)&&(enemy.ability!=='robots'||i.family==='SG')));
 add(weapon);if(weapon){const ammo=pick(items.filter(i=>i.category==='ammo'&&(i.caliber??i.id)===weapon.ammo&&(radiationZone?['explosive','incendiary'].includes(i.ammoGrade):i.ammoGrade===(boss?'polished':'normal'))));add(ammo??catalog.byId.get(weapon.ammo),30);}
 add(catalog.byId.get(boss?'first-aid':'bandage'));
 if(heavy)add(pick(items.filter(i=>['armor','helmet'].includes(i.category)&&(boss&&!radiationZone?i.tier>=5&&i.tier<=6:i.tier===(boss?6:radiationZone?4:3))&&i.quality!=='gold')));
 if(boss){if(rng()<.2)add(catalog.byId.get('backpack-6'));add(pick(['gold-bar','detector','military-battery','blueprint'].map(id=>catalog.byId.get(id)).filter(Boolean)));if(rng()<.08)add(pick(items.filter(isAcquirableGold)));}
 if(boss&&enemy.bossLetterId&&rng()<.18)stacks.push({itemId:enemy.bossLetterId,quantity:1}); // Fixed quest reward retains its identity.
 return stacks;
}
export function enemyRewardStacks(
 catalog,
 enemy,
 seed,
 radiationZone=false
){
 const legacy=
  legacyEnemyRewardStacks(
   catalog,
   enemy,
   seed,
   radiationZone
  );

 const boss=!!enemy.bossId;

 /*
  보스:
   랜덤 weapon / armor / helmet / backpack 제거.
   실제 장착 장비를 아래에서 정확히 넣는다.

  일반 적:
   기존 랜덤 weapon / ammo / medical 제거.
 */
 const blocked=
  boss
   ?new Set([
     'weapon',
     'medical',
     'ammo',
     'armor',
     'helmet',
     'backpack'
    ])
   :new Set([
     'weapon',
     'medical',
     'ammo'
    ]);

 const stacks=
  legacy.filter(stack=>{
   const item=
    catalog.byId.get(stack.itemId);

   return !blocked.has(
    item?.category
   );
  });

 const add=(itemId,quantity=1)=>{
  if(!itemId)return;

  const item=
   catalog.byId.get(itemId);

  if(!item)return;

  const existing=
   stacks.find(
    stack=>stack.itemId===itemId
   );

  if(existing)
   existing.quantity+=quantity;
  else
   stacks.push({
    itemId,
    quantity
   });
 };

 /*
  실제 들고 있던 총.
  항상 첫 번째 row.
 */
 const weapon=
  catalog.byId.get(
   enemy.weaponId
  );

 if(
  weapon?.category==='weapon' &&
  !isPistolWeapon(weapon)
 ){
  stacks.unshift({
   itemId:weapon.id,
   quantity:1
  });

  const ammo=
   catalog.byId.get(
    weapon.ammo
   );

  if(ammo)
   add(ammo.id,30);
 }

 /*
  보스가 실제 장착한 장비.
 */
 if(boss){
  add(enemy.helmetId);
  add(enemy.armorId);
  add(enemy.backpackId);
 }

 /*
  실제 남아 있던 치료제.
 */
 const medicalId=
  enemy.medicalItemId??
  'first-aid';

 for(
  let i=0;
  i<(enemy.medicalUses??0);
  i++
 ){
  add(medicalId);
 }

 return stacks;
}

export function dropEnemyRewards(raid,enemy){
 const id=`remains-${enemy.id}`;if(enemy.summonedBy||raid.containers.has(id))return;
 const items=pairWorldFlareLoot(enemyRewardStacks(raid.catalog,enemy,raid.seed,inRadiation(raid.world,enemy)),raid.catalog);
 /* golden-boss-legendary-drop-61 */
 if(
  enemy.goldenBoss&&
  (
   process.env.BLUECAP_GOLDEN_BOSS_TEST===`1` ||
   Math.random()<.03
  )
 ){
  const blades=[`legend-araya`,`legend-karambit`,`legend-thunder`,`legend-arbiter`].filter(itemId=>raid.catalog.byId.has(itemId));
  if(blades.length){
   const itemId=blades[Math.floor(Math.random()*blades.length)];
   items.push({itemId,quantity:1});
   raid.event(`golden_boss_legendary_drop`,{enemyId:enemy.id,itemId});
  }
 }
 const container=createContainer({id,x:enemy.x,z:enemy.z,containerKind:enemy.bossId?'rare':'military',name:enemy.bossId?`${enemy.name} 전리품`:'적의 전투 배낭',searchSeconds:0},0,items);
 container.state='open';raid.containers.set(id,container);
 if(enemy.bossId){const zone=raid.bossZones.find(z=>z.id===enemy.bossId);if(zone)zone.defeated=true;raid.bossWarnings=raid.bossWarnings.filter(w=>w.enemyId!==enemy.id);raid.event('boss_defeated',{enemyId:enemy.id,bossId:enemy.bossId,name:enemy.name,containerId:id});}
}