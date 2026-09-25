import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {WORLD} from '../shared/world.ts';
const world=structuredClone(WORLD);
world.obstacles=world.obstacles.filter(o=>!/^river-fence-122-[we]-/.test(o.id));
const rivers=world.terrain.filter(t=>t.kind==='river');
for(let z=-240;z<240;z+=2){
 const nearby=rivers.filter(t=>Math.abs(z+1-t.z)<=t.d/2+2);
 for(const [side,x] of [['w',Math.min(...nearby.map(t=>t.x-t.w/2))-.8],['e',Math.max(...nearby.map(t=>t.x+t.w/2))+.8]]){
  if(!world.roads.some(r=>r.w>r.d&&Math.abs(x-r.x)<r.w/2+1&&Math.abs(z+1-r.z)<r.d/2+1))world.obstacles.push({id:`river-fence-122-${side}-${z}`,x,z:z+1,w:.65,d:2.6});
 }
}
const text=fs.readFileSync('dist/assets/index-river-126.js','utf8');
const shape=text.slice(text.indexOf('function __bcRiverShape111'),text.indexOf('function __bcPaintRiver111'));
const start=text.indexOf('function __bcNature122');
const bridge=text.slice(start,text.indexOf(' // Red timber barn',start))+'return {bridges};}';
const boxes=[];
class Group{add(){}}
class Plane{attributes={position:{count:0}};rotateX(){}computeVertexNormals(){}}
class Mesh{position={set(){}}}
const context={world,__bcRiverCache111:new WeakMap,H:Group,Zc:Plane,U:Mesh,fl:class{},q:(g,color,x,y,z,w,h,d)=>{const o={color,x,y,z,w,h,d,rotation:{}};boxes.push(o);return o;}};
vm.createContext(context);vm.runInContext(shape+bridge+'result=__bcNature122(world)',context);
assert.equal(context.result.bridges.length,7);
const sockets=boxes.filter(o=>o.color==='#41473c');
assert.equal(sockets.length,28,'Every corner of all seven bridges connects to a bank fence');
assert(boxes.every(o=>[o.x,o.y,o.z,o.w,o.h,o.d].every(Number.isFinite)));
console.log(JSON.stringify({bridges:7,connectedCorners:sockets.length,geometryBoxes:boxes.length,finite:true}));
const obstacleRenderer=text.slice(text.indexOf('function ag(e)'),text.indexOf('// One river outline shared',text.indexOf('function ag(e)')));
vm.runInContext(obstacleRenderer,context);
const before=boxes.length;
context.ag({id:'river-fence-122-bridge-0-1',kind:'wood-fence',w:25,d:.65,h:1.4});
assert.equal(boxes.length,before,'Bridge collision fence must not draw over the stone parapet');
context.ag({id:'river-fence-122-w-10',kind:'wood-fence',w:.65,d:2.6,h:1.15});
assert(boxes.length>before,'Ordinary bank fences must still render');
console.log('Wood fence rendering smoke checks passed');
