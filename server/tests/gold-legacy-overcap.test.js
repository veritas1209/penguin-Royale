import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEMS,
  ITEM_BY_ID,
  materializeGoldItem,
} from '../../shared/catalog.ts';

import {
  LEGACY_GOLD_COMPAT,
} from '../../shared/legacyGoldCompat.ts';

const ARMOR =
  'armor-gold-mix-ergonomics-armor-set-fireproof-lead-blastproof-thick-l3-steel-front';

const BACKPACK =
  'backpack-gold-mix-elastic-encryption-advanced-elastic-advanced-encryption-first-aid-module-search-l3';

const MK14 =
  'mk14-gold-mix-smart-precision-penetration-magazine-reload-l3';

test('legacy overcap gold is lookup-only and never returns to generation pool', () => {
  assert.equal(
    ITEMS.filter(
      item =>
        item.quality === 'gold' &&
        Object.keys(item.goldTraitLevels ?? {}).length > 4
    ).length,
    0
  );

  for (const legacy of LEGACY_GOLD_COMPAT) {
    assert.ok(ITEM_BY_ID[legacy.id], legacy.id);
    assert.equal(
      ITEMS.some(item => item.id === legacy.id),
      false,
      legacy.id
    );
  }
});

test('legacy steel-front armor keeps variant, six traits, and original stats', () => {
  const item = ITEM_BY_ID[ARMOR];

  assert.ok(item);
  assert.equal(item.baseId, 'armor-6-steel-front');
  assert.equal(item.armorVariant, 'steel-front');

  const effective = materializeGoldItem(
    item,
    item.goldTraitLevels
  );

  assert.equal(
    Object.keys(effective.goldTraitLevels ?? {}).length,
    6
  );

  assert.equal(effective.armorVariant, 'steel-front');
  assert.equal(effective.reduction, 0.539);
  assert.equal(effective.armorSlots, 3);
});

test('legacy backpack keeps all six traits and original capacity', () => {
  const item = ITEM_BY_ID[BACKPACK];
  assert.ok(item);

  const effective = materializeGoldItem(
    item,
    item.goldTraitLevels
  );

  assert.equal(
    Object.keys(effective.goldTraitLevels ?? {}).length,
    6
  );

  assert.equal(effective.capacity, 640);
});

test('legacy Mk14 keeps all five traits and original combat stats', () => {
  const item = ITEM_BY_ID[MK14];
  assert.ok(item);

  const effective = materializeGoldItem(
    item,
    item.goldTraitLevels
  );

  assert.equal(
    Object.keys(effective.goldTraitLevels ?? {}).length,
    5
  );

  assert.equal(effective.baseId, 'mk14');
  assert.equal(effective.damage, 72.04);
  assert.equal(effective.magazine, 25);
  assert.equal(effective.reload, 1.55);
});
