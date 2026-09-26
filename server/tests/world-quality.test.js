import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORLD} from '../../shared/world.ts';
import {movementBlocked} from '../../shared/movement.ts';
const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
test('district access paths remain traversable along their entire length',()=>{
 assert.ok(WORLD.mapQuality.paths.length>=35);
 for(const p of WORLD.mapQuality.paths){const length=Math.hypot(p.x1-p.x0,p.z1-p.z0);for(let d=0;d<=length;d+=.35){const t=d/length;assert.ok(!movementBlocked(WORLD,p.x0+(p.x1-p.x0)*t,p.z0+(p.z1-p.z0)*t),p.id+' '+d);}}
});
test('roadside cover preserves roads, building approaches, loot, and extraction clearances',()=>{
 const covers=WORLD.obstacles.filter(o=>o.id.startsWith('quality-route-cover-'));assert.ok(covers.length>=20&&covers.length<=80);
 for(const cover of covers){assert.ok(!WORLD.roads.some(r=>overlap(cover,r,3)),cover.id);assert.ok(!WORLD.buildings.some(b=>overlap(cover,b,4)),cover.id);assert.ok(!WORLD.lootSpawns.some(l=>Math.hypot(l.x-cover.x,l.z-cover.z)<5),cover.id);assert.ok(!WORLD.extractions.some(e=>Math.hypot(e.x-cover.x,e.z-cover.z)<e.radius+6),cover.id);}
});
test('all extraction points and building entrances connect to the spawn on a one-metre navigation grid',()=>{
 const size=481,half=240,total=size*size,blocked=new Uint8Array(total),seen=new Uint8Array(total);
 const index=(x,z)=>(z+half)*size+x+half;
 const mark=(o,value,pad=.45)=>{for(let z=Math.max(-half,Math.ceil(o.z-o.d/2-pad));z<=Math.min(half,Math.floor(o.z+o.d/2+pad));z++)for(let x=Math.max(-half,Math.ceil(o.x-o.w/2-pad));x<=Math.min(half,Math.floor(o.x+o.w/2+pad));x++)blocked[index(x,z)]=value;};
 for(const t of WORLD.terrain.filter(t=>t.kind==='river'))mark(t,1);
 for(const r of WORLD.roads.filter(r=>r.w>r.d))mark(r,0,-.45);
 for(const o of WORLD.obstacles)mark(o,1);
 const queue=new Int32Array(total);let head=0,tail=0;const start=index(Math.round(WORLD.spawn.x),Math.round(WORLD.spawn.z));assert.equal(blocked[start],0);queue[tail++]=start;seen[start]=1;
 while(head<tail){const cur=queue[head++],x=cur%size;for(const n of [x>0?cur-1:-1,x<size-1?cur+1:-1,cur-size,cur+size])if(n>=0&&n<total&&!blocked[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
 const reachable=p=>{for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const x=Math.round(p.x)+dx,z=Math.round(p.z)+dz;if(Math.abs(x)<=half&&Math.abs(z)<=half&&seen[index(x,z)])return true;}return false;};
 for(const e of WORLD.extractions)assert.ok(reachable(e),e.id);
 for(const b of WORLD.buildings){const p={x:b.x,z:b.z};p.x+=b.door.side==='east'?b.w/2+1.8:b.door.side==='west'?-b.w/2-1.8:0;p.z+=b.door.side==='south'?b.d/2+1.8:b.door.side==='north'?-b.d/2-1.8:0;assert.ok(reachable(p),b.id);}
});
test('shipped world quality pass stays identical to shared authoring source',()=>{
 const bundle=fs.readFileSync(new URL('../../dist/assets/index-terrain-squad-133.js',import.meta.url),'utf8');
 const source=fs.readFileSync(new URL('../../shared/worldQuality.js',import.meta.url),'utf8').replace(/^\uFEFF/,'').replaceAll('export function','function');
 assert.ok(bundle.includes(source));assert.ok(bundle.includes('improveWorldQuality(Cg,Gh);'));assert.ok(bundle.includes('addWorldAccessPaths(root,world,oo,Attribute,U,fl);'));assert.ok(bundle.includes('paintNaturalGround(i,e,r.width,o);'));
});
