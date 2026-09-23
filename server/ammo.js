// One magazine contains one concrete ammo ID. Switching grade returns unused rounds.
export const AMMO_PRIORITY = ['normal', 'polished', 'corroded', 'explosive', 'incendiary'];
export function compatibleAmmo(catalog, caliber) {
 return catalog.items.filter(i => i.category === 'ammo' && (i.caliber ?? i.id) === caliber)
  .sort((a,b) => AMMO_PRIORITY.indexOf(a.ammoGrade ?? 'normal') - AMMO_PRIORITY.indexOf(b.ammoGrade ?? 'normal'));
}
export function chooseAmmo(catalog, caliber, reserve, preferred) {
 const options=compatibleAmmo(catalog,caliber);
 if(options.some(i=>i.id===preferred) && (reserve[preferred]??0)>0)return preferred;
 return options.find(i=>(reserve[i.id]??0)>0)?.id ?? null;
}
export function loadMagazine(player, slot, ammoId, capacity) {
 const old=player.loadedAmmo[slot];
 const excess=Math.max(0,(player.magazines[slot]??0)-capacity);
 if(old&&excess){player.reserveAmmo[old]=(player.reserveAmmo[old]??0)+excess;player.magazines[slot]-=excess;}
 if(old && old!==ammoId){player.reserveAmmo[old]=(player.reserveAmmo[old]??0)+(player.magazines[slot]??0);player.magazines[slot]=0;}
 const take=Math.max(0,Math.min(capacity-(player.magazines[slot]??0),player.reserveAmmo[ammoId]??0));
 player.magazines[slot]=(player.magazines[slot]??0)+take;
 player.reserveAmmo[ammoId]=(player.reserveAmmo[ammoId]??0)-take;
 player.loadedAmmo[slot]=ammoId;
 return take;
}
export function ammoShot(weapon, ammo) {
 return {...weapon,damage:(weapon.damage??20)*(ammo?.damageMultiplier??1),penetration:Math.max(0,(weapon.penetration??0)+(ammo?.penetrationBonus??0)),ammoGrade:ammo?.ammoGrade};
}
