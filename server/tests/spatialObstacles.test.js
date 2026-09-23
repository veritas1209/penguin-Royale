import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentObstacles} from '../spatialObstacles.js';

test('segment obstacle lookup selects nearby blockers and ignores distant map geometry',()=>{
 const near={x:6,z:0,w:2,d:2},far={x:120,z:120,w:8,d:8};
 const world={obstacles:[near,far]};
 const matches=segmentObstacles(world,{x:0,z:0},{x:10,z:0});
 assert.equal(matches.has(near),true);
 assert.equal(matches.has(far),false);
});

test('segment obstacle lookup rebuilds after a collider is added',()=>{
 const world={obstacles:[]},door={x:4,z:0,w:1,d:4};
 assert.equal(segmentObstacles(world,{x:0,z:0},{x:8,z:0}).size,0);
 world.obstacles.push(door);
 assert.equal(segmentObstacles(world,{x:0,z:0},{x:8,z:0}).has(door),true);
});
