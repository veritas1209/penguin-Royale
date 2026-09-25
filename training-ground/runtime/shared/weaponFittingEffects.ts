import type {ItemDef} from './catalog.ts';
import {weaponAttachmentId,supportsWeaponAttachment} from './weaponAttachments.ts';
import {firearmRange} from './firearmBalance.ts';
import {weaponAttachmentQualityEffects} from './attachmentQualities.ts';
/** One shared numeric contract for the server and equipment previews. */
export function weaponFittingStats(gear:Record<string,string|null|undefined>,host:string,lookup:(id:string)=>ItemDef|undefined){
 const weapon=gear[host]?lookup(gear[host]!):undefined;
 const parts=Object.fromEntries(['scope','barrel','grip','magazine'].map(slot=>{const id=weaponAttachmentId(gear,host,slot as 'scope'),part=id?lookup(id):undefined;return [slot,weapon&&part&&supportsWeaponAttachment(weapon,part)?part:undefined];}));
 const effects=weaponAttachmentQualityEffects(parts);
 const builtInSuppressor=(weapon?.baseId??weapon?.id)==='vss';
 const fitted=builtInSuppressor?{...effects,suppressed:true,noiseMultiplier:12/38}:effects;
 const rangeMultiplier=fitted.rangeMultiplier;
 return {...fitted,rangeMultiplier,magazineCapacity:Math.ceil((weapon?.magazine??0)*fitted.magazineMultiplier),reloadSeconds:(weapon?.reload??2)*fitted.reloadMultiplier,range:firearmRange(weapon??{})*rangeMultiplier,spreadMultiplier:1-Math.min(.65,Math.max(0,fitted.accuracyBonus)),noiseRadius:38*fitted.noiseMultiplier};
}
