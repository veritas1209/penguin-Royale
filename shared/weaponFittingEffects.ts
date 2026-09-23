import type {ItemDef} from './catalog.ts';
import {weaponAttachmentId} from './weaponAttachments.ts';
import {firearmRange} from './firearmBalance.ts';
import {weaponAttachmentQualityEffects} from './attachmentQualities.ts';
/** One shared numeric contract for the server and equipment previews. */
export function weaponFittingStats(gear:Record<string,string|null|undefined>,host:string,lookup:(id:string)=>ItemDef|undefined){
 const parts=Object.fromEntries(['scope','barrel','grip','magazine'].map(slot=>{const id=weaponAttachmentId(gear,host,slot as 'scope');return [slot,id?lookup(id):undefined];}));
 const effects=weaponAttachmentQualityEffects(parts),weapon=gear[host]?lookup(gear[host]!):undefined;
 const rangeMultiplier=effects.rangeMultiplier;
 return {...effects,rangeMultiplier,magazineCapacity:Math.ceil((weapon?.magazine??0)*effects.magazineMultiplier),reloadSeconds:(weapon?.reload??2)*effects.reloadMultiplier,range:firearmRange(weapon??{})*rangeMultiplier,spreadMultiplier:1-Math.min(.65,Math.max(0,effects.accuracyBonus)),noiseRadius:38*effects.noiseMultiplier};
}
