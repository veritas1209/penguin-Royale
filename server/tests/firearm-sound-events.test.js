import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID} from '../../shared/catalog.ts';
import {Raid,normalizeCatalog} from '../game.js';
import {firearmSoundProfile,emitFirearmSound} from '../firearmSound.js';
import {equipEnemy,fireEnemyProjectile} from '../enemyCombat.js';

const catalog=normalizeCatalog({items:ITEMS,talents:[]});
test('every firearm caliber and ammo grade survives the server gunshot contract',()=>{
 for(const caliber of ['ammo-9','ammo-45','ammo-57','ammo-556','ammo-762','ammo-300','ammo-50','ammo-12']){
  const ammo=catalog.byId.get(caliber),weapon=ITEMS.find(item=>item.category==='weapon'&&item.ammo===caliber);
  const profile=firearmSoundProfile({weapon,ammo,noiseRadius:48});
  assert.equal(profile.caliber,caliber);assert.ok(profile.caliberLabel);assert.ok(profile.soundClass);assert.equal(profile.ammoGrade,'normal');
 }
 for(const grade of ['corroded','normal','polished','explosive','incendiary']){
  const suffix=grade==='normal'?'':'-'+grade,ammo=catalog.byId.get('ammo-556'+suffix),weapon=catalog.byId.get('m416');
  const profile=firearmSoundProfile({weapon,ammo,noiseRadius:48});assert.equal(profile.ammoGrade,grade);assert.ok(profile.soundKey.endsWith(':'+grade));
 }
});

test('suppression, AWM and Lynx expose distinct distance and signature data',()=>{
 const rifle=ITEM_BY_ID.m416,ammo=ITEM_BY_ID['ammo-556'];
 const open=firearmSoundProfile({weapon:rifle,ammo,noiseRadius:48}),quiet=firearmSoundProfile({weapon:rifle,ammo,suppressed:true,noiseRadius:12});
 assert.equal(open.report,'unsuppressed');assert.equal(quiet.report,'suppressed');assert.ok(quiet.audibleRadius<open.audibleRadius);assert.ok(quiet.loudness<open.loudness);assert.ok(quiet.rolloffFactor>open.rolloffFactor);
 const awm=firearmSoundProfile({weapon:ITEM_BY_ID['awm-refined'],ammo:ITEM_BY_ID['ammo-300'],noiseRadius:72});
 const lynx=firearmSoundProfile({weapon:ITEM_BY_ID['lynx-amr-refined'],ammo:ITEM_BY_ID['ammo-50'],noiseRadius:72});
 assert.equal(awm.weaponSignature,'awm-magnum');assert.equal(lynx.weaponSignature,'lynx-amr-heavy');assert.equal(lynx.soundClass,'anti-materiel');assert.ok(lynx.loudness>awm.loudness);assert.ok(lynx.audibleRadius>awm.audibleRadius);
});

test('gunshot is reliable for self and allies with authoritative source and range',()=>{
 const messages=[],events=[],weapon=ITEM_BY_ID.m416,ammo=ITEM_BY_ID['ammo-556'];
 const transport={eventId:0,events,players:new Map([['self',{}],['ally',{}]]),emitToSockets:(message,ids,reliable)=>messages.push({message,ids,reliable})};
 transport.event=(kind,data)=>Raid.prototype.event.call(transport,kind,data);
 const report=emitFirearmSound(transport,{sourceKind:'player',sourceId:'self',playerId:'self',weapon,ammo,x:4,z:7,aimX:1,aimZ:0,noiseRadius:55,now:1200});
 assert.deepEqual(messages[0].ids,['self','ally']);assert.equal(messages[0].reliable,true);assert.equal(messages[0].message.kind,'gunshot');
 assert.equal(report.audibleRadius,55);assert.deepEqual([report.x,report.z,report.serverTime],[4,7,1200]);assert.deepEqual([report.aimX,report.aimZ],[1,0]);assert.equal(events[0].data.soundKey,report.soundKey);
});

test('player and enemy legacy shot events carry the complete audio contract',()=>{
 const playerEvents=[],weapon=ITEM_BY_ID.m416,ammo=ITEM_BY_ID['ammo-556'];
 const raid={catalog,seed:0,shotIndex:0,cancelSearch(){},event:(kind,data)=>playerEvents.push({kind,data}),talentValue:()=>0,hitscan(){},now:()=>1000};
 const player={id:'p',alive:true,downed:false,boarded:false,x:3,z:4,gear:{primary:weapon.id,'primary:barrel':'suppressor'},magazines:{primary:1},loadedAmmo:{primary:ammo.id},activeWeaponSlot:'primary'};
 Raid.prototype.resolveShot.call(raid,player,{slot:'primary',weapon,direction:{x:1,z:0}},1000);
 const report=playerEvents.find(event=>event.kind==='gunshot')?.data,shot=playerEvents.find(event=>event.kind==='shot')?.data;
 assert.equal(report.playerId,'p');assert.equal(report.ammoId,ammo.id);assert.equal(player.noiseRadius,report.audibleRadius);assert.equal(shot.suppressed,true);assert.deepEqual([shot.x,shot.z,shot.aimX,shot.aimZ],[3,4,1,0]);assert.equal(shot.soundKey,report.soundKey);

 const enemyEvents=[],enemy={id:'e',kind:'sniper',weaponId:'awm-refined',x:0,z:0,ammoInMagazine:2,reactionReadyAt:0,nextAttackAt:0,shotsFired:0,aimSpread:0,bulletSpeed:70,rangedRange:80,attackMs:1200},target={id:'p',x:20,z:0,input:{}};
 const enemyRaid={catalog,projectiles:new Map(),event:(kind,data)=>enemyEvents.push({kind,data}),now:()=>2000};
 assert.equal(fireEnemyProjectile(enemyRaid,enemy,target,2000),true);
 const enemyReport=enemyEvents.find(event=>event.kind==='gunshot')?.data,enemyShot=enemyEvents.find(event=>event.kind==='enemy_shot')?.data;
 assert.equal(enemyReport.enemyId,'e');assert.equal(enemyReport.weaponSignature,'awm-magnum');assert.equal(enemyShot.ammoId,'ammo-300');assert.equal(enemyShot.suppressed,false);assert.deepEqual([enemyShot.x,enemyShot.z],[0,0]);assert.equal(enemyShot.soundKey,enemyReport.soundKey);

 const quietEnemy={id:'quiet',kind:'raider',x:0,z:0,attachments:{barrel:'suppressor'}};
 equipEnemy(enemyRaid,quietEnemy,{weaponId:'m416'});
 assert.equal(quietEnemy.attachments.barrel,'suppressor');
 assert.equal(fireEnemyProjectile(enemyRaid,quietEnemy,target,4000),true);
 const quietReport=enemyEvents.find(event=>event.kind==='gunshot'&&event.data.enemyId==='quiet')?.data;
 const quietShot=enemyEvents.find(event=>event.kind==='enemy_shot'&&event.data.enemyId==='quiet')?.data;
 assert.equal(quietReport.suppressed,true);assert.equal(quietShot.suppressed,true);assert.equal(quietShot.report,'suppressed');assert.ok(quietReport.audibleRadius<enemyReport.audibleRadius);
});
