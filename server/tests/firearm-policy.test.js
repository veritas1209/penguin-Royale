import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEMS,
  ITEM_BY_ID,
  TALENTS,
} from '../../shared/catalog.ts';

import {
  FIREARM_CADENCE,
  firearmCadence,
  nextShotIntervalMs,
} from '../../shared/firearmCadence.ts';

import {
  isPistolWeapon,
} from '../../shared/weaponSlots.ts';

import {
  normalizeCatalog,
} from '../game.js';

import {
  equipEnemy,
  fireEnemyProjectile,
} from '../enemyCombat.js';

import {
  enemyRewardStacks,
} from '../bosses.js';


const close=(a,b,t=.02)=>
 assert.ok(
  Math.abs(a-b)<=t,
  `${a} != ${b}`
 );


test(
 'PUBG cadence table is authoritative for catalog weapons',
 ()=>{
  const expected={
   famas:60,
   groza:80,
   m416:85.7,

   'micro-uzi':48,
   vector:55,
   p90:60,
   js9:65,
   mp5k:67,
   'pp19-bizon':86,
   ump:92,

   mg3:60000/990,
   m249:75,
   dp28:109,

   mk14:90,
   vss:85.7,

   kar98k:1900,
   m24:1800,
   awm:1850,
   win94:600,
   'lynx-amr':1380,

   s1897:750,
   ns2000:800,
   s686:200,
   s12k:250,
  };

  for(const[id,ms]of Object.entries(expected)){
   const item=ITEM_BY_ID[id];

   assert.ok(item,id);

   close(
    firearmCadence(item).intervalMs,
    ms
   );

   close(
    item.fireRate,
    1000/ms,
    .001
   );
  }

  assert.equal(
   ITEM_BY_ID.m16a4.mode,
   'burst'
  );

  assert.equal(
   ITEM_BY_ID.m16a4.burst,
   3
  );

  close(
   firearmCadence(
    ITEM_BY_ID.m16a4
   ).intervalMs,
   75
  );

  assert.equal(
   ITEM_BY_ID['mk47-mutant'].mode,
   'burst'
  );

  assert.equal(
   ITEM_BY_ID['mk47-mutant'].burst,
   2
  );

  close(
   firearmCadence(
    ITEM_BY_ID['mk47-mutant']
   ).intervalMs,
   75
  );

  assert.equal(
   ITEM_BY_ID['asm-abakan'].mode,
   'auto'
  );

  close(
   firearmCadence(
    ITEM_BY_ID['asm-abakan']
   ).intervalMs,
   90.9
  );

  assert.ok(
   Object.keys(
    FIREARM_CADENCE
   ).length>=45
  );
 }
);


test(
 'DBS alternates double tap and pump cadence',
 ()=>{
  const dbs=ITEM_BY_ID.dbs;

  assert.equal(
   nextShotIntervalMs(dbs,14),
   125
  );

  assert.equal(
   nextShotIntervalMs(dbs,13),
   450
  );

  assert.equal(
   nextShotIntervalMs(dbs,12),
   125
  );

  assert.equal(
   nextShotIntervalMs(dbs,11),
   450
  );
 }
);


test(
 'AI rejects pistols and inherits actual weapon damage and cadence',
 ()=>{
  const catalog=
   normalizeCatalog({
    items:ITEMS,
    talents:TALENTS
   });

  const raid={catalog};

  const rejected={
   id:'pistol-test',
   kind:'raider',
   x:0,
   z:0,
   hp:100,
   maxHp:100
  };

  equipEnemy(
   raid,
   rejected,
   {weaponId:'p18c'}
  );

  assert.equal(
   isPistolWeapon(
    catalog.byId.get(
     rejected.weaponId
    )
   ),
   false
  );

  const enemy={
   id:'uzi-test',
   kind:'raider',
   x:0,
   z:5,
   hp:100,
   maxHp:100
  };

  equipEnemy(
   raid,
   enemy,
   {weaponId:'micro-uzi'}
  );

  assert.equal(
   enemy.damage,
   catalog.byId.get(
    'micro-uzi'
   ).damage
  );

  close(
   enemy.attackMs,
   48
  );
 }
);


test(
 'AI automatic and DBS fire use exact firearm cadence',
 ()=>{
  const catalog=
   normalizeCatalog({
    items:ITEMS,
    talents:TALENTS
   });

  const events=[];

  const raid={
   catalog,
   projectiles:new Map(),
   perfStats:null,
   event:(kind,data)=>
    events.push({kind,data})
  };

  const target={
   id:'p',
   x:0,
   z:0,
   alive:true,
   downed:false,
   boarded:false,
   settlement:null,
   input:{
    moveX:0,
    moveZ:0
   },
   moveMultiplier:1
  };

  const uzi={
   id:'uzi',
   kind:'raider',
   x:0,
   z:5,
   hp:100,
   maxHp:100
  };

  equipEnemy(
   raid,
   uzi,
   {weaponId:'micro-uzi'}
  );

  uzi.aimSpread=0;
  uzi.reactionReadyAt=0;
  uzi.nextAttackAt=0;

  assert.equal(
   fireEnemyProjectile(
    raid,
    uzi,
    target,
    1000
   ),
   true
  );

  close(
   uzi.nextAttackAt,
   1048
  );

  assert.equal(
   fireEnemyProjectile(
    raid,
    uzi,
    target,
    1047
   ),
   false
  );

  assert.equal(
   fireEnemyProjectile(
    raid,
    uzi,
    target,
    1048
   ),
   true
  );


  const dbs={
   id:'dbs',
   kind:'raider',
   x:0,
   z:5,
   hp:100,
   maxHp:100
  };

  equipEnemy(
   raid,
   dbs,
   {weaponId:'dbs'}
  );

  dbs.aimSpread=0;
  dbs.reactionReadyAt=0;
  dbs.nextAttackAt=0;
  dbs.ammoInMagazine=14;

  assert.equal(
   fireEnemyProjectile(
    raid,
    dbs,
    target,
    2000
   ),
   true
  );

  assert.equal(
   dbs.nextAttackAt,
   2125
  );

  assert.equal(
   fireEnemyProjectile(
    raid,
    dbs,
    target,
    2125
   ),
   true
  );

  assert.equal(
   dbs.nextAttackAt,
   2575
  );
 }
);


test(
 'ordinary enemy drops exact carried gun and remaining healing items',
 ()=>{
  const catalog=
   normalizeCatalog({
    items:ITEMS,
    talents:TALENTS
   });

  const enemy={
   id:'drop-test',
   kind:'heavy',
   weaponId:'vector-improved',
   medicalUses:1,
   medicalItemId:'first-aid'
  };

  const stacks=
   enemyRewardStacks(
    catalog,
    enemy,
    12345,
    false
   );

  const weapons=
   stacks.filter(
    s=>
     catalog.byId.get(
      s.itemId
     )?.category==='weapon'
   );

  const medical=
   stacks.filter(
    s=>
     catalog.byId.get(
      s.itemId
     )?.category==='medical'
   );

  assert.deepEqual(
   weapons,
   [{
    itemId:'vector-improved',
    quantity:1
   }]
  );

  assert.deepEqual(
   medical,
   [{
    itemId:'first-aid',
    quantity:1
   }]
  );
 }
);


test(
 'upgrade part is sold directly for one million',
 ()=>{
  const part=
   ITEM_BY_ID[
    'gold-upgrade-part'
   ];

  assert.equal(
   part.price,
   1_000_000
  );

  assert.equal(
   part.purchasable,
   true
  );

  /*
   교역소 구매가는 100만.
   플레이어가 되팔 때는 기존 50만 유지.
  */
  assert.equal(
   part.sell,
   500_000
  );
 }
);
