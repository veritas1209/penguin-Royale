import {weaponFitsSlot} from '../shared/weaponSlots.ts';
import {emptyContainerEquipmentSlots} from '../shared/containerEquipment.ts';
import {randomUUID} from 'node:crypto';
import {createContainer} from './containers.js';
import {raidEquipmentStats} from './raidEquipment.js';
import {armorSlotCount} from '../shared/armorAttachments.ts';
import {supportsWeaponAttachment} from '../shared/weaponAttachments.ts';
function fail(code,message){throw Object.assign(new Error(message),{code});}
function active(p){if(!p.alive||p.downed||p.boarded||p.settlement||!p.connected)fail('PLAYER_INACTIVE','현재 물품을 옮길 수 없습니다.');}
export function dropInventory(raid,player,itemId,quantity){
 active(player);if(!Number.isSafeInteger(quantity)||quantity<=0)fail('INVALID_QUANTITY','수량은 양의 정수여야 합니다.');
 const item=raid.catalog.byId.get(itemId);if(!item)fail('UNKNOWN_ITEM','알 수 없는 물품입니다.');
 const inventory=player.inventory.map(s=>({...s})),reserve={...player.reserveAmmo};
 const sourceBundle=player.inventory.find(s=>s.itemId===itemId)?.fittings;
 if(item.category==='ammo'){
  const stack=inventory.find(s=>s.itemId===itemId),available=(reserve[itemId]??0)+(stack?.quantity??0);
  if(available<quantity)fail('ITEM_NOT_OWNED','예비 탄약이 부족합니다.');
  const fromReserve=Math.min(quantity,reserve[itemId]??0);reserve[itemId]=(reserve[itemId]??0)-fromReserve;
  if(quantity>fromReserve)stack.quantity-=quantity-fromReserve;
 }else{const stack=inventory.find(s=>s.itemId===itemId);if(!stack||stack.quantity<quantity)fail('ITEM_NOT_OWNED','배낭 물품이 부족합니다.');stack.quantity-=quantity;}
 const nextInventory=inventory.filter(s=>s.quantity>0);
 const container=createContainer({id:'ground-loot-'+randomUUID(),x:player.x,z:player.z,name:'버린 물품',visualType:'ground-loot',searchSeconds:0},0,[{itemId,quantity,...(sourceBundle?{fittings:{...sourceBundle}}:{})}]);container.state='open';
 raid.db.updateRaidInventoryState(raid.id,player.id,nextInventory,player.gear,reserve,player.magazines,player.loadedAmmo);
 player.inventory=nextInventory;player.reserveAmmo=reserve;raid.containers.set(container.id,container);
 raid.event('inventory_dropped',{playerId:player.id,containerId:container.id,itemId,quantity});return container;
}
export function directEquipmentPlan(player,itemId,slot,catalog,{armorSlot=0,weaponSlot='primary'}={}){
 const item=catalog.byId.get(itemId);if(!item)fail('UNKNOWN_ITEM','알 수 없는 물품입니다.');
 let key=slot,compatible=false;
 if(['scope','barrel','grip','magazine'].includes(slot)){
  if(!['primary','secondary','pistol'].includes(weaponSlot))fail('INVALID_SLOT','잘못된 총기 슬롯입니다.');key=`${weaponSlot}:${slot}`;
  const host=catalog.byId.get(player.gear[weaponSlot]);
  compatible=Boolean(host)&&item.category==='attachment'&&item.slot===slot&&supportsWeaponAttachment(host,item);
 }else if(slot==='vest'){
  if(!Number.isSafeInteger(armorSlot)||armorSlot<0||armorSlot>2)fail('INVALID_SLOT','잘못된 방어구 파츠 슬롯입니다.');key=`armor:${armorSlot}`;
  compatible=item.category==='attachment'&&item.slot==='vest'&&armorSlot<armorSlotCount(catalog.byId.get(player.gear.armor));
 }else if(['primary','secondary','pistol'].includes(slot))compatible=weaponFitsSlot(item,slot);
 else if(slot==='melee')compatible=item.category==='weapon'&&item.mode==='melee';
 else if(slot==='flare')compatible=item.category==='weapon'&&item.mode==='flare';
 else if(['armor','helmet','backpack'].includes(slot))compatible=item.category===slot;
 else fail('INVALID_SLOT','지원하지 않는 장비 슬롯입니다.');
 if(!compatible)fail('INCOMPATIBLE_SLOT','장비 슬롯과 호환되지 않습니다.');
 if(!emptyContainerEquipmentSlots(item,player.gear,id=>catalog.byId.get(id)).some(target=>target.slot===slot&&(target.weaponSlot??'primary')===weaponSlot&&(target.armorSlot??0)===armorSlot))fail('SLOT_OCCUPIED','장비 슬롯이 이미 차 있습니다.');
 const gear={...player.gear,[key]:itemId},stats=raidEquipmentStats(player,gear,catalog);
 return {gear,stats,key};
}
