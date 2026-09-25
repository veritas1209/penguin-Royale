import {ArcticFoliage} from './arcticFoliage';
import {PointerAim} from './pointerAim';
import {LobbyIdleMotion} from './lobbyIdleMotion';
import {FirearmEffects,firearmEffectProfile} from './firearmEffects';
import {ITEM_BY_ID} from '../shared/catalog';
import {MovementPrediction} from './movementPrediction';
import {findWeaponMuzzle,type WeaponEquipment} from './weaponAttachments';
import {resolveShotVisual} from './shotVisuals';
import * as T from 'three';
import {RaidAccessEffects} from './raidAccessEffects';
import {RaidEffects} from './raidEffects';
import {searchableCrate} from './searchableCrate';
import {BuildingOcclusion} from './buildingOcclusion';
import {BossPresentation} from './bossPresentation';
import {guardRobot} from './guardRobot';
import {buildArcticDetails,buildArcticStructure} from './arcticDetails';
import type {WorldDef,WorldObstacle} from '../shared/world';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C,mat,mesh,ball,block,cylinder,rod,textPlate,penguin,crate,pine,rock, type Penguin } from './art';
import {ScopeViewState,type ScopeKind} from './scopeView';

const BASE_SCOPE_ZOOM_DAMPING=2; // Previous damping 5: transition time is now 2.5x longer.

const CORPSE_RARITY_COLORS=[
 '#9ba0a9',
 '#a4cc55',
 '#579de0',
 '#a67cdb',
 '#e675b1',
 '#dc5b60',
 '#edc65a',
];

function corpseRarityRank(item:any){
 if(!item)return 0;
 if(item.quality==='gold')return 6;

 const level=
  Number(
   item.equipmentLevel??
   item.tier??
   1
  );

 return Math.max(
  0,
  Math.min(5,level-1)
 );
}

function syncCorpseRarityBeam(
 model:T.Group,
 container:any
){
 let rank=0;

 const isCorpse=
  container.visualType==='player-loot' ||
  /전리품$/.test(
   String(container.name??'').trim()
  );

 if(isCorpse){
  for(const stack of container.items??[]){
   rank=Math.max(
    rank,
    corpseRarityRank(
     ITEM_BY_ID[stack.itemId]
    )
   );
  }
 }

 let beam=
  model.getObjectByName(
   'corpse-rarity-beam'
  ) as T.Mesh|null;

 if(rank<=0){
  if(beam)beam.visible=false;
  return;
 }

 if(!beam){
  beam=new T.Mesh(
   new T.CylinderGeometry(
    .13,
    .22,
    9,
    16,
    1,
    true
   ),
   new T.MeshBasicMaterial({
    color:CORPSE_RARITY_COLORS[rank],
    transparent:true,
    opacity:.48,
    depthWrite:false,
    depthTest:false
   })
  );

  beam.name='corpse-rarity-beam';
  beam.position.set(0,4.5,0);
  beam.renderOrder=100;
  beam.frustumCulled=false;

  model.add(beam);
 }

 beam.visible=true;

 const material=
  beam.material as T.MeshBasicMaterial;

 material.color.set(
  CORPSE_RARITY_COLORS[rank]
 );
}
type Obj=Record<string,any>;
function batch(source:T.Group){const out=new T.Group(),by=new Map<T.Material,T.BufferGeometry[]>(),casters=new Set<T.Material>();source.updateMatrixWorld(true);source.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.Material;if(o.castShadow)casters.add(m);let arr=by.get(m);if(!arr)by.set(m,arr=[]);const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geo.index)arr.push(geo.toNonIndexed());else arr.push(geo);}});for(const [m,geos]of by){const geo=mergeGeometries(geos,false);if(geo){const o=new T.Mesh(geo,m);o.userData.occluder=!!source.userData.occluder;o.castShadow=casters.has(m);o.receiveShadow=true;out.add(o);}geos.forEach(g=>g.dispose());}return out;}
function random(seed=816){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
let enemyAlertMaterial:T.SpriteMaterial|undefined;
function enemyAlertIcon(){
 if(!enemyAlertMaterial){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.beginPath();ctx.arc(32,32,27,0,Math.PI*2);ctx.fillStyle='#ffd62b';ctx.fill();ctx.lineWidth=5;ctx.strokeStyle='#111411';ctx.stroke();
  ctx.fillStyle='#111411';ctx.font='900 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',32,34);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;enemyAlertMaterial=new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false});
 }
 const icon=new T.Sprite(enemyAlertMaterial);icon.name='enemy-alert-icon';icon.position.set(0,2.65,0);icon.scale.set(.82,.82,1);icon.visible=false;return icon;
}
function building(w:number,d:number,h:number,color:string,label:string){const g=new T.Group();block(g,'#82958a',0,.16,0,w+.35,.32,d+.35);block(g,color,0,h/2,0,w,h,d);for(let y=.55;y<h;y+=.45){block(g,'#ffffff',0,y,d/2+.01,w,.025,.015);}
 const shape=new T.Shape();shape.moveTo(-w/2-.35,0);shape.lineTo(0,1.15);shape.lineTo(w/2+.35,0);shape.closePath();const roof=mesh(new T.ExtrudeGeometry(shape,{depth:d+.7,bevelEnabled:false}),mat(C.navy),g,0,h,-d/2-.35);roof.name='gabled-roof';
 for(let x=-w/2-.15;x<w/2;x+=.5){const y=h+1.15-Math.abs(x)/(w/2+.35)*1.15;rod(g,'#6a8b94',[x,y+.02,-d/2-.35],[x,y+.02,d/2+.35],.025);}
 for(const s of [-1,1]){const snow=block(g,C.snow,s*w*.27,h+.74,0,w*.55,.18,d+.76);snow.rotation.z=s*-.35;}
 block(g,'#284e57',0,1.05,d/2+.03,1.18,2.1,.1);block(g,'#dab577',.37,1.05,d/2+.12,.065,.2,.07);
 for(const x of [-w*.31,w*.31]){block(g,C.white,x,1.65,d/2+.06,1.1,1.05,.1);block(g,'#7fa9a5',x,1.65,d/2+.13,.91,.87,.06);block(g,C.white,x,1.65,d/2+.18,.06,.92,.04);block(g,C.white,x,1.65,d/2+.18,.95,.06,.04);}
 const sign=textPlate(g,label,'#f3e8c4',color,Math.min(w-.4,3),.62);sign.position.set(0,h-.42,d/2+.09);
 cylinder(g,'#654f40',w*.27,h+.9,-d*.23,.23,2);ball(g,C.snow,w*.27,h+1.95,-d*.23,.33,.16,.33);return g;}
function cover(o:Obj){const custom=buildArcticStructure(o as WorldObstacle);if(custom)return custom;const g=new T.Group();const w=o.w??o.width??2,d=o.d??o.depth??1,h=o.h??o.height??1;const kind=o.kind??o.type??'barrier';
 if(kind==="road-gate"){
  const alongX=w>d,span=alongX?w:d,edge=-span/2+.42;
  const piece=(color:string,at:number,y:number,length:number,height:number,width:number)=>
   block(g,color,alongX?at:0,y,alongX?0:at,alongX?length:width,height,alongX?width:length);
  piece("#242c30",edge,.09,.85,.18,.85);
  piece("#e4b91b",edge,.84,.72,1.5,.72);
  piece("#f4cf27",edge,1.62,.8,.12,.8);
  piece("#343b3d",edge,1.7,.24,.24,.24);
  const armStart=edge+.3,armLength=Math.max(1.5,span-.82);
  piece("#f0f2ed",armStart+armLength/2,1.75,armLength,.19,.17);
  for(let k=0;k<Math.floor(armLength/1.6);k++)piece("#b92a2b",armStart+1+k*1.6,1.77,.75,.075,.19);
  piece("#333b3e",span/2-.3,1.25,.16,2.5,.16);
  return g;
 }
 if(/building|hut|workshop|cabin|warehouse|office|lab|generator/.test(kind)){return building(w,d,h,o.color??C.teal,o.label??'BLUECAP');}
 if(/rock/.test(kind))return rock(w*.55,h,d*.55);
 if(/container/.test(kind)){block(g,o.color??C.red,0,h/2,0,w,h,d);for(let x=-w/2+.15;x<w/2;x+=.27)block(g,'#75493b',x,h/2,d/2+.012,.035,h*.89,.028);for(const x of [-w/2+.08,w/2-.08])block(g,C.trim,x,h/2,d/2+.035,.06,h,.045);block(g,C.snow,0,h+.04,0,w+.1,.13,d+.1);const sign=textPlate(g,'BC • 07','#e8dabb','#4a6060',Math.min(w*.7,2),.5);sign.position.set(0,h*.6,d/2+.07);return g;}
 if(/sandbag|barricade/.test(kind)){for(let y=.19;y<h;y+=.32)for(let x=-w/2+.3;x<w/2;x+=.57){ball(g,'#adb294',x+(Math.floor(y*3)%2)*.13,y,0,.34,.21,d*.56);}return g;}
 if(/car|truck/.test(kind)){block(g,C.teal,0,.75,0,w,1,d);block(g,'#c4ccbb',0,1.6,-d*.2,w*.87,.9,d*.45);block(g,'#507c7c',0,1.67,d*.03,w*.7,.52,.07);for(const x of [-w*.49,w*.49])for(const z of [-d*.3,d*.3]){cylinder(g,C.metal,x,.45,z,.43,.22).rotation.z=Math.PI/2;}return g;}
 if(/tree/.test(kind))return pine(h/3.8);
 if(/crate/.test(kind)){g.add(crate());g.scale.set(w,h/.85,d/.8);return g;}
 block(g,'#a4b2a3',0,h/2,0,w,h,d);block(g,C.snow,0,h+.035,0,w+.1,.11,d+.1);for(let x=-w/2+.15;x<w/2;x+=.38){const s=block(g,'#4f6355',x,h*.7,d/2+.02,.15,.22,.02);s.rotation.z=-.4;}return g;
}

export class SceneView {
 foliage=new ArcticFoliage();firearmFX=new FirearmEffects();occlusion=new BuildingOcclusion();bossFX=new BossPresentation();raidFX=new RaidEffects();renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.OrthographicCamera();stage=new T.Group();actors=new T.Group();effects=new T.Group();hero:Penguin;preview:Penguin;actorMap=new Map<string,Penguin>();lootMap=new Map<string,T.Group>();containerMap=new Map<string,T.Group>();accessFX=new RaidAccessEffects();baseObstacles:Obj[]=[];world:Obj={};inRaid=false;playerId='';look=new T.Vector3();aim=new T.Vector3(0,0,1);pointerAimState=new PointerAim();lobbyIdle=new LobbyIdleMotion();scopeView=new ScopeViewState();scopeZoom=1;scopeSpeed=BASE_SCOPE_ZOOM_DAMPING;clock=new T.Clock();elapsed=0;trauma=0;particles:{m:T.Mesh,life:number,max:number,v:T.Vector3}[]=[];snap:Obj|null=null;pred=new T.Vector3();movement=new MovementPrediction();moveX=0;moveZ=0;sprinting=false;lastSnap=0;fps=60;renderedFrames=0;
 constructor(canvas:HTMLCanvasElement){this.renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:1.7));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.scene.background=new T.Color('#bbccc5');this.scene.fog=new T.Fog('#bbccc5',50,140);const pm=new T.PMREMGenerator(this.renderer);this.scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;this.scene.environmentIntensity=.38;pm.dispose();this.scene.add(new T.HemisphereLight('#f3f4dd','#697c74',1.7));const sun=new T.DirectionalLight('#fff0cf',2.5);sun.name='following-sun';sun.position.set(-18,30,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-34;sun.shadow.camera.right=sun.shadow.camera.top=34;sun.shadow.camera.far=100;sun.shadow.normalBias=.045;sun.shadow.bias=-.0002;this.scene.add(sun,sun.target);this.scene.add(this.foliage.root,this.firearmFX.root,this.stage,this.actors,this.effects,this.raidFX.root,this.bossFX.root,this.accessFX.root);this.hero=penguin();this.preview=penguin();this.actors.add(this.preview.root);this.hideout();this.resize();addEventListener('resize',()=>this.resize());}
 resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.updateCameraProjection(w/h);}
 updateCameraProjection(aspect=innerWidth/innerHeight){const size=this.inRaid?(innerWidth<700?13:11.5):(innerWidth<700?6.8:7.2);const viewSize=size*this.scopeZoom;this.camera.left=-viewSize*aspect;this.camera.right=viewSize*aspect;this.camera.top=viewSize;this.camera.bottom=-viewSize;this.camera.near=.1;this.camera.far=250;this.camera.updateProjectionMatrix();}
 hideout(){this.lobbyIdle.reset();this.resetScope();this.pointerAimState.clear();this.inRaid=false;this.snap=null;this.clearStage();this.actorMap.forEach(p=>this.actors.remove(p.root));this.actorMap.clear();this.actors.add(this.preview.root);this.preview.root.position.set(0,0,0);this.preview.root.scale.setScalar(2.2);const g=new T.Group();block(g,'#9ba99b',0,-.35,0,28,.7,20);for(let x=-14;x<14;x+=2)for(let z=-10;z<10;z+=2){block(g,(x+z)%4?'#b1b9a8':'#b8bfad',x,.015,z,1.98,.035,1.98);}block(g,'#6d8178',0,3,-7,28,6,.35);for(let x=-13;x<14;x+=2){block(g,'#798e83',x,3,-6.78,.07,6,.1);}block(g,'#405f5d',-10,2.5,0,.4,5,14);cylinder(g,'#536e6a',0,.04,0,2.6,.16);cylinder(g,'#b2b89e',0,.14,0,2.33,.1);for(let i=0;i<12;i++){const a=i*Math.PI/6;block(g,'#e2c786',Math.sin(a)*2.46,.14,Math.cos(a)*2.46,.05,.025,.18).rotation.y=a;}
 const board=block(g,'#e1d6b8',3.8,3.8,-6.5,5.8,3.3,.15);board.name='operations-board';const title=textPlate(g,'NORTHPOINT  /  07','#2b565b','#e1d6b8',4.6,.7);title.position.set(3.8,4.7,-6.38);for(let i=0;i<5;i++){const a=block(g,'#899c8d',2.1+i*.8,3.5,-6.34,.52,.8,.02);a.rotation.z=(i%2-.5)*.3;}block(g,'#8e7150',-4.7,1.4,-4.6,4.8,.18,1.5);for(const x of [-6.5,-2.9])block(g,'#3b5046',x,.7,-4.6,.15,1.4,1.1);for(let i=0;i<4;i++){const c=crate(i===0?'medic':'weapon');c.position.set(-6+i*1.1,1.5,-4.6);c.scale.setScalar(.8);g.add(c);}const c=crate('weapon');c.position.set(3,0,-2);g.add(c);const c2=crate();c2.position.set(4,0,-3.3);g.add(c2);for(let i=0;i<3;i++){cylinder(g,'#66756a',6+i*.7,.45,-5.5,.27,.9);}
 const sign=textPlate(g,'KEEP YOUR FLIPPERS WARM','#eedbb1','#365f60',3,.62);sign.position.set(-4,4.6,-6.5);rod(g,C.metal,[-8,5.7,-4],[8,5.7,-4],.035);for(const x of [-6,0,6]){cylinder(g,C.metal,x,5.3,-4,.25,.15);ball(g,'#ffe5a7',x,5.19,-4,.2,.07,.2);}this.stage.add(batch(g));this.look.set(0,1.4,0);this.camera.position.set(10,10,17);this.camera.lookAt(this.look);this.resize();}
 clearStage(){this.foliage.reset();this.firearmFX.reset();this.occlusion.reset();this.bossFX.reset();this.raidFX.reset();this.particles.forEach(p=>{p.m.geometry.dispose();(p.m.material as T.Material).dispose();});this.stage.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.stage.clear();this.lootMap.clear();this.containerMap.clear();this.accessFX.reset();this.baseObstacles=[];this.effects.clear();this.particles=[];}
 start(world:Obj,playerId:string){this.resetScope();this.movement.reset();this.inRaid=true;this.playerId=playerId;this.clearStage();this.baseObstacles=(world.obstacles??[]).filter((o:Obj)=>!o.accessDoorId).map((o:Obj)=>({...o}));this.world={...world,obstacles:[...this.baseObstacles]};world=this.world;this.foliage.reset(world as WorldDef);this.raidFX.reset(world);this.actors.remove(this.preview.root);this.actorMap.clear();this.actors.clear();const g=new T.Group();const size=world.size??world.width??120;const groundMat=mat('#c0cfbf');const ground=mesh(new T.PlaneGeometry(size+60,size+60),groundMat,g,0,-.04,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 const water=mesh(new T.PlaneGeometry(size+100,35),mat('#649699',.24,.15),g,0,-.3,-size/2-12);water.rotation.x=-Math.PI/2;water.castShadow=false;
 const obstacles=world.obstacles??world.colliders??world.objects??[];for(const o of obstacles){if(o.kind==='interior-wall'||o.kind==='interior-window')continue;const ob=cover(o);ob.position.set(o.x,0,o.z);ob.rotation.y=o.rotation??o.yaw??0;if(o.kind==='blast-wall'){ob.traverse((part)=>{part.userData.occluder=true;});this.stage.add(ob);this.occlusion.add(ob,{x:o.x,z:o.z,w:o.w,d:o.d,wallHeight:o.h});continue;}g.add(ob);}
 const rng=random(154);for(let i=0;i<130;i++){const x=(rng()-.5)*size,z=(rng()-.5)*size;if(Math.abs(x)<size*.41&&Math.abs(z)<size*.41)continue;if((world.buildings??[]).some((b:Obj)=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2))continue;const p=pine(.7+rng()*.8);p.position.set(x,0,z);p.rotation.y=rng()*7;g.add(p);}
 for(let i=0;i<85;i++){const x=(rng()-.5)*size,z=(rng()-.5)*size;const r=rock(.2+rng()*.35,.12+rng()*.2,.2+rng()*.4);r.position.set(x,0,z);g.add(r);}
 for(const e of (world.extractions??[]).filter((e:Obj)=>e.kind==='fixed')){const mark=mesh(new T.RingGeometry((e.radius??5)-.16,e.radius??5,48),new T.MeshBasicMaterial({color:'#d4b86b',side:T.DoubleSide}),g,e.x,.075,e.z);mark.rotation.x=-Math.PI/2;for(let i=-1;i<=1;i+=2){block(g,'#dfd7aa',e.x+i*.6,.08,e.z,.18,.03,1.8);}block(g,'#dfd7aa',e.x,.081,e.z,1.2,.03,.17);for(let i=0;i<4;i++){const a=i*Math.PI/2;cylinder(g,C.orange,e.x+Math.sin(a)*3.3,.3,e.z+Math.cos(a)*3.3,.14,.6);}}
 // Coastline details anchor the outpost as a place rather than an arena.
 for(let i=0;i<18;i++){const x=-size/2+i*size/18;const r=rock(1.6,1.1,1.2);r.position.set(x,0,-size/2+1);g.add(r);}
 const details=buildArcticDetails(world as WorldDef);for(const detail of details.children.slice()){
  const definition=world.buildings?.find((b:Obj)=>b.id===detail.userData.buildingId);
  if(definition){const interior=new T.Group();interior.name=detail.name;detail.updateMatrixWorld(true);for(const part of detail.children)if(part instanceof T.Group)interior.add(batch(part));this.stage.add(interior);this.occlusion.add(interior,definition);}
  else g.add(detail);
 }const chunks=new Map<string,T.Group>();g.children.slice().forEach(o=>{const k=Math.floor(o.position.x/24)+','+Math.floor(o.position.z/24);let c=chunks.get(k);if(!c)chunks.set(k,c=new T.Group());c.add(o);});for(const chunk of chunks.values())this.stage.add(batch(chunk));this.resize();}
 setSnapshot(snapshot:Obj){this.snap=snapshot;this.raidFX.sync(snapshot);this.bossFX.sync(snapshot);this.lastSnap=performance.now();this.accessFX.sync(snapshot,this.world.buildings??[]);this.world.obstacles=[...this.baseObstacles,...this.accessFX.obstacles];const me=snapshot.players.find((p:Obj)=>p.id===this.playerId);if(me){this.movement.reconcile(me,snapshot.serverTime,this.lastSnap,this.world as any);this.pred.set(this.movement.state.x,0,this.movement.state.z);}
 const ids=new Set<string>();for(const p of [...snapshot.players,...snapshot.enemies]){ids.add(p.id);const isPlayer=snapshot.players.includes(p);let actor=this.actorMap.get(p.id);if(!actor){actor=p.kind==='drone'?guardRobot():penguin(isPlayer?'player':p.kind??'scav');this.actorMap.set(p.id,actor);this.actors.add(actor.root);actor.root.position.set(p.x,0,p.z);}if(!isPlayer&&!actor.root.userData.alertIcon){const icon=enemyAlertIcon();actor.root.add(icon);actor.root.userData.alertIcon=icon;}const alertIcon=actor.root.userData.alertIcon as T.Group|undefined;if(alertIcon)alertIcon.visible=(p.hp??1)>0&&Number.isFinite(p.alertedAt)&&snapshot.serverTime<(p.reactionReadyAt??0);actor.root.scale.setScalar(p.bossId?1.3:1);actor.root.userData.state=p;actor.root.visible=(p.hp>0||p.downed)&&!p.boarded;}
 for(const [id,a]of this.actorMap)if(!ids.has(id)){this.actors.remove(a.root);this.actorMap.delete(id);}
 const lootIds=new Set<string>();for(const l of snapshot.loot){lootIds.add(l.id);if(!this.lootMap.has(l.id)){const c=crate(/med|band|aid/i.test(l.itemId)?'medic':/ammo/i.test(l.itemId)?'crate':'weapon');c.scale.setScalar(.7);c.position.set(l.x,0,l.z);this.stage.add(c);this.lootMap.set(l.id,c);}}for(const[id,g]of this.lootMap)if(!lootIds.has(id)){this.stage.remove(g);this.lootMap.delete(id);this.burst(g.position.x,.5,g.position.z,'#efd388',12);}
 const containerIds=new Set<string>();

 for(const c of snapshot.containers??[]){
  containerIds.add(c.id);

  let model=this.containerMap.get(c.id);

  if(!model){
   model=searchableCrate(
    c.visualType??c.kind
   );

   model.position.set(c.x,0,c.z);
   this.stage.add(model);
   this.containerMap.set(c.id,model);
  }

  model.userData.state=c.state;
  model.userData.empty=
   c.state==='open'&&
   !(c.items?.length);

  const light=
   model.getObjectByName(
    'container-indicator'
   ) as T.Mesh;

  if(light)
   (
    light.material as
    T.MeshStandardMaterial
   ).color.set(
    c.state==='open'
     ?'#80b7a3'
     :c.state==='searching'
      ?'#f3d58d'
      :'#c9a566'
   );

  syncCorpseRarityBeam(
   model,
   c
  );
 }

 for(const[id,m] of this.containerMap){
  if(!containerIds.has(id)){
   this.stage.remove(m);
   this.containerMap.delete(id);
  }
 }

 }
 setWeapon(id:string,family:string,equipment?:WeaponEquipment){this.preview.setWeapon(id,family,equipment);const me=this.actorMap.get(this.playerId);me?.setWeapon(id,family,equipment);}
 setScope(kind:ScopeKind|undefined,enabled:boolean,aimTimeMultiplier=1){this.scopeSpeed=BASE_SCOPE_ZOOM_DAMPING/Math.max(.05,aimTimeMultiplier);this.scopeView.set(kind,enabled);}
 resetScope(){this.scopeView.reset();this.scopeZoom=1;this.updateCameraProjection();}
 pointerAim(x:number,y:number){this.pointerAimState.set(x,y);return this.refreshAim();}
 refreshAim(){return this.pointerAimState.update(this.camera,this.renderer.domElement.getBoundingClientRect(),this.pred,this.aim);}
 directionAim(x:number,z:number){this.pointerAimState.clear();if(Math.hypot(x,z)>.001)this.aim.set(x,0,z).normalize();}
 burst(x:number,y:number,z:number,color:string,count=8){for(let i=0;i<count;i++){const m=mesh(new T.IcosahedronGeometry(.07,0),new T.MeshBasicMaterial({color,transparent:true}),this.effects,x,y,z);const a=i/count*Math.PI*2;this.particles.push({m,life:.4,max:.4,v:new T.Vector3(Math.sin(a)*3,1+(i%3),Math.cos(a)*3)});}}
 shot(x:number,z:number,ax:number,az:number,enemy=false,actorId?:string){
  const actor=this.actorMap.get(actorId??this.playerId),socket=actor?findWeaponMuzzle(actor.gun):null;
  if(actor){actor.root.userData.motion??={};actor.root.userData.motion.shotAt=this.elapsed;}
  const item=ITEM_BY_ID[actor?.root.userData.state?.weaponId??''];
  if(!firearmEffectProfile(item).firearm)return;
  const origin=new T.Vector3(x+ax*.6,1.1,z+az*.6),eject=new T.Vector3(x+az*.32,1.14,z-ax*.32);
  if(actor&&socket){
   // Compute a virtual firing pose without touching the live actor's Euler/quaternion.
   actor.root.updateWorldMatrix(true,true);
   const pose=new T.Matrix4().makeRotationY(Math.atan2(ax,az));pose.scale(actor.root.scale);pose.setPosition(x,actor.root.position.y,z);
   if(actor.root.parent)pose.premultiply(actor.root.parent.matrixWorld);
   const toShot=pose.multiply(actor.root.matrixWorld.clone().invert());
   socket.getWorldPosition(origin).applyMatrix4(toShot);
   socket.parent?.localToWorld(eject.set(.12,.06,.02));eject.applyMatrix4(toShot);
  }
  const shot=resolveShotVisual(this.world.obstacles??[],{x,y:1.1,z},origin,{x:ax,z:az});if(!shot)return;
  const suppressed=!!socket?.parent?.userData.suppressed;
  if(shot.length>.01){
   const line=new T.Mesh(new T.CylinderGeometry(.018,.035,shot.length,5),new T.MeshBasicMaterial({color:enemy?'#e8aa81':'#ffe1a1',transparent:true}));
   line.position.set(shot.origin.x+shot.dx*shot.length/2,shot.origin.y,shot.origin.z+shot.dz*shot.length/2);
   line.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(shot.dx,0,shot.dz));
   this.effects.add(line);this.particles.push({m:line,life:.075,max:.075,v:new T.Vector3()});
  }
  this.firearmFX.emit(new T.Vector3(shot.origin.x,shot.origin.y,shot.origin.z),eject,ax,az,item,suppressed,socket?.parent??undefined);if(!enemy)this.trauma=.06;
 }

 reactHit(id:string){const actor=this.actorMap.get(id);if(actor){actor.root.userData.motion??={};actor.root.userData.motion.hurtAt=this.elapsed;}}
 update(dt:number,frameElapsed=dt){this.foliage.update(this.elapsed,this.pred);this.firearmFX.update(dt);this.accessFX.update(dt,this.pred);this.raidFX.update(dt);this.bossFX.update(dt);this.elapsed+=dt;const targetZoom=this.scopeView.active?this.scopeView.expansion:1;const nextZoom=T.MathUtils.damp(this.scopeZoom,targetZoom,this.scopeSpeed,dt);if(Math.abs(nextZoom-this.scopeZoom)>.0001){this.scopeZoom=nextZoom;this.updateCameraProjection();}this.fps=T.MathUtils.lerp(this.fps,1/Math.max(.000001,frameElapsed),.02);if(!this.inRaid){this.lobbyIdle.update(this.preview,dt);}else if(this.snap){const me=this.snap.players.find((p:Obj)=>p.id===this.playerId);if(me){const next=this.movement.advance({moveX:this.moveX,moveZ:this.moveZ,sprint:this.sprinting},dt,performance.now(),this.world as any,!!me.alive&&!me.downed&&!me.boarded);this.pred.set(next.x,0,next.z);}
 this.refreshAim();
 this.look.lerp(new T.Vector3(this.pred.x+this.aim.x*1.6,0,this.pred.z+this.aim.z*1.6),1-Math.exp(-dt*7));this.camera.position.set(this.look.x+this.trauma*Math.sin(this.elapsed*80),this.look.y+21,this.look.z+19);this.camera.lookAt(this.look.x,0,this.look.z);this.trauma*=Math.exp(-dt*16);
 this.refreshAim();
 for(const[id,a]of this.actorMap){const p=a.root.userData.state;if(!p)continue;const own=id===this.playerId;const target=own?this.pred:new T.Vector3(p.x,0,p.z);const moving=T.MathUtils.clamp(Math.hypot(a.root.position.x-target.x,a.root.position.z-target.z)/Math.max(.001,dt)/4.1,0,1.6);a.root.position.lerp(target,own?1:Math.min(1,dt*13));let yaw=own?Math.atan2(this.aim.x,this.aim.z):(p.yaw??Math.atan2(this.pred.x-p.x,this.pred.z-p.z));const motion=a.root.userData.motion??={};Object.assign(motion,{armed:!!p.weaponId,downed:!!p.downed,reloading:!!p.reloadEndsAt&&p.reloadEndsAt>(this.snap.serverTime??0),medical:!!p.medicalUse||!!p.reviving||!!p.healEndsAt&&p.healEndsAt>(this.snap.serverTime??0),searching:!!p.searching||(this.snap.containers??[]).some((c:Obj)=>c.search?.playerId===id)});a.animate(this.elapsed,moving,yaw,this.elapsed-(motion.hurtAt??-100)<.12);}
 for(const c of this.containerMap.values()){for(let i=0;i<3;i++){const drawer=c.getObjectByName('cabinet-drawer-'+i);if(drawer)drawer.position.z=T.MathUtils.damp(drawer.position.z,c.userData.state==='open'?.65:.37,9,dt);}const lid=c.getObjectByName('container-lid');if(lid)lid.rotation.x=T.MathUtils.damp(lid.rotation.x,c.userData.state==='open'?-1.85:0,9,dt);}


 }
 for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.effects.remove(p.m);p.m.geometry.dispose();(p.m.material as T.Material).dispose();this.particles.splice(i,1);continue;}p.m.position.addScaledVector(p.v,dt);p.v.y-=dt*4;(p.m.material as T.MeshBasicMaterial).opacity=p.life/p.max;}
 const sun=this.scene.getObjectByName('following-sun') as T.DirectionalLight;const lightX=this.inRaid?Math.round(this.look.x*4)/4:0,lightZ=this.inRaid?Math.round(this.look.z*4)/4:0;sun.position.set(lightX-18,30,lightZ+15);sun.target.position.set(lightX,0,lightZ);sun.target.updateMatrixWorld();if(this.inRaid)this.occlusion.update(this.camera,this.pred,dt,(this.snap?.enemies??[]).filter((e:Obj)=>Math.hypot(e.x-this.pred.x,e.z-this.pred.z)<18).slice(0,8).map((e:Obj)=>new T.Vector3(e.x,0,e.z)));this.renderer.render(this.scene,this.camera);this.renderedFrames++;}
 diagnostics(){return{foliage:this.foliage.diagnostics(),firearmEffects:this.firearmFX.diagnostics(),fps:Math.round(this.fps),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,dpr:this.renderer.getPixelRatio(),movementCorrection:this.movement.correction,movementCPU:{...this.movement.cpu,historyFrames:this.movement.history.length},state:this.inRaid?'active-play':'hideout'};}
}
