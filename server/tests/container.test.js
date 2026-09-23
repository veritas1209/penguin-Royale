import test from 'node:test';
import assert from 'node:assert/strict';
import { Raid, normalizeCatalog } from '../game.js';

const catalog = normalizeCatalog({
  items: [
    { id: 'med', category: 'medical', tier: 1, weight: 1, heal: 20 },
    { id: 'ammo', category: 'ammo', tier: 1, weight: 0.1, packSize: 10 },
    { id: 'heavy', category: 'valuable', tier: 1, weight: 50 },
    { id: 'armor', category: 'armor', tier: 1, weight: 2 },
    { id: 'rare-value', category: 'valuable', tier: 3, weight: 1 },
  ],
  talents: [],
});

function fixture({ world: override, players = ['one', 'two'] } = {}) {
  let clock = 1_000;
  const updates = [];
  const world = override ?? {
    size: 100,
    spawn: { x: 0, z: 0 },
    obstacles: [],
    lootSpawns: [
      { id: 'normal', x: 1, z: 0, pool: 'medical', tier: 1 },
      { id: 'military', x: 2, z: 0, pool: 'military', tier: 1 },
      { id: 'rare', x: 0, z: 2, pool: 'medical', containerKind: 'rare', tier: 2 },
    ],
    enemySpawns: [], extractions: [], radiationZones: [],
  };
  const room = { mode: players.length > 1 ? 'coop' : 'solo', members: new Map(players.map((id) => [id, { username: id }])) };
  const escrow = players.map((userId) => ({ userId, gear: [] }));
  const db = {
    profile: () => ({ talents: [] }),
    updateRaidLoot: (...args) => updates.push(args),
    updateRaidInventoryState: (raidId,userId,inventory) => updates.push([raidId,userId,inventory]),
    settleRaidPlayer: () => ({ applied: true }), markRaidCompleteIfSettled() {},
  };
  const raid = new Raid({ id: 'test', room, escrow, db, catalog, world, now: () => clock, emit() {} });
  return { raid, players: players.map((id) => raid.players.get(id)), updates, setClock: (value) => { clock = value; } };
}

test('initial world loot spawns are timed containers with hidden contents', () => {
  const { raid, players: [player] } = fixture();
  assert.equal(raid.loot.size, 0);
  assert.deepEqual([...raid.containers.values()].map(({ kind, searchSeconds }) => [kind, searchSeconds]), [
    ['normal', 3], ['military', 6], ['rare', 8],
  ]);
  const publicSnapshot = raid.snapshot(1_000);
  assert.ok(publicSnapshot.containers.every((container) => container.state === 'closed' && !('items' in container)));
  assert.equal('searching' in publicSnapshot.players[0], false);
  assert.equal(raid.snapshot(1_000, player.id).players[0].searching, null);
});

test('search is timed, repeated interact is idempotent, and taking is exact and atomic', () => {
  const { raid, players: [owner, other] } = fixture();
  const container = raid.containers.get('normal');
  container.items = [{ itemId: 'med', quantity: 3 }, { itemId: 'ammo', quantity: 10 }];
  owner.x = other.x = container.x; owner.z = other.z = container.z;
  raid.interact(owner, container.id, 2_000);
  const original = { ...owner.searching };
  raid.interact(owner, container.id, 2_500);
  assert.deepEqual(owner.searching, original);
  assert.throws(() => raid.interact(other, container.id, 2_500), { code: 'CONTAINER_BUSY' });
  raid.updateContainerSearches(4_999);
  assert.equal(container.state, 'searching');
  raid.updateContainerSearches(5_000);
  assert.equal(container.state, 'open');
  assert.deepEqual(raid.snapshot(5_000).containers.find(({ id }) => id === container.id).items, container.items);
  raid.takeContainer(other, container.id, 'ammo', 1);
  assert.equal(other.reserveAmmo.ammo,1);
  assert.throws(() => raid.takeContainer(owner, container.id, 'med', 1.5), { code: 'INVALID_QUANTITY' });
  raid.takeContainer(owner, container.id, 'med', 2);
  raid.takeContainer(owner, container.id, 'ammo', 4);
  assert.equal(owner.inventory.find(({ itemId }) => itemId === 'med').quantity, 2);
  assert.equal(owner.reserveAmmo.ammo, 4);
  assert.deepEqual(container.items.map(({stackId,...item})=>item), [{ itemId: 'med', quantity: 1 }, { itemId: 'ammo', quantity: 5 }]);
  assert.throws(() => raid.takeContainer(owner, container.id, 'med', 2), { code: 'INSUFFICIENT_CONTAINER_ITEMS' });
});

test('movement, explicit cancel, fire/reload intent, death, and disconnect interrupt search while damage does not', () => {
  const { raid, players: [player] } = fixture({ players: ['one'] });
  const container = raid.containers.get('normal');
  player.x = container.x; player.z = container.z;
  const restart = () => { raid.interact(player, container.id, 1_000); assert.equal(container.state, 'searching'); };
  restart(); raid.input(player, { moveX: 1, moveZ: 0, aimX: 0, aimZ: 1, sprint: false }); assert.equal(player.searching, null);
  player.input = { moveX: 0, moveZ: 0, sprint: false };
  restart(); raid.cancelSearch(player); assert.equal(container.state, 'closed'); assert.equal(raid.cancelSearch(player), false);
  restart(); assert.throws(() => raid.command(player.id, { type: 'fire', seq: 1, weaponSlot: 'primary', aimX: 1, aimZ: 0 }), { code: 'NO_WEAPON' }); assert.equal(player.searching, null);
  restart(); assert.throws(() => raid.command(player.id, { type: 'reload', seq: 2, weaponSlot: 'primary' }), { code: 'NO_WEAPON' }); assert.equal(player.searching, null);
  restart(); raid.damagePlayer(player, 1, 'test', 1_100); assert.ok(player.searching);raid.cancelSearch(player);
  restart(); raid.disconnect(player.id); assert.equal(player.searching, null);
  player.connected = true; player.disconnectedAt = null;
  restart(); raid.killPlayer(player, 'test', 1_200); assert.equal(player.searching, null);
});

test('distance, line of sight, capacity, and unknown catalog contents are authoritative', () => {
  const world = { size: 100, spawn: { x: 0, z: 0 }, obstacles: [{ x: 1, z: 0, w: 0.5, d: 2 }], lootSpawns: [], enemySpawns: [], extractions: [], radiationZones: [] };
  const { raid, players: [player] } = fixture({ world, players: ['one'] });
  const blocked = raid.addContainer({ id: 'blocked', x: 2, z: 0, containerKind: 'normal' }, [{ itemId: 'med', quantity: 1 }]);
  assert.throws(() => raid.interact(player, blocked.id, 1_000), { code: 'NO_LINE_OF_SIGHT' });
  player.x = 2; raid.interact(player, blocked.id, 1_000); raid.updateContainerSearches(4_000);
  blocked.items.push({ itemId: 'unknown', quantity: 1 }, { itemId: 'heavy', quantity: 1 });
  assert.throws(() => raid.takeContainer(player, blocked.id, 'unknown', 1), { code: 'UNKNOWN_ITEM' });
  assert.equal(blocked.items.find(({ itemId }) => itemId === 'unknown').quantity, 1);
  player.carryCapacity=raid.catalog.byId.get('heavy').weight-.01;
  assert.throws(() => raid.takeContainer(player, blocked.id, 'heavy', 1), { code: 'OVER_CAPACITY' });
  player.x = 10;
  assert.throws(() => raid.takeContainer(player, blocked.id, 'med', 1), { code: 'TOO_FAR' });
});

test('teammates receive the search timeline but no contents, and cancellation releases it',()=>{
 const {raid,players:[owner,other]}=fixture();owner.x=other.x=1;owner.z=other.z=0;
 raid.interact(owner,'normal',2000);
 const viewed=raid.snapshot(2500,other.id).containers.find(c=>c.id==='normal');
 assert.deepEqual(viewed.search,{playerId:owner.id,startedAt:2000,completeAt:5000});assert.equal('items' in viewed,false);
 raid.disconnect(owner.id);
 const cancelled=raid.snapshot(2600,other.id).containers.find(c=>c.id==='normal');assert.equal(cancelled.state,'closed');assert.equal('search' in cancelled,false);
 raid.interact(other,'normal',3000);raid.updateContainerSearches(6000);
 const opened=raid.snapshot(6000,other.id).containers.find(c=>c.id==='normal');assert.equal(opened.state,'open');assert.equal('search' in opened,false);assert.ok(Array.isArray(opened.items));
});
test('starting a search cancels treatment and extraction, while active reload prevents searching',()=>{
 const {raid,players:[p]}=fixture();p.x=1;p.z=0;p.medicalUse={itemId:'med',startedAt:1000,endsAt:7000};p.extracting={extractionId:'exit',completeAt:9000};
 raid.interact(p,'normal',2000);assert.equal(p.medicalUse,null);assert.equal(p.extracting,null);assert.ok(p.searching);assert.ok(raid.events.some(e=>e.kind==='extraction_cancelled'&&e.data.reason==='search'));
 raid.cancelSearch(p);p.reloadEndsAt=5000;assert.throws(()=>raid.interact(p,'normal',3000),{code:'RELOADING'});assert.equal(raid.containers.get('normal').state,'closed');
});
test('successful throwing and instant medical use stop an active search',()=>{
 const {raid,players:[p]}=fixture();p.x=1;p.z=0;
 raid.catalog={...raid.catalog,byId:new Map(raid.catalog.byId)};raid.catalog.byId.set('frag',{id:'frag',category:'throwable',effect:'grenade'});
 p.inventory=[{itemId:'frag',quantity:1},{itemId:'med',quantity:1}];
 raid.interact(p,'normal',1000);raid.command(p.id,{type:'throw',seq:1,itemId:'frag',aimX:1,aimZ:0});
 assert.equal(p.searching,null);assert.equal(raid.projectiles.size,1);assert.ok(!p.inventory.some(i=>i.itemId==='frag'));
 raid.db.updateRaidEquipment=()=>{};p.hp=30;raid.interact(p,'normal',1100);raid.useMedical(p,'med');assert.equal(p.searching,null);assert.equal(p.hp,50);
});
