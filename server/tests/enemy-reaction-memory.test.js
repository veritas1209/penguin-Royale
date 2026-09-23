import test from 'node:test';
import assert from 'node:assert/strict';
import {forgetEnemyTarget,perceiveEnemy,rememberEnemyPoint} from '../enemyPerception.js';

const world={size:100,obstacles:[]};
const player={id:'p',x:0,z:5,alive:true,downed:false,boarded:false,settlement:null};

test('auditory tracking does not extend reaction delay every tick and visual acquisition resets it once',()=>{
 const enemy={id:'guard',kind:'raider',x:0,z:0,yaw:0,alertState:'idle',reactionMs:500};
 rememberEnemyPoint(enemy,player.id,player,1000,{seen:false});
 assert.equal(enemy.alertedAt,1000);assert.equal(enemy.reactionReadyAt,1500);
 rememberEnemyPoint(enemy,player.id,player,1200,{seen:false});
 assert.equal(enemy.alertedAt,1000);assert.equal(enemy.reactionReadyAt,1500);
 perceiveEnemy(world,[],enemy,new Map([[player.id,player]]),1300);
 assert.equal(enemy.alertedAt,1300);assert.equal(enemy.reactionReadyAt,1800);
 perceiveEnemy(world,[],enemy,new Map([[player.id,player]]),1400);
 assert.equal(enemy.alertedAt,1300);assert.equal(enemy.reactionReadyAt,1800);
 forgetEnemyTarget(enemy);
 perceiveEnemy(world,[],enemy,new Map([[player.id,player]]),2000);
 assert.equal(enemy.alertedAt,2000);assert.equal(enemy.reactionReadyAt,2500);
});
