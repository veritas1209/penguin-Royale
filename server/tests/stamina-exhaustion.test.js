import test from 'node:test';import assert from 'node:assert/strict';import {advanceMovement} from '../../shared/movement.ts';
const world={size:1000,obstacles:[]};
test('exhausted sprint locks stamina recovery for five seconds',()=>{
 const state={x:0,z:0,stamina:.1,maxStamina:100,moveMultiplier:1,coldUntil:0,staminaRecoveryAt:0};
 advanceMovement(state,{moveX:1,moveZ:0,sprint:true},.1,1000,world);assert.equal(state.stamina,0);const lock=state.staminaRecoveryAt;assert.ok(lock>=5900);
 const x=state.x;advanceMovement(state,{moveX:1,moveZ:0,sprint:true},.25,lock-1,world);assert.equal(state.stamina,0);assert.ok(state.x-x<1.5);
 advanceMovement(state,{moveX:0,moveZ:0,sprint:false},.25,lock+250,world);assert.ok(state.stamina>0);
});
