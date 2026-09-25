// Server-authoritative entry selection and temporary extraction lifecycle.

const FLARE_ARM_DELAY_MS = 30000;
const FLARE_ACTIVE_DURATION_MS = 60000;
const FLARE_HOLD_DURATION_MS = 3000;
let flareSequence = 0;

const pos = (v) => ({
  x: Number.isFinite(v && v.x) ? v.x : Number(v && v.position && v.position.x) || 0,
  z: Number.isFinite(v && v.z) ? v.z : Number(v && v.position && v.position.z) || 0,
});
const distanceSquared = (a, b) => {
  const pa = pos(a); const pb = pos(b);
  return (pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2;
};

function boundaryEntries(world) {
  const width = Number(world.width || world.size) || 1000;
  const depth = Number(world.depth || world.size) || width;
  const inset = Math.max(8, Number(world.borderInset) || 20);
  const rx = width / 2 - inset; const rz = depth / 2 - inset;
  return Array.from({ length: 15 }, (_, i) => {
    const a = i / 15 * Math.PI * 2;
    const scale = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    return { id: `boundary-entry-${i + 1}`, x: Math.cos(a) * rx * scale, z: Math.sin(a) * rz * scale };
  });
}

export function isSafeRaidEntry(world, entry) {
  if (typeof world.isSpawnPositionClear === 'function') return world.isSpawnPositionClear(entry, {kind:'raid-entry'}) !== false;
  if (typeof world.isPositionClear === 'function') return world.isPositionClear(entry) !== false;
  const clearance = world.entryObstacleClearance ?? 5;
  const bound=(world.size??1000)/2;
  if(Math.abs(entry.x)+clearance>=bound||Math.abs(entry.z)+clearance>=bound)return false;
  if((world.obstacles??[]).some(o=>Math.abs(entry.x-o.x)<(o.w??o.width??0)/2+clearance&&Math.abs(entry.z-o.z)<(o.d??o.depth??0)/2+clearance))return false;
  if((world.enemySpawns??[]).some(e=>distanceSquared(entry,e)<Math.max(20,(e.radius??8)+8)**2))return false;
  return !(world.radiationZones??[]).some(z=>distanceSquared(entry,z)<(z.radius+clearance)**2);
}

function chooseRaidEntry(world, rng = Math.random) {
  const source = Array.isArray(world.entrySpawns) && world.entrySpawns.length ? world.entrySpawns : boundaryEntries(world);
  const safe = source.filter((entry) => isSafeRaidEntry(world, entry));
  if (!safe.length) throw new Error('World has no safe raid entry spawn');
  const roll = Number(rng());
  const index = Math.min(safe.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * safe.length)));
  return { ...safe[index], ...pos(safe[index]) };
}

function chooseFarthestExits(world, entry) {
  return (world.extractions || []).filter((exit) => (exit.kind || 'fixed') === 'fixed' && distanceSquared(exit, entry) > 0)
    .map((exit, index) => ({ exit, index, d: distanceSquared(exit, entry) }))
    .sort((a, b) => b.d - a.d || String(a.exit.id || '').localeCompare(String(b.exit.id || '')) || a.index - b.index)
    .slice(0, 2).map(({ exit }) => ({ ...exit, enabled: true }));
}

function makeFlareExtraction(player, now, id) {
  if (!Number.isFinite(now)) throw new TypeError('now must be finite');
  const origin = pos(player);
  return { id: id || `flare-${now}-${++flareSequence}`, kind: 'flare', name:'철수 플레어', radius:4, holdSeconds:3, ...origin, firedAt: now,
    activatesAt: now + FLARE_ARM_DELAY_MS, expiresAt: now + FLARE_ARM_DELAY_MS + FLARE_ACTIVE_DURATION_MS,
    holdDurationMs: FLARE_HOLD_DURATION_MS, state: 'arming' };
}

function flareExtractionStatus(extraction, now) {
  if (now < extraction.activatesAt) return 'arming';
  return now < extraction.expiresAt ? 'active' : 'expired';
}
const updateFlareExtraction = (extraction, now) => ({ ...extraction, state: flareExtractionStatus(extraction, now) });
function canFinishExtraction(extraction, startedAt, now) {
  return Number.isFinite(startedAt) && flareExtractionStatus(extraction, now) === 'active'
    && now >= startedAt + (Number(extraction.holdDurationMs) || FLARE_HOLD_DURATION_MS);
}
function cancelExtractionOnHit(player) {
  if (!player || !player.extracting) return null;
  const extracting = player.extracting; player.extracting = null;
  return { type: 'extraction_cancelled', playerId: player.id,
    extractionId: extracting.extractionId || extracting.id, reason: 'hit' };
}

export { FLARE_ARM_DELAY_MS, FLARE_ACTIVE_DURATION_MS, FLARE_HOLD_DURATION_MS,
  chooseRaidEntry, chooseFarthestExits, makeFlareExtraction, flareExtractionStatus,
  updateFlareExtraction, canFinishExtraction, cancelExtractionOnHit };
