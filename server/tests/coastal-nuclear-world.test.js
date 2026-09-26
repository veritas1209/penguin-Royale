import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD} from '../../shared/world.ts';
import {movementBlocked,advanceMovement} from '../../shared/movement.ts';
const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
test('coast and lake volumes fully block water without covering roads',()=>{
 const water=WORLD.terrain.filter(t=>/^(coast-sea-|nuclear-lake-)/.test(t.id));assert.equal(water.length,560);
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

test('curved water bodies taper naturally to the map boundary',()=>{
 for(const [prefix,sea] of [['coast-sea-',true],['nuclear-lake-',false]]){
  const rows=WORLD.terrain.filter(t=>t.id.startsWith(prefix));
  assert.ok(rows.every(r=>r.d<=.5));
  for(let i=1;i<rows.length;i++)assert.equal(rows[i].z-rows[i-1].z,.5);
  assert.ok(sea?rows[0].w<.01:rows.at(-1).w<5);
  assert.ok(!WORLD.obstacles.some(o=>o.id.startsWith('shore-join-'+prefix)||o.id==='shore-cap-'+prefix));
 }
});
test('nuclear site contains reserved reactor, switchyard and pumping infrastructure',()=>{
 const facilities=WORLD.obstacles.filter(o=>o.kind==='nuclear-equipment');assert.equal(facilities.length,3);
 for(const o of facilities){assert.ok(!WORLD.roads.some(r=>overlap(o,r,1)),o.id);assert.ok(!WORLD.buildings.some(b=>overlap(o,b,1)),o.id);assert.ok(!WORLD.obstacles.some(b=>b!==o&&b.kind==='tree'&&overlap(o,b,1)),o.id);}
});

test('shoreline and plant fences have collision along their visible rails',()=>{
 const rails=WORLD.obstacles.filter(o=>o.id.startsWith('coastal-rail-'));
 const plant=WORLD.obstacles.filter(o=>o.id.startsWith('nuclear-fence-'));
 assert.equal(rails.length,188);
 assert.equal(plant.length,3);
 assert.ok(!WORLD.obstacles.some(o=>o.id==='road-end-gate-4-minus'));
 for(const rail of [...rails,...plant]){
  assert.equal(rail.kind,'shore-rail');
  assert.ok(movementBlocked(WORLD,rail.x,rail.z),rail.id);
  assert.ok(!WORLD.roads.some(road=>overlap(rail,road,.1)),rail.id);
  assert.ok(!WORLD.buildings.some(building=>overlap(rail,building,.1)),rail.id);
 }
 for(const prefix of ['coastal-rail-sea-','coastal-rail-lake-']){
  const side=prefix.includes('sea')?1:-1;
  const rail=rails.filter(o=>o.id.startsWith(prefix))[30];
  const state={x:rail.x+side*2,z:rail.z,stamina:100,maxStamina:100,moveMultiplier:1,coldUntil:0};
  assert.equal(movementBlocked(WORLD,state.x,state.z),false);
  for(let i=0;i<10;i++)advanceMovement(state,{moveX:-side,moveZ:0,sprint:false},.1,1000+i*100,WORLD);
  assert.ok((state.x-rail.x)*side>.5,rail.id);
 }
});
