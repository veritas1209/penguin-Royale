import type {ItemDef} from './catalog.ts';
export const FIREARM_SLOTS=['primary','secondary','pistol'] as const;
export const CARRIED_WEAPON_SLOTS=[...FIREARM_SLOTS,'melee'] as const;
export function isPistolWeapon(item:ItemDef|null|undefined){return item?.category==='weapon'&&['PISTOL','HG'].includes(item.family?.toUpperCase()??'');}
export function weaponFitsSlot(item:ItemDef|null|undefined,slot:string){
 if(!item||item.category!=='weapon')return false;
 if(slot==='melee')return item.mode==='melee'||item.family?.toLowerCase()==='melee';
 if(slot==='pistol')return isPistolWeapon(item);
 return ['primary','secondary'].includes(slot)&&!isPistolWeapon(item)&&!['melee','flare','throw'].includes(item.mode??'')&&item.family?.toLowerCase()!=='melee';
}