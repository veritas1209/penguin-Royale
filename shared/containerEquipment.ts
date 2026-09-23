import {isPistolWeapon} from './weaponSlots.ts';
import type {ItemDef} from './catalog.ts';
import {supportedWeaponSlots,weaponAttachmentId,type WeaponAttachmentSlot} from './weaponAttachments.ts';
import {armorSlotCount,armorAttachmentsFromEquipment} from './armorAttachments.ts';
export type ContainerEquipTarget={slot:string;label:string;armorSlot?:number;weaponSlot?:string};
/** Empty destinations only: capacity is irrelevant because no bag transfer occurs. */
export function emptyContainerEquipmentSlots(item:ItemDef,gear:Record<string,string|null|undefined>,lookup:(id:string)=>ItemDef|undefined):ContainerEquipTarget[]{
 const labels:Record<string,string>={primary:'1번 무기',secondary:'2번 무기',pistol:'권총',armor:'방탄조끼',helmet:'헬멧',backpack:'배낭',melee:'근접무기',flare:'플레어건',medical:'의료품',throwable:'투척물'};
 const slots=item.mode==='flare'?['flare']:item.mode==='melee'?['melee']:item.category==='weapon'&&item.mode!=='throw'?(isPistolWeapon(item)?['pistol']:['primary','secondary']):['armor','helmet','backpack'].includes(item.category)?[item.category]:[];
 if(slots.length)return slots.filter(slot=>!gear[slot]).map(slot=>({slot,label:labels[slot]}));
 if(item.category!=='attachment')return [];
 if(item.slot==='vest')return armorAttachmentsFromEquipment(gear).slice(0,armorSlotCount(gear.armor?lookup(gear.armor):null)).flatMap((id,index)=>id?[]:[{slot:'vest',armorSlot:index,label:`방탄조끼 파츠 ${index+1}`}]);
 const part=item.slot as WeaponAttachmentSlot;
 return ['primary','secondary','pistol'].flatMap(host=>{const gun=gear[host]?lookup(gear[host]!):undefined;return gun&&supportedWeaponSlots(gun).includes(part)&&!weaponAttachmentId(gear,host,part)?[{slot:part,weaponSlot:host,label:`${labels[host]} 파츠`}]:[];});
}
