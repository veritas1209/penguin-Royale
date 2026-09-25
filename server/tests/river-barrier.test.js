import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD} from '../../shared/world.ts';
import {movementBlocked,riverBlocked} from '../../shared/movement.ts';
import {GOLDEN_STAR_CORE_DAMAGE} from '../goldenBoss.js';

test('river is impassable except on crossing bridge decks',()=>{
 assert.equal(riverBlocked(WORLD,104,0),false);
 assert.equal(movementBlocked(WORLD,104,0),false);
 assert.equal(riverBlocked(WORLD,104,7),true);
 assert.equal(movementBlocked(WORLD,104,7),true);
});

test('vertical bank road no longer removes riverside fence',()=>{
 const bankFences=WORLD.obstacles.filter(o=>o.id?.startsWith('river-fence-122-w-')&&o.z>-80&&o.z<-60);
 assert.ok(bankFences.length>=8);
});

test('golden boss starfall core deals 120 damage',()=>{
 assert.equal(GOLDEN_STAR_CORE_DAMAGE,120);
});
