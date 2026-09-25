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
 else if(base==='dbs'||base==='crossbow'||base==='ns2000')slots=['scope'];
 else if(['PISTOL','HG'].includes(family??''))slots=['scope','barrel','magazine'];
 // PUBG exceptions. Stock, cheek pad, choke and fixed attachments have no removable counterpart.
 if(['akm','groza','m16a4','famas','honey-badger','mini-14','mini14','qbu','mk14','slr','pp19-bizon','bizon','micro-uzi','uzi','js9'].includes(base))slots=slots.filter(s=>s!=='grip');
 if(['kar98k','mosin-nagant'].includes(base))slots=slots.filter(s=>s!=='magazine');
 if(base==='m249')slots=['scope','magazine'];
 if(base==='pp19-bizon'||base==='bizon')slots=['scope','barrel'];
 if(base==='vss')slots=['magazine'];
 if(base==='p90'||base==='win94')slots=[];
 if(base==='lynx-amr')slots=['scope'];
 if(base==='r1895')slots=['barrel'];
 if(base==='r45')slots=['scope'];
 if(base==='deagle')slots=['scope','magazine'];
 if(base==='skorpion')slots=['scope','barrel','grip','magazine'];
 if(base==='sawed-off')slots=[];
 return slots;
}

/** Checks the concrete part, including optic power and gun-specific rail limits. */
export function supportsWeaponAttachment(weapon:ItemDef,part:ItemDef):boolean{
 const slot=part.slot as WeaponAttachmentSlot;
 if(part.category!=='attachment'||!WEAPON_ATTACHMENT_SLOTS.includes(slot)||!supportedWeaponSlots(weapon).includes(slot))return false;
 const base=weapon.baseId??weapon.id,partBase=part.baseId??part.id;
 if(slot==='scope'){
  if(['tommy-gun','micro-uzi','uzi','p92','p18c','skorpion','dual-mp7','deagle','p1911','r45'].includes(base)&&partBase!=='red-dot')return false;
  if(partBase==='scope-8x'){
   const family=weapon.family?.toUpperCase();
   return family==='SR'||family==='DMR'||['m16a4','mk47-mutant','s12k'].includes(base);
  }
 }
 if(slot==='grip'){
  if(base==='tommy-gun'&&partBase!=='vertical-grip')return false;
  if(['p92','p18c','p1911','skorpion'].includes(base)&&partBase!=='vertical-grip')return false;
 }
 return true;
}
