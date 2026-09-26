import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ITEMS, TALENTS } from '../../shared/catalog.ts';
import { GameDatabase } from '../db.js';
import { RoomManager, normalizeCatalog } from '../game.js';

const catalog = normalizeCatalog({ items: ITEMS, talents: TALENTS });
const world = { size: 100, spawn: { x: 0, z: 0 }, obstacles: [], buildings: [], lootSpawns: [], enemySpawns: [], extractions: [], radiationZones: [] };

test('party keeps its roster, gear, and code across raids and server restart until a member leaves', () => {
  const directory = mkdtempSync(join(tmpdir(), 'penguin-party-'));
  const path = join(directory, 'game.sqlite');
  let db = new GameDatabase(path);
  try {
    const starter = [{ itemId: 'm416', quantity: 1 }, { itemId: 'akm', quantity: 1 }];
    const alpha = db.createUser('PartyAlpha', Buffer.alloc(16), Buffer.alloc(64), starter, { primary: 'm416' });
    const beta = db.createUser('PartyBeta', Buffer.alloc(16), Buffer.alloc(64), starter, { primary: 'm416' });
    let now = 1000;
    let manager = new RoomManager({ db, catalog, world, now: () => now, raidOptions: { initialEnemyDelayMs: 1000000, raidLimitMs: 500 } });
    const sent = [];
    const socket = () => ({ readyState: 1, bufferedAmount: 0, send: payload => sent.push(JSON.parse(payload)) });
    manager.attachSocket(alpha, socket());
    manager.attachSocket(beta, socket());
    const created = manager.createRoom(alpha, 'coop');
    const joined = manager.joinRoom(beta, created.code);
    assert.equal(joined.members.length, 2);
    assert.equal(manager.joinRoom(alpha, created.code).members.length, 2);
    assert.equal(joined.members[1].weaponId, 'm416');
    db.equip(beta.id, 'primary', 'akm', catalog);
    manager.broadcastCurrentRoom(beta.id);
    assert.equal(sent.filter(message => message.type === 'room').at(-1).room.members[1].weaponId, 'akm');
    for (let round = 0; round < 2; round++) {
      const raidId = manager.startRoom(alpha.id);
      assert.equal(manager.current(beta.id).room.id, created.id);
      now += 1000;
      manager.tick(now);
      assert.equal(manager.raids.has(raidId), false);
      const current = manager.current(beta.id).room;
      assert.equal(current.id, created.id);
      assert.equal(current.code, created.code);
      assert.equal(current.status, 'lobby');
      assert.equal(current.members.length, 2);
    }
    db.close();
    db = new GameDatabase(path);
    manager = new RoomManager({ db, catalog, world, now: () => now });
    assert.equal(manager.current(alpha.id).room.code, created.code);
    assert.equal(manager.current(beta.id).room.members.length, 2);
    manager.leaveRoom(alpha.id);
    assert.equal(manager.current(alpha.id).room, null);
    assert.equal(manager.current(beta.id).room.leaderId, beta.id);
    db.close();
    db = new GameDatabase(path);
    manager = new RoomManager({ db, catalog, world, now: () => now });
    assert.equal(manager.current(alpha.id).room, null);
    assert.equal(manager.current(beta.id).room.members.length, 1);
    manager.leaveRoom(beta.id);
    assert.equal(manager.current(beta.id).room, null);
    assert.equal(db.loadParties().length, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

