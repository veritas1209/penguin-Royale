import {publicEnemySnapshot,encodeSnapshot} from './snapshotWire.js';
import {isPistolWeapon} from '../shared/weaponSlots.ts';
import {stackWeight} from '../shared/fittedInventory.ts';
import {legacyFabricAliases} from '../shared/attachmentQualities.ts';
import {startRevive,cancelRevive,cancelRevivesFor,updateRevives,isBeingRevived} from './revival.js';
import {perceiveEnemy,rememberEnemyThreat,forceEnemyThreat,enemyLineOfSight} from './enemyPerception.js';
import {equipEnemy,updateEnemyActions,faceEnemyTarget,fireEnemyProjectile,queueEnemyReload,enemyCombatMoveSpeed} from './enemyCombat.js';
import {initEnemyForces,alertMajorResponse,advanceMajorResponse,broadcastEnemyThreat,tacticalGoal,separateEnemies,updateMajorResponseTracking,isVirtualResponseEnemy} from './enemyForces.js';
import {initGoldenBossEvent,updateGoldenBossEvent} from './goldenBoss.js';
import {enemyLeashGoal} from './enemyLeash.js';
import {advanceEnemyNavigation} from './enemyNavigation.js';
import {updateEnemyStamina} from './enemyStamina.js';
import {initializeEnemyPatrol,advanceEnemyPatrol} from './enemyPatrol.js';
import {initSquadPatrolEvent,updateSquadPatrolEvent,alertSquadPatrol,advanceSquadPatrol} from './squadPatrolEvent.js';
import {weaponFittingStats} from '../shared/weaponFittingEffects.ts';
import {FIREARM_HIT_RADIUS,firearmSpread,firearmRange} from '../shared/firearmBalance.ts';
import {firearmCadence,nextShotIntervalMs} from '../shared/firearmCadence.ts';
import {dropInventory,directEquipmentPlan} from './inventoryActions.js';
import {talentBonus} from '../shared/talents.ts';
import {armorSlotCount,armorAttachmentsFromEquipment,armorAttachmentEffects} from '../shared/armorAttachments.ts';
import {createPlayerLoot} from './playerLoot.js';
import {advanceMovement, movementBlocked} from '../shared/movement.ts';
import {inventoryCapacity,equipmentWeights} from '../shared/metroInventory.ts';
import {goldEquipmentEffects,equipmentWeightMobilityBonus,secureCapacityForGear,legacyGoldEquipmentAliases} from '../shared/goldEquipment.ts';
import {weaponAttachmentId,weaponAttachmentsFromEquipment} from '../shared/weaponAttachments.ts';
import {planRaidEquipment,raidEquipmentStats} from './raidEquipment.js';
import {SECURE_CAPACITY,planSecureTransfer} from './secureContainer.js';
import {materializeGoldItem} from '../shared/catalog.ts';
import {LEGACY_GOLD_COMPAT} from '../shared/legacyGoldCompat.ts';

import { randomBytes, randomUUID } from 'node:crypto';
import {pairWorldFlareLoot,rollWorldContainer,planRadiationWeaponSpawns,inRadiation} from './loot.js';
import { chooseAmmo, compatibleAmmo, loadMagazine, ammoShot } from './ammo.js';
import { createContainer, containerSnapshot } from './containers.js';
import {initBosses,updateBosses,dropEnemyRewards} from './bosses.js';
import {createRaidAccessWorld,createAccessDoorStates,accessDoorSnapshots,removeAccessDoorCollider,rollDocumentItem} from './access.js';
import {chooseRaidEntry,chooseFarthestExits,makeFlareExtraction,flareExtractionStatus,cancelExtractionOnHit} from './extractionRules.js';
import {segmentObstacles} from './spatialObstacles.js';
import {emitFirearmSound} from './firearmSound.js';

const TICK_MS = 50;
const ENEMY_TICK_MS = 100;
const AI_ACTIVE_RADIUS = 120;
const SNAPSHOT_MS = 100;
const SNAPSHOT_ENTITY_ENTRY_RADIUS = 60;
const SNAPSHOT_ENTITY_EXIT_RADIUS = 82;
const INPUT_STALE_MS = 1500;
const DISCONNECT_GRACE_MS = 30_000;
const RAID_LIMIT_MS = 15 * 60_000;
const EXTRACTION_DELAY_MS = 30_000;
const BOARDING_WINDOW_MS = 60_000;
const SLOT_SET = new Set(['primary', 'secondary', 'pistol', 'melee', 'armor', 'helmet', 'backpack', 'medical', 'throwable', 'flare']);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function effectiveGearItem(catalog,gear,traitLevels,slot){return materializeGoldItem(catalog.byId.get(gear?.[slot]),traitLevels?.[slot]);}
function effectiveGearLookup(catalog,gear,traitLevels){return id=>{for(const slot of ['primary','secondary','pistol','melee','armor','helmet','backpack'])if(gear?.[slot]===id&&traitLevels?.[slot])return effectiveGearItem(catalog,gear,traitLevels,slot);return catalog.byId.get(id);};}
function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function visibleWithHysteresis(cache,viewerId,kind,entity,distanceFromViewer,entry=SNAPSHOT_ENTITY_ENTRY_RADIUS,exit=SNAPSHOT_ENTITY_EXIT_RADIUS){
 if(!viewerId)return true;
 let visible=cache.get(viewerId);if(!visible)cache.set(viewerId,visible=new Set());
 const key=kind+':'+entity.id;
 if(visible.has(key)){if(distanceFromViewer>exit){visible.delete(key);return false;}return true;}
 if(distanceFromViewer<=entry){visible.add(key);return true;}
 return false;
}
function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function medicalHealTarget(item,player){if(item.id==='med-kit')return player.maxHp;if(item.id==='first-aid')return player.maxHp*.8;return item.healTarget;}
function rayAabbDistance(origin, direction, obstacle, maxDistance, blockWindows = false) {
  if(obstacle.bulletPassable&&!blockWindows)return Infinity;
  const halfW = (obstacle.w ?? obstacle.width ?? 1) / 2;
  const halfD = (obstacle.d ?? obstacle.depth ?? 1) / 2;
  let near = 0, far = maxDistance;
  for (const [position, velocity, min, max] of [
    [origin.x, direction.x, obstacle.x - halfW, obstacle.x + halfW],
    [origin.z, direction.z, obstacle.z - halfD, obstacle.z + halfD],
  ]) {
    if (Math.abs(velocity) < 1e-8) { if (position < min || position > max) return Infinity; continue; }
    const first = (min - position) / velocity, second = (max - position) / velocity;
    near = Math.max(near, Math.min(first, second)); far = Math.min(far, Math.max(first, second));
    if (near > far) return Infinity;
  }
  return far <= 1e-6 ? Infinity : near >= 0 ? near : Infinity;
}
function rayAabbDistanceToPoint(world,from,to,blockWindows=false){
 const d=distance(from,to);if(d<.001)return true;
 const direction={x:(to.x-from.x)/d,z:(to.z-from.z)/d};
 return ![...segmentObstacles(world,from,to)].some(o=>rayAabbDistance(from,direction,o,d,blockWindows)<d);
}
function normalize(x, z) {
  const length = Math.hypot(x, z);
  return length > 0.0001 ? { x: x / length, z: z / length } : { x: 0, z: 1 };
}
function stacksAdd(stacks, itemId, quantity) {
  const current = stacks.find((entry) => entry.itemId === itemId&&!entry.fittings);
  if (current) current.quantity += quantity;
  else stacks.push({ itemId, quantity });
}

export class RoomManager {
  constructor({ db, catalog, world, now = () => Date.now(), raidOptions = {} }) {
    this.db = db;
    this.catalog = normalizeCatalog(catalog);
    this.world = world;
    this.now = now;
    this.raidOptions = raidOptions;
    this.rooms = new Map();
    this.membership = new Map();
    this.raids = new Map();
    this.sockets = new Map();
  }

  roomView(room) {
    return {
      id: room.id,
      code: room.code,
      mode: room.mode,
      leaderId: room.leaderId,
      status: room.status,
      raidId: room.raidId,
      members: [...room.members.values()].map(({ id, username, connected }) => ({ id, username, connected })),
    };
  }

  listRooms() {
    return [...this.rooms.values()].filter((room) => room.mode === 'coop' && room.status === 'lobby' && room.members.size < 4)
      .map((room) => ({ code: room.code, members: room.members.size, capacity: 4 }));
  }

  current(userId) {
    const room = this.rooms.get(this.membership.get(userId));
    return room ? { room: this.roomView(room), raidId: room.raidId } : { room: null, raidId: null };
  }

  createRoom(user, mode) {
    if (mode !== 'solo' && mode !== 'coop') throw gameError('INVALID_MODE', 'Mode must be solo or coop');
    this.leaveRoom(user.id);
    if (this.rooms.size >= 200) throw gameError('SERVER_BUSY', 'Room capacity reached');
    const room = {
      id: randomUUID(),
      code: mode === 'coop' ? this.uniqueCode() : null,
      mode,
      leaderId: user.id,
      status: 'lobby',
      raidId: null,
      offlineSince: this.sockets.has(user.id) ? null : this.now(),
      members: new Map([[user.id, { id: user.id, username: user.username, connected: this.sockets.has(user.id) }]]),
    };
    this.rooms.set(room.id, room);
    this.membership.set(user.id, room.id);
    this.broadcastRoom(room);
    return this.roomView(room);
  }

  joinRoom(user, code) {
    const room = [...this.rooms.values()].find((candidate) => candidate.code === String(code).toUpperCase());
    if (!room || room.status !== 'lobby') throw gameError('ROOM_NOT_FOUND', 'Room is not joinable');
    if (room.members.size >= 4) throw gameError('ROOM_FULL', 'Room is full');
    this.leaveRoom(user.id);
    room.members.set(user.id, { id: user.id, username: user.username, connected: this.sockets.has(user.id) });
    this.membership.set(user.id, room.id);
    this.broadcastRoom(room);
    return this.roomView(room);
  }

  leaveRoom(userId) {
    const roomId = this.membership.get(userId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.status === 'raid') throw gameError('RAID_ACTIVE', 'Cannot leave an active raid');
    room.members.delete(userId);
    this.membership.delete(userId);
    if (room.members.size === 0) this.rooms.delete(room.id);
    else {
      if (room.leaderId === userId) room.leaderId = room.members.keys().next().value;
      this.broadcastRoom(room);
    }
  }

  startRoom(userId) {
    const room = this.rooms.get(this.membership.get(userId));
    if (!room) throw gameError('NO_ROOM', 'Create or join a room first');
    if (room.leaderId !== userId) throw gameError('LEADER_ONLY', 'Only the room leader can start');
    if (room.status !== 'lobby') throw gameError('ROOM_STATE', 'Room is not in the lobby');
    if ([...room.members.values()].some((member) => !member.connected)) throw gameError('MEMBER_OFFLINE', 'Every member must be connected');
    const raidId = randomUUID();
    const ammoRequests = new Map();
    for (const memberId of room.members.keys()) {
      const profile=this.db.profile(memberId);
      const secure=profile.securePacked??[];
      const secureCapacity=profile.secureCapacity??SECURE_CAPACITY;if(secure.some(s=>!this.catalog.byId.has(s.itemId)||!Number.isSafeInteger(s.quantity)||s.quantity<1)||secure.reduce((n,s)=>n+stackWeight(s,id=>this.catalog.byId.get(id)),0)>secureCapacity+.000001)throw gameError('SECURE_OVER_CAPACITY',`암호상자 용량은 ${secureCapacity}입니다. 출격 전에 물품을 줄여주세요.`);
      const packed=profile.packed??[];
      const weight=packed.reduce((n,stack)=>n+(this.catalog.byId.get(stack.itemId)?.weight??0)*stack.quantity,0);
      if(weight>this.db.packedCapacity(profile,this.catalog)+.000001)throw gameError('OVER_CAPACITY','가방 적재 용량을 초과했습니다.');
      ammoRequests.set(memberId,packed.map(stack=>({...stack,slot:this.catalog.byId.get(stack.itemId)?.category==='ammo'?'ammo':'packed'})));
    }
    const escrow = this.db.beginRaid(raidId, room.id, [...room.members.keys()], ammoRequests, this.now());
    const raid = new Raid({
      id: raidId,
      room,
      escrow,
      db: this.db,
      catalog: this.catalog,
      world: this.world,
      now: this.now,
      emit: (message, recipients, reliable = false) => this.emit(message, recipients, reliable),
      options: this.raidOptions,
    });
    room.status = 'raid';
    room.raidId = raidId;
    this.raids.set(raidId, raid);
    for (const memberId of room.members.keys()) {
      this.emit({ v: 1, type: 'raid_started', raidId, seed: raid.seed, startedAt: raid.startedAt, world: raid.world, playerId: memberId }, [memberId], true);
    }
    return raidId;
  }

  attachSocket(user, ws) {
    let sockets = this.sockets.get(user.id);
    const wasOffline = !sockets || sockets.size === 0;
    if (!sockets) {
      sockets = new Set();
      this.sockets.set(user.id, sockets);
    }
    sockets.add(ws);
    const room = this.rooms.get(this.membership.get(user.id));
    if (room) {
      const member = room.members.get(user.id);
      if (member) member.connected = true;
      room.offlineSince = null;
      const raid = room.raidId && this.raids.get(room.raidId);
      if (raid && wasOffline) raid.reconnect(user.id);
      this.broadcastRoom(room);
    }
    return room;
  }

  detachSocket(userId, ws) {
    const sockets = this.sockets.get(userId);
    if (!sockets?.delete(ws)) return;
    if (sockets.size > 0) return;
    this.sockets.delete(userId);
    const room = this.rooms.get(this.membership.get(userId));
    if (!room) return;
    const member = room.members.get(userId);
    if (member) member.connected = false;
    const raid = room.raidId && this.raids.get(room.raidId);
    if (raid) raid.disconnect(userId);
    else if ([...room.members.values()].every((candidate) => !candidate.connected)) room.offlineSince = this.now();
    this.broadcastRoom(room);
  }

  handleCommand(userId, message) {
    const room = this.rooms.get(this.membership.get(userId));
    const raid = room?.raidId && this.raids.get(room.raidId);
    if (!raid) throw gameError('NO_ACTIVE_RAID', 'No active raid');
    raid.command(userId, message);
  }

  tick(now = this.now()) {
    for (const [roomId, room] of this.rooms) {
      if (room.mode === 'coop') continue; // BC88 persistent party
      if (room.status !== 'lobby' || room.offlineSince == null || now - room.offlineSince < 5 * 60_000) continue;
      for (const memberId of room.members.keys()) this.membership.delete(memberId);
      this.rooms.delete(roomId);
    }
    for (const [id, raid] of this.raids) {
      raid.tick(now);
      if (raid.complete) {
        const room = raid.room;
        this.raids.delete(id);
        if (room.mode === 'coop') {
          room.status = 'lobby';
          room.raidId = null;
          room.offlineSince = [...room.members.values()].every((member) => !member.connected) ? now : null;
          this.broadcastRoom(room);
        } else {
          for (const memberId of room.members.keys()) this.membership.delete(memberId);
          this.rooms.delete(room.id);
        }
      }
    }
  }

  emit(message, recipients, reliable = false) {
    for (const userId of recipients) {
      const sockets = this.sockets.get(userId);
      for (const ws of sockets ?? []) {
        if (ws.readyState !== 1) continue;
        const bufferLimit = reliable ? 1024 * 1024 : 64 * 1024;
        if (ws.bufferedAmount > bufferLimit) {
          if(ws.transportStats) message.type === 'snapshot' ? ws.transportStats.skippedSnapshots++ : ws.transportStats.skippedMessages++;
          if (reliable && ws.bufferedAmount > 1024 * 1024) ws.close(4008, 'Client too slow');
          continue;
        }
        const payload=JSON.stringify({ ...encodeSnapshot(message,ws), ...(reliable ? { reliable: true } : {}) });
        if(ws.transportStats){ws.transportStats.messagesOut++;ws.transportStats.rawBytesOut+=Buffer.byteLength(payload);}
        ws.send(payload);
      }
    }
  }

  broadcastRoom(room) { this.emit({ v: 1, type: 'room', room: this.roomView(room) }, [...room.members.keys()], true); }

  uniqueCode() {
    let code;
    do code = randomBytes(4).toString('base64url').replace(/[-_]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X');
    while ([...this.rooms.values()].some((room) => room.code === code));
    return code;
  }
}

export class Raid {
  constructor({ id, room, escrow, db, catalog, world, now, emit, options = {} }) {
    this.id = id;
    this.room = room;
    this.db = db;
    this.catalog = catalog;
    this.world = createRaidAccessWorld(world);
    this.accessDoors = createAccessDoorStates(this.world);
    this.entry = (world.entrySpawns?.length || (world.extractions??[]).filter(e=>e.kind==='fixed').length>=2) ? chooseRaidEntry(this.world, options.entryRng ?? Math.random) : {...(world.spawn??{x:0,z:0})};
    this.world.spawn = {...this.entry};
    this.world.extractions = chooseFarthestExits(world,this.entry);
    this.now = now;
    this.emitToSockets = emit;
    this.options = { extractionDelayMs: EXTRACTION_DELAY_MS, boardingWindowMs: BOARDING_WINDOW_MS, disconnectGraceMs: DISCONNECT_GRACE_MS, raidLimitMs: RAID_LIMIT_MS, ...options };
    this.seed = randomBytes(4).readUInt32LE();
    this.startedAt = now();
    this.lastTickAt = this.startedAt;
    this.lastEnemyTickAt = this.startedAt;
    this.lastSnapshotAt = 0;
    this.lastActiveEnemyCount = 0;
    this.perfStats = {windowStartedAt:this.startedAt,ticks:0,totalTickMs:0,maxTickMs:0,maxSchedulerLagMs:0,totalSteps:0,snapshots:0,navSearches:0,navTimeouts:0,navCompleted:0,navNodeLimits:0,navNoPaths:0,navExpanded:0,navDirects:0,navMs:0,enemyShots:0,enemyHits:0,lastEnemyHit:null};
    this.snapshotId = 0;
    this.eventId = 0;
    this.shotIndex = 0;
    this.events = [];
    this.projectiles = new Map();
    this.areas = [];
    this.enemies = new Map();
    this.loot = new Map();
    this.containers = new Map();
    this.extractions = new Map();
    this.complete = false;
    this.players = new Map();
    this.viewerVisibility = new Map();
    this.spawnPlayers(escrow);
    this.spawnWorld();
    initBosses(this);
    initEnemyForces(this);
    initGoldenBossEvent(this);
    initSquadPatrolEvent(this);
    const __bcTestRuntime =
      Boolean(process.env.NODE_TEST_CONTEXT) ||
      process.argv.some(arg => /server[\\/]tests[\\/]|\.test\.js$/i.test(arg));

    this.initialEnemyDelayMs =
      Number(this.options?.initialEnemyDelayMs ?? (__bcTestRuntime ? 0 : 5000));

    this.initialEnemySpawnAt =
      this.startedAt + this.initialEnemyDelayMs;

    this.pendingInitialEnemies = null;

    if(this.initialEnemyDelayMs > 0){
      this.pendingInitialEnemies = [...this.enemies.entries()];
      this.enemies.clear();
    }
  }

  spawnPlayers(escrow) {
    const spawn = this.world.spawn ?? { x: 0, z: 44 };
    escrow.forEach((entry, index) => {
      const gearBySlot = Object.fromEntries(entry.gear.filter((stack) => !['ammo','packed'].includes(stack.slot)).map((stack) => [stack.slot, stack.itemId]));
      const goldTraitLevelsBySlot=Object.fromEntries(entry.gear.filter(stack=>stack.goldTraitLevels&&Object.keys(stack.goldTraitLevels).length).map(stack=>[stack.slot,{...stack.goldTraitLevels}]));
      const lookup=effectiveGearLookup(this.catalog,gearBySlot,goldTraitLevelsBySlot);
      const magazines = {};
      const loadedAmmo = {}, preferredAmmo = {};
      const inventory = entry.gear.filter(stack=>stack.slot==='packed').map(({itemId,quantity})=>({itemId,quantity}));
      const reserveAmmo = {};
      for (const stack of entry.gear.filter((candidate) => candidate.slot === 'ammo')) {
        reserveAmmo[stack.itemId] = (reserveAmmo[stack.itemId] ?? 0) + (stack.quantity ?? 1);
      }
      for (const slot of ['primary', 'secondary', 'pistol']) {
        const weapon = effectiveGearItem(this.catalog,gearBySlot,goldTraitLevelsBySlot,slot);
        if (weapon?.magazine) {
          const extended=weaponFittingStats(gearBySlot,slot,lookup).magazineMultiplier;
          const capacity = Math.ceil(weapon.magazine * extended);
          const ammoId=chooseAmmo(this.catalog,weapon.ammo,reserveAmmo,weapon.ammo);
          magazines[slot]=0;
          if(ammoId){preferredAmmo[slot]=ammoId;loadMagazine({magazines,reserveAmmo,loadedAmmo},slot,ammoId,capacity);}
        }
      }
      const armor = effectiveGearItem(this.catalog,gearBySlot,goldTraitLevelsBySlot,'armor');
      const helmet = effectiveGearItem(this.catalog,gearBySlot,goldTraitLevelsBySlot,'helmet');
      const effects=armorAttachmentEffects(gearBySlot,lookup),gold=goldEquipmentEffects(gearBySlot,lookup);
      const vest = armor ? lookup(gearBySlot.vest) : null;
      const backpack = effectiveGearItem(this.catalog,gearBySlot,goldTraitLevelsBySlot,'backpack'),gearWeight=equipmentWeights(gearBySlot,lookup).total;
      const hpBonus = this.talentValue(entry.userId, 'health', 0);
      const baseMaxHp = 100 + hpBonus;
      const radiationProtected = armor?.traits?.includes('radiation-immunity') || effects.radiationProtected;
      this.players.set(entry.userId, {
        id: entry.userId,
        username: this.room.members.get(entry.userId)?.username ?? 'Penguin',
        x: spawn.x + index * 1.5, z: spawn.z, yaw: 0,
        baseMaxHp, hp: baseMaxHp, maxHp: baseMaxHp, alive: true, downed: false, downedUntil: null,
        connected: true, disconnectedAt: null, boarded: false, settlement: null,
        gear: gearBySlot, goldTraitLevelsBySlot, inventory, secure:(entry.secure??[]).map(stack=>({...stack})), magazines, reserveAmmo, loadedAmmo, preferredAmmo,
        activeWeaponSlot: gearBySlot.primary ? 'primary' : gearBySlot.secondary ? 'secondary' : gearBySlot.pistol ? 'pistol' : 'melee',
        stamina: 100, maxStamina: 100, staminaRecoveryAt: 0, input: { moveX: 0, moveZ: 0, sprint: false },
        nextFireAt: 0, nextThrowAt: 0, nextUnderbarrelAt: 0, reloadEndsAt: null, reloadSlot: null, burstQueue: [],
        activeSkillReadyAt: {}, karambitHasteUntil: 0, arbiterPrimed: false, arayaDash: null,
        lastEnemyHitAt: 0, kills: 0, lastSeq: -1,
        armorReduction: clamp((armor?.reduction ?? 0) + (helmet?.reduction ?? 0) + effects.protection + gold.damageReduction, 0, 0.8),
        moveMultiplier: 1 + this.talentValue(entry.userId, 'speed', 0) + effects.mobility + equipmentWeightMobilityBonus(gearBySlot,lookup,gearWeight),
        carryCapacity: inventoryCapacity(backpack?.capacity??0,this.talentValue(entry.userId,'capacity',0),effects.capacity),
        secureCapacity:secureCapacityForGear(gearBySlot,lookup,SECURE_CAPACITY),equipmentWeightMultiplier:1-gold.equipmentWeightInfluenceReduction,
        headshotFlatReduction:gold.headshotFlatReduction,bossSpecialReduction:gold.bossSpecialReduction,flatDamageReduction:gold.flatDamageReduction,fireReduction:gold.fireReduction,explosiveReduction:gold.explosiveReduction,flashImmune:gold.flashImmune,reviveTimeMultiplier:1-gold.reviveTimeReduction,bonusLootChance:gold.bonusLootChance,
        radiation: false, radiationExposure: 0, radiationProtected: Boolean(radiationProtected), extracting: null,
        talentLevels: Object.fromEntries((this.db.profile(entry.userId)?.talents ?? []).map((talent) => [talent.talentId, talent.level])),
        noiseUntil: 0, noiseRadius: 0,
        searching: null,
      });
    });
  }

  talentValue(userId, effect, fallback) {
    const defs = this.catalog.talents.filter((talent) => talent.effect === effect);
    const owned = this.db.profile(userId)?.talents ?? [];
    return defs.reduce((sum, talent) => sum + talentBonus(talent,owned.find((entry) => entry.talentId === talent.id)?.level ?? 0), fallback);
  }

  spawnWorld() {
    const archetypes = {
      scout: { hp: 55, speed: 3.0, damage: 8, attackMs: 850, armor: 0, rangedRange: 6 },
      raider: { hp: 95, speed: 2.4, damage: 13, attackMs: 1000, armor: 0.08, rangedRange: 10 },
      heavy: { hp: 180, speed: 1.65, damage: 21, attackMs: 1250, armor: 0.28, rangedRange: 7 },
      commander: { hp: 270, speed: 2.0, damage: 26, attackMs: 950, armor: 0.35, rangedRange: 14 },
    };
    const enemySpawns = this.world.enemySpawns ?? [];
    enemySpawns.forEach((spawn, index) => this.enemies.set(spawn.id ?? `enemy-${index}`, {
      id: spawn.id ?? `enemy-${index}`, kind: spawn.kind ?? 'raider', x: spawn.x, z: spawn.z,
      hp: (archetypes[spawn.kind] ?? archetypes.raider).hp, maxHp: (archetypes[spawn.kind] ?? archetypes.raider).hp,
      ...archetypes[spawn.kind] ?? archetypes.raider, aggroRadius: spawn.radius ?? 8,
      targetId: null, nextAttackAt: 0, stunnedUntil: 0,
    }));
    const radiationPasswordLetterBudget={remaining:1+(this.seed&1)};
    const radiationWeaponSpawns=planRadiationWeaponSpawns(this.world,this.world.lootSpawns??[],this.seed);
    (this.world.lootSpawns??[]).forEach((spawn,index)=>{
      let value=(this.seed+index*2654435761)>>>0;const rng=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
      if(spawn.pool==='documents'){
        const items=[],used=new Set(),target=2+Math.floor(rng()*2);
        for(let n=0;n<100&&items.length<target;n++){const document=rollDocumentItem(this.catalog,rng);if(document&&!used.has(document.id)){used.add(document.id);items.push({itemId:document.id,quantity:1});}}
        if(items.length)this.addContainer(spawn,items,index);return;
      }
      const radioactive=inRadiation(this.world,spawn);
      const {items,lootType}=rollWorldContainer(this.catalog,this.world,spawn,rng,{passwordLetterBudget:radiationPasswordLetterBudget,radiationWeaponSpawns});
      if(items.length)this.addContainer(lootType?{...spawn,pool:lootType==='weapon'?'military':'rare',containerKind:lootType==='weapon'?'military':'rare',visualType:lootType==='weapon'?'military':'rare',name:lootType==='weapon'?'무기 상자':'판매용 물품 상자',searchSeconds:radioactive?6:spawn.searchSeconds}:spawn,items,index);
    });    (this.world.extractions ?? []).forEach((zone, index) => this.extractions.set(zone.id ?? `extract-${index}`, {
      id: zone.id ?? `extract-${index}`, name:zone.name, x: zone.x, z: zone.z, radius: zone.radius ?? 5,
      kind: zone.kind ?? 'helicopter', holdSeconds: zone.holdSeconds ?? 0,
      state: 'idle', calledAt: null, arrivalAt: null, departureAt: null,
    }));
  }

  addContainer(spawn, items, index = this.containers.size) {
    items=pairWorldFlareLoot(items,this.catalog);
    const container = createContainer(spawn, index, items);
    this.containers.set(container.id, container);
    return container;
  }

  command(userId, message) {
    const player = this.players.get(userId);
    if (!player || player.settlement) throw gameError('PLAYER_INACTIVE', 'Player is no longer active');
    if (player.downed) throw gameError('PLAYER_DOWNED', 'A downed player cannot act');
    if (player.boarded) throw gameError('PLAYER_BOARDED', 'A boarded player cannot act');
    if (!Number.isSafeInteger(message.seq)) throw gameError('INVALID_MESSAGE', 'Sequence must be an integer');
    player.lastSeq = message.seq;
    if(player.reviving&&['fire','active_skill','reload','throw','underbarrel','flare','use_medical','switch_weapon','equip_raid','equip_container','secure_transfer','unlock_door'].includes(message.type))cancelRevive(this,player,message.type);
    if(['fire','active_skill','reload','throw','underbarrel','flare'].includes(message.type))player.medicalUse=null;
    switch (message.type) {
      case 'input': this.input(player, message); break;
      case 'switch_weapon': this.switchWeapon(player, message.weaponSlot); break;
      case 'fire': this.cancelSearch(player, 'fire'); this.fire(player, message.weaponSlot, message.aimX, message.aimZ, this.now()); break;
      case 'active_skill': this.cancelSearch(player, 'skill'); this.activeSkill(player, message.aimX, message.aimZ, this.now()); break;
      case 'underbarrel': this.cancelSearch(player, 'fire'); this.underbarrel(player, message.aimX, message.aimZ, this.now()); break;
      case 'select_ammo': this.selectAmmo(player,message.weaponSlot,message.itemId,this.now()); break;
      case 'reload': this.cancelSearch(player, 'reload'); this.reload(player, message.weaponSlot, this.now()); break;
      case 'use_medical': if(message.cancel)player.medicalUse=null;else this.useMedical(player, message.itemId); break;
      case 'throw': this.cancelSearch(player,'throw'); this.throwItem(player, message.itemId, message.aimX, message.aimZ, this.now()); break;
      case 'interact': this.interact(player, message.targetId, this.now()); break;
      case 'cancel_revive': cancelRevive(this,player);break;
      case 'cancel_search': this.cancelSearch(player, 'cancelled'); break;
      case 'drop_inventory': {
        /* BC LEGENDARY DROP SERVER 64 */
        const __bcDropItem=this.catalog.byId.get(message.itemId);

        if(
          __bcDropItem?.legendaryBlade===true &&
          message.legendaryConfirm!==true
        ){
          throw gameError(
            'LEGENDARY_CONFIRM_REQUIRED',
            '전설 무기를 버리려면 확인이 필요합니다.'
          );
        }

        dropInventory(
          this,
          player,
          message.itemId,
          message.quantity
        );
        break;
      }
      case 'drop_equipped': this.dropEquipped(player,message.slot); break;
      case 'equip_container': this.equipContainer(player,message); break;
      case 'take_container': this.takeContainer(player, message.containerId, message.itemId, message.quantity, message.stackId); break;
      case 'flare': this.callExtraction(player, message.extractionId, this.now()); break;
      case 'equip_raid': this.equipRaid(player,message.slot,message.itemId,message.armorSlot,message.weaponSlot); break;
      case 'secure_transfer': this.transferSecure(player,message.itemId,message.quantity,message.direction); break;
      case 'unlock_door': this.unlockDoor(player,message.doorId); break;
      default: throw gameError('UNKNOWN_COMMAND', 'Unknown raid command');
    }
  }

  input(player, message) {
    for (const key of ['moveX', 'moveZ', 'aimX', 'aimZ']) if (!Number.isFinite(message[key])) throw gameError('INVALID_INPUT', 'Movement and aim must be finite');
    const move = normalize(clamp(message.moveX, -1, 1), clamp(message.moveZ, -1, 1));
    const magnitude = Math.min(1, Math.hypot(message.moveX, message.moveZ));
    if (magnitude > 0.01){this.cancelSearch(player,'movement');cancelRevive(this,player,'movement');}
    const __bcHealMoveScale=
 player.medicalUse ? .3 : 1;

player.input={
 moveX:move.x*magnitude*__bcHealMoveScale,
 moveZ:move.z*magnitude*__bcHealMoveScale,
 sprint:message.sprint===true
}; /* BC_HEAL_MOVE_70_INPUT */
    player.inputClientTime = Number.isFinite(message.clientTime) ? message.clientTime : null;
    player.inputTickAt = this.lastTickAt;
    player.inputReceivedAt = this.now();
    const aim = normalize(message.aimX, message.aimZ);
    player.yaw = Math.atan2(aim.x, aim.z);
  }

  equipRaid(player,slot,itemId,armorSlot=0,weaponSlot=null){
    if(!player.alive||player.downed||player.boarded||player.settlement||!player.connected)throw gameError('PLAYER_INACTIVE','현재 장비를 교체할 수 없습니다.');
    const canonicalSlot=weaponSlot?weaponSlot+':'+slot:slot;
    const plan=planRaidEquipment(player,canonicalSlot,itemId,this.catalog,armorSlot);
    const firearmPart=Boolean(weaponSlot),weaponGearSlot=weaponSlot??slot;
    const isWeaponSlot=['primary','secondary','pistol','melee'].includes(slot);
    const reserve={...player.reserveAmmo},magazines={...player.magazines},loadedAmmo={...player.loadedAmmo};
    if(isWeaponSlot&&player.gear[slot]!==plan.nextGear[slot]){
      const rounds=magazines[slot]??0,ammoId=loadedAmmo[slot];if(ammoId&&rounds>0)reserve[ammoId]=(reserve[ammoId]??0)+rounds;
      magazines[slot]=0;loadedAmmo[slot]=null;
    }
    const weight=plan.nextInventory.reduce((n,s)=>n+stackWeight(s,id=>this.catalog.byId.get(id)),0)+Object.entries(reserve).reduce((n,[id,q])=>n+(this.catalog.byId.get(id)?.weight??0)*q,0);
    if(weight>plan.stats.carryCapacity+.000001)throw gameError('OVER_CAPACITY','무기 교체 후 배낭 용량을 초과합니다.');
    if(isWeaponSlot||firearmPart){
      if(firearmPart){const host=this.catalog.byId.get(plan.nextGear[weaponGearSlot]),capacity=Math.ceil((host?.magazine??0)*weaponFittingStats(plan.nextGear,weaponGearSlot,id=>this.catalog.byId.get(id)).magazineMultiplier),rounds=magazines[weaponGearSlot]??0;if(rounds>capacity){const ammoId=loadedAmmo[weaponGearSlot];if(ammoId)reserve[ammoId]=(reserve[ammoId]??0)+(rounds-capacity);magazines[weaponGearSlot]=capacity;}}
      this.db.updateRaidInventoryState(this.id,player.id,plan.nextInventory,plan.nextGear,reserve,magazines,loadedAmmo);
    } else this.db.updateRaidEquipment(this.id,player.id,plan.nextInventory,plan.nextGear);
    this.cancelSearch(player,'equipment');
    player.inventory=plan.nextInventory;player.gear=plan.nextGear;player.goldTraitLevelsBySlot=plan.nextGoldTraitLevelsBySlot??player.goldTraitLevelsBySlot;player.reserveAmmo=reserve;player.magazines=magazines;player.loadedAmmo=loadedAmmo;
    if(isWeaponSlot){player.burstQueue=player.burstQueue.filter(shot=>shot.slot!==slot);if(player.reloadSlot===slot){player.reloadSlot=null;player.reloadEndsAt=null;player.reloadAmmoId=null;}if(!player.gear[player.activeWeaponSlot])player.activeWeaponSlot=['primary','secondary','pistol','melee'].find(host=>player.gear[host])??'melee';}
    Object.assign(player,plan.stats);player.hp=Math.min(player.hp,player.maxHp);
    this.event('equipment_changed',{playerId:player.id,slot:canonicalSlot,itemId});
  }

  dropEquipped(player,slot){
    if(!['primary','secondary','pistol','melee'].includes(slot)||!player.gear[slot])throw gameError('INVALID_SLOT','버릴 장착 무기가 없습니다.');
    const itemId=player.gear[slot];this.equipRaid(player,slot,null);return dropInventory(this,player,itemId,1);
  }

  switchWeapon(player, slot) {
    if (!['primary', 'secondary', 'pistol', 'melee'].includes(slot) || !player.gear[slot]) throw gameError('INVALID_WEAPON_SLOT', 'Weapon is not equipped');
    player.activeWeaponSlot = slot;
  }

  fire(player, slot, aimX, aimZ, now) {
    if (!player.alive || player.downed || player.boarded) return;
    if (!['primary', 'secondary', 'pistol', 'melee'].includes(slot)) throw gameError('INVALID_WEAPON_SLOT', 'Invalid weapon slot');
    const weapon = effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot);
    if (!weapon || weapon.category !== 'weapon') throw gameError('NO_WEAPON', 'Weapon is not equipped');
    if (!Number.isFinite(aimX) || !Number.isFinite(aimZ)) throw gameError('INVALID_AIM', 'Aim must be finite');
    if (player.reloadEndsAt) return;
    player.activeWeaponSlot = slot;
    const direction = normalize(aimX, aimZ);
    if (weapon.mode === 'melee' || weapon.family === 'melee') {
      if(now < player.nextFireAt)return;
      const haste=weapon.id==='legend-karambit'&&now<player.karambitHasteUntil?3:1;
      player.nextFireAt = now + 1000 / Math.max((weapon.fireRate ?? 1.5)*haste, 0.2);
      this.melee(player, weapon, direction);
      return;
    }
    if ((player.magazines[slot] ?? 0) <= 0) { this.event('dry_fire', { playerId: player.id, weaponId: weapon.id }); return; }
    const roundsBeforeShot=
      player.magazines[slot]??
      weapon.magazine??
      0;
    const cooldown=
      nextShotIntervalMs(
       weapon,
       roundsBeforeShot
      );
    let shotAt = now;
    if (now < player.nextFireAt) {
      const earlyTolerance = Math.min(50, cooldown * 0.35);
      if (weapon.mode !== 'auto' || player.nextFireAt - now > earlyTolerance || player.burstQueue.some(shot => shot.slot === slot && shot.at > now)) return;
      shotAt = player.nextFireAt;
    }
    const burst = weapon.mode === 'burst' ? Math.max(2, weapon.burst ?? 3) : 1;
    const cadence=
      firearmCadence(weapon).intervalMs;

    player.nextFireAt=
      weapon.mode==='burst'
       ?shotAt+cadence*burst
       :shotAt+cooldown;
    for (let index = 0; index < burst; index++) player.burstQueue.push({ at: shotAt + index * cadence, slot, weapon, direction });
  }

  activeSkill(player, aimX, aimZ, now) {
    if(!player.alive || player.downed || player.boarded || !player.connected)return;
    const weapon=this.heldLegendaryBlade(player);
    if(!weapon)throw gameError('NO_ACTIVE_SKILL','No legendary blade equipped');
    if(!Number.isFinite(aimX)||!Number.isFinite(aimZ))throw gameError('INVALID_AIM','Aim must be finite');
    if(player.arayaDash)return;
    const cooldowns={'legend-araya':10000,'legend-thunder':15000,'legend-karambit':30000,'legend-arbiter':30000};
    const cooldown=cooldowns[weapon.id];
    if(!cooldown)throw gameError('NO_ACTIVE_SKILL','No active skill');
    if(now<(player.activeSkillReadyAt?.[weapon.id]??0))return;
    const direction=normalize(aimX,aimZ);
    if(weapon.id==='legend-araya'){
      let travel=16;
      for(let step=.2;step<=16.001;step+=.2){
        const x=player.x+direction.x*step,z=player.z+direction.z*step;
        if(Math.abs(x)>this.world.size/2-.5||Math.abs(z)>this.world.size/2-.5){travel=step-.2;break;}
      }
      if(travel<.2)return;
      const targets=[...this.enemies.values()].filter(enemy=>{
        if(enemy.hp<=0||isVirtualResponseEnemy(enemy))return false;
        const dx=enemy.x-player.x,dz=enemy.z-player.z;
        const along=dx*direction.x+dz*direction.z;
        const lateral=Math.abs(dx*direction.z-dz*direction.x);
        if(along<-.6||along>travel+.6||lateral>1.3)return false;
        enemy.__arayaSkillAlong=along;
        return true;
      }).sort((a,b)=>a.__arayaSkillAlong-b.__arayaSkillAlong);
      const last=targets.at(-1);
      let finalTravel=last?Math.min(travel,Math.max(0,last.__arayaSkillAlong)+1.45):travel;
      // Issen may cross walls, but its landing point must leave room for the player collider.
      while(finalTravel>=.2&&movementBlocked(this.world,
        player.x+direction.x*finalTravel,player.z+direction.z*finalTravel))finalTravel-=.1;
      if(finalTravel<.2)return;
      player.arayaDash={x:player.x,z:player.z,ax:direction.x,az:direction.z,travel:finalTravel,startedAt:now,
        duration:Math.max(280,Math.min(470,230+finalTravel*15)),targets:targets.map(enemy=>({id:enemy.id,along:enemy.__arayaSkillAlong})),
        nextHit:0,lastId:last?.id??null};
      this.event('active_skill',{playerId:player.id,weaponId:weapon.id,startedAt:now,x:player.x,z:player.z,
        aimX:direction.x,aimZ:direction.z,travel:finalTravel,previewTravel:travel,targetIds:targets.map(enemy=>enemy.id),targets:targets.map(enemy=>({id:enemy.id,x:enemy.x,z:enemy.z,along:enemy.__arayaSkillAlong})),duration:player.arayaDash?.duration??0});
    }else if(weapon.id==='legend-thunder'){
      const targets=[...this.enemies.values()].filter(enemy=>enemy.hp>0&&!isVirtualResponseEnemy(enemy))
        .sort((a,b)=>distance(a,player)-distance(b,player)).slice(0,5);
      if(!targets.length)return;
      this.event('active_skill',{playerId:player.id,weaponId:weapon.id,startedAt:now,x:player.x,z:player.z,
        targets:targets.map(enemy=>({id:enemy.id,x:enemy.x,z:enemy.z}))});
      for(const enemy of targets){
        this.damageEnemy(player,enemy,200,weapon.id);
        this.healLegendKill68(player,enemy,weapon.id);
      }
    }else if(weapon.id==='legend-karambit'){
      player.karambitHasteUntil=now+5000;
      player.nextFireAt=Math.min(player.nextFireAt,now);
      this.event('active_skill',{playerId:player.id,weaponId:weapon.id,startedAt:now,x:player.x,z:player.z});
    }else if(weapon.id==='legend-arbiter'){
      const targets=[...this.enemies.values()].filter(enemy=>{
        if(enemy.hp<=0||isVirtualResponseEnemy(enemy))return false;
        const dx=enemy.x-player.x,dz=enemy.z-player.z;
        const along=dx*direction.x+dz*direction.z;
        return along>=0&&along<=18&&Math.abs(dx*direction.z-dz*direction.x)<=4;
      });
      this.event('active_skill',{playerId:player.id,weaponId:weapon.id,startedAt:now,x:player.x,z:player.z,
        aimX:direction.x,aimZ:direction.z,length:18,width:8,
        targets:targets.map(enemy=>({id:enemy.id,x:enemy.x,z:enemy.z}))});
      for(const enemy of targets){
        this.damageEnemy(player,enemy,50,weapon.id);
        if(enemy.hp>0)enemy.stunnedUntil=Math.max(enemy.stunnedUntil??0,now+5000);
      }
    }
    player.activeSkillReadyAt??={};
    player.activeSkillReadyAt[weapon.id]=now+cooldown;
  }

  updateArayaDash(player,now){
    const dash=player.arayaDash;
    if(!dash)return;
    const t=clamp((now-dash.startedAt)/dash.duration,0,1);
    const progress=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const traveled=dash.travel*progress;
    const x=dash.x+dash.ax*traveled,z=dash.z+dash.az*traveled;

    player.x=x;player.z=z;player.yaw=Math.atan2(dash.ax,dash.az);
    while(dash.nextHit<dash.targets.length&&dash.targets[dash.nextHit].along<=traveled+.4){
      const enemy=this.enemies.get(dash.targets[dash.nextHit++].id);
      if(!enemy||enemy.hp<=0)continue;
      this.damageEnemy(player,enemy,30,'legend-araya');
      if(enemy.hp>0){
        enemy.arayaBurnStacks=(enemy.arayaBurnStacks??0)+1;
        enemy.arayaBurnOwnerId=player.id;
        enemy.arayaBurnCarry??=0;
      }
    }
    if(t>=1){
      const enemy=this.enemies.get(dash.lastId);
      if(enemy&&enemy.hp>0){
        this.damageEnemy(player,enemy,30,'legend-araya');
        if(enemy.hp>0)enemy.stunnedUntil=Math.max(enemy.stunnedUntil??0,now+500);
      }
      player.arayaDash=null;
    }
  }

  resolveShot(player, queued, now) {
    if (!player.alive || player.downed || player.boarded || player.gear[queued.slot]!==queued.weapon.id || (player.magazines[queued.slot] ?? 0) <= 0) return;
    this.cancelSearch(player,'fire');cancelRevive(this,player,'fire',now);
    player.magazines[queued.slot]--;
    const ammoId=player.loadedAmmo?.[queued.slot]??queued.weapon.ammo;
    const ammo=this.catalog.byId.get(ammoId);
    const weapon=ammoShot(queued.weapon,ammo);
    const fitting=weaponFittingStats(player.gear,queued.slot,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot));
    const baseNoiseRadius=fitting.suppressed?fitting.noiseRadius:Math.max(fitting.noiseRadius,firearmRange(weapon)*1.15);
    const gunshot=emitFirearmSound(this,{sourceKind:'player',sourceId:player.id,playerId:player.id,weapon,ammo,x:player.x,z:player.z,aimX:queued.direction.x,aimZ:queued.direction.z,suppressed:fitting.suppressed,noiseRadius:baseNoiseRadius,now,slot:queued.slot});
    this.event('shot', {playerId:player.id,weaponId:weapon.id,slot:queued.slot,ammoId,ammoGrade:ammo?.ammoGrade,x:player.x,z:player.z,aimX:queued.direction.x,aimZ:queued.direction.z,suppressed:fitting.suppressed,...(gunshot??{})});
    player.noisePosition = {x:player.x,z:player.z};
    player.noiseUntil = now + 600;
    player.noiseRadius = gunshot?.audibleRadius??baseNoiseRadius;
    if (weapon.ammo === 'ammo-bolt' || weapon.family?.toLowerCase() === 'crossbow') {
      this.spawnProjectile(player, 'bolt', queued.direction, weapon.damage ?? 80, 26, 0.2, weapon.range ?? 45, now);
      return;
    }
    const pellets = Math.max(1, weapon.pellets ?? 1);
    for (let index = 0; index < pellets; index++) {
      const accuracy = this.talentValue(player.id, 'accuracy', 0) + fitting.accuracyBonus;
      const spreadScale = pellets === 1 ? Math.sin(++this.shotIndex * 12.9898 + this.seed) : (index / Math.max(pellets - 1, 1) - 0.5) * 2;
      const spread = firearmSpread(weapon) * (1 - clamp(accuracy, 0, 0.65)) * spreadScale;
      const angle = Math.atan2(queued.direction.z, queued.direction.x) + spread;
      this.hitscan(player, weapon, { x: Math.cos(angle), z: Math.sin(angle) }, index===0, now, queued.slot);
    }
  }

  hitscan(player, weapon, direction, specialEffect = true, now = this.now(), weaponSlot = player.activeWeaponSlot) {
    const range=firearmRange(weapon)*weaponFittingStats(player.gear,weaponSlot,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot)).rangeMultiplier;
    const candidates = [];
    const coverDistance = Math.min(range, ...(this.world.obstacles ?? []).map((obstacle) => rayAabbDistance(player, direction, obstacle, range)));
    for (const enemy of this.enemies.values()) {
      if(isVirtualResponseEnemy(enemy))continue;
      const dx = enemy.x - player.x, dz = enemy.z - player.z;
      const along = dx * direction.x + dz * direction.z;
      const lateral = Math.abs(dx * direction.z - dz * direction.x);
      if(along>0&&along<=coverDistance&&lateral<=1.5&&rayAabbDistanceToPoint(this.world,player,enemy)){
        if(lateral<=FIREARM_HIT_RADIUS)candidates.push({enemy,along});
        else forceEnemyThreat(enemy,player,now);
      }
    }
    candidates.sort((a, b) => a.along - b.along);
    const hitLimit=(weapon.baseId??weapon.id)==='lynx-amr'?4:1+Math.floor((weapon.penetration??0)*3);
    const hits = candidates.slice(0,hitLimit);
    hits.forEach(({ enemy }, index) => this.damageEnemy(player, enemy, (weapon.damage ?? 20) * Math.pow(0.72, index), weapon.id, weapon.penetration));
    const first=hits[0]?.enemy;
    if(first && specialEffect && weapon.ammoGrade==='explosive'){
      const radius=1.7;
      for(const enemy of [...this.enemies.values()])if(enemy.id!==first.id && distance(first,enemy)<=radius && rayAabbDistanceToPoint(this.world,first,enemy))this.damageEnemy(player,enemy,Math.min(18,(weapon.damage??20)*.16),'ammo-explosion');
      this.event('ammo_explosion',{playerId:player.id,x:first.x,z:first.z,radius});
    }
    if(first && specialEffect && weapon.ammoGrade==='incendiary' && this.enemies.has(first.id)){
      /* BC103 INCENDIARY BURN
         Non-stacking. A new hit refreshes a five-tick run while preserving
         the already scheduled next tick.
      */
      const previous=
        first.burn &&
        first.burn.ticksRemaining>0
          ?first.burn
          :null;

      const effectiveFirearm=
        effectiveGearItem(
          this.catalog,
          player.gear,
          player.goldTraitLevelsBySlot,
          weaponSlot
        );

      const tickDamage=
        Math.max(
          .01,
          Number(
            effectiveFirearm?.damage ??
            weapon.damage ??
            20
          )*.05
        );

      first.burn={
        ownerId:player.id,
        tickDamage,
        ticksRemaining:5,
        expiresAt:now+3500,
        nextAt:previous?.nextAt??now+500
      };

      this.event(
        'ammo_ignited',
        {
          playerId:player.id,
          enemyId:first.id,
          x:first.x,
          z:first.z,
          expiresAt:now+3500,
          ticks:5,
          tickDamage
        }
      );
    }
  }

  /* BC LEGENDARY MELEE 62 */
  /* BC LEGENDARY KILL HEAL 68 */
  healLegendKill68(player, enemy, weaponId) {
    if(
      !player ||
      !player.alive ||
      !enemy ||
      enemy.hp>0 ||
      enemy.__bcLegendHeal68===true
    )return;

    if(
      ![
        'legend-karambit',
        'legend-thunder',
        'legend-arbiter'
      ].includes(weaponId)
    )return;

    enemy.__bcLegendHeal68=true;

    const maxHp=
      Math.max(
        1,
        Number(player.maxHp)||1
      );

    const before=
      Math.max(
        0,
        Number(player.hp)||0
      );

    player.hp=
      Math.min(
        maxHp,
        before+maxHp*.70
      );

    this.event(
      'legendary_kill_heal',
      {
        playerId:player.id,
        enemyId:enemy.id,
        weaponId,
        amount:
          Math.max(
            0,
            player.hp-before
          ),
        hp:player.hp,
        maxHp
      }
    );
  }

  /* BC ARAYA LIFESTEAL 67 */
  healArayaKill67(player, enemy) {
    if(
      !player ||
      !player.alive ||
      !enemy ||
      enemy.hp>0 ||
      enemy.__bcArayaHeal67===true
    )return;

    enemy.__bcArayaHeal67=true;

    const maxHp=
      Math.max(
        1,
        Number(player.maxHp)||1
      );

    const before=
      Math.max(
        0,
        Number(player.hp)||0
      );

    const heal=
      maxHp*.90;

    player.hp=
      Math.min(
        maxHp,
        before+heal
      );

    this.event(
      'legendary_araya_heal',
      {
        playerId:player.id,
        enemyId:enemy.id,
        amount:
          Math.max(
            0,
            player.hp-before
          ),
        hp:player.hp,
        maxHp
      }
    );
  }

  legendaryMeleeHit(player, enemy, weapon) {
    if(!enemy || enemy.hp<=0)return;

    const id=weapon.id;
    const baseDamage=weapon.damage??35;

    if(id==='legend-arbiter'){
      const proc=player.arbiterPrimed||Math.random()<.25;
      if(player.arbiterPrimed)player.arbiterPrimed=false;
      const damage=proc?99999:baseDamage;

      this.damageEnemy(player,enemy,damage,id);

      this.healLegendKill68(player,enemy,id);

      if(proc){
        this.event('legendary_arbiter_proc',{
          playerId:player.id,
          enemyId:enemy.id,
          x:enemy.x,
          z:enemy.z,
          damage:99999
        });
      }
      return;
    }

    if(id==='legend-araya'){
      const skillNow=this.now();
      /*
       Keep maxHp as the ORIGINAL value exposed to snapshots.
       The destroyed ceiling is tracked separately.

       Health-bar progression now visibly becomes:
         100% -> 70% -> 40% -> 10% -> death
      */
      const baseMax=
        Math.max(
          1,
          Number(
            enemy.arayaBaseMaxHp ??
            enemy.maxHp
          )||1
        );

      enemy.arayaBaseMaxHp=
        baseMax;

      if(
        !Number.isFinite(
          enemy.arayaEffectiveMaxHp
        )
      ){
        /*
         Migrate enemies that were already hit by the older
         implementation where maxHp itself was reduced.
        */
        enemy.arayaEffectiveMaxHp=
          Math.min(
            baseMax,
            Math.max(
              0,
              Number(enemy.maxHp)||baseMax
            )
          );
      }

      /*
       Public maxHp stays original so the client denominator
       does not shrink together with current HP.
      */
      enemy.maxHp=
        baseMax;

      const cut=
        baseMax*.30;

      const nextCap=
        enemy.arayaEffectiveMaxHp-
        cut;

      enemy.arayaBurnStacks=
        (enemy.arayaBurnStacks??0)+1;

      enemy.arayaBurnOwnerId=
        player.id;

      enemy.arayaBurnCarry??=0;

      if(nextCap<=0){
        enemy.arayaEffectiveMaxHp=0;
        enemy.hp=Math.max(1,enemy.hp);

        this.event(
          'legendary_araya',
          {
            playerId:player.id,
            enemyId:enemy.id,
            x:enemy.x,
            z:enemy.z,
            effectiveMaxHp:0,
            baseMaxHp:baseMax,
            burnStacks:
              enemy.arayaBurnStacks
          }
        );

        this.damageEnemy(
          player,
          enemy,
          99999,
          id
        );

        this.healArayaKill67(
          player,
          enemy
        );
        if(Math.random()<.5)player.activeSkillReadyAt['legend-araya']=Math.max(skillNow,(player.activeSkillReadyAt?.['legend-araya']??skillNow)-1000);

        return;
      }

      enemy.arayaEffectiveMaxHp=
        nextCap;

      /*
       Max-HP destruction itself removes any current HP above
       the newly destroyed ceiling. This bypasses armor.
      */
      enemy.hp=
        Math.min(
          enemy.hp,
          enemy.arayaEffectiveMaxHp
        );

      this.event(
        'legendary_araya',
        {
          playerId:player.id,
          enemyId:enemy.id,
          x:enemy.x,
          z:enemy.z,
          effectiveMaxHp:
            enemy.arayaEffectiveMaxHp,
          baseMaxHp:baseMax,
          burnStacks:
            enemy.arayaBurnStacks
        }
      );

      this.damageEnemy(
        player,
        enemy,
        baseDamage,
        id
      );

      this.healArayaKill67(
        player,
        enemy
      );
      if(Math.random()<.5)player.activeSkillReadyAt['legend-araya']=Math.max(skillNow,(player.activeSkillReadyAt?.['legend-araya']??skillNow)-1000);

      return;
    }

    if(id==='legend-thunder'){
      const cx=enemy.x;
      const cz=enemy.z;

      this.damageEnemy(player,enemy,baseDamage,id);

      this.healLegendKill68(player,enemy,'legend-thunder');

      const secondaries=[...this.enemies.values()]
        .filter(target=>
          target.id!==enemy.id &&
          target.hp>0 &&
          Math.hypot(target.x-cx,target.z-cz)<=30
        )
        .sort((a,b)=>
          Math.hypot(a.x-cx,a.z-cz)-
          Math.hypot(b.x-cx,b.z-cz)
        )
        .slice(0,2);

      const targets=[];

      for(const target of secondaries){
        const damage=baseDamage*(.50+Math.random()*.25);

        targets.push({
          id:target.id,
          x:target.x,
          z:target.z,
          damage
        });

        this.damageEnemy(player,target,damage,'legend-thunder');

        this.healLegendKill68(player,target,'legend-thunder');
      }

      this.event('legendary_thunder',{
        playerId:player.id,
        primaryId:enemy.id,
        x:cx,
        z:cz,
        targets
      });
      return;
    }

    /* BC KARAMBIT BOSS DAMAGE 68 */
    const finalDamage=
      id==='legend-karambit' &&
      enemy.bossId
       ?baseDamage*2
       :baseDamage;

    this.damageEnemy(
      player,
      enemy,
      finalDamage,
      id
    );
    /* BC103 KARAMBIT BURN APPLY */
    if(
      id==='legend-karambit' &&
      enemy.hp>0
    ){
      const burnNow=this.now(),
            previous=
        enemy.karambitBurn &&
        enemy.karambitBurn.expiresAt>burnNow &&
        (enemy.karambitBurn.ticksRemaining??0)>0
          ?enemy.karambitBurn
          :null,
            stacks=
        Math.min(
          3,
          (Number(previous?.stacks)||0)+1
        );

      enemy.karambitBurn={
        ownerId:player.id,
        stacks,
        expiresAt:burnNow+4000,
        nextAt:previous?.nextAt??burnNow+1000,
        ticksRemaining:4
      };

      this.event(
        'burn_ignited',
        {
          playerId:player.id,
          enemyId:enemy.id,
          source:'legend-karambit',
          stacks,
          expiresAt:burnNow+4000
        }
      );
    }


    this.healLegendKill68(
      player,
      enemy,
      id
    );
  }

  /* BC LEGENDARY SURVIVAL 63 */
  heldLegendaryBlade(player) {
    const slot=player?.activeWeaponSlot;
    const itemId=slot?player?.gear?.[slot]:null;
    const item=itemId?this.catalog.byId.get(itemId):null;
    return item?.legendaryBlade===true?item:null;
  }

  updateLegendaryBladeState(player, now) {
    const blade=this.heldLegendaryBlade(player);

    let currentMove=
      Number.isFinite(player.moveMultiplier)
       ?player.moveMultiplier
       :1;

    if(
      Number.isFinite(player.__bcLegendAppliedMove) &&
      Math.abs(currentMove-player.__bcLegendAppliedMove)<1e-6
    ){
      currentMove=
        Number.isFinite(player.__bcLegendBaseMove)
         ?player.__bcLegendBaseMove
         :1;
    }

    if(!blade){
      player.moveMultiplier=currentMove;
      player.__bcLegendBaseMove=currentMove;
      player.__bcLegendAppliedMove=null;

      /* BC LEGENDARY STAMINA RESET 70 */
      if(
        Number.isFinite(
          player.__bcLegendAppliedMaxStamina
        )
      ){
        const baseMaxStamina=
          Number.isFinite(
            player.__bcLegendBaseMaxStamina
          )
           ?player.__bcLegendBaseMaxStamina
           :100;

        const currentMax=
          Math.max(
            1,
            Number(player.maxStamina)||
            baseMaxStamina
          );

        const ratio=
          Math.max(
            0,
            Math.min(
              1,
              (Number(player.stamina)||0)/
              currentMax
            )
          );

        player.maxStamina=
          baseMaxStamina;

        player.stamina=
          baseMaxStamina*
          ratio;
      }

      player.__bcLegendAppliedMaxStamina=null;
      player.__bcLegendBaseMaxStamina=null;
      player.legendaryStaminaBladeId=null;
      player.legendaryStaminaMultiplier=1;
      player.__bcLegendObservedBlade73=null;
      player.__bcLegendObservedStamina73=null;


      player.legendaryShield=0;
      player.legendaryShieldMax=0;
      player.legendaryBladeHeldId=null;
      player.legendaryBladeHeldSince=null;
      player.legendaryShieldLastDamageAt=null;
      player.legendaryShieldLastTickAt=now;
      return;
    }

    const moveBoost=
      blade.id==='legend-karambit'
       ?2
       :1.8;

    player.__bcLegendBaseMove=currentMove;
    player.moveMultiplier=currentMove*moveBoost;
    player.__bcLegendAppliedMove=player.moveMultiplier;

    /* BC LEGENDARY STAMINA 70 */
    const staminaBoost=
      blade.id==='legend-karambit'
       ?3
       :2;

    /*
     Recover the unmodified/base max stamina first.
     This prevents multiplication every tick.
    */
    let baseMaxStamina=
      Number.isFinite(
        player.maxStamina
      )
       ?player.maxStamina
       :100;

    if(
      Number.isFinite(
        player.__bcLegendAppliedMaxStamina
      ) &&
      Math.abs(
        baseMaxStamina-
        player.__bcLegendAppliedMaxStamina
      )<1e-6
    ){
      baseMaxStamina=
        Number.isFinite(
          player.__bcLegendBaseMaxStamina
        )
         ?player.__bcLegendBaseMaxStamina
         :100;
    }

    const previousMax=
      Math.max(
        1,
        Number(player.maxStamina)||
        baseMaxStamina
      );

    const previousStamina=
      Math.max(
        0,
        Number(player.stamina)||0
      );

    const staminaRatio=
      Math.max(
        0,
        Math.min(
          1,
          previousStamina/
          previousMax
        )
      );

    player.__bcLegendBaseMaxStamina=
      baseMaxStamina;

    player.maxStamina=
      baseMaxStamina*
      staminaBoost;

    player.__bcLegendAppliedMaxStamina=
      player.maxStamina;

    /*
     Preserve percentage only when the held legendary changes.
     During ordinary ticks the normal stamina drain/recovery value is kept.
    */
    if(
      player.legendaryStaminaBladeId!==
      blade.id
    ){
      player.stamina=
        player.maxStamina*
        staminaRatio;

      player.legendaryStaminaBladeId=
        blade.id;
    }else{
      player.stamina=
        Math.min(
          player.maxStamina,
          previousStamina
        );
    }

    player.legendaryStaminaMultiplier=
      staminaBoost;

    /* BC LEGENDARY STAMINA REGEN 73 */
    const observedStamina=
      Math.max(
        0,
        Number(player.stamina)||0
      );

    if(
      player.__bcLegendObservedBlade73===
      blade.id &&
      Number.isFinite(
        player.__bcLegendObservedStamina73
      ) &&
      observedStamina>
       player.__bcLegendObservedStamina73+
       .0001
    ){
      /*
       Core server recovery already happened.
       Multiply only that positive delta:
         normal legendary = 2x regen
         Karambit         = 3x regen
      */
      const baseRecovered=
        observedStamina-
        player.__bcLegendObservedStamina73;

      player.stamina=
        Math.min(
          player.maxStamina,
          observedStamina+
          baseRecovered*
          (
           staminaBoost-1
          )
        );
    }

    player.__bcLegendObservedBlade73=
      blade.id;

    player.__bcLegendObservedStamina73=
      player.stamina;



    const shieldMax=
      Math.max(
        0,
        Number(player.maxHp)||0
      )*2;

    if(player.legendaryBladeHeldId!==blade.id){
      player.legendaryBladeHeldId=blade.id;
      player.legendaryBladeHeldSince=now;
      player.legendaryShield=0;
      player.legendaryShieldMax=shieldMax;
      player.legendaryShieldLastDamageAt=now;
      player.legendaryShieldLastTickAt=now;
      return;
    }

    player.legendaryShieldMax=shieldMax;

    let shield=
      Math.max(
        0,
        Math.min(
          shieldMax,
          Number(player.legendaryShield)||0
        )
      );

    const lastTick=
      Number(player.legendaryShieldLastTickAt)||now;

    const dt=
      Math.max(
        0,
        Math.min(
          .25,
          (now-lastTick)/1000
        )
      );

    player.legendaryShieldLastTickAt=now;

    const lastDamage=
      Number(player.legendaryShieldLastDamageAt)||
      Number(player.legendaryBladeHeldSince)||
      now;

    if(now-lastDamage>=5000){
      shield=shieldMax;
    }else if(
      shieldMax>0 &&
      shield>=shieldMax*.5
    ){
      shield=Math.min(
        shieldMax,
        shield+4*dt
      );
    }

    player.legendaryShield=shield;
  }

  absorbLegendaryShield(player, damage, now) {
    const blade=this.heldLegendaryBlade(player);

    if(!blade){
      return {
        remaining:damage,
        absorbed:0
      };
    }

    const amount=
      Math.max(
        0,
        Number(damage)||0
      );

    if(amount>0){
      player.legendaryShieldLastDamageAt=now;
    }

    let shield=
      Math.max(
        0,
        Number(player.legendaryShield)||0
      );

    const absorbed=
      Math.min(
        shield,
        amount
      );

    shield-=absorbed;
    player.legendaryShield=shield;

    if(absorbed>0){
      this.event(
        'legendary_shield_hit',
        {
          playerId:player.id,
          weaponId:blade.id,
          absorbed,
          shield,
          shieldMax:
            player.legendaryShieldMax??0
        }
      );
    }

    return {
      remaining:
        Math.max(
          0,
          amount-absorbed
        ),
      absorbed
    };
  }

  melee(player, weapon, direction) {
    /* BC LEGENDARY MELEE AOE 96
       - Existing frontal sector stays 140 degrees.
       - Legendary blades hit EVERY valid enemy in the sector.
       - Ordinary melee stays single-target (nearest).
       - Every direct Thunderclap target executes its own chain-lightning logic.
    */
    const range=Math.max(.1,Number(weapon.range??2.3));
    const arcDeg=140;
    const halfArc=arcDeg*Math.PI/360;
    const minimumDot=Math.cos(halfArc);
    const hits=[];

    for(const enemy of this.enemies.values()){
      if(!enemy||enemy.hp<=0)continue;

      const dx=enemy.x-player.x;
      const dz=enemy.z-player.z;
      const d=Math.hypot(dx,dz);

      if(d>range||d<.01)continue;

      const dot=
        (dx*direction.x+dz*direction.z)/d;

      if(dot<minimumDot)continue;

      hits.push({enemy,d,dot});
    }

    hits.sort((a,b)=>a.d-b.d);

    const legendary=
      weapon.legendaryBlade===true;

    const directHits=
      legendary
       ?hits
       :hits.slice(0,1);

    this.event('melee',{
      playerId:player.id,
      weaponId:weapon.id,
      aimX:direction.x,
      aimZ:direction.z,
      range,
      arcDeg,
      targetId:directHits[0]?.enemy?.id??null,
      targetIds:directHits.map(hit=>hit.enemy.id),
      targetCount:directHits.length,
      aoe:legendary
    });

    for(const hit of directHits){
      this.legendaryMeleeHit(
        player,
        hit.enemy,
        weapon
      );
    }
  }

  selectAmmo(player,slot,itemId,now) {
    if(!['primary','secondary','pistol'].includes(slot))throw gameError('INVALID_WEAPON_SLOT','Invalid ammo slot');
    const weapon=effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot);
    if(!weapon?.ammo||!compatibleAmmo(this.catalog,weapon.ammo).some(i=>i.id===itemId))throw gameError('INCOMPATIBLE_AMMO','선택한 탄환은 이 총기에 사용할 수 없습니다.');
    if(player.reloadEndsAt)throw gameError('RELOADING','장전이 끝난 뒤 탄환을 변경하세요.');
    if((player.reserveAmmo[itemId]??0)<=0 && !(player.loadedAmmo?.[slot]===itemId && player.magazines[slot]>0))throw gameError('NO_AMMO','선택한 탄환을 소지하고 있지 않습니다.');
    player.preferredAmmo[slot]=itemId;
    this.reload(player,slot,now);
  }

  reload(player, slot, now) {
    if (!['primary', 'secondary', 'pistol'].includes(slot)) throw gameError('INVALID_WEAPON_SLOT', 'Invalid reload slot');
    const weapon = effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot);
    if (!weapon?.ammo || !weapon.magazine) throw gameError('NO_WEAPON', 'Weapon is not equipped');
    const extended=weaponFittingStats(player.gear,slot,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot)).magazineMultiplier;
    const capacity = Math.ceil(weapon.magazine * extended);
    const ammoId=chooseAmmo(this.catalog,weapon.ammo,player.reserveAmmo,player.preferredAmmo?.[slot])??(player.magazines[slot]>capacity?player.loadedAmmo?.[slot]:null);
    if (player.reloadEndsAt || !ammoId || (player.magazines[slot]===capacity && player.loadedAmmo?.[slot]===ammoId)) return;
    player.reloadSlot = slot;
    player.reloadAmmoId=ammoId;
    player.burstQueue=[];
    player.reloadEndsAt = now + weaponFittingStats(player.gear,slot,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot)).reloadSeconds*1000;
    this.event('reload_started', { playerId: player.id, slot, ammoId, endsAt: player.reloadEndsAt });
  }

  finishReload(player) {
    const slot = player.reloadSlot;
    const weapon = effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot);
    if (!slot || !weapon) return;
    const extended=weaponFittingStats(player.gear,slot,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot)).magazineMultiplier;
    const ammoId=chooseAmmo(this.catalog,weapon.ammo,player.reserveAmmo,player.reloadAmmoId)??player.loadedAmmo?.[slot];
    if(ammoId)loadMagazine(player,slot,ammoId,Math.ceil(weapon.magazine*extended));
    player.reloadEndsAt = null;
    player.reloadSlot = null;
    player.reloadAmmoId = null;
    this.event('reloaded', { playerId: player.id, slot, ammoId });
  }

  updateBoost(player,now){
    if(!player.alive||player.settlement||!player.boost)return;
    const previous=player.boostUpdatedAt??now,initial=player.boost;
    if(player.downed){player.boost=Math.max(0,initial-Math.max(0,now-previous)/3000);player.boostUpdatedAt=now;player.nextBoostHealAt=player.boost?now+8000:null;return;}
    while(player.nextBoostHealAt&&player.nextBoostHealAt<=Math.min(now,previous+initial*3000)){
      const gauge=Math.max(0,initial-(player.nextBoostHealAt-previous)/3000);
      const amount=gauge>90?4:gauge>60?3:gauge>20?2:gauge>0?1:0;
      player.hp=Math.min(player.maxHp,player.hp+amount);player.nextBoostHealAt+=8000;
    }
    player.boost=Math.max(0,initial-Math.max(0,now-previous)/3000);player.boostUpdatedAt=now;
    if(!player.boost)player.nextBoostHealAt=null;
  }

  finishRadiationMedicine(player,now){
    const use=player.medicalUse;
    if(!use||now<use.endsAt)return;
    if(!player.alive||player.downed||player.settlement){player.medicalUse=null;return;}
    const item=this.catalog.byId.get(use.itemId),healingTarget=medicalHealTarget(item,player);
    if(healingTarget!==undefined&&player.hp>=Math.min(player.maxHp,healingTarget)){player.medicalUse=null;return;}
    const inventory=player.inventory.map(s=>({...s})),gear={...player.gear};
    if(gear.medical===use.itemId)gear.medical=null;
    else{const stack=inventory.find(s=>s.itemId===use.itemId&&s.quantity>0);if(!stack){player.medicalUse=null;return;}stack.quantity--;}
    const nextInventory=inventory.filter(s=>s.quantity>0);
    this.db.updateRaidEquipment(this.id,player.id,nextInventory,gear);
    player.inventory=nextInventory;player.gear=gear;player.medicalUse=null;
    if(item.effect==='anti-radiation'){
      player.radiationExposure=0;player.maxHp=player.baseMaxHp??100;
      player.radiationMedicineUntil=now+(item.radiationDurationMs??60000);
    }else if(item.effect==='boost'){
      player.boost=Math.min(100,(player.boost??0)+(item.boostAmount??40));
      player.boostUpdatedAt=now;player.nextBoostHealAt??=now+8000;
    }else{
      player.hp=healingTarget!==undefined?Math.max(player.hp,Math.min(player.maxHp,healingTarget)):Math.min(player.maxHp,player.hp+(item.heal??35)*(1+this.talentValue(player.id,'heal',0)));
      this.event('heal',{playerId:player.id,itemId:item.id,hp:player.hp});
    }
  }

  useMedical(player, itemId) {
    const item = this.catalog.byId.get(itemId);
    const gearItem = player.gear.medical;
    const carried = player.inventory.find((stack) => stack.itemId === itemId && stack.quantity > 0);
    if (!item || item.category !== 'medical' || (gearItem !== itemId && !carried)) throw gameError('NO_MEDICAL', 'Medical item is not carried');
    if(item.effect==='anti-radiation'||item.effect==='boost'||item.healTarget!==undefined||(item.useTimeMs??0)>0){
      if(!player.alive||player.downed||player.settlement||player.medicalUse)return;
      if(item.effect==='boost'&&(player.boost??0)>=100)return;
      const healingTarget=medicalHealTarget(item,player);
      if(healingTarget!==undefined&&player.hp>=Math.min(player.maxHp,healingTarget))return;
      this.cancelSearch(player,'medical');
      const now=this.now();player.medicalUse={itemId,startedAt:now,endsAt:now+(item.useTimeMs??3000)};this.event('medical_started',{playerId:player.id,itemId,startedAt:now});return;
    }
    if(player.medicalUse)return;
    if (player.hp >= player.maxHp || !player.alive || player.downed || player.settlement) return;
    const nextInventory=player.inventory.map(s=>({...s})),nextGear={...player.gear};
    if(gearItem===itemId)nextGear.medical=null;
    else{const stack=nextInventory.find(s=>s.itemId===itemId);stack.quantity--;}
    const inventory=nextInventory.filter(s=>s.quantity>0);
    this.db.updateRaidEquipment(this.id,player.id,inventory,nextGear);
    player.inventory=inventory;player.gear=nextGear;this.cancelSearch(player,'medical');
    player.hp = Math.min(player.maxHp, player.hp + (item.heal ?? 35) * (1 + this.talentValue(player.id, 'heal', 0)));
    this.event('heal', { playerId: player.id, itemId, hp: player.hp });
  }

  throwItem(player, itemId, aimX, aimZ, now) {
    const item = this.catalog.byId.get(itemId);
    if (!Number.isFinite(aimX) || !Number.isFinite(aimZ)) throw gameError('INVALID_AIM', 'Aim must be finite');
    if (now < player.nextThrowAt) return;
    if (!item || item.category !== 'throwable' || (player.gear.throwable !== itemId && !player.inventory.some((s) => s.itemId === itemId && s.quantity > 0))) throw gameError('NO_THROWABLE', 'Throwable is not carried');
    player.nextThrowAt = now + 1000 / Math.max(item.fireRate ?? 0.7, 0.1);
    if (player.gear.throwable === itemId) player.gear.throwable = null;
    else this.consumeInventory(player, itemId, 1);
    this.spawnProjectile(player, item.effect ?? 'grenade', normalize(aimX, aimZ), item.damage ?? 80, 13, item.radius ?? 4, item.range ?? 18, now, true);
    this.event('throw', { playerId: player.id, itemId });
  }

  underbarrel(player, aimX, aimZ, now) {
    const launcher = this.catalog.byId.get(weaponAttachmentId(player.gear,player.activeWeaponSlot,'grip'));
    if (!Number.isFinite(aimX) || !Number.isFinite(aimZ)) throw gameError('INVALID_AIM', 'Aim must be finite');
    if (now < player.nextUnderbarrelAt) return;
    if (!launcher || launcher.ammo !== 'ammo-40') throw gameError('NO_UNDERBARREL', '40 mm launcher is not equipped');
    player.nextUnderbarrelAt = now + 1000 / Math.max(launcher.fireRate ?? 0.4, 0.1);
    if ((player.reserveAmmo['ammo-40'] ?? 0) < 1) throw gameError('NO_AMMO', 'No 40 mm grenades');
    player.reserveAmmo['ammo-40']--;
    this.spawnProjectile(player, 'grenade-40mm', normalize(aimX, aimZ), launcher.damage ?? 110, 18, launcher.radius ?? 5, launcher.range ?? 28, now, true);
  }

  spawnProjectile(player, kind, direction, damage, speed, radius, range, now, explosive = false) {
    const id = randomUUID();
    this.projectiles.set(id, { id, kind, ownerId: player.id, x: player.x, z: player.z, vx: direction.x * speed, vz: direction.z * speed, damage, radius, remaining: range, explosive, createdAt: now });
  }

  reviveReach(a,b){return rayAabbDistanceToPoint(this.world,a,b,true);}

  interact(player, targetId, now) {
    if(player.reviving&&player.reviving.targetId!==targetId)cancelRevive(this,player,'interact',now);
    const container = this.containers.get(targetId);
    if (container) {
      this.requireContainerAccess(container);
      if (distance(player, container) > 2.5) throw gameError('TOO_FAR', 'Container is too far away');
      if (!rayAabbDistanceToPoint(this.world, player, container, true)) throw gameError('NO_LINE_OF_SIGHT', 'Container is blocked by a wall');
      if (container.state === 'open') { container.openedBy ??= player.id; return; }
      if (player.searching?.containerId === container.id && container.openedBy === player.id) return;
      if (container.state === 'searching') throw gameError('CONTAINER_BUSY', 'Another player is searching this container');
      if (player.searching) this.cancelSearch(player, 'changed_target');
      if(player.reloadEndsAt&&player.reloadEndsAt>now)throw gameError('RELOADING','재장전 중입니다.');
      player.medicalUse=null;
      if(player.extracting){const extractionId=player.extracting.extractionId;player.extracting=null;this.event('extraction_cancelled',{playerId:player.id,extractionId,reason:'search'});}
      const completeAt = now + container.searchSeconds * 1000;
      container.state = 'searching'; container.openedBy = player.id;container.searchStartedAt=now;container.searchCompleteAt=completeAt;
      player.searching = { containerId: container.id, startedAt: now, completeAt };
      this.event('container_search_started', { playerId: player.id, containerId: container.id, completeAt });
      return;
    }
    const loot = this.loot.get(targetId);
    if (loot) {
      if (distance(player, loot) > 2.5) throw gameError('TOO_FAR', 'Loot is too far away');
      if (!rayAabbDistanceToPoint(this.world, player, loot, true)) throw gameError('NO_LINE_OF_SIGHT', 'Loot is blocked by a wall');
      const item = this.catalog.byId.get(loot.itemId);
      const nextWeight = this.carriedWeight(player) + (item?.weight ?? 0) * loot.quantity;
      if (nextWeight > player.carryCapacity) throw gameError('OVER_CAPACITY', 'Backpack capacity exceeded');
      if(item?.category==='ammo')player.reserveAmmo[loot.itemId]=(player.reserveAmmo[loot.itemId]??0)+loot.quantity;
      else stacksAdd(player.inventory, loot.itemId, loot.quantity);
      this.loot.delete(targetId);
      this.db.updateRaidLoot(this.id, player.id, player.inventory);
      this.event('loot', { playerId: player.id, ...loot });
      return;
    }
    const teammate = this.players.get(targetId);
    if(teammate?.downed){startRevive(this,player,teammate,now);return;}
    const extraction = this.extractions.get(targetId);
    if (extraction) {
      if(!player.alive||player.downed||!player.connected)throw gameError('NOT_ALIVE','Player cannot extract');
      if(distance(player,extraction)>extraction.radius)throw gameError('TOO_FAR','Move into the extraction zone');
      if(extraction.kind==='flare'){
        const state=flareExtractionStatus(extraction,now);
        if(state==='arming')throw gameError('FLARE_NOT_READY','Flare zone is not active yet');
        if(state==='expired')throw gameError('FLARE_EXPIRED','Flare zone has expired');
      }
      if(player.extracting?.extractionId===extraction.id)return;
      this.cancelSearch(player,'extraction');
      const completeAt=now+(extraction.holdSeconds??8)*1000;
      player.extracting={extractionId:extraction.id,startedAt:now,completeAt};
      this.event('extraction_started',{playerId:player.id,extractionId:extraction.id,completeAt});
      return;
    }
    throw gameError('TARGET_NOT_FOUND', 'Interact target does not exist');
  }

  cancelSearch(player, reason = 'cancelled') {
    const search = player.searching;
    if (!search) return false;
    const container = this.containers.get(search.containerId);
    player.searching = null;
    if (container?.state === 'searching' && container.openedBy === player.id) { container.state = 'closed'; delete container.openedBy;delete container.searchStartedAt;delete container.searchCompleteAt; }
    this.event('container_search_cancelled', { playerId: player.id, containerId: search.containerId, reason });
    return true;
  }

  updateContainerSearches(now) {
    for (const player of this.players.values()) {
      const search = player.searching;
      if (!search) continue;
      const container = this.containers.get(search.containerId);
      if (!player.connected || player.settlement || !player.alive || player.downed || !container || container.state !== 'searching' || container.openedBy !== player.id || distance(player, container) > 2.5 || !rayAabbDistanceToPoint(this.world, player, container, true)) { this.cancelSearch(player, 'interrupted'); continue; }
      if (now >= search.completeAt) { player.searching = null; container.state = 'open';delete container.searchStartedAt;delete container.searchCompleteAt; const rng=this.options.random??Math.random;if(player.bonusLootChance>0&&container.items.length&&rng()<player.bonusLootChance){const bonus=container.items[Math.min(container.items.length-1,Math.floor(rng()*container.items.length))];bonus.quantity++;this.event('container_bonus_item',{playerId:player.id,containerId:container.id,itemId:bonus.itemId,quantity:1});} this.event('container_opened', { playerId: player.id, containerId: container.id }); }
    }
  }

  equipContainer(player,message){
    if(!player.alive||player.downed||!player.connected||player.boarded||player.settlement)throw gameError('PLAYER_INACTIVE','현재 장비를 획득할 수 없습니다.');
    if(message.quantity!==undefined&&message.quantity!==1)throw gameError('INVALID_QUANTITY','직접 장착 수량은 한 개입니다.');
    const container=this.containers.get(message.containerId);
    if(!container)throw gameError('CONTAINER_NOT_FOUND','Container does not exist');
    this.requireContainerAccess(container);
    if(container.state!=='open')throw gameError('CONTAINER_CLOSED','Container has not been opened');
    if(distance(player,container)>2.5)throw gameError('TOO_FAR','Container is too far away');
    if(!rayAabbDistanceToPoint(this.world,player,container,true))throw gameError('NO_LINE_OF_SIGHT','Container is blocked by a wall');
    if(message.stackId!==undefined&&typeof message.stackId!=='string')throw gameError('INVALID_STACK_ID','Invalid container item row');
    const stack=container.items.find(s=>s.itemId===message.itemId&&(message.stackId===undefined||s.stackId===message.stackId));
    if(!stack||stack.quantity<1)throw gameError('INSUFFICIENT_CONTAINER_ITEMS','Item is no longer in container');
    const plan=directEquipmentPlan(player,message.itemId,message.slot,this.catalog,message);
    if(stack.fittings){
      for(const [part,id] of Object.entries(stack.fittings)){
        const key=plan.key+':'+part;if(plan.gear[key])throw gameError('SLOT_OCCUPIED','장착할 장비 파츠 슬롯이 차 있습니다.');plan.gear[key]=id;
      }
      Object.assign(plan.stats,raidEquipmentStats(player,plan.gear,this.catalog));
    }
    const reserve={...player.reserveAmmo},magazines={...player.magazines},loadedAmmo={...player.loadedAmmo};
    if(['primary','secondary','pistol'].includes(plan.key)){
      const oldAmmo=loadedAmmo[plan.key],oldRounds=magazines[plan.key]??0;
      if(oldAmmo&&oldRounds>0)reserve[oldAmmo]=(reserve[oldAmmo]??0)+oldRounds;
      magazines[plan.key]=0;loadedAmmo[plan.key]=null;
    }
    const weight=player.inventory.reduce((n,s)=>n+stackWeight(s,id=>this.catalog.byId.get(id)),0)+Object.entries(reserve).reduce((n,[id,q])=>n+(this.catalog.byId.get(id)?.weight??0)*q,0);
    if(weight>plan.stats.carryCapacity+.000001)throw gameError('OVER_CAPACITY','새 장비의 배낭 용량을 초과합니다.');
    const items=container.items.map(s=>({...s}));items[container.items.indexOf(stack)].quantity--;
    this.db.updateRaidInventoryState(this.id,player.id,player.inventory,plan.gear,reserve,magazines,loadedAmmo);
    player.gear=plan.gear;player.reserveAmmo=reserve;player.magazines=magazines;player.loadedAmmo=loadedAmmo;
    Object.assign(player,plan.stats);container.items=items.filter(s=>s.quantity>0);
    this.cancelSearch(player,'equipment');player.medicalUse=null;
    this.event('container_equipped',{playerId:player.id,containerId:container.id,itemId:message.itemId,slot:plan.key});
  }

  takeContainer(player, containerId, itemId, quantity, stackId = undefined) {
    if(!player.alive||player.downed||!player.connected||player.boarded||player.settlement)throw gameError('PLAYER_INACTIVE','현재 전리품을 획득할 수 없습니다.');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw gameError('INVALID_QUANTITY', 'Quantity must be a positive integer');
    const container = this.containers.get(containerId);
    if (!container) throw gameError('CONTAINER_NOT_FOUND', 'Container does not exist');
    this.requireContainerAccess(container);
    if (container.state !== 'open') throw gameError('CONTAINER_CLOSED', 'Container has not been opened');
    if (distance(player, container) > 2.5) throw gameError('TOO_FAR', 'Container is too far away');
    if (!rayAabbDistanceToPoint(this.world, player, container, true)) throw gameError('NO_LINE_OF_SIGHT', 'Container is blocked by a wall');
    const item = this.catalog.byId.get(itemId);
    if (!item) throw gameError('UNKNOWN_ITEM', 'Container item is not in the catalog');
    if(stackId!==undefined&&typeof stackId!=='string')throw gameError('INVALID_STACK_ID','Invalid container item row');
    const stack = container.items.find((entry) => entry.itemId === itemId&&(stackId===undefined||entry.stackId===stackId));
    if (!stack || stack.quantity < quantity) throw gameError('INSUFFICIENT_CONTAINER_ITEMS', 'Container does not hold that quantity');
    if (this.carriedWeight(player) + stackWeight({...stack,quantity},id=>this.catalog.byId.get(id)) > player.carryCapacity) throw gameError('OVER_CAPACITY', 'Backpack capacity exceeded');
    const nextItems=container.items.map(s=>({...s})),nextInventory=player.inventory.map(s=>({...s})),nextReserve={...player.reserveAmmo};
    const nextStack=nextItems[container.items.indexOf(stack)];nextStack.quantity-=quantity;
    if(!nextStack.quantity)nextItems.splice(nextItems.indexOf(nextStack),1);
    if(item.category==='ammo')nextReserve[itemId]=(nextReserve[itemId]??0)+quantity;
    else if(stack.fittings)nextInventory.push({itemId,quantity,fittings:{...stack.fittings}});else stacksAdd(nextInventory,itemId,quantity);
    this.db.updateRaidInventoryState(this.id,player.id,nextInventory,player.gear,nextReserve,player.magazines,player.loadedAmmo);
    container.items=nextItems;player.inventory=nextInventory;player.reserveAmmo=nextReserve;
    this.event('loot', { playerId: player.id, containerId, itemId, quantity });
  }

  transferSecure(player,itemId,quantity,direction){
    if(!player.alive||player.downed||!player.connected||player.settlement)throw gameError('NOT_ALIVE','지금은 암호상자를 사용할 수 없습니다.');
    const next=planSecureTransfer(player,itemId,quantity,direction,this.catalog);
    this.db.updateRaidSecure(this.id,player.id,next.nextInventory,next.nextSecure);
    player.inventory=next.nextInventory;player.reserveAmmo=next.nextReserveAmmo;player.secure=next.nextSecure;
    this.event('secure_transferred',{playerId:player.id,itemId,quantity,direction});
  }

  requireContainerAccess(container) {
    if(container.accessDoorId && this.accessDoors.get(container.accessDoorId)?.state!=='open')throw gameError('ACCESS_DOOR_LOCKED','Unlock the supply room first');
  }

  unlockDoor(player,doorId) {
    if(!player.alive||player.downed||player.settlement||!player.connected)throw gameError('NOT_ALIVE','Player cannot unlock doors');
    const door=this.accessDoors.get(doorId);
    if(!door)throw gameError('ACCESS_DOOR_NOT_FOUND','Access door does not exist');
    if(door.state==='open')return;
    if(distance(player,door)>2.5)throw gameError('TOO_FAR','Door is too far away');
    const reachWorld={...this.world,obstacles:this.world.obstacles.filter(o=>o.accessDoorId!==doorId)};
    if(!rayAabbDistanceToPoint(reachWorld,player,door,true))throw gameError('NO_LINE_OF_SIGHT','Door is blocked');
    const inventoryIndex=player.inventory.findIndex(stack=>stack.itemId===door.itemId&&stack.quantity>=1);
    const secureIndex=player.secure.findIndex(stack=>stack.itemId===door.itemId&&stack.quantity>=1);
    if(inventoryIndex<0&&secureIndex<0)throw gameError('PASSWORD_LETTER_REQUIRED','A matching password letter is required');
    const nextInventory=player.inventory.map(stack=>({...stack}));
    const nextSecure=player.secure.map(stack=>({...stack}));
    const source=inventoryIndex>=0?nextInventory:nextSecure;
    const index=inventoryIndex>=0?inventoryIndex:secureIndex;
    source[index].quantity--;
    const retainedInventory=nextInventory.filter(stack=>stack.quantity>0);
    const retainedSecure=nextSecure.filter(stack=>stack.quantity>0);
    this.db.updateRaidSecure(this.id,player.id,retainedInventory,retainedSecure);
    player.inventory=retainedInventory;
    player.secure=retainedSecure;
    door.state='open';door.openedBy=player.id;
    removeAccessDoorCollider(this.world,doorId);
    this.event('access_door_opened',{playerId:player.id,doorId,color:door.color});
  }

  callExtraction(player, _extractionId, now) {
    if(!player.alive||player.downed||!player.connected||player.settlement)throw gameError('NOT_ALIVE','Player cannot fire a flare');
    const hasGun=player.gear.flare==='signal-flare'||player.inventory.some(s=>s.itemId==='signal-flare'&&s.quantity>0);
    if(!hasGun)throw gameError('NO_FLARE','Carry or equip a signal flare launcher');
    if((player.reserveAmmo['ammo-flare']??0)<1)throw gameError('NO_FLARE_AMMO','A blue signal flare round is required');
    player.reserveAmmo['ammo-flare']--;
    this.cancelSearch(player,'flare');
    const extraction=makeFlareExtraction(player,now,`flare-${randomUUID()}`);
    this.extractions.set(extraction.id,extraction);
    this.event('flare_fired',{playerId:player.id,extractionId:extraction.id,x:extraction.x,z:extraction.z,activatesAt:extraction.activatesAt,expiresAt:extraction.expiresAt});
  }

  tick(now) {
    for(const player of this.players.values())this.updateLegendaryBladeState(player,now);
    if (this.complete || now <= this.lastTickAt) return;
    const perfStarted=process.hrtime.bigint(),schedulerLagMs=Math.max(0,now-this.lastTickAt-TICK_MS);
    let remaining = Math.min(now - this.lastTickAt, 250),steps=0;
    while (remaining > 0) {
      const step = Math.min(TICK_MS, remaining);
      this.simulate(step / 1000, this.lastTickAt + step);
      this.lastTickAt += step;
      remaining -= step;
      steps++;
    }
    this.lastTickAt = now;
    this.updateWallTimers(now);
    const snapshotSent=now-this.lastSnapshotAt>=SNAPSHOT_MS;
    if (snapshotSent) this.broadcastSnapshot(now);
    this.recordPerformance(now,Number(process.hrtime.bigint()-perfStarted)/1e6,schedulerLagMs,steps,snapshotSent);
  }

  recordPerformance(now,tickMs,schedulerLagMs,steps,snapshotSent){
    const stats=this.perfStats;
    stats.ticks++;stats.totalTickMs+=tickMs;stats.maxTickMs=Math.max(stats.maxTickMs,tickMs);stats.maxSchedulerLagMs=Math.max(stats.maxSchedulerLagMs,schedulerLagMs);stats.totalSteps+=steps;if(snapshotSent)stats.snapshots++;
    if(now-stats.windowStartedAt<5000)return;
    const enemies=[...this.enemies.values()];
    console.info('[raid-perf] '+JSON.stringify({raidId:this.id,elapsedMs:now-this.startedAt,ticks:stats.ticks,tickAvgMs:Number((stats.totalTickMs/stats.ticks).toFixed(2)),tickMaxMs:Number(stats.maxTickMs.toFixed(2)),schedulerLagMaxMs:Number(stats.maxSchedulerLagMs.toFixed(2)),simSteps:stats.totalSteps,snapshots:stats.snapshots,players:this.players.size,connectedPlayers:[...this.players.values()].filter(player=>player.connected&&!player.settlement).length,enemies:enemies.length,activeEnemies:this.lastActiveEnemyCount,combatEnemies:enemies.filter(enemy=>enemy.alertState==='combat'||enemy.alertState==='investigate').length,responseEnemies:enemies.filter(enemy=>enemy.responsePlatoonId).length,patrolEnemies:enemies.filter(enemy=>enemy.patrolSquadId).length,summonedEnemies:enemies.filter(enemy=>enemy.summonedBy).length,mapSnipers:enemies.filter(enemy=>enemy.mapSniper).length,projectiles:this.projectiles.size,areas:this.areas.length,navSearches:stats.navSearches,navTimeouts:stats.navTimeouts,navCompleted:stats.navCompleted,navNodeLimits:stats.navNodeLimits,navNoPaths:stats.navNoPaths,navExpanded:stats.navExpanded,navDirects:stats.navDirects,navMs:Number(stats.navMs.toFixed(2)),enemyShots:stats.enemyShots,enemyHits:stats.enemyHits,lastEnemyHit:stats.lastEnemyHit}));
    this.perfStats={windowStartedAt:now,ticks:0,totalTickMs:0,maxTickMs:0,maxSchedulerLagMs:0,totalSteps:0,snapshots:0,navSearches:0,navTimeouts:0,navCompleted:0,navNodeLimits:0,navNoPaths:0,navExpanded:0,navDirects:0,navMs:0,enemyShots:0,enemyHits:0,lastEnemyHit:null};
  }

  simulate(dt, now) {
    for (const player of this.players.values()) {
      if (player.settlement) continue;
      if (!player.connected && player.disconnectedAt && now - player.disconnectedAt >= this.options.disconnectGraceMs) this.killPlayer(player, 'disconnect', now);
      if (player.downed && !isBeingRevived(this,player) && now >= player.downedUntil) this.killPlayer(player, 'bled_out', now);
      this.updateBoost(player,now);
      if(player.downed)player.medicalUse=null;
      if (!player.alive || player.downed || player.boarded) continue;
      if(Number.isFinite(player.inputReceivedAt)&&now-player.inputReceivedAt>INPUT_STALE_MS){player.input={moveX:0,moveZ:0,sprint:false};player.inputClientTime=null;}
      if(player.arayaDash)this.updateArayaDash(player,now);else advanceMovement(player, player.input, dt, now, this.world);
      if(player.input.sprint&&Math.hypot(player.input.moveX,player.input.moveZ)>.01&&player.stamina>0){
        const activeNoise=now<(player.noiseUntil??0)?player.noiseRadius??0:0;
        player.noisePosition={x:player.x,z:player.z};player.noiseUntil=Math.max(player.noiseUntil??0,now+250);player.noiseRadius=Math.max(activeNoise,18);
      }
      if (player.reloadEndsAt && now >= player.reloadEndsAt) this.finishReload(player);
      while (player.burstQueue.length && player.burstQueue[0].at <= now) this.resolveShot(player, player.burstQueue.shift(), now);
      this.finishRadiationMedicine(player,now);
      this.updateRadiation(player, dt, now);
    }
    this.updateProjectiles(dt, now);
    this.updateAreas(now);
    const enemyElapsed=now-this.lastEnemyTickAt;
    updateGoldenBossEvent(this,now);
    if(enemyElapsed>=ENEMY_TICK_MS||this.lastEnemyTickAt===this.startedAt){
      this.lastEnemyTickAt=now;
      this.updateEnemies(Math.min(.15,Math.max(dt,enemyElapsed/1000)),now);
    }
    if(!this.pendingInitialEnemies) updateBosses(this, now);
    this.updateExtractions(now);
    this.updateContainerSearches(now);
    updateRevives(this,now);
    if (now - this.startedAt >= this.options.raidLimitMs) for (const player of this.players.values()) if (!player.settlement) this.killPlayer(player, 'raid_timeout', now);
    if ([...this.players.values()].every((player) => player.settlement)) {
      this.db.markRaidCompleteIfSettled(this.id, now);
      this.complete = true;
    }
  }

  updateWallTimers(now) {
    for (const player of this.players.values()) {
      if (!player.settlement && !player.connected && player.disconnectedAt && now - player.disconnectedAt >= this.options.disconnectGraceMs) this.killPlayer(player, 'disconnect', now);
      if (!player.settlement && player.downed && !isBeingRevived(this,player) && now >= player.downedUntil) this.killPlayer(player, 'bled_out', now);
    }
    this.updateExtractions(now);
    this.updateContainerSearches(now);
    updateRevives(this,now);
    if (now - this.startedAt >= this.options.raidLimitMs) for (const player of this.players.values()) if (!player.settlement) this.killPlayer(player, 'raid_timeout', now);
    if ([...this.players.values()].every((player) => player.settlement)) {
      this.db.markRaidCompleteIfSettled(this.id, now);
      this.complete = true;
    }
  }

  updateRadiation(player, dt, now) {
    const zone = (this.world.radiationZones ?? []).find((candidate) => candidate.w && candidate.d ? Math.abs(player.x-candidate.x) <= candidate.w/2 && Math.abs(player.z-candidate.z) <= candidate.d/2 : distance(player, candidate) <= candidate.radius);
    player.radiation = Boolean(zone);
    if (!zone) return;
    if (player.radiationProtected || now < (player.radiationMedicineUntil??0)) return;
    player.radiationExposure += dt;
    if(dt>0)cancelRevivesFor(this,player,'radiation',now);
    player.maxHp = Math.max(zone.minMaxHp ?? 35, player.maxHp - (zone.maxHpPerSecond ?? 0.35) * dt);
    player.hp = Math.min(player.maxHp, player.hp - (zone.hpPerSecond ?? 2) * dt);
    if (player.hp <= 0) this.killPlayer(player, 'radiation', now);
  }

  updateAreas(now) {
    for(const enemy of [...this.enemies.values()]){
      /* BC103 INCENDIARY 5-TICK DOT */
      const burn=enemy.burn;

      if(burn){
        if(
          now>=burn.nextAt &&
          (burn.ticksRemaining??0)>0 &&
          burn.nextAt<=burn.expiresAt
        ){
          burn.nextAt+=500;
          burn.ticksRemaining=
            Math.max(
              0,
              Number(burn.ticksRemaining||0)-1
            );

          this.damageEnemy(
            this.players.get(burn.ownerId),
            enemy,
            Number(burn.tickDamage)||3,
            'ammo-incendiary'
          );
        }

        if(
          (burn.ticksRemaining??0)<=0 ||
          now>=burn.expiresAt
        ){
          delete enemy.burn;
        }
      }

      if(enemy.hp<=0)continue;

      /* BC103 KARAMBIT BURN
         50 DPS per stack / max 3 / four-second refresh.
         VFX does not change with stack count.
      */
      const karambitBurn=enemy.karambitBurn;

      if(karambitBurn){
        if(
          now>=karambitBurn.nextAt &&
          (karambitBurn.ticksRemaining??0)>0 &&
          karambitBurn.nextAt<=karambitBurn.expiresAt
        ){
          karambitBurn.nextAt+=1000;
          karambitBurn.ticksRemaining=
            Math.max(
              0,
              Number(karambitBurn.ticksRemaining||0)-1
            );

          const owner=
            this.players.get(
              karambitBurn.ownerId
            )??null;

          const stacks=
            Math.max(
              1,
              Math.min(
                3,
                Number(karambitBurn.stacks)||1
              )
            );

          this.damageEnemy(
            owner,
            enemy,
            50*stacks,
            'legend-karambit-burn'
          );

          this.healLegendKill68(
            owner,
            enemy,
            'legend-karambit'
          );
        }

        if(
          (karambitBurn.ticksRemaining??0)<=0 ||
          now>=karambitBurn.expiresAt
        ){
          delete enemy.karambitBurn;
        }
      }
    }
    for (const area of this.areas) {
      if (area.kind === 'fire' && now >= (area.nextDamageAt ?? 0)) {
        area.nextDamageAt = now + 500;
        const owner = this.players.get(area.ownerId);
        for (const enemy of [...this.enemies.values()]) if (distance(area, enemy) <= area.radius && rayAabbDistanceToPoint(this.world,area,enemy)) this.damageEnemy(owner, enemy, 7.5, 'fire');
      }
    }
    this.areas = this.areas.filter((area) => now < area.expiresAt);
  }

  blocked(position) {
    return movementBlocked(this.world,position.x,position.z);
  }

  updateEnemies(dt, now) {
    /* BC ARAYA BURN 62 */
    for(const enemy of this.enemies.values()){
      /* BC ARAYA EFFECTIVE CAP 68 */
      if(
        Number.isFinite(
          enemy.arayaEffectiveMaxHp
        )
      ){
        if(
          Number.isFinite(
            enemy.arayaBaseMaxHp
          )
        ){
          enemy.maxHp=
            enemy.arayaBaseMaxHp;
        }

        enemy.hp=
          Math.min(
            enemy.hp,
            Math.max(
              0,
              enemy.arayaEffectiveMaxHp
            )
          );
      }

      const stacks=Number(enemy.arayaBurnStacks)||0;

      if(stacks<=0 || enemy.hp<=0)continue;

      enemy.arayaBurnCarry=
        (enemy.arayaBurnCarry??0)+
        stacks*30*Math.max(0,dt);

      const damage=Math.floor(enemy.arayaBurnCarry);

      if(damage<=0)continue;

      enemy.arayaBurnCarry-=damage;

      const owner=this.players.get(enemy.arayaBurnOwnerId)??null;

      this.damageEnemy(owner,enemy,damage,'legend-araya');
      this.healArayaKill67(owner,enemy);
    }


    if(this.pendingInitialEnemies){
      if(now < this.initialEnemySpawnAt) return;

      for(const [id,enemy] of this.pendingInitialEnemies){
        this.enemies.set(id,enemy);
      }

      this.pendingInitialEnemies=null;
    }

    updateMajorResponseTracking(this,now,dt);
    updateSquadPatrolEvent(this, now);
    const deadlineNs=process.hrtime.bigint()+6000000n;
    const navigationBudget={remaining:2,deadlineNs,searches:0,timeouts:0,spentMs:0},patrolBudget={remaining:2,deadlineNs,searches:0,timeouts:0,spentMs:0},enemies=[...this.enemies.values()];
    const activePlayers=[...this.players.values()].filter(player=>player.alive&&!player.downed&&!player.boarded&&!player.settlement);
    const activeEnemies=[];
    const offset=enemies.length?(this.enemyUpdateCursor??0)%enemies.length:0;
    this.enemyUpdateCursor=offset+1;
    for(let index=0;index<enemies.length;index++){
      const enemy=enemies[(index+offset)%enemies.length];
      if(isVirtualResponseEnemy(enemy))continue;
      const preLeashGoal=enemyLeashGoal(enemy);
      if(!enemy.responsePlatoonId&&!preLeashGoal&&!activePlayers.some(player=>distance(enemy,player)<=AI_ACTIVE_RADIUS)){enemy.targetId=null;continue;}
      activeEnemies.push(enemy);
      if(!enemy.weaponId)equipEnemy(this,enemy,{kind:enemy.kind});
      updateEnemyStamina(enemy,dt,now);
      initializeEnemyPatrol(enemy);
      if(now<enemy.stunnedUntil){updateEnemyActions(this,enemy,now);continue;}
      const perceived=perceiveEnemy(this.world,this.areas,enemy,this.players,now),target=perceived.target,point=perceived.point;
      const leashGoal=enemyLeashGoal(enemy,target??point??null);
      if(leashGoal){
        enemy.targetId=target?.id??null;
        updateEnemyActions(this,enemy,now,{hasTarget:true});
        if(target){faceEnemyTarget(enemy,target);if(distance(enemy,target)<=enemy.rangedRange)fireEnemyProjectile(this,enemy,target,now);}
        queueEnemyReload(this,enemy,now);
        enemy.alertState='returning';
        if(distance(enemy,leashGoal)>1.25)advanceEnemyNavigation(this.world,enemy,leashGoal,dt,now,navigationBudget,{speedMultiplier:1});
        continue;
      }
      enemy.targetId=target?.id??null;
      updateEnemyActions(this,enemy,now,{hasTarget:!!target});
      if(target)faceEnemyTarget(enemy,target);
      if(point&&perceived.observed){alertSquadPatrol(this,enemy,point,now);alertMajorResponse(this,enemy,point,target?.id,now);}
      if(!point){
        if(enemy.healEndsAt)continue;
        if(!advanceMajorResponse(this,enemy,dt,now,patrolBudget)&&!advanceSquadPatrol(this,enemy,dt,now,patrolBudget))advanceEnemyPatrol(this.world,enemy,dt,now,patrolBudget);
        continue;
      }
      if(!target){
        if(enemy.healEndsAt)continue;
        if(!advanceMajorResponse(this,enemy,dt,now,navigationBudget)&&!advanceSquadPatrol(this,enemy,dt,now,navigationBudget))advanceEnemyNavigation(this.world,enemy,point,dt,now,navigationBudget,{speedMultiplier:1.12});
        continue;
      }
      const tactic=tacticalGoal(this,enemy,target,now),combatSpeed=enemyCombatMoveSpeed(this,enemy,now);
      const canShoot=distance(enemy,target)<=enemy.rangedRange&&enemyLineOfSight(this.world,this.areas,enemy,target,now);
      if(tactic.move){
        if(enemy.responsePlatoonId&&canShoot)fireEnemyProjectile(this,enemy,target,now);
        advanceEnemyNavigation(this.world,enemy,tactic.point,dt,now,navigationBudget,{speedMultiplier:1,speedOverride:combatSpeed});
      }else if(canShoot)fireEnemyProjectile(this,enemy,target,now);
      queueEnemyReload(this,enemy,now);
    }
    this.lastActiveEnemyCount=activeEnemies.length;
    this.perfStats.navSearches+=navigationBudget.searches+patrolBudget.searches;this.perfStats.navTimeouts+=navigationBudget.timeouts+patrolBudget.timeouts;this.perfStats.navCompleted+=(navigationBudget.completed??0)+(patrolBudget.completed??0);this.perfStats.navNodeLimits+=(navigationBudget.nodeLimits??0)+(patrolBudget.nodeLimits??0);this.perfStats.navNoPaths+=(navigationBudget.noPaths??0)+(patrolBudget.noPaths??0);this.perfStats.navExpanded+=(navigationBudget.expanded??0)+(patrolBudget.expanded??0);this.perfStats.navDirects+=(navigationBudget.directs??0)+(patrolBudget.directs??0);this.perfStats.navMs+=navigationBudget.spentMs+patrolBudget.spentMs;
    separateEnemies(this,activeEnemies);
  }
  updateEnemyGunfire(now) {
    for(const enemy of this.enemies.values()){
      if(
       !enemy.weaponId ||
       enemy.hp<=0 ||
       isVirtualResponseEnemy(enemy)
      )continue;

      const target=
       this.players.get(enemy.targetId);

      const canShoot=
       !!target &&
       target.alive &&
       !target.downed &&
       !target.boarded &&
       !target.settlement &&
       distance(enemy,target)<=enemy.rangedRange &&
       enemyLineOfSight(
        this.world,
        this.areas,
        enemy,
        target,
        now
       );

      if(!canShoot){
       /*
        가려진 동안 발사 시각을 수 초씩 적립했다가
        한 프레임에 몰아쏘는 것 방지.
       */
       enemy.burstShotsRemaining=0;
       enemy.nextBurstShotAt=0;
       enemy.nextAttackAt=
        Math.max(
         enemy.nextAttackAt??0,
         now
        );
       continue;
      }

      /*
       simulation tick보다 빠른 총기는
       간혹 한 tick에서 2발을 처리해서
       장기 평균 cadence를 정확히 유지한다.
      */
      let guard=0;

      while(guard++<4){
       const due=
        (enemy.burstShotsRemaining??0)>0
         ?(enemy.nextBurstShotAt??Infinity)
         :(enemy.nextAttackAt??0);

       if(due>now)break;

       if(
        !fireEnemyProjectile(
         this,
         enemy,
         target,
         Math.max(due,now-200)
        )
       )break;
      }

      queueEnemyReload(
       this,
       enemy,
       now
      );
    }
  }

  updateProjectiles(dt, now) {
    this.updateEnemyGunfire(now);
    for(const [id,projectile] of this.projectiles){
      if(projectile.hostile&&now>(projectile.expiresAt??projectile.createdAt+2200)){this.projectiles.delete(id);continue;}
      const speed=Math.hypot(projectile.vx,projectile.vz),step=Math.min(projectile.remaining,speed*dt),origin={x:projectile.x,z:projectile.z},direction=normalize(projectile.vx,projectile.vz);
      const endpoint={x:origin.x+direction.x*step,z:origin.z+direction.z*step};
      let wallDistance=Infinity;
      for(const obstacle of segmentObstacles(this.world,origin,endpoint))wallDistance=Math.min(wallDistance,rayAabbDistance(origin,direction,obstacle,step));
      let travelled=Math.min(step,wallDistance),hit=null;
      const targets=projectile.hostile?this.players.values():this.enemies.values(),radiusSquared=projectile.hostile ? .55*.55 : .49;
      for(const candidate of targets){
        if(!projectile.hostile&&isVirtualResponseEnemy(candidate))continue;
        if(projectile.hostile&&(!candidate.alive||candidate.downed||candidate.boarded||candidate.settlement))continue;
        const dx=candidate.x-origin.x,dz=candidate.z-origin.z,projection=dx*direction.x+dz*direction.z,perpendicular=dx*dx+dz*dz-projection*projection;
        if(projection<0||perpendicular>radiusSquared)continue;
        const entry=Math.max(0,projection-Math.sqrt(Math.max(0,radiusSquared-perpendicular)));
        if(entry<=travelled){travelled=entry;hit=candidate;}
      }
      projectile.x+=direction.x*travelled;projectile.z+=direction.z*travelled;projectile.remaining-=step;
      if(hit||projectile.remaining<=0||wallDistance<=step){
        const owner=this.players.get(projectile.ownerId);
        if(projectile.hostile){
          if(hit){const source=this.enemies.get(projectile.sourceEnemyId);this.perfStats.enemyHits++;this.perfStats.lastEnemyHit={sourceId:projectile.sourceEnemyId??projectile.ownerId,weaponId:projectile.weaponId,ageMs:now-projectile.createdAt,sourceDistance:source?Number(distance(source,hit).toFixed(1)):null};this.damagePlayer(hit,projectile.damage,projectile.sourceEnemyId??projectile.ownerId,now,'enemy-firearm');}
        }else if(projectile.explosive){
          if(projectile.kind==='smoke')this.areas.push({id,kind:'smoke',x:projectile.x,z:projectile.z,radius:projectile.radius,expiresAt:now+8000});
          else if(projectile.kind==='flash'){
            for(const enemy of this.enemies.values())if(!isVirtualResponseEnemy(enemy)&&!enemy.flashImmune&&distance(projectile,enemy)<=projectile.radius&&rayAabbDistanceToPoint(this.world,projectile,enemy))enemy.stunnedUntil=now+4000;
          }else{
            for(const enemy of [...this.enemies.values()]){
              const d=distance(projectile,enemy);
              if(d<=projectile.radius&&rayAabbDistanceToPoint(this.world,projectile,enemy))this.damageEnemy(owner,enemy,projectile.damage*(1-d/Math.max(projectile.radius*1.5,.01)),projectile.kind);
            }
            if(projectile.kind==='fire')this.areas.push({id,kind:'fire',ownerId:projectile.ownerId,x:projectile.x,z:projectile.z,radius:projectile.radius,expiresAt:now+6000});
          }
          this.event('explosion',{projectileId:id,kind:projectile.kind,x:projectile.x,z:projectile.z,radius:projectile.radius});
        }else if(hit)this.damageEnemy(owner,hit,projectile.damage,projectile.kind);
        this.projectiles.delete(id);
      }
      if(now-projectile.createdAt>10000)this.projectiles.delete(id);
    }
  }
  damageEnemy(player, enemy, damage, weaponId, penetrationOverride = null) {
    if(!this.enemies.has(enemy.id)||enemy.hp<=0)return;
    const weapon = this.catalog.byId.get(weaponId);

    const baseProtection=
      clamp(
       (enemy.armor??0)-
       (penetrationOverride??weapon?.penetration??0),
       0,
       .8
      );

    const protection=
      baseProtection*
      (
       1-
       clamp(
        weapon?.armorIgnore??0,
        0,
        1
       )
      );

    let adjusted=damage;
    const incomingKind=
      String(weaponId??'');

    if(
     incomingKind.includes('fire') ||
     incomingKind.includes('incendiary')
    ){
     adjusted*=
      1-(enemy.fireReduction??0);
    }

    if(
     incomingKind.includes('explos') ||
     incomingKind.includes('frag')
    ){
     adjusted*=
      1-(enemy.explosiveReduction??0);
    }

    const goldReduction=
      clamp(
       enemy.goldDamageReduction??0,
       0,
       .8
      );

    const flat=
      enemy.flatDamageReduction??0;

    const applied=
      Math.max(
       1,
       adjusted*
       (1-protection)*
       (1-goldReduction)-
       flat
      );
    enemy.hp -= applied; enemy.lastHitAt=this.now(); enemy.healEndsAt=null;
    if(player&&!['fire','ammo-incendiary'].includes(weaponId)){forceEnemyThreat(enemy,player,this.now());broadcastEnemyThreat(this,enemy,player,this.now());}
    this.event('hit', { playerId: player?.id, enemyId: enemy.id, weaponId, damage: Math.round(applied), hp: Math.max(0, enemy.hp) });
    if (enemy.hp <= 0) {
      this.enemies.delete(enemy.id);
      dropEnemyRewards(this,enemy);
      if (player) player.kills++;
      this.event('kill', { playerId: player?.id, enemyId: enemy.id, weaponId });
    }
  }

  damagePlayer(player, damage, sourceId, now, damageKind='normal') {
    /* BC LEGENDARY FIREARM GUARD 66 */
    const __bcLegendGuardBlade=
      this.heldLegendaryBlade(
        player
      );

    /*
     Enemy AI in this game is firearm-only.
     While a legendary blade is ACTIVELY HELD:
       enemy firearm damage -> 50%
     The reduced damage is then passed to the legendary shield.
    */
    if(
      __bcLegendGuardBlade &&
      damageKind==='enemy-firearm'
    ){
      damage*=.30;
    }

    /* BC LEGENDARY SHIELD ABSORB 63 */
    const __bcShieldResult=
      this.absorbLegendaryShield(
        player,
        damage,
        now
      );

    damage=__bcShieldResult.remaining;

    if(
      __bcShieldResult.absorbed>0 &&
      damage<=0
    ){
      if(player.extracting){
        player.extracting=null;

        this.event(
          'extraction_cancelled',
          {
            playerId:player.id,
            reason:'hit'
          }
        );
      }

      return;
    }

    if(player.settlement||!player.alive||!Number.isFinite(damage)||damage<=0)return;
    const cancelled=cancelExtractionOnHit(player);
    if(cancelled){const {type,...data}=cancelled;this.event(type,data);}
    cancelRevivesFor(this,player,'damage',now);
    let adjusted=damage;
    if(damageKind.includes('boss-special'))adjusted*=1-(player.bossSpecialReduction??0);
    if(damageKind.includes('fire'))adjusted*=1-(player.fireReduction??0);
    if(damageKind.includes('explosive'))adjusted*=1-(player.explosiveReduction??0);
    const flat=(player.flatDamageReduction??0)+(damageKind.includes('headshot')?(player.headshotFlatReduction??0):0);
    const sourceEnemy=
      damageKind==='enemy-firearm'
       ?this.enemies.get(sourceId)
       :null;

    const armorIgnore=
      clamp(
       sourceEnemy?.weaponArmorIgnore??0,
       0,
       1
      );

    const applied=
      Math.max(
       1,
       adjusted*
       (
        1-
        player.armorReduction*
        (1-armorIgnore)
       )-
       flat
      );
    player.hp -= applied;
    this.event('player_hit', { playerId: player.id, sourceId, damage: Math.round(applied), hp: Math.max(0, player.hp) });
    if (player.hp <= 0) {
      const livingTeammate = [...this.players.values()].some((other) => other.id !== player.id && other.alive && !other.downed && !other.boarded && other.connected && !other.settlement);
      if (this.room.mode === 'coop' && livingTeammate && !player.downed) {
        player.hp = 1; player.downed = true; player.downedUntil = now + 20_000;
        this.event('downed', { playerId: player.id, until: player.downedUntil });
      } else this.killPlayer(player, 'combat', now);
    }
  }

  updateExtractions(now) {
    for(const zone of this.extractions.values())if(zone.kind==='flare'){
      const state=flareExtractionStatus(zone,now);
      if(zone.state!==state){zone.state=state;this.event(state==='active'?'flare_activated':'flare_expired',{extractionId:zone.id,expiresAt:zone.expiresAt});}
    }
    for(const player of this.players.values()){
      if(!player.extracting||player.settlement)continue;
      const zone=this.extractions.get(player.extracting.extractionId);
      if(!player.alive||player.downed||!player.connected||!zone||distance(player,zone)>zone.radius||zone.kind==='flare'&&zone.state!=='active'){
        const extractionId=player.extracting.extractionId;player.extracting=null;
        this.event('extraction_cancelled',{playerId:player.id,extractionId,reason:zone?.state==='expired'?'expired':'interrupted'});
      }else if(now>=player.extracting.completeAt){player.extracting=null;this.settle(player,'extracted',now);}
    }
  }

  killPlayer(player, reason, now) {
    if (player.settlement) return;
    this.cancelSearch(player,'death');cancelRevivesFor(this,player,'death',now);
    player.extracting=null;
    player.hp = 0; player.alive = false; player.downed = false;
    this.event('death', { playerId: player.id, reason });
    this.settle(player, 'dead', now);
  }

  settle(player, outcome, now) {
    if(player.settlementResult)return {...player.settlementResult,applied:false};

    /*
     Extraction-only equipment never survives a raid.
     Remove it before settlement so snapshots/debrief cannot retain it either.
    */
    const raidOnlyItems=new Set([
      'signal-flare',
      'ammo-flare'
    ]);

    player.inventory=
      (player.inventory??[])
       .filter(stack=>!raidOnlyItems.has(stack.itemId));

    player.secure=
      (player.secure??[])
       .filter(stack=>!raidOnlyItems.has(stack.itemId));

    for(const [slot,itemId] of Object.entries(player.gear??{})){
      if(raidOnlyItems.has(itemId))
        player.gear[slot]=null;
    }

    if(player.reserveAmmo)
      delete player.reserveAmmo['ammo-flare'];

    for(const slot of ['primary','secondary','pistol']){
      if(player.loadedAmmo?.[slot]==='ammo-flare'){
        player.loadedAmmo[slot]=null;
        player.magazines[slot]=0;
      }

      if(player.preferredAmmo?.[slot]==='ammo-flare')
        player.preferredAmmo[slot]=null;
    }

    const returnedGear = [];
    if (outcome === 'extracted') {
      for (const itemId of Object.values(player.gear)) if (itemId) stacksAdd(returnedGear, itemId, 1);
      const remainingAmmo = { ...player.reserveAmmo };
      for (const slot of ['primary', 'secondary', 'pistol']) {
        const weapon = effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot);
        const ammoId=player.loadedAmmo?.[slot]??weapon?.ammo;
        if (ammoId) remainingAmmo[ammoId] = (remainingAmmo[ammoId] ?? 0) + (player.magazines[slot] ?? 0);
      }
      for (const [itemId, quantity] of Object.entries(remainingAmmo)) if (quantity > 0) stacksAdd(returnedGear, itemId, quantity);
    }
    const recovery = outcome === 'dead' ? recoveryLoadout(this.catalog) : { items: [], equipped: {} };
    const finalEquipped = outcome === 'extracted' ? player.gear : recovery.equipped;
    const deathBag=player.inventory.map(stack=>({...stack}));
    if(outcome==='dead'){
      const ammo={...player.reserveAmmo};
      for(const slot of ['primary','secondary','pistol']){
        const weapon=effectiveGearItem(this.catalog,player.gear,player.goldTraitLevelsBySlot,slot),ammoId=player.loadedAmmo?.[slot]??weapon?.ammo;
        if(ammoId)ammo[ammoId]=(ammo[ammoId]??0)+(player.magazines[slot]??0);
      }
      for(const [itemId,quantity] of Object.entries(ammo))if(quantity>0)stacksAdd(deathBag,itemId,quantity);
    }
    /* BC LEGENDARY DEATH PROTECT 68 */
    const __bcLegendOwned68=
      new Map();

    const __bcIsLegend68=
      itemId=>
        !!itemId &&
        (
          this.catalog.byId.get(itemId)?.legendaryBlade===true ||
          String(itemId).startsWith('legend-')
        );

    const __bcRememberLegend68=(
      itemId,
      quantity=1
    )=>{
      if(!__bcIsLegend68(itemId))
        return;

      const qty=
        Math.max(
          1,
          Number(quantity)||1
        );

      /*
       Use MAX, not SUM, to avoid double-counting an equipped
       instance that may also appear in a transient inventory list.
      */
      __bcLegendOwned68.set(
        itemId,
        Math.max(
          __bcLegendOwned68.get(itemId)??0,
          qty
        )
      );
    };

    if(outcome==='dead'){
      for(
        const stack
        of player.inventory??[]
      ){
        __bcRememberLegend68(
          stack?.itemId,
          stack?.quantity
        );
      }

      __bcRememberLegend68(
        player.gear?.melee,
        1
      );

      /*
       Settlement and corpse construction never receive legends.
      */
      for(const list of[
        returnedGear,
        deathBag
      ]){
        if(!Array.isArray(list))
          continue;

        for(
          let i=list.length-1;
          i>=0;
          i--
        ){
          if(
            __bcIsLegend68(
              list[i]?.itemId
            )
          ){
            list.splice(i,1);
          }
        }
      }

      if(
        finalEquipped?.melee &&
        __bcIsLegend68(
          finalEquipped.melee
        )
      ){
        delete finalEquipped.melee;
      }
    }

const result=this.db.settleRaidPlayer(this.id,player.id,outcome,returnedGear,outcome==='dead'?deathBag:player.inventory,player.kills,recovery.items,finalEquipped,now,player.gear);
    /* BC LEGENDARY DEATH RESTORE 68 */
    if(
      outcome==='dead' &&
      __bcLegendOwned68.size
    ){
      /* BC LEGENDARY DEATH DUP FIX 102
         DB settlement already restores a retained equipped legendary blade.
         BC68 used to add the same blade again unconditionally, creating +1
         real ownership on every retained death.

         Only restore the quantity that settlement did NOT already return.
         This keeps the BC68 death-protection rule while preventing duplicate
         inventory ownership and duplicate item_instances rows.
      */
      for(
        const [itemId,quantity]
        of __bcLegendOwned68
      ){
        const __bcAlreadyReturned102=
          (result?.lossReport?.retained??[])
           .filter(
            stack=>
             stack?.itemId===itemId &&
             stack?.source===`equipment`
           )
           .reduce(
            (sum,stack)=>
             sum+
             Math.max(
              1,
              Number(stack?.quantity)||1
             ),
            0
           );

        const __bcRestoreQty102=
          Math.max(
           0,
           quantity-
           __bcAlreadyReturned102
          );

        if(__bcRestoreQty102>0){
          this.db.addInventory(
            player.id,
            itemId,
            __bcRestoreQty102
          );
        }
      }

      this.db.syncInstances?.(
        player.id
      );

      if(result?.lossReport){
        const legendIds=
          new Set(
            __bcLegendOwned68.keys()
          );

        if(
          Array.isArray(
            result.lossReport.lost
          )
        ){
          result.lossReport.lost=
            result.lossReport.lost.filter(
              stack=>
                !legendIds.has(
                  stack?.itemId
                )
            );
        }

        result.lossReport.protected??=[];

        for(
          const [itemId,quantity]
          of __bcLegendOwned68
        ){
          if(
            !result.lossReport.protected.some(
              stack=>
                stack?.itemId===itemId
            )
          ){
            result.lossReport.protected.push({
              itemId,
              quantity,
              slot:'melee',
              groupSlot:'melee',
              source:'legendary',
              reason:'legendary'
            });
          }
        }
      }
    }



    player.settlement=result.outcome??outcome;player.alive=player.settlement==='extracted';
    player.lossReport=result.lossReport??null;player.settlementResult=result;
    const dropped=createPlayerLoot(this.id,player,result);
    if(dropped&&!this.containers.has(dropped.id)){this.containers.set(dropped.id,dropped);this.event('player_loot_dropped',{playerId:player.id,containerId:dropped.id,x:dropped.x,z:dropped.z});}
    this.event('settled',{playerId:player.id,outcome:player.settlement,applied:result.applied});
    return result;
  }

  recoveryItems() { return recoveryLoadout(this.catalog).items; }

  carriedWeight(player) {
    return player.inventory.reduce((sum, stack) => sum + stackWeight(stack,id=>this.catalog.byId.get(id)), 0)+Object.entries(player.reserveAmmo).reduce((sum,[id,quantity])=>sum+(this.catalog.byId.get(id)?.weight??0)*quantity,0);
  }

  itemValue(player) {
    const value=id=>this.catalog.byId.get(id)?.sell??0;
    const stackValue=stack=>value(stack.itemId)*(stack.quantity??0)+Object.values(stack.fittings??{}).reduce((sum,id)=>sum+value(id),0);
    const bags=[...(player.inventory??[]),...(player.secure??[])].reduce((sum,stack)=>sum+stackValue(stack),0);
    const equipment=Object.values(player.gear??{}).reduce((sum,id)=>sum+value(id),0);
    const reserve=Object.entries(player.reserveAmmo??{}).reduce((sum,[id,quantity])=>sum+value(id)*quantity,0);
    const loaded=Object.entries(player.magazines??{}).reduce((sum,[slot,quantity])=>sum+value(player.loadedAmmo?.[slot])*quantity,0);
    return Math.floor(bags+equipment+reserve+loaded);
  }

  disconnect(userId) {
    const player = this.players.get(userId);
    if (!player || player.settlement) return;
    this.cancelSearch(player,'disconnect');cancelRevivesFor(this,player,'disconnect');
    if(player.extracting){const extractionId=player.extracting.extractionId;player.extracting=null;this.event('extraction_cancelled',{playerId:player.id,extractionId,reason:'disconnect'});}
    player.connected = false; player.disconnectedAt = this.now(); player.input = { moveX: 0, moveZ: 0, sprint: false };
    this.event('teammate_disconnected', { playerId: userId, graceEndsAt: player.disconnectedAt + this.options.disconnectGraceMs });
  }

  reconnect(userId) {
    const player = this.players.get(userId);
    if (!player || player.settlement) return;
    const now = this.now();
    if (player.disconnectedAt != null && now - player.disconnectedAt >= this.options.disconnectGraceMs) {
      this.killPlayer(player, 'disconnect', now);
      return;
    }
    player.connected = true; player.disconnectedAt = null; player.lastSeq = -1;
    this.event('teammate_reconnected', { playerId: userId });
  }

  consumeInventory(player, itemId, quantity) {
    const stack = player.inventory.find((entry) => entry.itemId === itemId);
    if (!stack || stack.quantity < quantity) throw gameError('ITEM_NOT_CARRIED', 'Item is not carried');
    stack.quantity -= quantity;
    if (stack.quantity === 0) player.inventory.splice(player.inventory.indexOf(stack), 1);
    this.db.updateRaidLoot(this.id, player.id, player.inventory);
  }

  event(kind, data) {
    const message = { v: 1, type: 'event', id: ++this.eventId, kind, data };
    this.events.push({ id: message.id, kind, data });
    if (this.events.length > 100) this.events.shift();
    this.emitToSockets(message, [...this.players.keys()], true);
  }

  snapshot(now = this.now(), viewerId = null, snapshotId = ++this.snapshotId) {
    const viewer=this.players.get(viewerId);
    const visible=(kind,entity,entry=SNAPSHOT_ENTITY_ENTRY_RADIUS,exit=SNAPSHOT_ENTITY_EXIT_RADIUS)=>!viewer||visibleWithHysteresis(this.viewerVisibility,viewerId,kind,entity,distance(entity,viewer),entry,exit);
    const visiblePlayers=[...this.players.values()].filter(player=>!viewer||player.id===viewerId||visible('player',player));
    return {
      v: 1, type: 'snapshot', id: snapshotId, serverTime: now,
      raid: { id: this.id, phase: this.complete ? 'complete' : 'active', elapsedMs: now - this.startedAt },
      players: visiblePlayers.map((player) => ({
        id: player.id, username: player.username, x: player.x, z: player.z, yaw: player.yaw,
        hp: Math.max(0, player.hp), maxHp: player.maxHp, baseMaxHp: player.baseMaxHp, alive: player.alive, downed: player.downed,
        reviving:player.reviving?{targetId:player.reviving.targetId,startedAt:player.reviving.startedAt,completeAt:player.reviving.completeAt}:null,beingRevivedBy:player.beingRevivedBy??null,downedUntil:player.downedUntil??null,
        connected: player.connected, boarded: player.boarded, weaponId: player.gear[player.activeWeaponSlot] ?? null,
        attachments:weaponAttachmentsFromEquipment(player.gear)[player.activeWeaponSlot]??{}, activeWeaponSlot: player.activeWeaponSlot, ammoInMagazine: player.magazines[player.activeWeaponSlot] ?? 0, ammoId:player.loadedAmmo?.[player.activeWeaponSlot]??null,
        stamina: player.stamina, maxStamina: player.maxStamina, staminaRecoveryAt: player.staminaRecoveryAt??0, reloadEndsAt: player.reloadEndsAt,
        coldUntil: player.coldUntil ?? 0, radiation: player.radiation, radiationExposure: player.radiationExposure, radiationProtected: player.radiationProtected,
        extracting: player.extracting,
        ...(player.id === viewerId ? { movement:{clientTime:Number.isFinite(player.inputClientTime)?player.inputClientTime+Math.max(0,this.lastTickAt-player.inputTickAt):null,serverTime:this.lastTickAt,moveMultiplier:player.moveMultiplier*(player.medicalUse ? .3 : 1)/* BC_HEAL_MOVE_70_SNAPSHOT */}, legendaryShield:player.legendaryShield??0,legendaryShieldMax:player.legendaryShieldMax??0,legendaryBladeHeldId:player.legendaryBladeHeldId??null,activeSkillReadyAt:player.activeSkillReadyAt,karambitHasteUntil:player.karambitHasteUntil,arbiterPrimed:player.arbiterPrimed,arayaDash:player.arayaDash?{startedAt:player.arayaDash.startedAt,duration:player.arayaDash.duration}:null,magazines: player.magazines, loadedAmmo:player.loadedAmmo, preferredAmmo:player.preferredAmmo, reserveAmmo: player.reserveAmmo, inventory: player.inventory, secure:player.secure, secureCapacity:player.secureCapacity??SECURE_CAPACITY, medicalUse:player.alive&&!player.downed&&!player.settlement?player.medicalUse??null:null,radiationMedicineUntil:player.radiationMedicineUntil??0,boost:player.boost??0, lossReport:player.lossReport??null, equipment: player.gear, armorReduction:player.armorReduction, weaponAttachments:weaponAttachmentsFromEquipment(player.gear),weaponFittingStats:Object.fromEntries(['primary','secondary','pistol'].map(host=>[host,weaponFittingStats(player.gear,host,effectiveGearLookup(this.catalog,player.gear,player.goldTraitLevelsBySlot))])),armorAttachments:armorAttachmentsFromEquipment(player.gear), equipmentWeight:equipmentWeights(player.gear,id=>this.catalog.byId.get(id),player.activeWeaponSlot).total*(player.equipmentWeightMultiplier??1), fittedWeights:equipmentWeights(player.gear,id=>this.catalog.byId.get(id),player.activeWeaponSlot).bySlot, talentLevels: player.talentLevels, carryCapacity: player.carryCapacity, carriedWeight: this.carriedWeight(player), itemValue:this.itemValue(player), searching: player.searching } : {}),
      })),
      enemies: [...this.enemies.values()]
        .filter(enemy=>!isVirtualResponseEnemy(enemy)&&visible('enemy',enemy))
        .map(enemy=>({
          ...publicEnemySnapshot(enemy),
          /* BC103 SHARED BURN VFX STATE */
          burning:
            (Number(enemy.arayaBurnStacks)||0)>0 ||
            (
              (enemy.karambitBurn?.ticksRemaining??0)>0 &&
              (enemy.karambitBurn?.expiresAt??0)>=now
            ) ||
            (
              (enemy.burn?.ticksRemaining??0)>0 &&
              (enemy.burn?.expiresAt??0)>=now
            )
        })),
      projectiles: [...this.projectiles.values()].filter(projectile=>!viewer||distance(projectile,viewer)<=95).map(({ownerId,sourceEnemyId,hostile,weaponId,id,kind,x,z,vx,vz})=>({id,kind,ownerId,sourceEnemyId,hostile,weaponId,x,z,vx,vz})),
      loot: [...this.loot.values()].filter(item=>visible('loot',item)).map(item=>({...item})),
      containers: [...this.containers.values()].filter(container=>visible('container',container)).map(containerSnapshot),
      bossZones:this.bossZones.map(z=>({...z})),bossWarnings:this.bossWarnings.map(({damage,...w})=>w),
      entry:{...this.entry}, accessDoors:accessDoorSnapshots(this.accessDoors),
      extractions: [...this.extractions.values()].map(extraction=>({...extraction})),
      areas: this.areas.map(({ id, kind, x, z, radius, expiresAt }) => ({ id, kind, x, z, radius, expiresAt })),
      events: this.events.slice(-20),
    };
  }

  broadcastSnapshot(now) {
    this.lastSnapshotAt = now;
    const snapshotId = ++this.snapshotId;
    for (const playerId of this.players.keys()) {
      this.emitToSockets(this.snapshot(now, playerId, snapshotId), [playerId]);
    }
  }
}

export function recoveryLoadout(catalog) {
  const normalized = catalog.byId ? catalog : normalizeCatalog(catalog);
  const firearm = normalized.items
    .filter((item) => item.category === 'weapon' && item.ammo && item.purchasable!==false && item.quality!=='gold' && !['flare', 'melee'].includes(item.mode))
    .sort((a, b) => a.price - b.price)[0];
  if (!firearm) return { items: [], equipped: {} };
  const ammo = normalized.byId.get(firearm.ammo);
  const items = [
    { itemId: firearm.id, quantity: 1 },
    { itemId: firearm.ammo, quantity: Math.max(firearm.magazine ?? 1, ammo?.packSize ?? 1) },
  ];
  const equipped = { [isPistolWeapon(firearm)?'pistol':'primary']: firearm.id };
  if (normalized.byId.has('bandage')) {
    items.push({ itemId: 'bandage', quantity: 1 });

  }
  return { items, equipped };
}

export function normalizeCatalog(catalog) {
  const items = catalog.items ?? catalog.ITEMS ?? [];
  const talents = catalog.talents ?? catalog.TALENTS ?? [];
  return { items, talents, byId: new Map([...items.map((item) => [item.id, item]),...LEGACY_GOLD_COMPAT.map((item) => [item.id, item]),...legacyFabricAliases(items),...legacyGoldEquipmentAliases(items)]) };
}

export function expectedSlot(item) {
  if (!item) return null;
  if (item.slot) return item.slot;
  if (item.category === 'armor' || item.category === 'helmet' || item.category === 'backpack' || item.category === 'medical' || item.category === 'throwable') return item.category;
  if (item.family === 'flare') return 'flare';
  if (item.category === 'weapon') return item.family === 'melee' || item.mode === 'melee' ? 'melee' : null;
  return null;
}

export function isValidSlot(slot) { return SLOT_SET.has(slot); }
export function gameError(code, message) { return Object.assign(new Error(message), { code }); }


