import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS} from '../../shared/catalog.ts';
import {weaponFittingStats} from '../../shared/weaponFittingEffects.ts';
import {Raid,normalizeCatalog} from '../game.js';
import {planRaidEquipment} from '../raidEquipment.js';
const gun={id:'test-gun',category:'weapon',family:'AR',ammo:'test-ammo',magazine:30,reload:2,range:40,spread:.1,weight:150},ammo={id:'test-ammo',category:'ammo',weight:1};
const catalog=normalizeCatalog({items:[gun,ammo,...ITEMS.filter(i=>i.category==='attachment')],talents:[]});
function raidFor(quality){
 const suffix=quality==='intact'?'':'-'+quality;
 const gear=[{slot:'primary',itemId:'test-gun'},...['scope','grip','magazine','barrel'].map((slot,i)=>({slot:'primary:'+slot,itemId:['scope-4x','vertical-grip','extended-mag','suppressor'][i]+suffix})),{slot:'ammo',itemId:'test-ammo',quantity:100}];
 return new Raid({id:'q-'+quality,room:{mode:'solo',members:new Map([['p',{username:'p'}]])},escrow:[{userId:'p',gear}],db:{profile:()=>({talents:[]})},catalog,world:{size:100,spawn:{x:0,z:0},obstacles:[],lootSpawns:[],enemySpawns:[],extractions:[],radiationZones:[]},now:()=>1000,emit(){}});
}
test('quality changes magazine reload spread and noise while fixed optics keep range',()=>{
 const result=[];
 for(const quality of ['broken','repaired','intact','improved','refined']){
 const raid=raidFor(quality),p=raid.players.get('p'),stats=weaponFittingStats(p.gear,'primary',id=>catalog.byId.get(id));
 assert.equal(p.magazines.primary,stats.magazineCapacity);assert.equal(p.magazines.primary+p.reserveAmmo['test-ammo'],100);
 p.magazines.primary=0;raid.reload(p,'primary',1000);assert.equal(p.reloadEndsAt-1000,stats.reloadSeconds*1000);
 raid.finishReload(p);let direction;raid.hitscan=(_p,_w,d)=>{direction=d;};raid.seed=0;raid.shotIndex=0;
 raid.resolveShot(p,{slot:'primary',weapon:gun,direction:{x:1,z:0}},1000);
 assert.equal(p.noiseRadius,stats.noiseRadius);result.push({capacity:stats.magazineCapacity,time:stats.reloadSeconds,range:stats.range,noise:p.noiseRadius,spread:Math.abs(direction.z)});
 }
 for(let i=1;i<result.length;i++){assert.ok(result[i].capacity>result[i-1].capacity);assert.ok(result[i].time<result[i-1].time);assert.equal(result[i].range,result[i-1].range);assert.ok(result[i].noise<result[i-1].noise);assert.ok(result[i].spread<result[i-1].spread);}
});
test('shrinking magazine grade preserves concrete loaded ammo and exact total rounds',()=>{
 const raid=raidFor('refined'),p=raid.players.get('p');p.reserveAmmo['test-ammo']=0;const before=p.magazines.primary;
 p.gear['primary:magazine']='extended-mag-broken';raid.reload(p,'primary',1000);assert.equal(p.reloadSlot,'primary');raid.finishReload(p);
 assert.equal(p.magazines.primary,35);assert.equal(p.loadedAmmo.primary,'test-ammo');assert.equal(p.magazines.primary+p.reserveAmmo['test-ammo'],before);
});
test('lower quality tactical pouch replacement rejects capacity overflow without consuming either part',()=>{
 const player={gear:{armor:'armor-6','armor:0':'tactical-pouch-refined'},inventory:[{itemId:'tactical-pouch-broken',quantity:1},{itemId:'weight',quantity:146}],reserveAmmo:{}};
 const byId=new Map([...ITEMS,{id:'weight',weight:1}].map(i=>[i.id,i])),local={byId,talents:[]};
 assert.throws(()=>planRaidEquipment(player,'vest','tactical-pouch-broken',local,0),e=>e.code==='OVER_CAPACITY');
 assert.equal(player.gear['armor:0'],'tactical-pouch-refined');assert.equal(player.inventory[0].quantity,1);
});
