import type {ItemDef} from './catalog.ts';
import {attachmentQualityFactor,attachmentCapacityBonus} from './attachmentQualities.ts';
export function armorSlotCount(armor:ItemDef|undefined|null){
 if(!armor)return 0;
 return armor.armorSlots??((armor.equipmentLevel??armor.tier)>=6?3:(armor.equipmentLevel??armor.tier)>=4?2:1);
}
export function armorAttachmentsFromEquipment(gear:Record<string,string|null|undefined>){
 const slots=[0,1,2].map(i=>gear[`armor:${i}`]??null);
 if(gear.vest){const free=slots.findIndex(id=>!id);if(free>=0)slots[free]=gear.vest;}
 return slots;
}
export function armorAttachmentEffects(gear:Record<string,string|null|undefined>,lookup:(id:string)=>ItemDef|undefined){
 const armor=gear.armor?lookup(gear.armor):null;
 const parts=armor?armorAttachmentsFromEquipment(gear).slice(0,armorSlotCount(armor)).filter((id):id is string=>Boolean(id)).map(lookup).filter((p):p is ItemDef=>Boolean(p)):[];
 const sum=(effect:string)=>parts.filter(p=>p.effect===effect).reduce((n,p)=>n+attachmentQualityFactor(p),0);
 return {protection:sum('protection')*.05,mobility:sum('mobility')*.1,capacity:parts.reduce((n,p)=>n+attachmentCapacityBonus(p),0),radiationProtected:parts.some(p=>p.effect==='radiation-immunity')};
}
