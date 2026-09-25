import {stackWeight} from '../shared/fittedInventory.ts';
import {SECURE_CAPACITY} from '../shared/metroInventory.ts';
export {SECURE_CAPACITY};

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function cloneStacks(stacks = []) { return stacks.map(s => ({...s,...(s.fittings?{fittings:{...s.fittings}}:{})})); }
function addStack(stacks,itemId,quantity){const s=stacks.find(x=>x.itemId===itemId);if(s)s.quantity+=quantity;else stacks.push({itemId,quantity});}
function removeStack(stacks,itemId,quantity){const s=stacks.find(x=>x.itemId===itemId);if(!s||s.quantity<quantity)fail('INSUFFICIENT_ITEMS','원본 보관 공간의 수량이 부족합니다.');s.quantity-=quantity;if(!s.quantity)stacks.splice(stacks.indexOf(s),1);}

export function planSecureTransfer(player,itemId,quantity,direction,catalog){
  if(!catalog?.byId?.has(itemId))fail('ITEM_NOT_FOUND','Unknown item');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000)fail('INVALID_QUANTITY','Quantity must be 1-10000');
  if(direction!=='deposit'&&direction!=='withdraw')fail('INVALID_DIRECTION','Direction must be deposit or withdraw');
  const item=catalog.byId.get(itemId),isAmmo=item.category==='ammo';
  if([...player.inventory,...player.secure].some(s=>s.itemId===itemId&&s.fittings))fail('FITTED_WEAPON_SECURE','파츠가 장착된 무기는 암호상자로 옮길 수 없습니다.');
  const nextInventory=cloneStacks(player.inventory),nextReserveAmmo={...player.reserveAmmo},nextSecure=cloneStacks(player.secure);
  if(direction==='deposit'){
    if(isAmmo){if((nextReserveAmmo[itemId]??0)<quantity)fail('INSUFFICIENT_ITEMS','가방의 탄약 수량이 부족합니다.');nextReserveAmmo[itemId]-=quantity;if(!nextReserveAmmo[itemId])delete nextReserveAmmo[itemId];}
    else removeStack(nextInventory,itemId,quantity);
    addStack(nextSecure,itemId,quantity);
    const weight=nextSecure.reduce((n,s)=>n+stackWeight(s,id=>catalog.byId.get(id)),0);
    if(weight>(player.secureCapacity??SECURE_CAPACITY)+.000001)fail('SECURE_OVER_CAPACITY',`암호상자의 ${player.secureCapacity??SECURE_CAPACITY} 용량을 초과했습니다.`);
  }else{
    removeStack(nextSecure,itemId,quantity);
    const weight=nextInventory.reduce((n,s)=>n+stackWeight(s,id=>catalog.byId.get(id)),0)+Object.entries(nextReserveAmmo).reduce((n,[id,q])=>n+(catalog.byId.get(id)?.weight??0)*q,0);
    if(weight+(item.weight??0)*quantity>player.carryCapacity+.000001)fail('OVER_CAPACITY','Backpack capacity exceeded');
    if(isAmmo)nextReserveAmmo[itemId]=(nextReserveAmmo[itemId]??0)+quantity;else addStack(nextInventory,itemId,quantity);
  }
  return {nextInventory,nextReserveAmmo,nextSecure};
}
