import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const DB =
  '/home/hajin/.local/share/bluecap-extraction/game.sqlite';

const OLD_CATALOG =
  '/home/hajin/services/bluecap-extraction/releases/20260918-gold-workshop-08/shared/catalog.ts';

const NEW_CATALOG =
  '/home/hajin/services/bluecap-extraction/releases/20260918-gold-workshop-10/shared/catalog.ts';

const apply = process.argv.includes('--apply');

const oldModule = await import(pathToFileURL(OLD_CATALOG).href);
const newModule = await import(pathToFileURL(NEW_CATALOG).href);

const oldItems = oldModule.ITEMS;
const newItems = newModule.ITEMS;

const oldById = new Map(oldItems.map(item => [item.id, item]));
const newById = new Map(newItems.map(item => [item.id, item]));

const db = new DatabaseSync(DB, {timeout: 5000});
db.exec('PRAGMA foreign_keys=ON');

function traitCount(item) {
  return Object.keys(item?.goldTraitLevels ?? {}).length;
}

function prefixOf(item) {
  const marker = item.id.indexOf('-gold-');
  return marker >= 0 ? item.id.slice(0, marker) : item.id;
}

function findTarget(legacy) {
  const prefix = prefixOf(legacy);

  const matches = newItems.filter(candidate => {
    if (candidate.quality !== 'gold') return false;
    if (candidate.category !== legacy.category) return false;

    if (
      legacy.baseId &&
      candidate.baseId &&
      candidate.baseId === legacy.baseId
    ) return true;

    return candidate.id.startsWith(prefix + '-gold-');
  });

  matches.sort((a, b) =>
    traitCount(a) - traitCount(b) ||
    a.id.localeCompare(b.id)
  );

  return matches[0] ?? null;
}

const referenced = db.prepare(`
  SELECT user_id AS userId, item_id AS itemId FROM inventory
  UNION
  SELECT user_id AS userId, item_id AS itemId
    FROM equipped WHERE item_id IS NOT NULL
  UNION
  SELECT user_id AS userId, item_id AS itemId FROM item_instances
`).all();

const referencedIds = [...new Set(referenced.map(row => row.itemId))];

const mappings = new Map();
const unresolved = [];

for (const id of referencedIds) {
  if (newById.has(id)) continue;

  const legacy = oldById.get(id);

  if (!legacy || legacy.quality !== 'gold') continue;

  const target = findTarget(legacy);

  if (!target) {
    unresolved.push(id);
    continue;
  }

  mappings.set(id, {
    legacy,
    target,
    levels: {...(legacy.goldTraitLevels ?? {})},
  });
}

console.log(`MODE=${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(`LEGACY_GOLD_IDS=${mappings.size}`);

for (const [oldId, info] of mappings) {
  console.log(
    `${oldId} -> ${info.target.id} ` +
    `traits=${JSON.stringify(info.levels)}`
  );
}

if (unresolved.length) {
  console.error('UNRESOLVED LEGACY GOLD ITEMS:');
  for (const id of unresolved) console.error('  ' + id);
  process.exitCode = 2;
}

if (!apply || unresolved.length) {
  db.close();
  process.exit();
}

function mergeQuantityTable(table, userId, oldId, newId) {
  const row = db.prepare(
    `SELECT quantity FROM ${table} WHERE user_id=? AND item_id=?`
  ).get(userId, oldId);

  if (!row) return 0;

  db.prepare(`
    INSERT INTO ${table}(user_id,item_id,quantity)
    VALUES(?,?,?)
    ON CONFLICT(user_id,item_id)
    DO UPDATE SET quantity=quantity+excluded.quantity
  `).run(userId, newId, row.quantity);

  db.prepare(
    `DELETE FROM ${table} WHERE user_id=? AND item_id=?`
  ).run(userId, oldId);

  return row.quantity;
}

function upsertTraits(instanceId, levels) {
  db.prepare(`
    INSERT INTO item_instance_gold_traits(instance_id,traits_json)
    VALUES(?,?)
    ON CONFLICT(instance_id)
    DO UPDATE SET traits_json=excluded.traits_json
  `).run(instanceId, JSON.stringify(levels));
}

db.exec('BEGIN IMMEDIATE');

try {
  for (const [oldId, info] of mappings) {
    const newId = info.target.id;
    const defaultLevels = info.levels;

    const users = db.prepare(`
      SELECT user_id AS userId FROM inventory WHERE item_id=?
      UNION
      SELECT user_id AS userId FROM equipped WHERE item_id=?
      UNION
      SELECT user_id AS userId FROM item_instances WHERE item_id=?
    `).all(oldId, oldId, oldId);

    for (const {userId} of users) {
      const inventoryRow = db.prepare(`
        SELECT quantity FROM inventory
        WHERE user_id=? AND item_id=?
      `).get(userId, oldId);

      const instances = db.prepare(`
        SELECT
          i.id,
          i.status,
          i.slot,
          i.fittings_json AS fittingsJson,
          g.traits_json AS traitsJson
        FROM item_instances i
        LEFT JOIN item_instance_gold_traits g
          ON g.instance_id=i.id
        WHERE i.user_id=? AND i.item_id=?
      `).all(userId, oldId);

      const equippedSlots = db.prepare(`
        SELECT slot FROM equipped
        WHERE user_id=? AND item_id=?
      `).all(userId, oldId).map(row => row.slot);

      for (const instance of instances) {
        let levels = defaultLevels;

        if (instance.traitsJson) {
          try {
            levels = JSON.parse(instance.traitsJson);
          } catch {}
        }

        upsertTraits(instance.id, levels);

        db.prepare(`
          UPDATE item_instances
          SET item_id=?
          WHERE id=?
        `).run(newId, instance.id);
      }

      const existingEquipped = new Set(
        instances
          .filter(instance => instance.status === 'equipped')
          .map(instance => instance.slot)
      );

      let created = 0;

      for (const slot of equippedSlots) {
        if (existingEquipped.has(slot)) continue;

        const id = randomUUID();

        db.prepare(`
          INSERT INTO item_instances(
            id,user_id,item_id,fittings_json,status,slot
          )
          VALUES(?,?,?,'{}','equipped',?)
        `).run(id, userId, newId, slot);

        upsertTraits(id, defaultLevels);
        created++;
      }

      const inventoryQuantity = inventoryRow?.quantity ?? 0;

      const quantityToPreserve =
        inventoryQuantity > 0
          ? inventoryQuantity
          : Math.max(instances.length + created, equippedSlots.length);

      const sourceInstanceCount = instances.length + created;

      for (
        let index = sourceInstanceCount;
        index < quantityToPreserve;
        index++
      ) {
        const id = randomUUID();

        db.prepare(`
          INSERT INTO item_instances(
            id,user_id,item_id,fittings_json,status,slot
          )
          VALUES(?,?,?,'{}','stash',NULL)
        `).run(id, userId, newId);

        upsertTraits(id, defaultLevels);
      }

      if (inventoryQuantity > 0) {
        db.prepare(`
          INSERT INTO inventory(user_id,item_id,quantity)
          VALUES(?,?,?)
          ON CONFLICT(user_id,item_id)
          DO UPDATE SET quantity=quantity+excluded.quantity
        `).run(userId, newId, inventoryQuantity);

        db.prepare(`
          DELETE FROM inventory
          WHERE user_id=? AND item_id=?
        `).run(userId, oldId);
      } else if (quantityToPreserve > 0) {
        db.prepare(`
          INSERT INTO inventory(user_id,item_id,quantity)
          VALUES(?,?,?)
          ON CONFLICT(user_id,item_id)
          DO UPDATE SET quantity=quantity+excluded.quantity
        `).run(userId, newId, quantityToPreserve);
      }

      db.prepare(`
        UPDATE equipped
        SET item_id=?
        WHERE user_id=? AND item_id=?
      `).run(newId, userId, oldId);

      mergeQuantityTable('packed', userId, oldId, newId);
      mergeQuantityTable('secure_packed', userId, oldId, newId);
    }
  }

  const idMap = new Map(
    [...mappings].map(([oldId, info]) => [
      oldId,
      {
        newId: info.target.id,
        levels: info.levels,
      },
    ])
  );

  function rewrite(value) {
    let changed = false;

    function visit(node) {
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }

      if (!node || typeof node !== 'object') return;

      if (typeof node.itemId === 'string' && idMap.has(node.itemId)) {
        const mapped = idMap.get(node.itemId);
        node.itemId = mapped.newId;

        if (
          !node.goldTraitLevels ||
          Object.keys(node.goldTraitLevels).length === 0
        ) {
          node.goldTraitLevels = {...mapped.levels};
        }

        changed = true;
      }

      for (const child of Object.values(node)) visit(child);
    }

    visit(value);
    return changed;
  }

  const escrowRows = db.prepare(`
    SELECT
      raid_id AS raidId,
      user_id AS userId,
      gear_json AS gearJson,
      loot_json AS lootJson,
      secure_json AS secureJson
    FROM raid_escrow
  `).all();

  for (const row of escrowRows) {
    const gear = JSON.parse(row.gearJson ?? '[]');
    const loot = JSON.parse(row.lootJson ?? '[]');
    const secure = JSON.parse(row.secureJson ?? '[]');

    const changed =
      rewrite(gear) |
      rewrite(loot) |
      rewrite(secure);

    if (changed) {
      db.prepare(`
        UPDATE raid_escrow
        SET gear_json=?, loot_json=?, secure_json=?
        WHERE raid_id=? AND user_id=?
      `).run(
        JSON.stringify(gear),
        JSON.stringify(loot),
        JSON.stringify(secure),
        row.raidId,
        row.userId
      );
    }
  }

  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

console.log('MIGRATION_APPLIED');
console.log(db.prepare('PRAGMA integrity_check').get());

const remaining = db.prepare(`
  SELECT DISTINCT item_id AS itemId FROM inventory
  UNION
  SELECT DISTINCT item_id AS itemId FROM equipped
  UNION
  SELECT DISTINCT item_id AS itemId FROM item_instances
`).all().map(row => row.itemId).filter(id =>
  !newById.has(id) &&
  oldById.get(id)?.quality === 'gold'
);

console.log('REMAINING_LEGACY_GOLD=', remaining);

db.close();
