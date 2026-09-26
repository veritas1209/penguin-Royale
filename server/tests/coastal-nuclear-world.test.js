import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD} from '../../shared/world.ts';
const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
test('coast and lake volumes fully block water without covering roads',()=>{
 const water=WORLD.terrain.filter(t=>/^(coast-sea-|nuclear-lake-)/.test(t.id));assert.equal(water.length,130);
 for(const t of water){const b=WORLD.obstacles.find(o=>o.id==='water-block-'+t.id);assert.ok(b);for(const key of ['x','z','w','d'])assert.equal(b[key],t[key]);assert.ok(!WORLD.roads.some(r=>overlap(t,r)));}
 for(const p of [...WORLD.enemySpawns,...WORLD.lootSpawns])assert.ok(!water.some(t=>overlap({...p,w:1,d:1},t)),p.id);
});
test('coastal, nuclear, and farm buildings have clear structural footprints',()=>{
 const buildings=WORLD.buildings.filter(b=>/^(fishing|hydro)-/.test(b.id)||(b.x>120&&b.x<215&&b.z>90&&b.z<235));
 for(const b of buildings){const others=[...WORLD.buildings.filter(o=>o!==b),...WORLD.roads,...WORLD.obstacles.filter(o=>!o.id.startsWith(b.id+'-')&&!['interior-wall','interior-window'].includes(o.kind))];assert.ok(!others.some(o=>overlap(b,o,.3)),b.id);}
 for(const b of buildings.filter(b=>b.x>120&&b.z>90)){assert.equal(b.wallColor,'#a94335');assert.equal(b.occlusion.fadeRoof,true);assert.ok(WORLD.lootSpawns.some(l=>l.buildingId===b.id));}
 assert.equal(WORLD.landmarks.find(l=>l.id==='hydro').kind,'nuclear');
 assert.equal(WORLD.obstacles.filter(o=>o.kind==='cooling-tower').length,2);
});
