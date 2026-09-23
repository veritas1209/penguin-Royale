import {isPistolWeapon} from '../shared/weaponSlots.ts';
import {randomUUID} from 'node:crypto';
import {ITEM_BY_ID} from '../shared/catalog.ts';
const HOSTS=['primary','secondary','pistol','melee','armor','helmet','backpack'];
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function installItemInstances(C){
 const p=C.prototype;p.instanceCatalog=new Map(Object.entries(ITEM_BY_ID));
 p.isInstanceItem=function(id){const i=this.instanceCatalog.get(id);return !!i&&(i.category==='weapon'&&!['flare','throw'].includes(i.mode)||['armor','helmet','backpack'].includes(i.category));};
 p.instanceRows=function(u){return this.db.prepare("SELECT i.id,i.item_id AS itemId,i.fittings_json,i.status,i.slot,g.traits_json FROM item_instances i LEFT JOIN item_instance_gold_traits g ON g.instance_id=i.id WHERE i.user_id=? ORDER BY i.rowid").all(u).map(({fittings_json,traits_json,...r})=>{const defaults=this.instanceCatalog.get(r.itemId)?.goldTraitLevels??{};return {...r,fittings:JSON.parse(fittings_json),goldTraitLevels:traits_json?JSON.parse(traits_json):{...defaults}};});};
 p.syncInstances=function(u){
  const active=!!this.db.prepare("SELECT 1 FROM raid_escrow WHERE user_id=? AND status='active'").get(u),rows=this.instanceRows(u);
  const owned=this.db.prepare('SELECT item_id,quantity FROM inventory WHERE user_id=?').all(u);
  for(const s of owned)if(this.isInstanceItem(s.item_id)){let own=rows.filter(r=>r.itemId===s.item_id&&r.status!=='raid');while(own.length<s.quantity){const r={id:randomUUID(),itemId:s.item_id,status:'stash',slot:null,fittings:{}};this.db.prepare("INSERT INTO item_instances VALUES(?,?,?,'{}','stash',NULL)").run(r.id,u,r.itemId);rows.push(r);own.push(r);}while(own.length>s.quantity){const r=own.findLast(r=>r.status==='stash')??own.at(-1);this.db.prepare('DELETE FROM item_instances WHERE id=?').run(r.id);own.splice(own.indexOf(r),1);rows.splice(rows.indexOf(r),1);}}
  for(const r of [...rows])if(r.status!=='raid'&&!owned.some(s=>s.item_id===r.itemId&&s.quantity>0)){this.db.prepare('DELETE FROM item_instances WHERE id=?').run(r.id);rows.splice(rows.indexOf(r),1);}
  if(active)return;
  const gear=Object.fromEntries(this.db.prepare('SELECT slot,item_id FROM equipped WHERE user_id=?').all(u).map(r=>[r.slot,r.item_id]));
  // Legacy pistol reservations move with their exact instance and fitted parts.
  for(const host of ['primary','secondary'])if(isPistolWeapon(this.instanceCatalog.get(gear[host]))){
   const itemId=gear[host],fittings=Object.fromEntries(Object.entries(gear).filter(([key,id])=>key.startsWith(host+':')&&id).map(([key,id])=>[key.slice(host.length+1),id]));
   const r=rows.find(r=>r.status==='equipped'&&r.slot===host)??rows.find(r=>r.status==='stash'&&r.itemId===itemId);
   const next=gear.pistol?null:'pistol';
   this.db.prepare('DELETE FROM equipped WHERE user_id=? AND (slot=? OR slot LIKE ?)').run(u,host,host+':%');
   delete gear[host];for(const key of Object.keys(gear))if(key.startsWith(host+':'))delete gear[key];
   if(r){r.fittings={...r.fittings,...fittings};r.status=next?'equipped':'stash';r.slot=next;this.db.prepare('UPDATE item_instances SET status=?,slot=?,fittings_json=? WHERE id=?').run(r.status,r.slot,JSON.stringify(r.fittings),r.id);}
   if(next){gear.pistol=itemId;this.db.prepare('INSERT INTO equipped VALUES(?,?,?) ON CONFLICT(user_id,slot) DO UPDATE SET item_id=excluded.item_id').run(u,next,itemId);for(const [part,id] of Object.entries(r?.fittings??fittings)){gear[next+':'+part]=id;this.db.prepare('INSERT INTO equipped VALUES(?,?,?) ON CONFLICT(user_id,slot) DO UPDATE SET item_id=excluded.item_id').run(u,next+':'+part,id);}}
  }
  for(const host of HOSTS){const old=rows.find(r=>r.status==='equipped'&&r.slot===host);if(old&&old.itemId!==gear[host]){this.db.prepare("UPDATE item_instances SET status='stash',slot=NULL WHERE id=?").run(old.id);old.status='stash';old.slot=null;}if(gear[host]&&!rows.some(r=>r.status==='equipped'&&r.slot===host)){const r=rows.find(r=>r.status==='stash'&&r.itemId===gear[host]);if(r){r.fittings=Object.fromEntries(Object.entries(gear).filter(([s,id])=>s.startsWith(host+':')&&id).map(([s,id])=>[s.slice(host.length+1),id]));this.db.prepare("UPDATE item_instances SET status='equipped',slot=?,fittings_json=? WHERE id=?").run(host,JSON.stringify(r.fittings),r.id);r.status='equipped';r.slot=host;}}}
 };
 p.instanceProfile=function(u){this.syncInstances(u);const instances=this.instanceRows(u).filter(r=>r.status!=='raid');return {instances,equippedInstanceIds:Object.fromEntries(instances.filter(r=>r.status==='equipped').map(r=>[r.slot,r.id]))};};
 p.instanceReserved=function(u,id){return this.instanceRows(u).filter(r=>r.status!=='raid').reduce((n,r)=>n+Object.values(r.fittings).filter(x=>x===id).length,0);};
 p.selectInstance=function(u,itemId,id){this.syncInstances(u);const rows=this.instanceRows(u),r=id?rows.find(r=>r.id===id):rows.find(r=>r.itemId===itemId&&r.status==='stash');if(!r||r.itemId!==itemId||r.status==='raid')throw fail('ITEM_NOT_OWNED','선택한 개별 장비가 보관함에 없습니다.');return r;};
 p.switchInstance=function(u,slot,itemId,id){this.syncInstances(u);const old=this.instanceRows(u).find(r=>r.status==='equipped'&&r.slot===slot),next=itemId===null?null:id?this.selectInstance(u,itemId,id):old?.itemId===itemId?old:this.selectInstance(u,itemId);if(next?.status==='equipped'&&next.slot!==slot)throw fail('INSTANCE_EQUIPPED','다른 슬롯에 장착된 장비입니다.');if(old)this.db.prepare("UPDATE item_instances SET status='stash',slot=NULL WHERE id=?").run(old.id);this.db.prepare('DELETE FROM equipped WHERE user_id=? AND (slot=? OR slot LIKE ?)').run(u,slot,slot+':%');if(next){this.db.prepare("UPDATE item_instances SET status='equipped',slot=? WHERE id=?").run(slot,next.id);this.db.prepare('INSERT INTO equipped VALUES(?,?,?)').run(u,slot,itemId);for(const [part,x]of Object.entries(next.fittings))this.db.prepare('INSERT INTO equipped VALUES(?,?,?)').run(u,slot+':'+part,x);}};
 p.saveInstanceFitting=function(u,slot,itemId,hostId){const [host,part]=slot.split(':');this.syncInstances(u);const r=hostId?this.instanceRows(u).find(r=>r.id===hostId&&r.status!=='raid'):this.instanceRows(u).find(r=>r.status==='equipped'&&r.slot===host);if(!r)throw fail('HOST_NOT_OWNED','파츠를 장착할 개별 장비가 없습니다.');const previous=r.fittings[part];if(itemId!==null&&this.inventoryQuantity(u,itemId)<this.reservedQuantity(u,itemId)+(previous===itemId?0:1))throw fail('ITEM_NOT_OWNED','장착할 여분 파츠가 없습니다.');if(itemId===null)delete r.fittings[part];else r.fittings[part]=itemId;this.db.prepare('UPDATE item_instances SET fittings_json=? WHERE id=?').run(JSON.stringify(r.fittings),r.id);if(r.status==='equipped')this.db.prepare('INSERT INTO equipped VALUES(?,?,?) ON CONFLICT(user_id,slot) DO UPDATE SET item_id=excluded.item_id').run(u,r.slot+':'+part,itemId);return r;};
}
