import {resetSnapshotWire} from './snapshotWire.js';
import {isDirectShopItem} from '../shared/shopAvailability.ts';
import {weaponFitsSlot} from '../shared/weaponSlots.ts';
import {talentBonus,talentUpgradeCost} from '../shared/talents.ts';
import { createServer as createHttpServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import { GameDatabase } from './db.js';
import { rollSupply, SUPPLY_PACKS } from './loot.js';
import { authenticate, clearSessionCookie, hashPassword, issueSession, parseCookies, SESSION_COOKIE, sessionCookie, tokenHash, validPassword, validUsername, verifyPassword } from './auth.js';
import { expectedSlot, gameError, isValidSlot, normalizeCatalog, recoveryLoadout, RoomManager } from './game.js';

const BASE = '/games/penguin-extraction';
const EQUIP_SLOTS = new Set(['primary', 'secondary', 'pistol', 'melee', 'armor', 'helmet', 'backpack', 'medical', 'throwable', 'flare', 'scope', 'barrel', 'magazine', 'grip', 'vest']);

export function createGameServer({ dbPath = 'data/penguin-extraction.sqlite', catalog, world, now = () => Date.now(), raidOptions = {}, lossRandom=Math.random, bagLossChance=1, upgradeRandom=Math.random, recover = true, staticDir = null, allowedOrigins = ['http://127.0.0.1:5189', 'http://localhost:5189', 'http://127.0.0.1:10000', 'http://localhost:10000'], trustProxy = false, rateLimitMax = 180 } = {}) {
  if (!catalog || !world) throw new Error('catalog and world are required');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new GameDatabase(dbPath,{lossRandom,bagLossChance,upgradeRandom});
  db.retireLegacyRadiationEquipment();
  db.retireDurabilityGoldWeapons();
  const normalizedCatalog = normalizeCatalog(catalog);
  db.instanceCatalog=normalizedCatalog.byId;
  const manager = new RoomManager({ db, catalog: normalizedCatalog, world, now, raidOptions });
  const recovery = recoveryLoadout(normalizedCatalog);
  const recoveredRaids = recover ? db.recoverActiveRaids(now(), recovery.items, recovery.equipped) : 0;
  db.migratePackedConsumables();
  const originSet = new Set(allowedOrigins);
  const rateLimits = new Map();

  const server = createHttpServer(async (request, response) => {
    try {
      setSecurityHeaders(response);
      if (await serveStatic(request, response, staticDir)) return;
      if (!allowRequest(rateLimits, request.socket.remoteAddress ?? 'local', now(), rateLimitMax)) return sendError(response, 429, 'RATE_LIMITED', 'Too many requests');
      if (request.method !== 'GET' && request.method !== 'HEAD' && !originAllowed(request, originSet)) return sendError(response, 403, 'ORIGIN_DENIED', 'Origin is not allowed');
      await route(request, response, { db, manager, catalog: normalizedCatalog, now, trustProxy });
    } catch (error) {
      const status = statusFor(error.code);
      sendError(response, status, error.code ?? 'INTERNAL', status === 500 ? 'Internal server error' : error.message);
    }
  });

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: {
      threshold: 1024,
      concurrencyLimit: 4,
      zlibDeflateOptions: { level: 3 },
      zlibInflateOptions: { chunkSize: 10 * 1024 },
    },
  });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== `${BASE}/ws`) { socket.destroy(); return; }
    if (!originAllowed(request, originSet)) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    if (wss.clients.size >= 500) { socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    const user = authenticate(db, request, now());
    if (!user) { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request, user));
  });

  wss.on('connection', (ws, _request, user) => {
    let greeted = false;
    ws.sessionExpiresAt = user.expires_at;
    let lastSeq = -1;
    ws.isAlive = true;
    ws.transportStats={messagesIn:0,rawBytesIn:0,messagesOut:0,rawBytesOut:0,skippedSnapshots:0,skippedMessages:0};
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw, binary) => {
      try {
        if (binary) throw gameError('INVALID_MESSAGE', 'Binary messages are not supported');
        ws.transportStats.messagesIn++;
        ws.transportStats.rawBytesIn+=raw.length;
        const message = JSON.parse(raw.toString());
        if (!message || message.v !== 1 || typeof message.type !== 'string' || !Number.isSafeInteger(message.seq) || message.seq <= lastSeq) throw gameError('INVALID_MESSAGE', 'Expected version 1 and an increasing integer sequence');
        lastSeq = message.seq;
        if (!greeted) {
          if (message.type !== 'hello') throw gameError('HELLO_REQUIRED', 'The first message must be hello');
          greeted = true;
          ws.snapshotStaticV1 = message.snapshotStaticV1 === true;
          const room = manager.attachSocket(user, ws);
          const raid = room?.raidId ? manager.raids.get(room.raidId) : null;
          ws.send(JSON.stringify({ v: 1, type: 'welcome', playerId: user.id, room: room ? manager.roomView(room) : null, raid: raid ? raid.snapshot(now(), user.id) : null, serverTime: now(), tickHz: 20, snapshotHz: 10 }));
          return;
        }
        if (message.type === 'snapshot_resync') { resetSnapshotWire(ws); return; }
        if (message.type === 'ping') {
          if (!Number.isFinite(message.clientTime)) throw gameError('INVALID_MESSAGE', 'clientTime must be finite');
          ws.send(JSON.stringify({ v: 1, type: 'pong', clientTime: message.clientTime, serverTime: now() }));
          return;
        }
        manager.handleCommand(user.id, message);
      } catch (error) {
        ws.send(JSON.stringify({ v: 1, type: 'error', seq: Number.isSafeInteger(lastSeq) ? lastSeq : undefined, code: error.code ?? 'INVALID_MESSAGE', message: error.message ?? 'Invalid message' }));
      }
    });
    ws.on('close', () => { if (greeted) manager.detachSocket(user.id, ws); });
  });

  const tickTimer = setInterval(() => manager.tick(now()), 50);
  tickTimer.unref?.();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (now() >= ws.sessionExpiresAt) { ws.close(4003, 'Session expired'); continue; }
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false; ws.ping();
    }
  }, 15_000);
  heartbeat.unref?.();
  const transportLog=setInterval(()=>{
    if(!wss.clients.size)return;
    let messagesIn=0,rawBytesIn=0,messagesOut=0,rawBytesOut=0,skippedSnapshots=0,skippedMessages=0,maxBuffered=0;
    for(const ws of wss.clients){
      const stats=ws.transportStats??{};
      messagesIn+=stats.messagesIn??0;rawBytesIn+=stats.rawBytesIn??0;messagesOut+=stats.messagesOut??0;rawBytesOut+=stats.rawBytesOut??0;
      skippedSnapshots+=stats.skippedSnapshots??0;skippedMessages+=stats.skippedMessages??0;maxBuffered=Math.max(maxBuffered,ws.bufferedAmount??0);
      if(ws.transportStats)Object.assign(ws.transportStats,{messagesIn:0,rawBytesIn:0,messagesOut:0,rawBytesOut:0,skippedSnapshots:0,skippedMessages:0});
    }
    console.info('[ws-perf] '+JSON.stringify({clients:wss.clients.size,messagesIn,rawBytesIn,messagesOut,rawBytesOut,skippedSnapshots,skippedMessages,maxBuffered}));
  },5000);
  transportLog.unref?.();

  return {
    server, wss, db, manager, recoveredRaids,
    listen(port = 18090, host = '127.0.0.1') { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(server.address()); }); }); },
    async close() {
      clearInterval(tickTimer); clearInterval(heartbeat); clearInterval(transportLog);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      db.close();
    },
  };
}

async function route(request, response, context) {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname;
  if (request.method === 'GET' && path === '/api/health') return send(response, 200, { ok: true, tickHz: 20, snapshotHz: 10 });

  if (request.method === 'POST' && path === '/api/auth/register') {
    const body = await readJson(request);
    if (!validUsername(body.username) || !validPassword(body.password)) throw gameError('INVALID_CREDENTIALS', 'Username must be 3-20 safe characters and password 8-128 characters');
    if (context.db.getUserByUsername(body.username)) throw gameError('USERNAME_TAKEN', 'Username is already registered');
    const { salt, hash } = await hashPassword(body.password);
    const starter = starterLoadout(context.catalog);
    let user;
    try { user = context.db.createUser(body.username, salt, hash, starter.items, starter.equipped, starter.packed); }
    catch (error) { if (String(error.message).includes('UNIQUE')) throw gameError('USERNAME_TAKEN', 'Username is already registered'); throw error; }
    const token = issueSession(context.db, user.id, context.now());
    response.setHeader('Set-Cookie', sessionCookie(token, isSecure(request, context.trustProxy)));
    return send(response, 201, { ok: true, user: publicUser(user), profile: profileView(context.db.profile(user.id)) });
  }

  if (request.method === 'POST' && path === '/api/auth/login') {
    const body = await readJson(request);
    const record = typeof body.username === 'string' ? context.db.getUserByUsername(body.username) : null;
    const valid = record && validPassword(body.password) && await verifyPassword(body.password, record.password_salt, record.password_hash);
    if (!valid) throw gameError('BAD_LOGIN', 'Username or password is incorrect');
    const prior = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    if (prior) context.db.deleteSession(tokenHash(prior));
    const token = issueSession(context.db, record.id, context.now());
    response.setHeader('Set-Cookie', sessionCookie(token, isSecure(request, context.trustProxy)));
    return send(response, 200, { ok: true, user: publicUser(record), profile: profileView(context.db.profile(record.id)) });
  }

  if (request.method === 'POST' && path === '/api/auth/logout') {
    const prior = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const active = prior ? context.db.getSession(tokenHash(prior), context.now()) : null;
    if (prior) context.db.deleteSession(tokenHash(prior));
    if (active) {
      for (const ws of context.manager.sockets.get(active.id) ?? []) ws.close(4003, 'Signed out');
    }
    response.setHeader('Set-Cookie', clearSessionCookie(isSecure(request, context.trustProxy)));
    return send(response, 200, { ok: true });
  }

  const user = authenticate(context.db, request, context.now());
  if (!user) throw gameError('UNAUTHENTICATED', 'Sign in required');
  if (request.method === 'GET' && path === '/api/me') return send(response, 200, { ok: true, user: publicUser(user), profile: profileView(context.db.profile(user.id)) });
  const resultRoute=path.match(/^\/api\/raids\/([^/]+)\/result$/);
  if(request.method==='GET'&&resultRoute){
    const result=context.db.getRaidSettlement(resultRoute[1],user.id);
    if(!result)return sendError(response,404,'NOT_FOUND','Raid result not found');
    return send(response,200,{ok:true,result});
  }
  if (request.method === 'GET' && path === '/api/catalog') return send(response, 200, { ok: true, items: context.catalog.items, talents: context.catalog.talents });

  if (request.method === 'POST' && path === '/api/shop/buy') {
    const body = await readJson(request);
    const quantity = boundedInteger(body.quantity, 1, 20);
    const item = context.catalog.byId.get(body.itemId);
    if (!item || !Number.isSafeInteger(item.price) || item.price < 0) throw gameError('ITEM_NOT_FOUND', 'Unknown shop item');
    if (item.id === 'ammo-flare' || item.baseId === 'ammo-flare' || item.id === 'signal-flare' || item.baseId === 'signal-flare' || item.mode === 'flare') throw gameError('NOT_FOR_SALE', '철수 플레어건은 원정 맵 드롭으로만 획득할 수 있습니다.');
    if (!isDirectShopItem(item)) throw gameError('NOT_FOR_SALE', '희귀 획득 전용 장비는 직접 구매할 수 없습니다.');
    const units = item.category === 'ammo' ? quantity * (item.packSize ?? 1) : quantity;
    const profile = context.db.purchase(user.id, item.id, units, item.price * units);
    return send(response, 200, { ok: true, purchased: { itemId: item.id, units }, profile: profileView(profile) });
  }

  if (request.method === 'POST' && path === '/api/shop/crate') {
    const body = await readJson(request);
    if (!Object.hasOwn(SUPPLY_PACKS, body.kind)) throw gameError('INVALID_PACK', '보급 상자를 선택하세요.');
    const pack = SUPPLY_PACKS[body.kind];
    const item = rollSupply(context.catalog.items, body.kind);
    const profile = context.db.purchase(user.id, item.id, 1, pack.price);
    return send(response, 200, { ok: true, reward: { itemId: item.id, quantity: 1 }, profile: profileView(profile) });
  }

  if (request.method === 'POST' && path === '/api/shop/sell') {
    const body = await readJson(request);
    const quantity = boundedInteger(body.quantity, 1, 1000);
    const item = context.catalog.byId.get(body.itemId);
    if (!item) throw gameError('ITEM_NOT_FOUND', 'Unknown item');
    const multiplier = talentEffect(context, user.id, 'sell');
    const profile = context.db.sell(user.id, item.id, quantity, Math.floor(item.sell * quantity * (1 + multiplier)),body.instanceId??null,{includeFittings:body.includeFittings===true,catalog:context.catalog,multiplier});
    return send(response, 200, { ok: true, profile: profileView(profile) });
  }

  if(request.method==='POST'&&path==='/api/gold/dismantle'){
    const body=await readJson(request),profile=context.db.dismantleGold(user.id,body.itemId,body.instanceId,context.catalog);
    return send(response,200,{ok:true,profile:profileView(profile)});
  }
  if(request.method==='POST'&&path==='/api/gold/upgrade'){
    const body=await readJson(request),result=context.db.upgradeGold(user.id,body.itemId,body.instanceId,context.catalog);
    return send(response,200,{ok:true,...result,profile:profileView(result.profile)});
  }
  if(request.method==='POST'&&path==='/api/shop/sell-collectibles'){
    const multiplier=talentEffect(context,user.id,'sell'),result=context.db.sellCollectibles(user.id,context.catalog,multiplier);
    return send(response,200,{ok:true,...result,profile:profileView(result.profile)});
  }

  if(request.method==='POST'&&path==='/api/loadout/secure'){
    const body=await readJson(request);const profile=context.db.secure(user.id,body.itemId,body.quantity,context.catalog);
    return send(response,200,{ok:true,profile:profileView(profile)});
  }
  if (request.method === 'POST' && path === '/api/loadout/pack') {
    const body=await readJson(request);
    const profile=context.db.pack(user.id,body.itemId,body.quantity,context.catalog);
    return send(response,200,{ok:true,profile:profileView(profile)});
  }

  if (request.method === 'POST' && path === '/api/loadout/equip') {
    const body = await readJson(request);
    if (!EQUIP_SLOTS.has(body.slot)) throw gameError('INVALID_SLOT', 'Unknown equipment slot');
    const item = body.itemId === null ? null : context.catalog.byId.get(body.itemId);
    if (body.itemId !== null && !item) throw gameError('ITEM_NOT_FOUND', 'Unknown item');
    if (item && !compatibleSlot(item, body.slot)) throw gameError('INCOMPATIBLE_SLOT', 'Item cannot be equipped in that slot');
    if(['medical','throwable'].includes(body.slot))throw gameError('PACK_REQUIRED','의료품과 투척물은 가방에 수량을 지정해 적재하세요.');
    let storedSlot=body.slot;
    if(['scope','barrel','grip','magazine'].includes(body.slot)){
      const weaponSlot=body.weaponSlot??'primary';
      if(!['primary','secondary','pistol'].includes(weaponSlot))throw gameError('INVALID_WEAPON_SLOT','Unknown weapon slot');
      storedSlot=`${weaponSlot}:${body.slot}`;
    }else if(body.weaponSlot!==undefined)throw gameError('INVALID_WEAPON_SLOT','weaponSlot is only valid for firearm attachments');
    if(body.slot==='vest'){const index=body.armorSlot??0;if(!Number.isSafeInteger(index)||index<0||index>2)throw gameError('INVALID_SLOT','Unknown armor attachment slot');storedSlot=`armor:${index}`;}else if(body.armorSlot!==undefined)throw gameError('INVALID_SLOT','armorSlot is only valid for armor attachments');
    const profile=context.db.equip(user.id,storedSlot,body.itemId,context.catalog,body.instanceId??null,body.hostInstanceId??null);
    return send(response, 200, { ok: true, profile: profileView(profile) });
  }

  if (request.method === 'POST' && path === '/api/talents/unlock') {
    const body = await readJson(request);
    const talent = context.catalog.talents.find((candidate) => candidate.id === body.talentId);
    if (!talent) throw gameError('TALENT_NOT_FOUND', 'Unknown talent');
    const profile = context.db.profile(user.id);
    const current = profile.talents.find((entry) => entry.talentId === talent.id)?.level ?? 0;
    if (current >= talent.maxLevel) throw gameError('TALENT_MAXED', 'Talent is already at maximum level');
    if (talent.prerequisite && !profile.talents.some((entry) => entry.talentId === talent.prerequisite)) throw gameError('TALENT_PREREQUISITE', 'Talent prerequisite is not unlocked');
    const updated = context.db.unlockTalent(user.id, talent.id, current + 1, talentUpgradeCost(talent,current));
    return send(response, 200, { ok: true, profile: profileView(updated) });
  }

  if (request.method === 'GET' && path === '/api/rooms') return send(response, 200, { ok: true, rooms: context.manager.listRooms() });
  if (request.method === 'GET' && path === '/api/rooms/current') return send(response, 200, { ok: true, ...context.manager.current(user.id) });
  if (request.method === 'POST' && path === '/api/rooms') {
    const body = await readJson(request);
    return send(response, 201, { ok: true, room: context.manager.createRoom(user, body.mode) });
  }
  if (request.method === 'POST' && path === '/api/rooms/join') {
    const body = await readJson(request);
    if (typeof body.code !== 'string' || !/^[A-Za-z0-9]{6}$/.test(body.code)) throw gameError('INVALID_CODE', 'Invite code must have six characters');
    return send(response, 200, { ok: true, room: context.manager.joinRoom(user, body.code) });
  }
  if (request.method === 'POST' && path === '/api/rooms/leave') { context.manager.leaveRoom(user.id); return send(response, 200, { ok: true }); }
  if (request.method === 'POST' && path === '/api/rooms/start') return send(response, 200, { ok: true, raidId: context.manager.startRoom(user.id) });

  sendError(response, 404, 'NOT_FOUND', 'Route not found');
}

function compatibleSlot(item, slot) {
  if (item.category === 'weapon') {
    if (item.family === 'flare' || item.mode === 'flare') return slot === 'flare';
    if (item.family?.toLowerCase() === 'melee' || item.mode === 'melee') return slot === 'melee';
    return weaponFitsSlot(item,slot);
  }
  if (item.category === 'attachment') return item.slot === slot;
  return expectedSlot(item) === slot;
}

function starterLoadout(catalog) {
  const desired = [['m416-repaired', 1], ['p92-repaired', 1], ['sickle', 1], ['armor-1', 1], ['helmet-1', 1], ['backpack-1', 1], ['bandage', 3], ['first-aid', 1], ['ammo-556', 120], ['ammo-9', 60]];
  const items = desired.filter(([itemId]) => catalog.byId.has(itemId)).map(([itemId, quantity]) => ({ itemId, quantity }));
  const equipped = {
    primary: catalog.byId.has('m416-repaired') ? 'm416-repaired' : null,
    pistol: catalog.byId.has('p92-repaired') ? 'p92-repaired' : null,
    melee: catalog.byId.has('sickle') ? 'sickle' : null,
    armor: catalog.byId.has('armor-1') ? 'armor-1' : null,
    helmet: catalog.byId.has('helmet-1') ? 'helmet-1' : null,
    backpack: catalog.byId.has('backpack-1') ? 'backpack-1' : null,
    medical: null,
    flare: null,
  };
  const packed=[['ammo-556',90],['ammo-9',30],['bandage',3],['first-aid',1]].filter(([id])=>catalog.byId.has(id)).map(([itemId,quantity])=>({itemId,quantity}));
  return { items, equipped, packed };
}

function profileView(profile) {
  const talentLevels = Object.fromEntries((profile?.talents ?? []).map((entry) => [entry.talentId, entry.level]));
  return { ...profile, talents: profile?.talents ?? [], talentLevels };
}

function talentEffect(context, userId, effect) {
  const levels = profileView(context.db.profile(userId)).talentLevels;
  return context.catalog.talents.filter((talent) => talent.effect === effect).reduce((sum, talent) => sum + talentBonus(talent,levels[talent.id]??0), 0);
}

async function serveStatic(request, response, staticDir) {
  if (!staticDir) return false;
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/') {
    response.writeHead(302, { location: `${BASE}/` });
    response.end();
    return true;
  }
  if (!url.pathname.startsWith(`${BASE}/`) && url.pathname !== BASE) return false;
  if (url.pathname.startsWith(`${BASE}/api/`) || url.pathname === `${BASE}/ws`) return false;
  let relative;
  try { relative = decodeURIComponent(url.pathname.slice(BASE.length + 1)); }
  catch { sendError(response, 400, 'INVALID_PATH', 'Invalid path encoding'); return true; }
  if (!relative || url.pathname === BASE) relative = 'index.html';
  const root = resolve(staticDir);
  let filePath = resolve(root, relative);
  if (filePath !== root && !filePath.startsWith(root + sep)) { sendError(response, 403, 'PATH_DENIED', 'Path is outside the game build'); return true; }
  let data;
  try { data = await readFile(filePath); }
  catch {
    if (extname(relative)) return false;
    filePath = resolve(root, 'index.html');
    try { data = await readFile(filePath); } catch { return false; }
  }
  const extension = extname(filePath).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
  const contentType = types[extension] ?? 'application/octet-stream';
  response.writeHead(200, { 'content-type': contentType, 'content-length': data.length, 'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
  response.end(request.method === 'HEAD' ? undefined : data);
  return true;
}

async function readJson(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32 * 1024) throw gameError('BODY_TOO_LARGE', 'Request body is too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw gameError('INVALID_JSON', 'Request body must be valid JSON'); }
}

function send(response, status, body) {
  if (response.writableEnded) return;
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), 'cache-control': 'no-store' });
  response.end(payload);
}

function sendError(response, status, code, message) { send(response, status, { ok: false, error: { code, message } }); }
function publicUser(user) { return { id: user.id, username: user.username }; }
function boundedInteger(value, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw gameError('INVALID_QUANTITY', `Quantity must be ${min}-${max}`); return value; }
function isSecure(request, trustProxy) { return request.socket.encrypted === true || (trustProxy && request.headers['x-forwarded-proto'] === 'https'); }
function originAllowed(request, origins) { const origin = request.headers.origin; return !origin || origins.has(origin); }
function setSecurityHeaders(response) { response.setHeader('x-content-type-options', 'nosniff'); response.setHeader('referrer-policy', 'same-origin'); response.setHeader('cross-origin-resource-policy', 'same-origin'); }
function allowRequest(map, key, now, maximum=180) { const state = map.get(key); if (!state || now - state.startedAt >= 60_000) { map.set(key, { startedAt: now, count: 1 }); return true; } state.count++; return state.count <= maximum; }
function statusFor(code) {
  if (code === 'UNAUTHENTICATED' || code === 'BAD_LOGIN') return 401;
  if (code === 'LEADER_ONLY') return 403;
  if (['ROOM_NOT_FOUND', 'ITEM_NOT_FOUND', 'TALENT_NOT_FOUND', 'NOT_FOUND'].includes(code)) return 404;
  if (['USERNAME_TAKEN', 'INSUFFICIENT_CURRENCY', 'INSUFFICIENT_ITEMS', 'ITEM_NOT_OWNED', 'ROOM_FULL', 'ROOM_STATE', 'RAID_ACTIVE', 'MEMBER_OFFLINE', 'TALENT_MAXED', 'TALENT_PREREQUISITE'].includes(code)) return 409;
  if (!code || code === 'INTERNAL') return 500;
  return 400;
}
