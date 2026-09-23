import test from 'node:test';
import assert from 'node:assert/strict';
import { Raid, normalizeCatalog } from '../game.js';
import { GameDatabase } from '../db.js';
import { createRaidAccessWorld, isPasswordLetter, rollDocumentItem } from '../access.js';

const items = [
  ...['white', 'red', 'yellow', 'green', 'black'].map((color) => ({ id: `password-letter-${color}`, category: 'valuable', tier: color === 'black' ? 6 : 5, weight: 1 })),
  { id: 'metro-2036', category: 'valuable', tier: 3, weight: 1 },
  { id: 'old-video-tape', category: 'valuable', tier: 1, weight: 1 },
  { id: 'torn-map', category: 'valuable', tier: 5, weight: 1 },
  { id: 'torn-blueprint', category: 'valuable', tier: 5, weight: 1 },
  { id: 'precision-blueprint', category: 'valuable', tier: 6, weight: 1 },
  { id: 'top-secret-intelligence', category: 'valuable', tier: 6, weight: 1 },
  { id: 'ordinary-value', category: 'valuable', tier: 1, weight: 1 },
  { id: 'signal-flare', category: 'weapon', tier: 1, weight: 1 },
  { id: 'ammo-flare', category: 'ammo', tier: 1, weight: .1 },
];
const catalog = normalizeCatalog({ items, talents: [] });
const door = { id: 'access-door-yellow', buildingId: 'vault', name: 'Yellow vault', color: 'yellow', itemId: 'password-letter-yellow', x: 2, z: 0, w: .2, d: 3.2, h: 4.1, rotation: 0 };

function fixture({ obstacles = [], players = ['one', 'two'] } = {}) {
  const updates = [];
  const world = { size: 100, spawn: { x: 0, z: 0 }, obstacles, accessDoors: [door], lootSpawns: [], enemySpawns: [], extractions: [], radiationZones: [] };
  const room = { mode: 'coop', members: new Map(players.map((id) => [id, { username: id }])) };
  const escrow = players.map((userId) => ({ userId, gear: [] }));
  const db = { profile: () => ({ talents: [] }), updateRaidSecure: (...args) => updates.push(args), settleRaidPlayer: () => ({ applied: true }), markRaidCompleteIfSettled() {} };
  const raid = new Raid({ id: 'raid', room, escrow, db, catalog, world, now: () => 1_000, emit() {} });
  return { raid, sourceWorld: world, players: players.map((id) => raid.players.get(id)), updates };
}

test('raid access collision is cloned and locked doors appear in snapshots', () => {
  const { raid, sourceWorld } = fixture();
  assert.equal(sourceWorld.obstacles.length, 0);
  assert.ok(raid.world.obstacles.some((entry) => entry.accessDoorId === door.id));
  assert.deepEqual(raid.snapshot(1_000).accessDoors, [{ ...door, state: 'locked' }]);
});

test('unlock validates range, LOS and exact letter before mutation', () => {
  const { raid, players: [player], updates } = fixture({ obstacles: [{ x: 1, z: 0, w: .2, d: 4 }] });
  player.inventory.push({ itemId: door.itemId, quantity: 1 });
  assert.throws(() => raid.unlockDoor(player, door.id), { code: 'NO_LINE_OF_SIGHT' });
  assert.equal(player.inventory[0].quantity, 1); assert.equal(updates.length, 0);
  raid.world.obstacles = raid.world.obstacles.filter((entry) => !entry.id || !entry.id.startsWith('access-collider-')).concat([{ x: 1, z: 0, w: .2, d: 4 }, { ...door, id: `access-collider-${door.id}`, accessDoorId: door.id }]);
  player.x = -4;
  assert.throws(() => raid.unlockDoor(player, door.id), { code: 'TOO_FAR' });
  player.x = 0; raid.world.obstacles = raid.world.obstacles.filter((entry) => entry.x !== 1);
  player.inventory = [{ itemId: 'password-letter-red', quantity: 1 }];
  assert.throws(() => raid.unlockDoor(player, door.id), { code: 'PASSWORD_LETTER_REQUIRED' });
  assert.deepEqual(player.inventory, [{ itemId: 'password-letter-red', quantity: 1 }]);
});

test('door opens squad-wide once, consumes one letter, persists, and removes collision immediately', () => {
  const { raid, players: [owner, teammate], updates } = fixture();
  owner.inventory.push({ itemId: door.itemId, quantity: 2 });
  teammate.inventory.push({ itemId: door.itemId, quantity: 1 });
  raid.unlockDoor(owner, door.id);
  assert.equal(raid.accessDoors.get(door.id).state, 'open');
  assert.equal(raid.accessDoors.get(door.id).openedBy, owner.id);
  assert.deepEqual(owner.inventory, [{ itemId: door.itemId, quantity: 1 }]);
  assert.equal(updates.length, 1);
  assert.equal(raid.world.obstacles.some((entry) => entry.accessDoorId === door.id), false);
  raid.unlockDoor(teammate, door.id);
  assert.deepEqual(teammate.inventory, [{ itemId: door.itemId, quantity: 1 }]);
  assert.equal(updates.length, 1);
});

test('door accepts a password letter in the secure container and consumes exactly one', () => {
  const { raid, players: [player], updates } = fixture({ players: ['one'] });
  player.secure = [{ itemId: door.itemId, quantity: 2 }];
  raid.unlockDoor(player, door.id);
  assert.deepEqual(player.inventory, []);
  assert.deepEqual(player.secure, [{ itemId: door.itemId, quantity: 1 }]);
  assert.deepEqual(updates[0].slice(2), [[], [{ itemId: door.itemId, quantity: 1 }]]);
  raid.unlockDoor(player, door.id);
  assert.equal(updates.length, 1);
  assert.deepEqual(player.secure, [{ itemId: door.itemId, quantity: 1 }]);
});

test('locked-room containers reject search and take regardless of geometry', () => {
  const { raid, players: [player] } = fixture();
  player.x = 1; player.z = 0;
  const container = raid.addContainer({ id: 'vault-files', x: 1, z: 0, accessDoorId: door.id, pool: 'documents' }, [{ itemId: 'metro-2036', quantity: 1 }]);
  assert.throws(() => raid.interact(player, container.id, 1_000), { code: 'ACCESS_DOOR_LOCKED' });
  container.state = 'open';
  assert.throws(() => raid.takeContainer(player, container.id, 'metro-2036', 1), { code: 'ACCESS_DOOR_LOCKED' });
});

test('flare launchers in containers include one usable round', () => {
  const { raid } = fixture({ players: ['one'] });
  const container = raid.addContainer({ id: 'flare-cache', x: 0, z: 0 }, [{ itemId: 'signal-flare', quantity: 1 }]);
  assert.deepEqual(container.items.map(({stackId,...item})=>item), [{ itemId: 'signal-flare', quantity: 1 }, { itemId: 'ammo-flare', quantity: 1 }]);
});

test('document pool is mostly documents and keeps password letters rare', () => {
  let seed = 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let letters = 0;
  for (let index = 0; index < 20_000; index++) if (isPasswordLetter(rollDocumentItem(catalog, random)?.id)) letters++;
  assert.ok(letters > 120 && letters < 320, `letter count ${letters}`);
});

test('packed password letter is consumed in raid and cannot duplicate on extraction', () => {
  const db = new GameDatabase(':memory:');
  try {
    const user = db.createUser('access-user', Buffer.from('salt'), Buffer.from('hash'), [{ itemId: door.itemId, quantity: 2 }]);
    db.pack(user.id, door.itemId, 1, catalog);
    const escrow = db.beginRaid('raid-db', 'room-db', [user.id], new Map([[user.id, [{ itemId: door.itemId, quantity: 1, slot: 'packed' }]]]), 1_000);
    const room = { mode: 'solo', members: new Map([[user.id, { username: 'access-user' }]]) };
    const world = { size: 100, spawn: { x: 0, z: 0 }, obstacles: [], accessDoors: [door], lootSpawns: [], enemySpawns: [], extractions: [], radiationZones: [] };
    const raid = new Raid({ id: 'raid-db', room, escrow, db, catalog, world, now: () => 1_000, emit() {} });
    const player = raid.players.get(user.id);
    raid.unlockDoor(player, door.id);
    raid.settle(player, 'extracted', 2_000);
    assert.equal(db.inventoryQuantity(user.id, door.itemId), 1);
    assert.equal(db.profile(user.id).packed.find((stack) => stack.itemId === door.itemId)?.quantity, 1);
  } finally { db.close(); }
});

test('secure password letter consumption survives extraction without copying or stale reservation', () => {
  const db = new GameDatabase(':memory:');
  try {
    const user = db.createUser('secure-access-user', Buffer.from('salt'), Buffer.from('hash'), [{ itemId: door.itemId, quantity: 2 }]);
    db.secure(user.id, door.itemId, 1, catalog);
    const escrow = db.beginRaid('secure-raid-db', 'secure-room-db', [user.id], new Map(), 1_000);
    const room = { mode: 'solo', members: new Map([[user.id, { username: 'secure-access-user' }]]) };
    const world = { size: 100, spawn: { x: 0, z: 0 }, obstacles: [], accessDoors: [door], lootSpawns: [], enemySpawns: [], extractions: [], radiationZones: [] };
    const raid = new Raid({ id: 'secure-raid-db', room, escrow, db, catalog, world, now: () => 1_000, emit() {} });
    const player = raid.players.get(user.id);
    assert.deepEqual(player.inventory, []);
    assert.deepEqual(player.secure, [{ itemId: door.itemId, quantity: 1 }]);
    raid.unlockDoor(player, door.id);
    raid.settle(player, 'extracted', 2_000);
    assert.equal(db.inventoryQuantity(user.id, door.itemId), 1);
    assert.equal(db.profile(user.id).securePacked.some((stack) => stack.itemId === door.itemId), false);
  } finally { db.close(); }
});

test('access door definitions reject mismatched item IDs', () => {
  assert.throws(() => createRaidAccessWorld({ obstacles: [], accessDoors: [{ ...door, itemId: 'password-letter-red' }] }), { code: 'INVALID_ACCESS_DOOR' });
});


test('failed persistence leaves the letter and locked door intact',()=>{
 const {raid,players:[player]}=fixture();player.inventory=[{itemId:door.itemId,quantity:1}];
 raid.db.updateRaidSecure=()=>{throw new Error('disk unavailable');};
 assert.throws(()=>raid.unlockDoor(player,door.id),/disk unavailable/);
 assert.deepEqual(player.inventory,[{itemId:door.itemId,quantity:1}]);
 assert.equal(raid.accessDoors.get(door.id).state,'locked');
 assert.ok(raid.world.obstacles.some(o=>o.accessDoorId===door.id));
});

