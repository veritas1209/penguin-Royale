import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { ITEMS, TALENTS } from '../../shared/catalog.ts';
import { WORLD } from '../../shared/world.ts';
import { createGameServer } from '../app.js';
import { GameDatabase } from '../db.js';
import { normalizeCatalog, Raid, recoveryLoadout } from '../game.js';

const catalog = { items: ITEMS, talents: TALENTS };

function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'penguin-server-'));
  return { directory, path: join(directory, 'game.sqlite') };
}

async function running(options = {}) {
  const storage = temporaryDatabase();
  const game = createGameServer({lossRandom:()=>0, dbPath: storage.path, catalog, world: WORLD, ...options });
  const address = await game.listen(0);
  return { game, storage, base: `http://127.0.0.1:${address.port}/games/penguin-extraction` };
}

async function request(base, path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { response, json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function register(base, username) {
  const result = await request(base, '/api/auth/register', { method: 'POST', body: { username, password: 'correct-horse-99' } });
  assert.equal(result.response.status, 201, JSON.stringify(result.json));
  return result;
}

async function websocket(base, cookie) {
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { cookie } });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let seq = 0;
  const messages = [];
  ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  ws.send(JSON.stringify({ v: 1, type: 'hello', seq: seq++ }));
  await waitFor(() => messages.some((message) => message.type === 'welcome'));
  return { ws, messages, nextSeq: () => seq++ };
}

async function waitFor(predicate, timeout = 2_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for state');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('authentication isolates accounts and persists profiles across restart', async () => {
  const state = await running();
  try {
    const denied = await request(state.base, '/api/auth/register', { method: 'POST', headers: { origin: 'https://untrusted.example' }, body: { username: 'Denied_User', password: 'correct-horse-99' } });
    assert.equal(denied.response.status, 403);
    const alice = await register(state.base, 'Alice_One');
    const bob = await register(state.base, 'Bob_Two');
    assert.notEqual(alice.json.user.id, bob.json.user.id);
    const aliceMe = await request(state.base, '/api/me', { cookie: alice.cookie });
    const bobMe = await request(state.base, '/api/me', { cookie: bob.cookie });
    assert.equal(aliceMe.json.user.username, 'Alice_One');
    assert.equal(bobMe.json.user.username, 'Bob_Two');
    assert.equal(aliceMe.json.profile.equipped.primary, 'm416-repaired');
    assert.equal(aliceMe.json.profile.talentLevels.constructor, Object);
    assert.equal((await request(state.base, '/api/me')).response.status, 401);

    const buy = await request(state.base, '/api/shop/buy', { method: 'POST', cookie: alice.cookie, body: { itemId: 'ammo-556', quantity: 1 } });
    assert.equal(buy.response.status, 200);
    assert.equal(buy.json.purchased.units, ITEMS.find((item) => item.id === 'ammo-556').packSize);
    const quantityAfterBuy = buy.json.profile.stash.find((stack) => stack.itemId === 'ammo-556').quantity;

    await state.game.close();
    const restarted = createGameServer({lossRandom:()=>0, dbPath: state.storage.path, catalog, world: WORLD });
    const address = await restarted.listen(0);
    try {
      const login = await request(`http://127.0.0.1:${address.port}/games/penguin-extraction`, '/api/auth/login', { method: 'POST', body: { username: 'alice_one', password: 'correct-horse-99' } });
      assert.equal(login.response.status, 200);
      assert.equal(login.json.profile.stash.find((stack) => stack.itemId === 'ammo-556').quantity, quantityAfterBuy);
      const wrong = await request(`http://127.0.0.1:${address.port}/games/penguin-extraction`, '/api/auth/login', { method: 'POST', body: { username: 'Alice_One', password: 'wrong-password' } });
      assert.equal(wrong.response.status, 401);
    } finally { await restarted.close(); }
  } finally {
    if (state.game.server.listening) await state.game.close();
    rmSync(state.storage.directory, { recursive: true, force: true });
  }
});

test('two authenticated players join a co-op room and start one authoritative raid', async () => {
  const state = await running();
  const sockets = [];
  try {
    const alpha = await register(state.base, 'Coop_Alpha');
    const beta = await register(state.base, 'Coop_Beta');
    const alphaSocket = await websocket(state.base, alpha.cookie); sockets.push(alphaSocket.ws);
    const betaSocket = await websocket(state.base, beta.cookie); sockets.push(betaSocket.ws);
    const created = await request(state.base, '/api/rooms', { method: 'POST', cookie: alpha.cookie, body: { mode: 'coop' } });
    assert.match(created.json.room.code, /^[A-Z0-9]{6}$/);
    const joined = await request(state.base, '/api/rooms/join', { method: 'POST', cookie: beta.cookie, body: { code: created.json.room.code } });
    assert.equal(joined.json.room.members.length, 2);
    const beforeReady = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: alpha.cookie });
    assert.equal(beforeReady.response.status, 409);
    const alphaReady = await request(state.base, '/api/rooms/ready', { method: 'POST', cookie: alpha.cookie, body: { ready: true } });
    assert.equal(alphaReady.json.room.members[0].ready, true);
    const stillWaiting = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: alpha.cookie });
    assert.equal(stillWaiting.response.status, 409);
    const betaReady = await request(state.base, '/api/rooms/ready', { method: 'POST', cookie: beta.cookie, body: { ready: true } });
    assert.equal(betaReady.json.room.members.every(member => member.ready), true);
    const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: alpha.cookie });
    assert.equal(started.response.status, 200, JSON.stringify(started.json));
    const raid = state.game.manager.raids.get(started.json.raidId);
    assert.equal(raid.players.size, 2);
    assert.equal(raid.room.mode, 'coop');
    assert.ok([...raid.players.values()].every((player) => player.magazines.primary > 0));
    const betaStart = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: beta.cookie });
    assert.equal(betaStart.response.status, 403);
  } finally {
    for (const ws of sockets) ws.terminate();
    await state.game.close();
    rmSync(state.storage.directory, { recursive: true, force: true });
  }
});

test('flare activates after thirty seconds and extraction preserves remaining ammo', async () => {
  let clock = 1_000_000;
  const state = await running({ now: () => clock });
  let socket;
  try {
    const account = await register(state.base, 'Heli_Test');
    // The launcher is now map-only; grant a recovered one in this lifecycle fixture.
    state.game.db.db.prepare('INSERT INTO inventory(user_id,item_id,quantity) VALUES (?,?,1)').run(account.json.user.id,'signal-flare');
    state.game.db.equip(account.json.user.id,'flare','signal-flare',state.game.manager.catalog);
    const connection = await websocket(state.base, account.cookie); socket = connection.ws;
    await request(state.base, '/api/rooms', { method: 'POST', cookie: account.cookie, body: { mode: 'solo' } });
    const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: account.cookie });
    const raid = state.game.manager.raids.get(started.json.raidId);
    const player = raid.players.get(account.json.user.id);
    raid.enemies.clear();
    const flareDrop=raid.addContainer({id:'fixture-flare-world',x:player.x,z:player.z,searchSeconds:0},[{itemId:'signal-flare',quantity:1}]);flareDrop.state='open';
    raid.takeContainer(player,flareDrop.id,'ammo-flare',1);
    const ammoBefore = player.reserveAmmo['ammo-flare'];
    raid.command(player.id,{v:1,type:'flare',seq:1});
    const zone=[...raid.extractions.values()].find(e=>e.kind==='flare');
    assert.equal(zone.activatesAt,clock+30_000);
    assert.equal(zone.expiresAt,clock+90_000);
    assert.equal(player.reserveAmmo['ammo-flare'],ammoBefore-1);
    clock+=29_999;raid.tick(clock);assert.equal(zone.state,'arming');
    clock+=1;raid.tick(clock);assert.equal(zone.state,'active');
    raid.command(player.id,{v:1,type:'interact',seq:2,targetId:zone.id});
    clock+=3_000;raid.tick(clock);
    assert.equal(player.settlement, 'extracted');
    const profile = state.game.db.profile(player.id);
    assert.equal(profile.stats.extracts, 1);
    assert.equal(profile.stash.find((stack) => stack.itemId === 'ammo-flare'), undefined);
  } finally {
    socket?.terminate(); await state.game.close(); rmSync(state.storage.directory, { recursive: true, force: true });
  }
});


test('medical and ammunition consumption persist through extraction and clear consumed equipment', async () => {
  const state = await running();
  let socket;
  try {
    const account = await register(state.base, 'Consume_Test');
    const connection = await websocket(state.base, account.cookie); socket = connection.ws;
    await request(state.base, '/api/rooms', { method: 'POST', cookie: account.cookie, body: { mode: 'solo' } });
    const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: account.cookie });
    const raid = state.game.manager.raids.get(started.json.raidId);
    const player = raid.players.get(account.json.user.id);
    player.hp = 10;
    raid.command(player.id, { v: 1, type: 'use_medical', seq: 1, itemId: 'bandage' });
    assert.equal(player.gear.medical, undefined);
    assert.equal(player.inventory.find(s=>s.itemId==='bandage')?.quantity,3);
    raid.finishRadiationMedicine(player,player.medicalUse.endsAt);
    assert.equal(player.inventory.find(s=>s.itemId==='bandage')?.quantity,2);
    // First aid was explicitly packed by the starter loadout.
    state.game.db.updateRaidLoot(raid.id, player.id, player.inventory);
    player.hp = 10;
    raid.command(player.id, { v: 1, type: 'use_medical', seq: 2, itemId: 'first-aid' });
    raid.finishRadiationMedicine(player,player.medicalUse.endsAt);
    assert.equal(player.hp,80);
    assert.equal(player.inventory.find((stack) => stack.itemId === 'first-aid'), undefined);
    raid.command(player.id, { v: 1, type: 'fire', seq: 3, weaponSlot: 'primary', aimX: 0, aimZ: 1 });
    raid.simulate(0.05, Date.now());
    raid.settle(player, 'extracted', Date.now());
    const profile = state.game.db.profile(player.id);
    assert.equal(profile.equipped.medical, undefined);
    assert.equal(profile.equipped.primary, 'm416-repaired');
    assert.equal(profile.stash.find((stack) => stack.itemId === 'bandage')?.quantity, 2);
    assert.equal(profile.stash.find((stack) => stack.itemId === 'first-aid')?.quantity, undefined);
    assert.equal(profile.stash.find((stack) => stack.itemId === 'ammo-556')?.quantity, 119);
  } finally {
    socket?.terminate(); await state.game.close(); rmSync(state.storage.directory, { recursive: true, force: true });
  }
});

test('death equips a playable recovery kit exactly once and permits the next raid', async () => {
  const state = await running();
  let socket;
  try {
    const account = await register(state.base, 'Recovery_Test');
    const connection = await websocket(state.base, account.cookie); socket = connection.ws;
    await request(state.base, '/api/rooms', { method: 'POST', cookie: account.cookie, body: { mode: 'solo' } });
    const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: account.cookie });
    const raid = state.game.manager.raids.get(started.json.raidId);
    const player = raid.players.get(account.json.user.id);
    const recovery = recoveryLoadout(normalizeCatalog(catalog));
    raid.killPlayer(player, 'test', Date.now());
    const once = state.game.db.profile(player.id);
    assert.equal(once.equipped.pistol, recovery.equipped.pistol);
    assert.equal(once.equipped.medical, undefined);
    assert.equal(once.packed.find(s=>s.itemId==='bandage')?.quantity,1);
    const firearmQuantity = once.stash.find((stack) => stack.itemId === (recovery.equipped.pistol??recovery.equipped.primary))?.quantity;
    raid.settle(player, 'dead', Date.now() + 1);
    assert.equal(state.game.db.profile(player.id).stash.find((stack) => stack.itemId === (recovery.equipped.pistol??recovery.equipped.primary))?.quantity, firearmQuantity);
    state.game.manager.tick(Date.now() + 100);
    const room = state.game.manager.createRoom(account.json.user, 'solo');
    assert.equal(room.status, 'lobby');
    const nextRaidId = state.game.manager.startRoom(player.id);
    assert.ok(state.game.manager.raids.get(nextRaidId).players.get(player.id).gear.pistol);
  } finally {
    socket?.terminate(); await state.game.close(); rmSync(state.storage.directory, { recursive: true, force: true });
  }
});

test('reconnect resumes a private raid snapshot with a fresh command sequence', async () => {
  const state = await running();
  const sockets = [];
  try {
    const account = await register(state.base, 'Reconnect_Test');
    const first = await websocket(state.base, account.cookie); sockets.push(first.ws);
    await request(state.base, '/api/rooms', { method: 'POST', cookie: account.cookie, body: { mode: 'solo' } });
    const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: account.cookie });
    const raid = state.game.manager.raids.get(started.json.raidId);
    const player = raid.players.get(account.json.user.id);
    first.ws.send(JSON.stringify({ v: 1, type: 'input', seq: 100, moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, sprint: false }));
    await waitFor(() => player.lastSeq === 100);
    first.ws.terminate();
    await waitFor(() => player.connected === false);
    const second = await websocket(state.base, account.cookie); sockets.push(second.ws);
    const welcome = second.messages.find((message) => message.type === 'welcome');
    const own = welcome.raid.players.find((candidate) => candidate.id === player.id);
    assert.ok(own.equipment);
    assert.ok(own.reserveAmmo);
    assert.ok(Array.isArray(own.inventory));
    second.ws.send(JSON.stringify({ v: 1, type: 'input', seq: 1, moveX: 0, moveZ: 0, aimX: 1, aimZ: 0, sprint: false }));
    await waitFor(() => player.lastSeq === 1);
    assert.equal(second.messages.some((message) => message.code === 'STALE_SEQUENCE'), false);
  } finally {
    for (const ws of sockets) ws.terminate();
    await state.game.close(); rmSync(state.storage.directory, { recursive: true, force: true });
  }
});

test('unfinished raid escrow becomes one death on restart', () => {
  const storage = temporaryDatabase();
  try {
    let db = new GameDatabase(storage.path, {lossRandom:()=>0});
    const user = db.createUser('Crash_Test', Buffer.alloc(16), Buffer.alloc(64), [{ itemId: 'm416-repaired', quantity: 1 }], { primary: 'm416-repaired' });
    db.beginRaid('raid-crash', 'room-crash', [user.id], new Map(), 100);
    assert.equal(db.inventoryQuantity(user.id, 'm416-repaired'), 0);
    db.close();
    db = new GameDatabase(storage.path, {lossRandom:()=>0});
    const recovery = recoveryLoadout(normalizeCatalog(catalog));
    assert.equal(db.recoverActiveRaids(200, recovery.items, recovery.equipped), 1);
    assert.equal(db.recoverActiveRaids(300, recovery.items, recovery.equipped), 0);
    assert.equal(db.profile(user.id).stats.deaths, 1);
    assert.equal(db.profile(user.id).equipped.pistol, recovery.equipped.pistol);
    db.close();
  } finally { rmSync(storage.directory, { recursive: true, force: true }); }
});

test('radiation reduces current and maximum HP unless protected by armor trait or armored vest; retired talent gives no protection', () => {
  assert.equal(ITEMS.find((item) => item.id === 'armor-gold-lead')?.traits?.includes('radiation-immunity'), true);
  const db = new GameDatabase(':memory:', {lossRandom:()=>0});
  const profiles = new Map();
  const make = (id, gear, talents = []) => {
    profiles.set(id, { talents });
    return { userId: id, gear: Object.entries(gear).map(([slot, itemId]) => ({ slot, itemId, quantity: 1 })) };
  };
  const escrow = [
    make('bare', {}),
    make('vest-only', { vest: 'lead-lined-fabric' }),
    make('vest-armored', { armor: 'armor-1', vest: 'lead-lined-fabric' }),
    make('trait-armor', { armor: 'armor-gold-lead' }),
    make('talented', {}, [{ talentId: 'radiation-resistance', level: 1 }]),
  ];
  const mockDb = {
    profile: (id) => ({ talents: profiles.get(id)?.talents ?? [] }),
    updateRaidLoot() {}, settleRaidPlayer() { return { applied: true }; }, markRaidCompleteIfSettled() {},
  };
  const room = { mode: 'coop', members: new Map(escrow.map((entry) => [entry.userId, { username: entry.userId }])) };
  let clock = 10_000;
  const raid = new Raid({ id: 'radiation', room, escrow, db: mockDb, catalog: normalizeCatalog(catalog), world: WORLD, now: () => clock, emit() {} });
  const zone = WORLD.radiationZones[0];
  for (const player of raid.players.values()) { player.x = zone.x; player.z = zone.z; }
  clock += 1_000; raid.simulate(1, clock);
  assert.ok(raid.players.get('bare').hp < raid.players.get('bare').baseMaxHp);
  assert.ok(raid.players.get('bare').maxHp < raid.players.get('bare').baseMaxHp);
  assert.equal(raid.players.get('vest-only').radiationProtected, false);
  assert.equal(raid.players.get('vest-armored').radiationProtected, true);
  assert.equal(raid.players.get('trait-armor').radiationProtected, true);
  assert.equal(raid.players.get('talented').radiationProtected, false);
  assert.ok(raid.players.get('talented').maxHp < raid.players.get('talented').baseMaxHp);
  const reducedMax = raid.players.get('bare').maxHp;
  raid.players.get('bare').x = zone.x + zone.radius + 5;
  clock += 1_000; raid.simulate(1, clock);
  assert.equal(raid.players.get('bare').maxHp, reducedMax);
  assert.equal(raid.players.get('bare').radiation, false);

  const nextEscrow = [make('bare-next', {})];
  const nextRoom = { mode: 'solo', members: new Map([['bare-next', { username: 'bare-next' }]]) };
  const nextRaid = new Raid({ id: 'radiation-next', room: nextRoom, escrow: nextEscrow, db: mockDb, catalog: normalizeCatalog(catalog), world: WORLD, now: () => clock, emit() {} });
  assert.equal(nextRaid.players.get('bare-next').maxHp, nextRaid.players.get('bare-next').baseMaxHp);
  assert.equal(nextRaid.players.get('bare-next').hp, nextRaid.players.get('bare-next').baseMaxHp);
  db.close();
});




test('reconnect respects the exact disconnect deadline before the next tick', async () => {
  for (const offset of [29999, 30000]) {
    let clock = 100000;
    const state = await running({ now: () => clock });
    let socket;
    try {
      const account = await register(state.base, 'Boundary_' + offset);
      const connection = await websocket(state.base, account.cookie); socket = connection.ws;
      await request(state.base, '/api/rooms', { method: 'POST', cookie: account.cookie, body: { mode: 'solo' } });
      const started = await request(state.base, '/api/rooms/start', { method: 'POST', cookie: account.cookie });
      const raid = state.game.manager.raids.get(started.json.raidId);
      const player = raid.players.get(account.json.user.id);
      raid.disconnect(player.id);
      clock += offset;
      raid.reconnect(player.id);
      if (offset < 30000) {
        assert.equal(player.connected, true);
        assert.equal(player.settlement, null);
      } else {
        assert.equal(player.settlement, 'dead');
        assert.equal(state.game.db.profile(player.id).stats.deaths, 1);
      }
    } finally {
      socket?.terminate(); await state.game.close(); rmSync(state.storage.directory, { recursive: true, force: true });
    }
  }
});

