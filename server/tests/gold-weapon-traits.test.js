import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID,GOLD_OPTIONS} from '../../shared/catalog.ts';

test('gold firearm traits exclude durability and keep the five implemented traits at levels one to three',()=>{
 for(const level of [1,2,3])for(const trait of ['smart','precision','penetration','magazine','reload'])assert.ok(GOLD_OPTIONS[trait+'-l'+level]);
 assert.equal(Object.keys(GOLD_OPTIONS).some(id=>id.startsWith('durable')),false);
 assert.equal(ITEMS.some(item=>item.id.includes('-gold-durable-')||item.optionIds?.some(id=>id.startsWith('durable'))),false);
 const base=ITEM_BY_ID['mk14-refined'];assert.ok(base);
 const smart=ITEM_BY_ID['mk14-gold-smart-l3'],precision=ITEM_BY_ID['mk14-gold-precision-l3'],penetration=ITEM_BY_ID['mk14-gold-penetration-l3'],magazine=ITEM_BY_ID['mk14-gold-magazine-l3'],reload=ITEM_BY_ID['mk14-gold-reload-l3'];
 assert.equal(smart.aimTimeMultiplier,.7);
 assert.equal(precision.damage,Number((base.damage+15).toFixed(2)));
 assert.equal(penetration.armorIgnore,1);
 assert.equal(magazine.magazine,base.magazine+5);
 assert.equal(reload.reload,Number((base.reload*.5).toFixed(2)));
});
