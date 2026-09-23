import type {ItemDef} from './catalog.ts';
export const WEAPON_ATTACHMENT_SLOTS=['scope','barrel','grip','magazine'] as const;
export type WeaponAttachmentSlot=typeof WEAPON_ATTACHMENT_SLOTS[number];
export type FirearmSlot='primary'|'secondary'|'pistol';
export type WeaponAttachments=Record<FirearmSlot,Partial<Record<WeaponAttachmentSlot,string|null>>>;
export function weaponAttachmentsFromEquipment(gear:Record<string,string|null|undefined>):WeaponAttachments{
 const result:WeaponAttachments={primary:{},secondary:{},pistol:{}};
 for(const host of ['primary','secondary','pistol'] as const)for(const slot of WEAPON_ATTACHMENT_SLOTS)result[host][slot]=gear[`${host}:${slot}`]??(host==='primary'?gear[slot]:null)??null;
 return result;
}
export function weaponAttachmentId(gear:Record<string,string|null|undefined>,host:string,slot:WeaponAttachmentSlot){return gear[`${host}:${slot}`]??(host==='primary'?gear[slot]:undefined);}
export function supportedWeaponSlots(item:ItemDef):WeaponAttachmentSlot[]{
 if(item.category!=='weapon'||item.mode==='melee'||item.mode==='flare')return [];
 const base=item.baseId??item.id,family=item.family?.toUpperCase();
 let slots:WeaponAttachmentSlot[]=[];
 if(['AR','SMG','DMR'].includes(family??''))slots=['scope','barrel','grip','magazine'];
 else if(family==='SR')slots=['scope','barrel','magazine'];
 else if(family==='LMG')slots=['scope'];
 else if(base==='s12k')slots=['scope','barrel','magazine'];
 else if(base==='dbs'||base==='crossbow')slots=['scope'];
 else if(['SG','SHOTGUN'].includes(family??''))slots=['barrel'];
 else if(['PISTOL','HG'].includes(family??''))slots=['scope','barrel','magazine'];
 if(['akm','groza','m16a4','mini14','slr','vss','pp19-bizon','bizon','micro-uzi','uzi','ump45','p90'].includes(base))slots=slots.filter(s=>s!=='grip');
 if(['kar98k','mosin-nagant','win94','s1897','s686'].includes(base))slots=slots.filter(s=>s!=='magazine');
 if(base==='win94')slots=[];
 return slots;
}
