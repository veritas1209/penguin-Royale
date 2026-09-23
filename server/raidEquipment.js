import {weaponFitsSlot} from '../shared/weaponSlots.ts';
import {talentBonus} from '../shared/talents.ts';
import {armorSlotCount,armorAttachmentsFromEquipment,armorAttachmentEffects} from '../shared/armorAttachments.ts';
import {inventoryCapacity,equipmentWeights} from '../shared/metroInventory.ts';
import {goldEquipmentEffects,equipmentWeightMobilityBonus,secureCapacityForGear} from '../shared/goldEquipment.ts';
import {SECURE_CAPACITY} from '../shared/metroInventory.ts';
import {materializeGoldItem} from '../shared/catalog.ts';

const SLOTS=new Set(['armor','helmet','backpack','primary','secondary','pistol','melee']);
const WEAPON_PART=/^(primary|secondary|pistol):(scope|barrel|grip|magazine)$/;
function fail(code,message){throw Object.assign(new Error(message),{code});}
function talentValue(player,catalog,effect){return (catalog.talents??[]).reduce((sum,t)=>sum+(t.effect===effect?talentBonus(t,player.talentLevels?.[t.id]??0):0),0);}

export function raidEquipmentStats(player,gear,catalog){
 const levels=player.goldTraitLevelsBySlot??{},lookup=id=>{for(const slot of ['primary','secondary','pistol','melee','armor','helmet','backpack'])if(gear[slot]===id&&levels[slot])return materializeGoldItem(catalog.byId.get(id),levels[slot]);return catalog.byId.get(id);},effects=armorAttachmentEffects(gear,lookup),gold=goldEquipmentEffects(gear,lookup);
 const armor=materializeGoldItem(catalog.byId.get(gear.armor),levels.armor),helmet=materializeGoldItem(catalog.byId.get(gear.helmet),levels.helmet),vest=armor?lookup(gear.vest):null,backpack=materializeGoldItem(catalog.byId.get(gear.backpack),levels.backpack),gearWeight=equipmentWeights(gear,lookup).total;
 return {
  armorReduction:Math.min(.8,Math.max(0,(armor?.reduction??0)+(helmet?.reduction??0)+effects.protection+gold.damageReduction)),
  radiationProtected:Boolean(armor?.traits?.includes('radiation-immunity')||effects.radiationProtected),
  carryCapacity:inventoryCapacity(backpack?.capacity??0,talentValue(player,catalog,'capacity'),effects.capacity),
  secureCapacity:secureCapacityForGear(gear,lookup,SECURE_CAPACITY),equipmentWeightMultiplier:1-gold.equipmentWeightInfluenceReduction,
  headshotFlatReduction:gold.headshotFlatReduction,bossSpecialReduction:gold.bossSpecialReduction,flatDamageReduction:gold.flatDamageReduction,fireReduction:gold.fireReduction,explosiveReduction:gold.explosiveReduction,flashImmune:gold.flashImmune,reviveTimeMultiplier:1-gold.reviveTimeReduction,bonusLootChance:gold.bonusLootChance,
  moveMultiplier:1+talentValue(player,catalog,'speed')+effects.mobility+equipmentWeightMobilityBonus(gear,lookup,gearWeight),
 };
}

export function planRaidEquipment(player,slot,itemId,catalog,armorSlot=0){
 if(slot==='vest'){if(!Number.isSafeInteger(armorSlot)||armorSlot<0||armorSlot>2)fail('INVALID_SLOT','잘못된 방어구 파츠 슬롯입니다.');slot=`armor:${armorSlot}`;}
 const isArmorPart=/^armor:[0-2]$/.test(slot),weaponPart=slot.match(WEAPON_PART);
 if(!SLOTS.has(slot)&&!isArmorPart&&!weaponPart)fail('INVALID_SLOT','지원하지 않는 장비 슬롯입니다.');
 if(itemId!==null&&typeof itemId!=='string')fail('ITEM_NOT_FOUND','Unknown item');
 const selected=itemId===null?null:catalog.byId.get(itemId);
 if(itemId!==null&&!selected)fail('ITEM_NOT_FOUND','Unknown item');
 if(selected&&isArmorPart&&(armorSlot>=armorSlotCount(catalog.byId.get(player.gear.armor))||selected.category!=='attachment'||selected.slot!=='vest'))fail('INCOMPATIBLE_SLOT','방어구 부착물 슬롯과 호환되지 않습니다.');
 if(selected&&weaponPart){const host=catalog.byId.get(player.gear[weaponPart[1]]);if(!host||selected.category!=='attachment'||selected.slot!==weaponPart[2]||!(host.weaponSlots??[]).includes(weaponPart[2]))fail('INCOMPATIBLE_SLOT','총기 부착물 슬롯과 호환되지 않습니다.');}
 const weaponSlot=['primary','secondary','pistol','melee'].includes(slot);
 if(selected&&weaponSlot&&!weaponFitsSlot(selected,slot))fail('INCOMPATIBLE_SLOT','무기 슬롯과 호환되지 않습니다.');
 if(selected?.category!==slot&&selected!==null&&!isArmorPart&&!weaponSlot&&!weaponPart)fail('INCOMPATIBLE_SLOT','해당 장비 슬롯과 호환되지 않습니다.');
 const nextInventory=player.inventory.map(s=>({...s})),nextGear={...player.gear};
 const previous=nextGear[slot]??null,selectedStack=player.inventory.find(s=>s.itemId===itemId&&s.quantity>0);
 if(previous===itemId)return {nextInventory,nextGear,nextGoldTraitLevelsBySlot:{...(player.goldTraitLevelsBySlot??{})},stats:raidEquipmentStats(player,nextGear,catalog)};
 if(selected){
  const stack=nextInventory.find(s=>s.itemId===itemId);
  if(!stack||stack.quantity<1)fail('ITEM_NOT_OWNED','배낭에 교체할 장비가 없습니다.');
  stack.quantity--;if(!stack.quantity)nextInventory.splice(nextInventory.indexOf(stack),1);
 }
 if(previous){const old=nextInventory.find(s=>s.itemId===previous&&!s.fittings);if(old)old.quantity++;else nextInventory.push({itemId:previous,quantity:1});}
 if(weaponSlot||slot==='armor'){
  const fittings={};
  if(slot==='armor'&&nextGear.vest){fittings['0']=nextGear.vest;delete nextGear.vest;}
  for(const key of Object.keys(nextGear))if(key.startsWith(slot+':')){fittings[key.slice(slot.length+1)]=nextGear[key];delete nextGear[key];}
  if(previous&&Object.keys(fittings).length){const old=nextInventory.find(s=>s.itemId===previous&&!s.fittings);if(old){old.quantity--;if(!old.quantity)nextInventory.splice(nextInventory.indexOf(old),1);}nextInventory.push({itemId:previous,quantity:1,fittings});}
  if(selectedStack?.fittings)for(const [part,id] of Object.entries(selectedStack.fittings))nextGear[slot+':'+part]=id;
 }
 const nextGoldTraitLevelsBySlot={...(player.goldTraitLevelsBySlot??{})};
 if(itemId===null){delete nextGear[slot];delete nextGoldTraitLevelsBySlot[slot];}
 else{nextGear[slot]=itemId;nextGoldTraitLevelsBySlot[slot]={...(selectedStack?.goldTraitLevels??selected?.goldTraitLevels??{})};}
 const stats=raidEquipmentStats({...player,goldTraitLevelsBySlot:nextGoldTraitLevelsBySlot},nextGear,catalog);
 const weight=nextInventory.reduce((n,s)=>n+((catalog.byId.get(s.itemId)?.weight??0)+Object.values(s.fittings??{}).reduce((n,id)=>n+(catalog.byId.get(id)?.weight??0),0))*s.quantity,0)+Object.entries(player.reserveAmmo??{}).reduce((n,[id,q])=>n+(catalog.byId.get(id)?.weight??0)*q,0);
 if(weight>stats.carryCapacity+.000001)fail('OVER_CAPACITY','장비를 교체하면 배낭 용량을 초과합니다.');
 return {nextInventory,nextGear,nextGoldTraitLevelsBySlot,stats};
}
