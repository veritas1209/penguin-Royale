import {planSecureTransfer} from '../secureContainer.js';import {createPlayerLoot} from '../playerLoot.js';
import {createContainer} from '../containers.js';import {dropInventory} from '../inventoryActions.js';import {planRaidEquipment} from '../raidEquipment.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {GameDatabase} from '../db.js';import {Raid,normalizeCatalog} from '../game.js';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';import {weaponFitsSlot,isPistolWeapon} from '../../shared/weaponSlots.ts';
import {equipmentWeights} from '../../shared/metroInventory.ts';import {emptyContainerEquipmentSlots} from '../../shared/containerEquipment.ts';
import {equipmentLossPlan} from '../settlementLoss.js';
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});
const pistol=ITEMS.find(i=>isPistolWeapon(i)&&i.id==='p92-repaired')??ITEMS.find(isPistolWeapon),otherPistol=ITEMS.find(i=>isPistolWeapon(i)&&i.id!==pistol.id);

test('legacy two pistol slots move one exact fitted instance to pistol and stash the other without loss',()=>{
 const db=new GameDatabase(':memory:');db.instanceCatalog=catalog.byId;
 try{
  const u=db.createUser('legacy-four',Buffer.from('s'),Buffer.from('h'),[{itemId:pistol.id,quantity:1},{itemId:otherPistol.id,quantity:1},{itemId:'red-dot',quantity:2}],{primary:pistol.id,secondary:otherPistol.id,'primary:scope':'red-dot','secondary:scope':'red-dot'});
  for(const [id,itemId,slot]of [['old-first',pistol.id,'primary'],['old-extra',otherPistol.id,'secondary']])db.db.prepare('INSERT INTO item_instances VALUES(?,?,?,?,?,?)').run(id,u.id,itemId,JSON.stringify({scope:'red-dot'}),'equipped',slot);
  const p=db.profile(u.id);assert.equal(p.equipped.pistol,pistol.id);assert.equal(p.equipped.primary,undefined);assert.equal(p.equipped.secondary,undefined);assert.equal(p.equippedInstanceIds.pistol,'old-first');assert.equal(p.equipped['pistol:scope'],'red-dot');assert.equal(p.instances.find(r=>r.id==='old-extra').status,'stash');assert.equal(p.instances.find(r=>r.id==='old-extra').fittings.scope,'red-dot');assert.equal(db.instanceReserved(u.id,'red-dot'),2);assert.equal(db.inventoryQuantity(u.id,pistol.id),1);assert.equal(db.inventoryQuantity(u.id,otherPistol.id),1);
  assert.deepEqual(db.profile(u.id).instances,p.instances);assert.throws(()=>db.equip(u.id,'primary',pistol.id,catalog),{code:'INCOMPATIBLE_SLOT'});assert.throws(()=>db.equip(u.id,'pistol','m416',catalog),{code:'INCOMPATIBLE_SLOT'});
 }finally{db.close();}
});

function runtime(){
 const db=new GameDatabase(':memory:',{lossRandom:()=>.9});db.instanceCatalog=catalog.byId;
 const gear={primary:'m416-repaired',secondary:'mk14-repaired',pistol:pistol.id,melee:'sickle',backpack:'backpack-6','pistol:scope':'red-dot'};
 const owned=Object.values(gear).map(itemId=>({itemId,quantity:1}));owned.push({itemId:otherPistol.id,quantity:1});
 const ammoIds=[...new Set(['primary','secondary','pistol'].map(slot=>catalog.byId.get(gear[slot]).ammo))];for(const itemId of ammoIds)owned.push({itemId,quantity:100});
 const u=db.createUser('four-runtime',Buffer.from('s'),Buffer.from('h'),owned,gear);const [entry]=db.beginRaid('four','room',[u.id],new Map([[u.id,[...ammoIds.map(itemId=>({itemId,quantity:100})),{itemId:otherPistol.id,quantity:1,slot:'packed'}]]]));
 const world={size:200,spawn:{x:0,z:0},obstacles:[],enemySpawns:[],lootSpawns:[],extractions:[],radiationZones:[]};
 const raid=new Raid({id:'four',room:{mode:'solo',members:new Map([[u.id,{username:'u'}]])},escrow:[entry],db,catalog,world,now:()=>1000,emit(){}}),p=raid.players.get(u.id);p.carryCapacity=10000;return {db,u,raid,p,ammoIds};
}

test('all four weapons switch; pistol magazine, ammo selection, reload and shot queue use its own host',()=>{
 const {db,raid,p}=runtime();try{
  for(const slot of ['primary','secondary','pistol','melee']){raid.switchWeapon(p,slot);assert.equal(p.activeWeaponSlot,slot);}
  assert.ok(p.magazines.pistol>0);const ammo=catalog.byId.get(p.gear.pistol).ammo,capacity=p.magazines.pistol;p.magazines.pistol=0;p.reloadSlot='pistol';p.reloadAmmoId=ammo;raid.finishReload(p);assert.equal(p.magazines.pistol,capacity);
  raid.fire(p,'pistol',1,0,1000);assert.equal(p.burstQueue[0].slot,'pistol');const main=p.magazines.primary;raid.resolveShot(p,p.burstQueue[0],1000);assert.equal(p.magazines.pistol,capacity-1);assert.equal(p.magazines.primary,main);
  const own=raid.snapshot(1000,p.id).players[0];assert.equal(own.weaponAttachments.pistol.scope,'red-dot');assert.ok(own.weaponFittingStats.pistol);assert.equal(own.magazines.pistol,capacity-1);
 }finally{db.close();}
});

test('pistol raid swaps preserve loaded rounds and attached bundle, cancel stale shots and extract exactly once',()=>{
 const {db,raid,p,ammoIds}=runtime();try{
  const old=p.gear.pistol,ammo=catalog.byId.get(old).ammo,rounds=p.magazines.pistol,reserve=p.reserveAmmo[ammo];p.burstQueue=[{slot:'pistol',weapon:catalog.byId.get(old)},{slot:'primary',weapon:catalog.byId.get(p.gear.primary)}];
  raid.equipRaid(p,'pistol',otherPistol.id);assert.equal(p.reserveAmmo[ammo],reserve+rounds);assert.equal(p.magazines.pistol,0);assert.equal(p.gear['pistol:scope'],undefined);assert.equal(p.burstQueue.length,1);assert.equal(p.inventory.find(s=>s.itemId===old).fittings.scope,'red-dot');
  const stored=JSON.parse(db.db.prepare('SELECT loot_json FROM raid_escrow WHERE raid_id=?').get('four').loot_json);assert.equal(stored.find(s=>s.itemId===old).fittings.scope,'red-dot');
  raid.equipRaid(p,'pistol',old);assert.equal(p.gear['pistol:scope'],'red-dot');assert.equal(p.inventory.some(s=>s.itemId===old),false);raid.settle(p,'extracted',2000);
  for(const id of ammoIds)assert.equal(db.inventoryQuantity(p.id,id),100);assert.equal(db.inventoryQuantity(p.id,'red-dot'),1);assert.equal(db.inventoryQuantity(p.id,old),1);assert.equal(db.inventoryQuantity(p.id,otherPistol.id),1);
 }finally{db.close();}
});

test('pistol attachments count once and death has independent four host rolls with parts following pistol',()=>{
 const gear={primary:'m416',secondary:'mk14',pistol:pistol.id,melee:'sickle','pistol:scope':'red-dot'};
 assert.equal(weaponFitsSlot(pistol,'pistol'),true);assert.equal(weaponFitsSlot(pistol,'secondary'),false);assert.deepEqual(emptyContainerEquipmentSlots(pistol,{},id=>catalog.byId.get(id)).map(s=>s.slot),['pistol']);
 const weights=equipmentWeights(gear,id=>catalog.byId.get(id),'pistol');assert.equal(weights.bySlot.pistol,catalog.byId.get(pistol.id).weight+catalog.byId.get('red-dot').weight);
 let calls=0;const plan=equipmentLossPlan(Object.entries(gear).map(([slot,itemId])=>({slot,itemId,quantity:1})),[],[],()=>{calls++;return calls===2?.1:.9;});assert.equal(calls,4);assert.ok(plan.lossReport.lost.some(s=>s.slot==='pistol'));assert.ok(plan.lossReport.lost.some(s=>s.slot==='pistol:scope'));assert.equal(plan.finalEquipped.primary,'m416');
});
test('fitted armor swaps as one body, restores modules and rejects overflow without altering the original',()=>{
 const part=ITEMS.find(i=>i.category==='attachment'&&i.slot==='vest'&&i.baseId==='tactical-pouch')??ITEMS.find(i=>i.category==='attachment'&&i.slot==='vest');
 const p={gear:{armor:'armor-6','armor:0':part.id,backpack:'backpack-6'},inventory:[{itemId:'armor-1',quantity:1}],reserveAmmo:{},talentLevels:{}};
 const first=planRaidEquipment(p,'armor','armor-1',catalog);assert.equal(first.nextGear['armor:0'],undefined);const bundle=first.nextInventory.find(s=>s.itemId==='armor-6');assert.equal(bundle.fittings['0'],part.id);assert.equal(p.gear['armor:0'],part.id);
 const second=planRaidEquipment({...p,gear:first.nextGear,inventory:first.nextInventory},'armor','armor-6',catalog);assert.equal(second.nextGear['armor:0'],part.id);assert.equal(second.nextInventory.some(s=>s.itemId==='armor-6'),false);
 const tiny={...p,gear:{armor:'armor-6','armor:0':part.id},inventory:[{itemId:'armor-1',quantity:1},{itemId:'m416',quantity:4}]};assert.throws(()=>planRaidEquipment(tiny,'armor','armor-1',catalog),{code:'OVER_CAPACITY'});assert.equal(tiny.gear['armor:0'],part.id);assert.equal(tiny.inventory.length,2);
});

test('fitted weapon drop and pickup keep parts; empty-slot direct equip restores them',()=>{
 const {db,raid,p}=runtime();try{
  const old=p.gear.pistol;raid.equipRaid(p,'pistol',otherPistol.id);const c=dropInventory(raid,p,old,1);assert.equal(c.items[0].fittings.scope,'red-dot');assert.equal(p.inventory.some(s=>s.itemId===old),false);
  raid.takeContainer(p,c.id,old,1);assert.equal(p.inventory.find(s=>s.itemId===old).fittings.scope,'red-dot');const d=dropInventory(raid,p,old,1);raid.equipRaid(p,'pistol',null);raid.equipContainer(p,{containerId:d.id,itemId:old,slot:'pistol'});assert.equal(p.gear['pistol:scope'],'red-dot');assert.equal(d.items.length,0);raid.settle(p,'extracted',2000);assert.equal(db.inventoryQuantity(p.id,'red-dot'),1);
 }finally{db.close();}
});

test('new fitted host picked up into bag becomes a fitted stash instance upon extraction',()=>{
 const {db,raid,p}=runtime();try{
  const c=createContainer({id:'found',x:p.x,z:p.z},0,[{itemId:'m416',quantity:1,fittings:{scope:'red-dot'}}]);c.state='open';raid.containers.set(c.id,c);raid.takeContainer(p,c.id,'m416',1);raid.settle(p,'extracted',2000);
  const profile=db.profile(p.id),found=profile.instances.find(r=>r.itemId==='m416');assert.equal(found.status,'stash');assert.equal(found.fittings.scope,'red-dot');assert.equal(db.inventoryQuantity(p.id,'red-dot'),2);assert.equal(db.instanceReserved(p.id,'red-dot'),2);
 }finally{db.close();}
});
test('plain and fitted same firearm pickup/drop/reclaim/extraction preserve two bodies and one fitting',()=>{
 const {db,raid,p}=runtime();try{
  const itemId='mk14',part='scope-4x';
  const fitted=createContainer({id:'mixed-fitted',x:p.x,z:p.z},0,[{itemId,quantity:1,fittings:{scope:part}}]);fitted.state='open';raid.containers.set(fitted.id,fitted);
  raid.takeContainer(p,fitted.id,itemId,1);
  const plain=createContainer({id:'mixed-plain',x:p.x,z:p.z},0,[{itemId,quantity:1}]);plain.state='open';raid.containers.set(plain.id,plain);raid.takeContainer(p,plain.id,itemId,1);
  const bodies=()=>p.inventory.filter(s=>s.itemId===itemId);assert.equal(bodies().length,2);assert.equal(bodies().find(s=>s.fittings).quantity,1);assert.equal(bodies().find(s=>!s.fittings).quantity,1);
  const fittedDrop=dropInventory(raid,p,itemId,1);assert.equal(fittedDrop.items[0].fittings.scope,part);raid.takeContainer(p,fittedDrop.id,itemId,1);
  // Reclaim appended the fitted body after the plain one: the next drop must be plain.
  const plainDrop=dropInventory(raid,p,itemId,1);assert.equal(plainDrop.items[0].fittings,undefined);raid.takeContainer(p,plainDrop.id,itemId,1);assert.equal(bodies().find(s=>s.fittings).quantity,1);
  raid.settle(p,'extracted',2000);assert.equal(db.inventoryQuantity(p.id,itemId),2);assert.equal(db.inventoryQuantity(p.id,part),1);assert.equal(db.instanceReserved(p.id,part),1);
  const instances=db.profile(p.id).instances.filter(r=>r.itemId===itemId);assert.equal(instances.length,2);assert.equal(instances.filter(r=>r.fittings.scope===part).length,1);assert.equal(instances.filter(r=>!r.fittings.scope).length,1);
 }finally{db.close();}
});

test('secure transfer never merges a plain copy into an existing fitted body and failed transfer is atomic',()=>{
 const player={inventory:[{itemId:'mk14',quantity:1,fittings:{scope:'scope-4x'}},{itemId:'mk14',quantity:1}],secure:[{itemId:'mk14',quantity:1}],reserveAmmo:{},carryCapacity:1000};
 const before=JSON.stringify(player);for(const direction of ['deposit','withdraw'])assert.throws(()=>planSecureTransfer(player,'mk14',1,direction,catalog),{code:'FITTED_WEAPON_SECURE'});assert.equal(JSON.stringify(player),before);
});

test('flat corpse host pickup stays plain beside a fitted copy and corpse parts appear only once',()=>{
 const {db,raid,p}=runtime();try{
  p.inventory.push({itemId:'mk14',quantity:1,fittings:{scope:'scope-4x'}});
  const corpse=createPlayerLoot('source',{id:'donor',username:'Donor',x:p.x,z:p.z},{applied:true,outcome:'dead',lossReport:{lost:[{itemId:'mk14',quantity:1,source:'bag'},{itemId:'mk14',quantity:1,source:'bag'},{itemId:'scope-4x',quantity:1,source:'bag'}]}});
  assert.equal(corpse.items.find(s=>s.itemId==='mk14').quantity,2);assert.equal(corpse.items.find(s=>s.itemId==='scope-4x').quantity,1);raid.containers.set(corpse.id,corpse);raid.takeContainer(p,corpse.id,'mk14',2);
  assert.equal(p.inventory.find(s=>s.itemId==='mk14'&&s.fittings).quantity,1);assert.equal(p.inventory.find(s=>s.itemId==='mk14'&&!s.fittings).quantity,2);
 }finally{db.close();}
});
test('container stackId picks the second fitted Mk14 row and stale IDs never fall back',()=>{
 const {db,raid,p}=runtime();try{
  const c=createContainer({id:'exact-pickup',x:p.x,z:p.z},0,[{itemId:'mk14',quantity:1,fittings:{scope:'red-dot'}},{itemId:'mk14',quantity:1,fittings:{scope:'scope-4x'}}]);c.state='open';raid.containers.set(c.id,c);
  const [first,second]=c.items.map(s=>s.stackId);assert.notEqual(first,second);
  raid.command(p.id,{type:'take_container',seq:1,containerId:c.id,itemId:'mk14',quantity:1,stackId:second});assert.equal(p.inventory.find(s=>s.itemId==='mk14').fittings.scope,'scope-4x');assert.equal(c.items.length,1);assert.equal(c.items[0].stackId,first);
  const before=JSON.stringify(c.items);assert.throws(()=>raid.takeContainer(p,c.id,'mk14',1,second),{code:'INSUFFICIENT_CONTAINER_ITEMS'});assert.equal(JSON.stringify(c.items),before);
  assert.throws(()=>raid.takeContainer(p,c.id,'mk14',1,'another-container:item:0'),{code:'INSUFFICIENT_CONTAINER_ITEMS'});assert.throws(()=>raid.takeContainer(p,c.id,'red-dot',1,first),{code:'INSUFFICIENT_CONTAINER_ITEMS'});
  raid.takeContainer(p,c.id,'mk14',1);assert.deepEqual(p.inventory.filter(s=>s.itemId==='mk14').map(s=>s.fittings.scope).sort(),['red-dot','scope-4x']);
 }finally{db.close();}
});

test('container exact-row direct equip restores second row fittings and preserves first stable ID',()=>{
 const {db,raid,p}=runtime();try{
  raid.equipRaid(p,'secondary',null);
  const c=createContainer({id:'exact-equip',x:p.x,z:p.z},0,[{itemId:'mk14',quantity:1,fittings:{scope:'red-dot'}},{itemId:'mk14',quantity:1,fittings:{scope:'scope-4x'}}]);c.state='open';raid.containers.set(c.id,c);
  const [first,second]=c.items.map(s=>s.stackId);raid.command(p.id,{type:'equip_container',seq:1,containerId:c.id,itemId:'mk14',slot:'secondary',stackId:second});assert.equal(p.gear['secondary:scope'],'scope-4x');assert.equal(c.items[0].stackId,first);
  assert.throws(()=>raid.equipContainer(p,{containerId:c.id,itemId:'mk14',slot:'primary',stackId:second}),{code:'INSUFFICIENT_CONTAINER_ITEMS'});assert.equal(c.items[0].stackId,first);
  const own=raid.snapshot(1000,p.id);assert.equal(own.containers.find(s=>s.id===c.id).items[0].stackId,first);raid.takeContainer(p,c.id,'mk14',1,first);raid.settle(p,'extracted',2000);
  assert.equal(db.inventoryQuantity(p.id,'mk14'),2);assert.equal(db.inventoryQuantity(p.id,'scope-4x'),1);assert.equal(db.inventoryQuantity(p.id,'red-dot'),2);
 }finally{db.close();}
});
test('in-raid attachment swap and equipped weapon drop keep the fitted host on the ground',()=>{
 const {db,raid,p}=runtime();try{
  p.inventory.push({itemId:'scope-2x',quantity:1});raid.db.updateRaidInventoryState(raid.id,p.id,p.inventory,p.gear,p.reserveAmmo,p.magazines,p.loadedAmmo);
  raid.equipRaid(p,'scope','scope-2x',0,'primary');assert.equal(p.gear['primary:scope'],'scope-2x');assert.equal(p.inventory.some(s=>s.itemId==='scope-2x'),false);
  const gun=p.gear.primary,container=raid.dropEquipped(p,'primary');assert.equal(p.gear.primary,undefined);assert.equal(container.state,'open');assert.equal(container.items[0].itemId,gun);assert.equal(container.items[0].fittings.scope,'scope-2x');assert.ok(raid.containers.has(container.id));
 }finally{db.close();}
});

