import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function createTraining(){
  const listeners=new Map(),elements=new Map(),buttons=Array.from({length:4},()=>({
    addEventListener(){},classList:{toggle(){}}
  }));
  const element=id=>{
    if(!elements.has(id))elements.set(id,{
      id,style:{},classList:{add(){},remove(){}},textContent:'',value:id==='ai-count'?'6':'assault',
      checked:false,disabled:false,innerHTML:'',selectedOptions:[{textContent:'교전·추격'}],
      setAttribute(){},addEventListener(type,handler){listeners.set(id+':'+type,handler);}
    });
    return elements.get(id);
  };
  const canvas=element('game-canvas');
  let now=1000,scopeKind=null;
  class Group{add(){}}
  class Mesh{constructor(){this.position={set(){}};this.receiveShadow=false;}}
  class View{
    constructor(){
      this.renderer={setPixelRatio(){},info:{render:{calls:0}},domElement:canvas};
      this.stage={add(){}};
      this.actorMap=new Map();
      this.movement={state:{x:0,z:0,stamina:100,maxStamina:100,moveMultiplier:1,staminaRecoveryAt:0},history:[]};
      this.pred={x:0,z:0,set(x,y,z){this.x=x;this.z=z;}};
      this.aim={x:0,z:-1};
      this.scopeZoom=1;
    }
    start(){this.movement.state={x:0,z:0,stamina:100,maxStamina:100,moveMultiplier:1,staminaRecoveryAt:0};}
    resetScope(){scopeKind=null;this.scopeZoom=1;}
    setScope(kind){scopeKind=kind;this.scopeZoom=1.28;}
    resize(){} setSnapshot(){} setWeapon(){} directionAim(x,z){this.aim={x,z};}
    burst(){} reactHit(){} shot(){} pointerAim(){}
  }
  const window={__LIVE_TRAINING__:{weapons:[{id:'legend-araya',mode:'melee'}]},
    devicePixelRatio:1,addEventListener(type,handler){listeners.set('window:'+type,handler);}};
  const context={window,document:{getElementById:element,querySelectorAll:()=>buttons},
    Audio:class{play(){return Promise.resolve();}},vg:View,H:Group,U:Mesh,lh:class{},Lo:class{},
    performance:{now:()=>now},requestAnimationFrame(){},console,__bcMeleeSlash76(){},Q:null};
  runInNewContext(readFileSync(new URL('./training-controller.js',import.meta.url),'utf8'),context);
  return {window,elements,trigger(id,type,event={}){listeners.get(id+':'+type)?.(event);},
    tick(ms){now+=ms;},get scopeKind(){return scopeKind;}};
}

test('targets wait for training start and reset returns to idle',()=>{
  const harness=createTraining();
  assert.equal(harness.window.__TRAINING__.state.ai,false);
  assert.equal(harness.elements.get('status').textContent,'표적 대기 중');
  assert.equal(harness.elements.get('skill-cooldown').textContent,'재사용 8초');
  harness.trigger('training-start','click');
  assert.equal(harness.window.__TRAINING__.state.ai,true);
  harness.trigger('reset','click');
  assert.equal(harness.window.__TRAINING__.state.ai,false);
});

test('right mouse button aims a held legendary blade until release',()=>{
  const harness=createTraining();
  harness.trigger('game-canvas','pointerdown',{button:2,preventDefault(){}});
  assert.equal(harness.scopeKind,'red-dot');
  assert.equal(harness.window.__TRAINING__.state.scopeHeld,true);
  harness.trigger('window','pointerup',{button:2});
  assert.equal(harness.window.__TRAINING__.state.scopeHeld,false);
  assert.equal(harness.scopeKind,null);
});

test('Araya final max-health cut counts as a kill',()=>{
  const harness=createTraining(),enemy=harness.window.__TRAINING__.enemies.find(e=>e.id==='front');
  enemy.x=0;enemy.z=14;enemy.maxHp=5000;enemy.hp=5000;enemy.cap=5000;
  for(let i=0;i<4;i++){harness.window.__TRAINING__.strike();harness.tick(500);}
  assert.equal(enemy.hp,0);
  assert.equal(harness.window.__TRAINING__.state.kills,1);
});
