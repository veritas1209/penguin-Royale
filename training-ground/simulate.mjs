import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Raid,normalizeCatalog} from './runtime/server/game.js';
import {equipEnemy} from './runtime/server/enemyCombat.js';
import {ITEMS,TALENTS} from './runtime/shared/catalog.ts';

const directory=dirname(fileURLToPath(import.meta.url));
const scenarioFile=resolve(process.argv[2]??join(directory,'scenario.json'));
const reportFile=resolve(process.argv[3]??join(directory,'report.html'));
const scenario=JSON.parse(await readFile(scenarioFile,'utf8'));
const manifest=JSON.parse(await readFile(join(directory,'runtime-manifest.json'),'utf8'));
const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS});

function finite(value,label,defaultValue){
 const number=value==null?defaultValue:Number(value);
 if(!Number.isFinite(number))throw new Error(label+' must be finite');
 return number;
}
const durationMs=finite(scenario.durationMs,'durationMs',4000);
const stepMs=finite(scenario.stepMs,'stepMs',50);
if(durationMs<0||durationMs>120000||stepMs<10||stepMs>200||durationMs/stepMs>12000)
 throw new Error('Use durationMs 0..120000 and stepMs 10..200');
const playerSpec=scenario.player??{};
const weaponId=playerSpec.weaponId??'legend-araya';
const weapon=catalog.byId.get(weaponId);
if(!weapon||weapon.category!=='weapon')throw new Error('Unknown weapon: '+weaponId);
const enemySpecs=scenario.enemies??[];
if(!Array.isArray(enemySpecs)||enemySpecs.length>30)throw new Error('Use at most 30 enemies');
const ids=new Set();
for(const enemy of enemySpecs){
 if(!enemy.id||ids.has(enemy.id))throw new Error('Enemy ids must be unique and nonempty');
 ids.add(enemy.id);
}
const actions=[...(scenario.actions??[])].sort((a,b)=>a.atMs-b.atMs);
for(const action of actions){
 const at=finite(action.atMs,'action.atMs',0);
 if(at<0||at>durationMs)throw new Error('Action outside duration: '+at);
}

const START=1000;
let clock=START,sequence=0;
const events=[],errors=[];
const db={
 profile(){return {talents:[]};},
 updateRaidLoot(){},updateRaidEquipment(){},updateRaidInventoryState(){},addInventory(){},
 settleRaidPlayer(){return {applied:true};},
 markRaidCompleteIfSettled(){}
};
const world={
 id:'offline-combat',name:'Offline Combat Lab',size:finite(scenario.size,'size',80),
 spawn:{x:finite(playerSpec.x,'player.x',0),z:finite(playerSpec.z,'player.z',0)},
 obstacles:scenario.obstacles??[],lootSpawns:[],enemySpawns:[],
 extractions:[],radiationZones:[],roads:[],terrain:[],landmarks:[],accessDoors:[]
};
const room={mode:'solo',members:new Map([['sim-player',{username:'Simulator'}]])};
const raid=new Raid({
 id:'offline-simulation',room,escrow:[{userId:'sim-player',gear:[{slot:'melee',itemId:weaponId,quantity:1}]}],
 db,catalog,world,now:()=>clock,emit(message){
  if(message.type==='event')events.push({atMs:clock-START,kind:message.kind,data:message.data});
 },options:{initialEnemyDelayMs:0,raidLimitMs:durationMs+60000}
});
raid.enemies.clear();
raid.pendingInitialEnemies=null;
raid.majorResponses.clear();
raid.bossZones=[];
raid.bossWarnings=[];
raid.goldenBossEvent={planned:false,warned:false,spawned:false};
raid.squadPatrol={routes:[],active:null,nextAt:Infinity,sequence:0};
raid.events.length=0;
events.length=0;
const player=raid.players.get('sim-player');
player.hp=finite(playerSpec.hp,'player.hp',player.maxHp);
player.maxHp=Math.max(player.maxHp,player.hp);
player.activeWeaponSlot='melee';

for(const spec of enemySpecs){
 const kind=spec.kind??'raider';
 const hp=finite(spec.hp,'enemy.hp',100);
 const enemy={
  id:spec.id,name:spec.name??spec.id,kind,
  x:finite(spec.x,'enemy.x',0),z:finite(spec.z,'enemy.z',3),
  hp,maxHp:hp,armor:finite(spec.armor,'enemy.armor',0),
  speed:finite(spec.speed,'enemy.speed',2.5),damage:finite(spec.damage,'enemy.damage',10),
  attackMs:800,rangedRange:20,aggroRadius:25,
  targetId:null,nextAttackAt:START+1200,stunnedUntil:0,alertState:'patrol'
 };
 if(spec.bossId)enemy.bossId=spec.bossId;
 equipEnemy(raid,enemy,{kind,weaponId:spec.weaponId,armorTier:spec.armorTier});
 enemy.hp=hp;enemy.maxHp=hp;
 enemy.yaw=finite(spec.yaw,'enemy.yaw',enemy.yaw);
 enemy.armor=finite(spec.armor,'enemy.armor',enemy.armor);
 if(spec.ai!==true){
  enemy.stunnedUntil=Infinity;
  enemy.nextAttackAt=Infinity;
  enemy.rangedRange=0;
  enemy.speed=0;
  enemy.medicalUses=0;
 }
 raid.enemies.set(enemy.id,enemy);
}

const lastEnemyPositions=new Map(enemySpecs.map(spec=>[spec.id,{x:spec.x??0,z:spec.z??3}]));
const frames=[];
function capture(atMs){
 const enemies=enemySpecs.map(spec=>{
  const enemy=raid.enemies.get(spec.id);
  if(enemy)lastEnemyPositions.set(spec.id,{x:enemy.x,z:enemy.z});
  const position=lastEnemyPositions.get(spec.id);
  return {id:spec.id,name:spec.name??spec.id,x:position.x,z:position.z,
   hp:Math.max(0,enemy?.hp??0),maxHp:spec.hp??100,alive:Boolean(enemy&&enemy.hp>0),
   ai:spec.ai===true,armor:enemy?.armor??spec.armor??0,
   alertState:enemy?.alertState??'dead'};
 });
 frames.push({atMs,player:{x:player.x,z:player.z,hp:Math.max(0,player.hp),maxHp:player.maxHp,
  alive:player.alive,stamina:player.stamina,yaw:player.yaw},
  enemies,projectiles:[...raid.projectiles.values()].map(p=>({x:p.x,z:p.z,kind:p.kind,hostile:p.hostile})),
  areas:raid.areas.map(a=>({x:a.x,z:a.z,radius:a.radius,kind:a.kind}))});
}
let actionIndex=0;
const times=[];
for(let elapsed=0;elapsed<durationMs;elapsed+=stepMs)times.push(elapsed);
times.push(durationMs);
for(const elapsed of times){
 clock=START+elapsed;
 while(actionIndex<actions.length&&actions[actionIndex].atMs<=elapsed){
  const action=actions[actionIndex++];
  try{
   if(action.type==='fixture_position'){
    const target=action.targetId==='sim-player'?player:raid.enemies.get(action.targetId);
    if(!target)throw new Error('Unknown fixture target: '+action.targetId);
    target.x=finite(action.x,'fixture.x',target.x);
    target.z=finite(action.z,'fixture.z',target.z);
   }else{
    const {atMs,...message}=action;
    raid.command('sim-player',{...message,seq:++sequence});
   }
  }catch(error){
   errors.push({atMs:elapsed,action,message:String(error?.message??error)});
  }
 }
 if(elapsed>0)raid.tick(clock);
 capture(elapsed);
}
const summary={
 dealt:events.filter(e=>e.kind==='hit'&&e.data.playerId==='sim-player').reduce((sum,e)=>sum+(e.data.damage??0),0),
 hits:events.filter(e=>e.kind==='hit'&&e.data.playerId==='sim-player').length,
 kills:events.filter(e=>e.kind==='kill'&&e.data.playerId==='sim-player').length,
 playerHp:Math.max(0,player.hp),
 survivors:[...raid.enemies.values()].filter(e=>ids.has(e.id)).length
};
const report={
 name:scenario.name??'Combat simulation',weaponId,weaponName:weapon.name,
 durationMs,stepMs,engineHash:manifest.files['server/game.js'].slice(0,12),
 scenario,summary,frames,events,errors
};
const jsonFile=reportFile.endsWith('.html')?reportFile.slice(0,-5)+'.json':reportFile+'.json';
await writeFile(jsonFile,JSON.stringify(report,null,2));
const template=await readFile(join(directory,'report-template.html'),'utf8');
const safeData=JSON.stringify(report).replaceAll('<',String.fromCharCode(92)+'u003c');
await writeFile(reportFile,template.replace('__SIM_DATA__',safeData));
console.log('Simulation:',report.name);
console.log('Engine:',report.engineHash,'Weapon:',weaponId);
console.log('Damage events:',summary.hits,'Damage:',summary.dealt,'Kills:',summary.kills,'Player HP:',summary.playerHp);
console.log('Report:',reportFile);
if(errors.length){
 console.error('Action errors:',errors.length);
 process.exitCode=1;
}
