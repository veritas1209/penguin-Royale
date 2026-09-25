const CALIBER_PROFILES=Object.freeze({
 'ammo-9':{label:'9mm',soundClass:'pistol',power:.82},
 'ammo-45':{label:'.45 ACP',soundClass:'pistol-heavy',power:.9},
 'ammo-57':{label:'5.7mm',soundClass:'pistol-fast',power:.86},
 'ammo-556':{label:'5.56mm',soundClass:'rifle-light',power:1},
 'ammo-762':{label:'7.62mm',soundClass:'rifle-heavy',power:1.12},
 'ammo-300':{label:'.300 Magnum',soundClass:'magnum',power:1.32},
 'ammo-50':{label:'.50 BMG',soundClass:'anti-materiel',power:1.5},
 'ammo-12':{label:'12 gauge',soundClass:'shotgun',power:1.08},
});
const AMMO_LAYERS=Object.freeze({corroded:'dry',normal:'standard',polished:'sharp',explosive:'explosive',incendiary:'incendiary'});
const round2=value=>Math.round(value*100)/100;
function weaponSignature(weapon){
 const base=String(weapon?.baseId??weapon?.id??'unknown').toLowerCase();
 if(base==='awm'||base.startsWith('awm-'))return 'awm-magnum';
 if(base==='lynx-amr'||base.startsWith('lynx-amr-'))return 'lynx-amr-heavy';
 const family=String(weapon?.family??'rifle').toLowerCase();
 return family==='hg'?'pistol':family;
}
function firearm(weapon){
 const family=String(weapon?.family??'').toLowerCase();
 return !!weapon?.ammo&&weapon.ammo!=='ammo-bolt'&&family!=='crossbow'&&!['melee','flare','throw'].includes(weapon.mode);
}
/** One server-owned audio contract for AI hearing and every connected raid client. */
export function firearmSoundProfile({weapon,ammo,suppressed=false,noiseRadius}={}){
 if(!firearm(weapon))return null;
 const caliber=ammo?.caliber??weapon.ammo,caliberProfile=CALIBER_PROFILES[caliber]??{label:caliber,soundClass:'rifle',power:1};
 const signature=weaponSignature(weapon),special=signature==='lynx-amr-heavy'?1.2:signature==='awm-magnum'?1.1:1;
 const baseRadius=Number.isFinite(noiseRadius)?noiseRadius:Math.max(38,(weapon.range??25)*1.15)*(suppressed?.34:1);
 const audibleRadius=Math.max(.5,baseRadius*special);
 const ammoGrade=ammo?.ammoGrade??'normal',report=suppressed?'suppressed':'unsuppressed';
 return {
  report,suppressed,weaponSignature:signature,weaponFamily:weapon.family??null,
  caliber,caliberLabel:caliberProfile.label,ammoGrade,ammoLayer:AMMO_LAYERS[ammoGrade]??'standard',
  soundClass:caliberProfile.soundClass,soundKey:`gunshot:${signature}:${report}:${ammoGrade}`,
  loudness:round2(caliberProfile.power*special*(suppressed?.42:1)),audibleRadius,
  referenceDistance:round2(Math.min(audibleRadius,suppressed?2.5:6)),rolloffFactor:suppressed?2.15:1.35,
 };
}
export function emitFirearmSound(raid,{sourceKind,sourceId,weapon,ammo,x,z,suppressed=false,noiseRadius,now=raid.now?.(),...context}){
 const profile=firearmSoundProfile({weapon,ammo,suppressed,noiseRadius});if(!profile)return null;
 const data={sourceKind,sourceId,weaponId:weapon.id,ammoId:ammo?.id??weapon.ammo,x,z,serverTime:now,...profile,...context};
 raid.event('gunshot',data);return data;
}
