const ACCESS_COLORS = new Set(['yellow', 'red', 'black']);
const PASSWORD_LETTERS = new Set(['white', 'red', 'yellow', 'green', 'black'].map((color) => `password-letter-${color}`));

export function isPasswordLetter(itemId) { return PASSWORD_LETTERS.has(itemId); }

export function createRaidAccessWorld(world) {
  const accessDoors = (world.accessDoors ?? []).map((door) => {
    if (!door?.id || !door.buildingId || !ACCESS_COLORS.has(door.color) || door.itemId !== `password-letter-${door.color}`)
      throw Object.assign(new Error('Invalid access door definition'), { code: 'INVALID_ACCESS_DOOR' });
    return { ...door, rotation: 0 };
  });
  const obstacles = (world.obstacles ?? []).map((obstacle) => ({ ...obstacle }));
  for (const door of accessDoors) obstacles.push({ id: `access-collider-${door.id}`, accessDoorId: door.id, x: door.x, z: door.z, w: door.w, d: door.d, h: door.h });
  return { ...world, obstacles, accessDoors };
}

export function createAccessDoorStates(world) { return new Map((world.accessDoors ?? []).map((door) => [door.id, { ...door, state: 'locked' }])); }
export function accessDoorSnapshots(accessDoors) { return [...accessDoors.values()].map((door) => ({ ...door })); }
export function removeAccessDoorCollider(world, doorId) { world.obstacles = (world.obstacles ?? []).filter((obstacle) => obstacle.accessDoorId !== doorId); }

// Password letters are document-cache exclusives and intentionally rare (about 1% total).
export const DOCUMENT_WEIGHTS = Object.freeze([
  ['metro-2036', 34], ['old-video-tape', 27], ['torn-map', 18], ['torn-blueprint', 12], ['precision-blueprint', 4], ['top-secret-intelligence', 2],
  ['password-letter-white', .2], ['password-letter-green', .2], ['password-letter-yellow', .2], ['password-letter-red', .2], ['password-letter-black', .2],
]);

export function rollDocumentItem(catalog, random = Math.random) {
  const weighted = DOCUMENT_WEIGHTS.map(([id, weight]) => ({ item: catalog.byId.get(id), weight })).filter(({ item }) => item);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) return null;
  let roll = random() * total;
  for (const entry of weighted) { roll -= entry.weight; if (roll < 0) return entry.item; }
  return weighted.at(-1).item;
}
