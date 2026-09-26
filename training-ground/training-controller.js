// Local 3D training ground controller. The preceding script is the production 3D client through SceneView.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("game-canvas");
  const status = $("status");
  const logBox = $("event-log");
  const weaponName = $("weapon-name");
  const weaponStats = $("weapon-stats");
  const weapons = [
    {id:"legend-araya",name:"천살성도 - 아라야시키",damage:150,fireRate:2.25,range:5,color:"#edc65a",skill:"일섬",skillText:"최대 16m · 경로 적 30 피해/화상 · 마지막 적 뒤 추가 30 피해와 0.5초 공중 띄우기",cooldown:8000},
    {id:"legend-thunder",name:"징벌자 선더클랩",damage:90,fireRate:1.5,range:5,color:"#8fd9ff",skill:"천벌",skillText:"가장 가까운 적 최대 5명 · 각 200 피해",cooldown:15000},
    {id:"legend-karambit",name:"태양의 불꽃 - 카람빗",damage:85,fireRate:3,range:5,color:"#ffad73",skill:"초가속",skillText:"5초간 공격속도 +200% (3배)",cooldown:30000},
    {id:"legend-arbiter",name:"어비터 아이스",damage:110,fireRate:1.5,range:5,color:"#b6eaff",skill:"빙결 폭풍",skillText:"전방 18m × 폭 8m 범위의 적에게 50 피해 · 이동과 공격 5초 정지",cooldown:30000}
  ];
  const starts = [
    {id:"front",name:"정면 표적",x:0,z:2,hp:480},
    {id:"left",name:"좌측 표적",x:-4,z:1,hp:480},
    {id:"right",name:"우측 표적",x:4,z:1,hp:480},
    {id:"rear",name:"후방 표적",x:0,z:-6,hp:480},
    {id:"heavy",name:"중장갑 표적",x:-9,z:-7,hp:900},
    {id:"far",name:"거리 표적",x:9,z:-7,hp:900},
    {id:"dps",name:"무적 DPS 표적",x:-6,z:8,hp:1000000,immortal:true}
  ];
  const world = {
    id:"offline-training",name:"전투 훈련장",size:82,spawn:{x:0,z:13},
    roads:[{x:0,z:2,w:34,d:34}],buildings:[],terrain:[],landmarks:[],radiationZones:[{id:"offstage-rad",x:150,z:150,radius:10,hpPerSecond:0,maxHpPerSecond:0,minMaxHp:100}],
    lootSpawns:[],enemySpawns:[],accessDoors:[],extractions:[],
    obstacles:[
      {id:"cover-a",x:-12,z:5,w:4.5,d:1.2,h:1.1,kind:"sandbag",rotation:0},
      {id:"cover-b",x:12,z:5,w:4.5,d:1.2,h:1.1,kind:"sandbag",rotation:0},
      {id:"cover-c",x:-12,z:-10,w:4.5,d:1.2,h:1.1,kind:"sandbag",rotation:0},
      {id:"cover-d",x:12,z:-10,w:4.5,d:1.2,h:1.1,kind:"sandbag",rotation:0}
    ]
  };
  let view, enemies=[], selected=0, lastShot=0, time=0, lastFrame=0, lastSnapshot=0;
  let kills=0, damageDone=0, playerHp=100, running=true, ai=false, seq=0;
  const keys = new Set();
  const eventLog=[];
  const skillReadyAt=new Map();
  const skillVisuals=[];
  let karambitBuffUntil=0;
  let dashTargeting=false,dashPreview=null,dashPreviewTravel=0;
  let dashMotion=null;
  let dpsEvents=[],dpsTotal=0,dpsPeak=0,dpsNow=0,dpsStartedAt=0;
  const dashSound=new Audio("__DASH_SOUND_DATA__");
  const thunderSound=new Audio("__LIGHTNING_SOUND_DATA__");
  const magicSoundUrl="__MAGIC_SOUND_DATA__";
  const karambitSound=new Audio(magicSoundUrl);
  const arbiterSound=new Audio("__ARBITER_SOUND_DATA__");
  for(const sound of [dashSound,thunderSound,karambitSound,arbiterSound])sound.preload="auto";
  dashSound.volume=.6;
  thunderSound.volume=.48;
  karambitSound.volume=arbiterSound.volume=.55;
  function playSkillSound(sound){
    sound.currentTime=0;
    sound.play().catch(()=>{});
  }
  function log(message){
    eventLog.unshift(message);
    if(eventLog.length>8)eventLog.length=8;
    logBox.innerHTML=eventLog.map((x)=>"<div>"+x+"</div>").join("");
  }
  function error(err){
    status.textContent="훈련장 실행 오류: "+String(err && (err.stack || err.message) || err);
    status.classList.add("error");
    console.error(err);
  }
  window.addEventListener("error",(e)=>error(e.error || e.message));
  window.addEventListener("unhandledrejection",(e)=>error(e.reason));
  function weapon(){return weapons[selected];}
  function makeSnapshot(){
    const now=performance.now();
    return {
      v:1,type:"snapshot",id:++seq,serverTime:now,
      raid:{id:"offline-training",phase:"active",elapsedMs:time*1000},
      players:[{id:"trainer",username:"훈련병",x:view.pred.x,z:view.pred.z,
        yaw:Math.atan2(view.aim.x,view.aim.z),hp:playerHp,maxHp:100,alive:playerHp>0,
        downed:false,boarded:false,weaponId:weapon().id,
        activeWeaponSlot:"melee",stamina:view.movement.state.stamina,
        maxStamina:view.movement.state.maxStamina,
        staminaRecoveryAt:view.movement.state.staminaRecoveryAt,
        movement:{clientTime:now,serverTime:now,moveMultiplier:1}}],
      enemies:enemies.map((e)=>({id:e.id,name:e.name,kind:"raider",
        x:e.x,z:e.z,yaw:Math.atan2(view.pred.x-e.x,view.pred.z-e.z),
        hp:e.hp,maxHp:e.maxHp,alive:e.hp>0,weaponId:"akm",burning:e.burn>0,
        alertState:e.frozenUntil>now?"frozen":ai?"combat":"idle"})),
      loot:[],containers:[],projectiles:[],bossZones:[],bossWarnings:[],
      accessDoors:[],entry:{},extractions:[],areas:[],events:[]
    };
  }
  function sync(){
    view.setSnapshot(makeSnapshot());
    for(const e of enemies){
      const actor=view.actorMap.get(e.id);
      if(actor&&!actor.root.userData.trainingArmed){
        actor.setWeapon("akm","rifle");
        actor.root.userData.trainingArmed=true;
        const animate=actor.animate.bind(actor);
        actor.animate=(...args)=>e.frozenUntil>performance.now()?undefined:animate(...args);
      }
    }
    updateLabels();
    updateTargetLabels();
  }
  function select(index){
    cancelDashTarget();
    dashMotion=null;
    selected=index;
    view.setWeapon(weapon().id,"melee");
    weaponName.textContent=weapon().name;
    weaponStats.textContent="기본 공격 "+weapon().damage+" · 사거리 "+weapon().range+"m · 초당 "+weapon().fireRate+"회";
    $("skill-name").textContent=weapon().skill;
    $("skill-detail").textContent=weapon().skillText;
    document.querySelectorAll(".weapon").forEach((b,i)=>b.classList.toggle("active",i===selected));
    log("무기 장착: "+weapon().name);
    sync();
  }
  function reset(){
    cancelDashTarget();
    dashMotion=null;
    view.start(world,"trainer");
    enemies=starts.map((e)=>({...e,maxHp:e.hp,cap:e.hp,burn:0,burnCarry:0,attackAt:0,frozenUntil:0}));
    skillReadyAt.clear();karambitBuffUntil=0;
    dpsEvents=[];dpsTotal=0;dpsPeak=0;dpsNow=0;dpsStartedAt=0;
    for(const visual of skillVisuals){visual.mesh.removeFromParent();visual.mesh.geometry.dispose();visual.mesh.material.dispose();}
    skillVisuals.length=0;
    view.movement.state.x=0;
    view.movement.state.z=13;
    view.movement.state.stamina=100;
    view.movement.state.maxStamina=100;
    view.pred.set(0,0,13);
    view.directionAim(0,-1);
    kills=0;damageDone=0;playerHp=100;lastShot=0;time=0;running=true;
    select(selected);
    status.textContent="로컬 3D 훈련장 · 연결 없이 실행 중";
    status.classList.remove("error");
    log("표적 6개와 무적 DPS 표적 배치 완료");
    updateSkillHud();
    updateDps(performance.now());
  }
  function hurt(e,amount,kind,quiet=false){
    if(e.hp<=0||amount<=0)return 0;
    if(e.immortal){
      const dealt=amount>=99999?weapon().damage:amount;
      const now=performance.now();
      if(!dpsStartedAt)dpsStartedAt=now;
      dpsEvents.push({at:now,damage:dealt});
      dpsTotal+=dealt;
      damageDone+=dealt;
      if(!quiet){
        view.reactHit(e.id);
        view.burst(e.x,1.15,e.z,kind||weapon().color,9);
      }
      return dealt;
    }
    const before=e.hp;
    e.hp=Math.max(0,e.hp-amount);
    const dealt=before-e.hp;
    damageDone+=dealt;
    if(!quiet||e.hp<=0){
      view.reactHit(e.id);
      view.burst(e.x,1.15,e.z,kind || weapon().color,9);
      log(e.name+" "+Math.round(dealt)+" 피해"+(e.hp<=0?" · 처치":""));
    }
    if(before>0&&e.hp<=0)kills++;
    return dealt;
  }
  function strike(){
    if(!running||playerHp<=0||dashTargeting||dashMotion)return;
    const now=performance.now();
    const w=weapon();
    const rate=w.fireRate*(w.id==="legend-karambit"&&now<karambitBuffUntil?3:1);
    if(now-lastShot<1000/rate)return;
    lastShot=now;
    const actor=view.actorMap.get("trainer");
    if(actor){
      actor.root.userData.motion=actor.root.userData.motion||{};
      actor.root.userData.motion.meleeAt=view.elapsed;
    }
    const px=view.pred.x,pz=view.pred.z,ax=view.aim.x,az=view.aim.z;
    __bcMeleeSlash76('trainer',w.id,ax,az,w.range,140);
    const minimumDot=Math.cos(70*Math.PI/180);
    const hits=enemies.filter((e)=>{
      if(e.hp<=0)return false;
      const dx=e.x-px,dz=e.z-pz,d=Math.hypot(dx,dz);
      return d>=0.01&&d<=w.range&&(dx*ax+dz*az)/d>=minimumDot;
    }).sort((a,b)=>Math.hypot(a.x-px,a.z-pz)-Math.hypot(b.x-px,b.z-pz));
    view.burst(px+ax*1.6,.9,pz+az*1.6,w.color,5);
    if(!hits.length){log("공격 빗나감");return;}
    for(const e of hits){
      if(w.id==="legend-araya"){
        if(!e.immortal){
          e.cap=Math.max(0,e.cap-e.maxHp*.3);
          e.hp=Math.min(e.hp,e.cap);
        }
        e.burn++;
        const dealt=!e.immortal&&e.cap<=0?hurt(e,99999,w.color):hurt(e,w.damage,w.color);
        if(dealt>0){
          skillReadyAt.set(w.id,Math.max(now,(skillReadyAt.get(w.id)||now)-1000));
          log("아라야시키 · 일섬 재사용 1초 감소");
        }
      }else if(w.id==="legend-arbiter"){
        hurt(e,Math.random()<.25?99999:w.damage,w.color);
      }else if(w.id==="legend-thunder"){
        hurt(e,w.damage,w.color);
        const chain=enemies.filter((t)=>t!==e&&t.hp>0&&Math.hypot(t.x-e.x,t.z-e.z)<=30)
          .sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z)).slice(0,2);
        for(const t of chain)hurt(t,Math.round(w.damage*.45),w.color);
      }else hurt(e,w.damage,w.color);
    }
    sync();
    updateSkillHud();
  }
  function skillBeam(start,end,color,width=.05,life=360){
    const delta=end.clone().sub(start);
    const length=delta.length();
    if(!Number.isFinite(length)||length<.02)return;
    const mesh=new U(new ks(width,width,length,6),new Lo({color,transparent:true,opacity:.82,depthWrite:false,blending:2}));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new V(0,1,0),delta.normalize());
    view.effects.add(mesh);
    skillVisuals.push({mesh,born:performance.now(),life});
  }
  function iceRing(x,z,radius,color,life,options={}){
    const geometry=new oo(),vertices=[],indices=[],segments=48,thickness=options.thickness||.08;
    for(let i=0;i<=segments;i++){
      const angle=i/segments*Math.PI*2,cs=Math.cos(angle),sn=Math.sin(angle);
      vertices.push(cs,0,sn,cs*(1-thickness),0,sn*(1-thickness));
      if(i<segments){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
    }
    geometry.setAttribute("position",new Ja(vertices,3));geometry.setIndex(indices);
    const mesh=new U(geometry,new Lo({color,transparent:true,opacity:options.opacity||.78,depthWrite:false,side:2,blending:2}));
    mesh.position.set(x,.12,z);mesh.scale.set(radius,1,radius);view.effects.add(mesh);
    skillVisuals.push({mesh,born:performance.now()+(options.delay||0),life,baseOpacity:options.opacity||.78,persistent:!!options.persistent,expand:options.expand||0,radius});
    return mesh;
  }
  function updateSkillVisuals(now){
    for(let i=skillVisuals.length-1;i>=0;i--){
      const effect=skillVisuals[i],age=now-effect.born;
      if(age>=effect.life||!effect.mesh.parent){
        effect.mesh.removeFromParent();effect.mesh.geometry.dispose();effect.mesh.material.dispose();skillVisuals.splice(i,1);
      }else if(age<0){
        effect.mesh.visible=false;
      }else{
        effect.mesh.visible=true;
        if(effect.expand){
          const radius=effect.radius+(effect.expand-effect.radius)*Math.min(1,age/effect.life);
          effect.mesh.scale.set(radius,1,radius);
        }
        if(effect.kind==="iceGPU"){
          effect.mesh.material.uniforms.uTime.value=age/1000;
        }else if(effect.kind==="iceWave"){
          const travel=Math.min(1,age/effect.life)*effect.distance;
          effect.mesh.position.set(effect.x+effect.ax*travel,.2,effect.z+effect.az*travel);
          effect.mesh.material.opacity=effect.baseOpacity*Math.sin(Math.PI*Math.min(1,age/effect.life));
        }else if(effect.kind==="iceSpike"){
          const rise=Math.min(1,age/190);
          effect.mesh.scale.y=effect.height*rise;
          effect.mesh.position.y=.12+effect.height*rise*.5;
          effect.mesh.material.opacity=effect.baseOpacity*Math.min(1,(effect.life-age)/500);
        }else if(effect.kind==="iceShard"){
          const seconds=age/1000;
          effect.mesh.position.set(effect.x+effect.vx*seconds,
            effect.y+effect.vy*seconds-2.8*seconds*seconds,
            effect.z+effect.vz*seconds);
          effect.mesh.rotation.x+=.035;effect.mesh.rotation.z+=.025;
          effect.mesh.material.opacity=effect.baseOpacity*(1-age/effect.life);
        }else if(effect.persistent){
          effect.mesh.material.opacity=effect.baseOpacity*(age>effect.life-500?(effect.life-age)/500:0.8+0.2*Math.sin(age*.009));
        }else effect.mesh.material.opacity=(effect.baseOpacity||.82)*(1-age/effect.life);
      }
    }
  }
  function skillBlocked(x,z){
    if(Math.abs(x)>world.size/2-.5||Math.abs(z)>world.size/2-.5)return true;
    return false;
  }
  function traceDash(){
    const ox=view.pred.x,oz=view.pred.z,unit=Math.hypot(view.aim.x,view.aim.z)||1;
    const ax=view.aim.x/unit,az=view.aim.z/unit;
    let travel=0;
    for(let distance=.2;distance<=16.001;distance+=.2){
      const x=ox+ax*distance,z=oz+az*distance;
      if(skillBlocked(x,z))break;
      travel=distance;
    }
    return {ox,oz,ax,az,travel,endX:ox+ax*travel,endZ:oz+az*travel};
  }
  function dashSkill(w){
    const {ox,oz,ax,az,travel,endX,endZ}=traceDash();
    if(travel<.2){log("일섬 경로가 막혔습니다");return false;}
    const targets=enemies.filter((e)=>{
      if(e.hp<=0)return false;
      const dx=e.x-ox,dz=e.z-oz;
      e.dashAlong=dx*ax+dz*az;
      return e.dashAlong>=-.6&&e.dashAlong<=travel+.6&&Math.abs(dx*az-dz*ax)<=1.3;
    }).sort((a,b)=>a.dashAlong-b.dashAlong);
    const last=targets.at(-1);
    let finalTravel=last?Math.min(travel,Math.max(0,last.dashAlong)+1.45):travel;
    const landingBlocked=(distance)=>world.obstacles.some(o=>
      Math.abs(ox+ax*distance-o.x)<=o.w/2+.45&&Math.abs(oz+az*distance-o.z)<=o.d/2+.45);
    while(finalTravel>=.2&&landingBlocked(finalTravel))finalTravel-=.1;
    if(finalTravel<.2)return false;
    const landingX=ox+ax*finalTravel,landingZ=oz+az*finalTravel;
    skillBeam(new V(ox,.19,oz),new V(landingX,.19,landingZ),"#ab1e3b",.24,470);
    skillBeam(new V(ox,.22,oz),new V(landingX,.22,landingZ),"#ff475d",.07,340);
    // Preserve the original crimson path; only a fine inner glint sharpens its edge.
    skillBeam(new V(ox,.245,oz),new V(landingX,.245,landingZ),"#ffd2bd",.018,210);
    view.burst(ox,.8,oz,"#ff475d",18);
    view.burst(ox,1.25,oz,"#ffd3ad",8);
    playSkillSound(dashSound);
    dashMotion={ox,oz,ax,az,travel:finalTravel,targets,nextHit:0,last,
      startedAt:performance.now(),duration:Math.max(280,Math.min(470,230+finalTravel*15)),
      previousX:ox,previousZ:oz,trailAt:0,particleAt:0,color:w.color};
    log(last?"일섬 · "+targets.length+"명 경로 타격 → 마지막 적 뒤로 이동":"일섬 · 경로에 적이 없어 최대 거리 이동");
    return true;
  }
  function updateDashMotion(now){
    const dash=dashMotion;
    if(!dash)return;
    const t=Math.max(0,Math.min(1,(now-dash.startedAt)/dash.duration));
    const progress=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const distance=dash.travel*progress;
    const x=dash.ox+dash.ax*distance,z=dash.oz+dash.az*distance;
    view.pred.set(x,0,z);
    view.movement.state.x=x;view.movement.state.z=z;view.movement.history=[];
    if(distance-dash.trailAt>.36||t===1){
      skillBeam(new V(dash.previousX,.95,dash.previousZ),new V(x,.95,z),"#ff314c",.34,280);
      skillBeam(new V(dash.previousX,1.03,dash.previousZ),new V(x,1.03,z),"#ffe3ba",.07,190);
      skillBeam(new V(dash.previousX,.12,dash.previousZ),new V(x,.12,z),"#691827",.46,500);
      dash.trailAt=distance;dash.previousX=x;dash.previousZ=z;
    }
    while(dash.particleAt+.9<=distance){
      dash.particleAt+=.9;
      const px=dash.ox+dash.ax*dash.particleAt;
      const pz=dash.oz+dash.az*dash.particleAt;
      const side=Math.floor(dash.particleAt/.9)%2?1:-1;
      const sidewaysX=-dash.az*side,sidewaysZ=dash.ax*side;
      view.burst(px,.65,pz,"#ff405a",5);
      view.burst(px+sidewaysX*.55,.42,pz+sidewaysZ*.55,"#ffbb8b",3);
      skillBeam(new V(px,.5,pz),new V(px+sidewaysX*.9,1.15,pz+sidewaysZ*.9),"#ff6679",.035,230);
      skillBeam(new V(px,.51,pz),new V(px+sidewaysX*.72,1.03,pz+sidewaysZ*.72),"#fff0dc",.012,125);
    }
    while(dash.nextHit<dash.targets.length&&dash.targets[dash.nextHit].dashAlong<=distance+.4){
      const target=dash.targets[dash.nextHit++];
      hurt(target,30,dash.color);
      if(target.hp>0)target.burn++;
      view.burst(target.x,1.2,target.z,"#ff4761",20);
      // Compact impact glints retain the original burst silhouette and do not obscure actors.
      const sx=-dash.az*.7,sz=dash.ax*.7;
      skillBeam(new V(target.x-sx,.7,target.z-sz),new V(target.x+sx,1.7,target.z+sz),"#ffe5cb",.025,145);
      skillBeam(new V(target.x-sx,1.5,target.z-sz),new V(target.x+sx,.9,target.z+sz),"#ff7790",.02,180);
    }
    if(t===1){
      while(dash.nextHit<dash.targets.length){
        const target=dash.targets[dash.nextHit++];
        hurt(target,30,dash.color);
        if(target.hp>0)target.burn++;
      }
      view.burst(x,1.1,z,"#ffb5a5",30);
      view.burst(x,.45,z,"#ff405a",14);
      if(dash.last&&dash.last.hp>0){
        hurt(dash.last,30,"#ffbec6");
        if(dash.last.hp>0)dash.last.airborneUntil=now+500;
      }
      log(dash.last?"일섬 마무리 · "+dash.last.name+" 뒤 추가 타격 · 0.5초 공중 띄우기":"일섬 마무리 · 최대 거리 도착");
      dashMotion=null;
      sync();
    }
  }
  function makeDashPreview(length=16,halfWidth=1.3){
    const root=new H();
    const floor=new oo();
    floor.setAttribute("position",new Ja([
      -halfWidth,.085,0, halfWidth,.085,0, -halfWidth,.085,length, halfWidth,.085,length
    ],3));
    floor.setIndex([0,1,2,1,3,2]);
    const body=new U(floor,new Lo({color:"#e7273f",transparent:true,opacity:.34,depthWrite:false,side:2}));
    root.add(body);
    const makeLine=(length,width,color)=>{
      const mesh=new U(new ks(width,width,length,6),new Lo({color,transparent:true,opacity:.9,depthWrite:false}));
      root.add(mesh);return mesh;
    };
    const left=makeLine(length,.045,"#ff5265"),right=makeLine(length,.045,"#ff5265");
    left.rotation.x=right.rotation.x=Math.PI/2;
    left.position.x=-halfWidth;right.position.x=halfWidth;
    left.position.y=right.position.y=.105;
    const end=makeLine(halfWidth*2,.07,"#ffb5b9");
    end.rotation.z=Math.PI/2;end.position.y=.11;
    const arrowGeometry=new oo();
    arrowGeometry.setAttribute("position",new Ja([-.6,.12,-.04,.6,.12,-.04,0,.12,.8],3));
    arrowGeometry.setIndex([0,1,2]);
    const arrow=new U(arrowGeometry,new Lo({color:"#ffd0d4",transparent:true,opacity:.95,depthWrite:false,side:2}));
    root.add(arrow);
    view.effects.add(root);
    return {root,body,left,right,end,arrow,length,halfWidth};
  }
  function cancelDashTarget(){
    dashTargeting=false;dashPreviewTravel=0;
    if(dashPreview){
      dashPreview.root.traverse((obj)=>{if(obj instanceof U){obj.geometry.dispose();obj.material.dispose();}});
      dashPreview.root.removeFromParent();
      dashPreview=null;
    }
  }
  function beginDashTarget(){
    if(!running||playerHp<=0||!["legend-araya","legend-arbiter"].includes(weapon().id))return false;
    const w=weapon(),remaining=(skillReadyAt.get(w.id)||0)-performance.now();
    if(remaining>0){log(w.skill+" 재사용까지 "+(remaining/1000).toFixed(1)+"초");return false;}
    if(!dashTargeting){
      dashTargeting=true;
      dashPreview=w.id==="legend-arbiter"?makeDashPreview(18,4):makeDashPreview();
      log(w.skill+" 조준 시작");
    }
    updateDashPreview();
    updateSkillHud();
    return true;
  }
  function updateDashPreview(){
    if(!dashTargeting||!dashPreview)return;
    const araya=weapon().id==="legend-araya";
    const trace=araya?traceDash():{ox:view.pred.x,oz:view.pred.z,ax:view.aim.x,az:view.aim.z,travel:18};
    const {ox,oz,ax,az,travel}=trace;
    dashPreviewTravel=travel;
    const p=dashPreview;
    p.root.position.set(ox,0,oz);
    p.root.rotation.y=Math.atan2(ax,az);
    p.body.scale.z=Math.max(.001,travel/p.length);
    for(const side of [p.left,p.right]){
      side.scale.y=Math.max(.001,travel/p.length);
      side.position.z=travel/2;
    }
    p.end.position.z=travel;
    p.arrow.position.z=travel;
    p.root.visible=travel>=.2;

  }
  function releaseDashTarget(){
    if(!dashTargeting)return false;
    const activated=useSkill(true);
    cancelDashTarget();
    updateSkillHud();
    return activated;
  }
  function thunderSkill(w){
    const px=view.pred.x,pz=view.pred.z;
    const targets=enemies.filter((e)=>e.hp>0).sort((a,b)=>Math.hypot(a.x-px,a.z-pz)-Math.hypot(b.x-px,b.z-pz)).slice(0,5);
    if(!targets.length){log("천벌 대상이 없습니다");return false;}
    playSkillSound(thunderSound);
    for(const e of targets){
      const start=new V(px,1.7,pz),end=new V(e.x,1.4,e.z);
      let last=start;
      for(let i=1;i<=6;i++){
        const t=i/6;
        const next=i===6?end:new V(start.x+(end.x-start.x)*t+(Math.random()-.5)*.55,1.7+Math.sin(t*Math.PI)*(.6+Math.random()*.4),start.z+(end.z-start.z)*t+(Math.random()-.5)*.55);
        skillBeam(last,next,i%2?"#70cfff":"#f8fcff",i%2?.055:.03,400);
        last=next;
      }
      hurt(e,200,w.color);
      view.burst(e.x,1.35,e.z,"#dcf7ff",15);
    }
    log("천벌 · "+targets.length+"명 번개 공격");
    return true;
  }
  // Local GPU ice storm: one frost sheet, two batched crystal layers and a low mist sheet.
  // Per-crystal timing is evaluated on the GPU; every cast owns and disposes its resources.
  function iceStorm(px,pz,ax,az,now){
    const vertexBase=`varying vec3 vLocal; varying vec3 vNormal; varying vec3 vWorld;
      void main(){vLocal=position;vNormal=normalize(normalMatrix*normal);
        vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;
        gl_Position=projectionMatrix*viewMatrix*p;}`;
    const noiseGLSL=`
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float cells(vec2 p){vec2 i=floor(p),f=fract(p);float a=9.,b=9.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 g=vec2(float(x),float(y));vec2 h=vec2(hash(i+g),hash(i+g+19.7));
          float d=length(g+.18+.64*h-f);if(d<a){b=a;a=d;}else b=min(b,d);}
        return b-a;}
    `;
    const add=(geometry,vertexShader,fragmentShader,life,extra={})=>{
      const material=new ul({uniforms:{uTime:{value:0},uLife:{value:life/1000}},
        vertexShader,fragmentShader,transparent:true,depthWrite:false,side:2,...extra});
      const mesh=new U(geometry,material);mesh.position.set(px,0,pz);
      mesh.rotation.y=Math.atan2(ax,az);mesh.frustumCulled=false;view.effects.add(mesh);
      skillVisuals.push({mesh,born:now,life,kind:"iceGPU"});return mesh;
    };
    const sheet=(height)=>{const g=new oo();
      g.setAttribute("position",new Ja([-4,height,0,4,height,0,-4,height,18,4,height,18],3));
      g.setIndex([0,1,2,1,3,2]);g.computeVertexNormals();return g;};
    add(sheet(.12),vertexBase,`
      uniform float uTime;uniform float uLife;varying vec3 vLocal;
      ${noiseGLSL}
      void main(){vec2 p=vLocal.xz;float front=uTime*31.;
        float reveal=1.-smoothstep(front-.7,front+.15,p.y);
        float edge=smoothstep(0.,.32,4.-abs(p.x))*smoothstep(0.,.4,p.y)*smoothstep(0.,.5,18.-p.y);
        vec2 warped=p*1.18+vec2(noise(p*1.7),noise(p*1.9+7.3))*.75;
        float crack=1.-smoothstep(.008,.045,cells(warped));
        crack+=.24*(1.-smoothstep(.004,.024,cells(warped*2.4)))*noise(p*4.);
        float grain=noise(p*17.);float frost=noise(p*3.1)*.65+grain*.35;
        float crest=exp(-pow((p.y-front)*1.6,2.));
        float fade=1.-smoothstep(3.7,5.,uTime);
        float ribs=pow(max(0.,sin(p.y*2.2+noise(p*2.)*2.)),18.)*.18;
        vec3 c=mix(vec3(.025,.16,.25),vec3(.24,.58,.72),frost);
        c+=crack*vec3(.36,.78,1.)*(.65+exp(-max(0.,uTime-p.y/31.)*3.)*1.6);
        c+=crest*vec3(.75,1.25,1.5)+ribs;
        gl_FragColor=vec4(c,edge*reveal*fade*(.58+crack*.3));
      }`,5000);
    const crystalVertex=`uniform float uTime;attribute vec3 aCenter;attribute vec2 aData;
      varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;varying float vAge;varying float vSeed;
      void main(){float age=uTime-aCenter.z/31.;vAge=age;vSeed=aData.y;
        float rise=clamp(age/.16,0.,1.);rise=1.-pow(1.-rise,3.);
        float melt=1.-smoothstep(2.5,4.5,age);
        vec3 p=position;p.y*=rise*melt;
        if(aData.x>0.5){float t=max(0.,age);float angle=t*(1.3+aData.y);
          mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));p.xy=rot*p.xy;
          p+=vec3(sin(aData.y*31.)*t*.8,max(0.,t*(3.+aData.y*2.)-t*t*3.),t*.4);
          p*=1.-smoothstep(.75,1.4,t);}
        p+=aCenter;vLocal=position;vNormal=normalize(mat3(modelMatrix)*normal);
        vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`;
    const crystalFragment=`uniform float uTime;uniform float uLife;varying vec3 vNormal;
      varying vec3 vWorld;varying vec3 vLocal;varying float vAge;varying float vSeed;
      void main(){if(vAge<0.)discard;vec3 n=normalize(vNormal),eye=normalize(cameraPosition-vWorld);
        float fres=pow(1.-abs(dot(n,eye)),2.5);
        float sun=pow(max(0.,dot(reflect(-normalize(vec3(-.5,1.,.8)),n),eye)),22.);
        float face=max(0.,dot(n,normalize(vec3(-.65,1.,.45))));
        float stripe=pow(max(0.,sin(vLocal.y*19.+vLocal.x*7.+vSeed*12.)),24.);
        float flash=exp(-max(0.,vAge)*6.);
        vec3 c=mix(vec3(.025,.12,.25),vec3(.32,.72,.91),face);
        c+=fres*vec3(.38,.8,1.)+sun*vec3(1.3)+stripe*.15+flash*vec3(.32,.6,.7);
        float fade=1.-smoothstep(uLife-.9,uLife,uTime);
        gl_FragColor=vec4(c,(.88+fres*.12)*fade);
      }`;
    const crystals=(air)=>{
      const positions=[],normals=[],centers=[],data=[];
      const count=air?84:66;
      const tri=(a,b,c,center,seed)=>{
        const u=new V(...b).sub(new V(...a)),v=new V(...c).sub(new V(...a));
        const n=u.cross(v).normalize();
        for(const p of [a,b,c]){positions.push(...p);normals.push(n.x,n.y,n.z);centers.push(...center);data.push(air?1:0,seed);}
      };
      for(let i=0;i<count;i++){
        const seed=(Math.sin(i*72.17+4.2)*437.7)%1,rand=Math.abs(seed);
        const z=.4+(i+.25)/count*17.1;
        const x=air?Math.sin(i*9.7)*3.6:(i%3===0?Math.sin(i*4.7)*2.7:(i%2?1:-1)*(3.2+rand*.6));
        const height=air?.17+rand*.32:(i%3===0?.35+rand*.8:1.15+rand*1.6);
        const radius=air?.05+rand*.065:.15+rand*.24;
        const center=[x,.13,z],tip=[Math.sin(i)*height*.22,height,.13*height];
        const ring=[];for(let j=0;j<5;j++){const a=j*Math.PI*2/5+i;ring.push([Math.cos(a)*radius,height*.28,Math.sin(a)*radius]);}
        for(let j=0;j<5;j++){tri(ring[j],ring[(j+1)%5],tip,center,rand);tri([0,0,0],ring[(j+1)%5],ring[j],center,rand);}
      }
      const g=new oo();g.setAttribute("position",new Ja(positions,3));g.setAttribute("normal",new Ja(normals,3));
      g.setAttribute("aCenter",new Ja(centers,3));g.setAttribute("aData",new Ja(data,2));
      add(g,crystalVertex,crystalFragment,air?2200:5000);
    };
    crystals(false);crystals(true);
    add(sheet(.46),vertexBase,`
      uniform float uTime;uniform float uLife;varying vec3 vLocal;${noiseGLSL}
      void main(){vec2 p=vLocal.xz;float age=uTime-p.y/31.;if(age<0.)discard;
        float edge=smoothstep(0.,.9,4.-abs(p.x))*smoothstep(0.,.6,p.y)*smoothstep(0.,.8,18.-p.y);
        float cloud=noise(p*1.25+vec2(uTime*.6,-uTime*1.8));
        float curl=noise(p*3.2+vec2(-uTime,uTime*.5));
        float crest=exp(-age*age*35.);
        float opacity=edge*(cloud*curl*.26*exp(-age*.8)+crest*.42)*(1.-smoothstep(1.4,2.1,uTime));
        gl_FragColor=vec4(vec3(.5,.83,1.)+crest*.45,opacity);
      }`,2100,{blending:2});
  }
  function arbiterSkill(){
    const now=performance.now(),px=view.pred.x,pz=view.pred.z;
    const unit=Math.hypot(view.aim.x,view.aim.z)||1,ax=view.aim.x/unit,az=view.aim.z/unit;
    const length=18,halfWidth=4,sideX=-az,sideZ=ax;
    playSkillSound(arbiterSound);
    iceStorm(px,pz,ax,az,now);
    view.burst(px,.7,pz,"#d9f7ff",24);
    const targets=enemies.filter(e=>{
      if(e.hp<=0)return false;
      const dx=e.x-px,dz=e.z-pz,along=dx*ax+dz*az;
      return along>=0&&along<=length&&Math.abs(dx*az-dz*ax)<=halfWidth;
    });
    for(const e of targets){
      hurt(e,50,"#a3eaff");
      if(e.hp<=0)continue;
      e.frozenUntil=now+5000;
      iceRing(e.x,e.z,1.3,"#a6e9ff",5000,{persistent:true,opacity:.8,thickness:.12});
      iceRing(e.x,e.z,.85,"#e8fbff",5000,{persistent:true,opacity:.58,thickness:.035});
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3,dx=Math.cos(angle)*.8,dz=Math.sin(angle)*.8;
        skillBeam(new V(e.x+dx,.13,e.z+dz),new V(e.x+dx*.75,1.3+(i%2)*.4,e.z+dz*.75),
          i%2?"#dcf8ff":"#7dd5ff",.055,880);
      }
      view.burst(e.x,.85,e.z,"#a6eaff",18);
    }
    log("빙결 폭풍 · "+targets.length+"명에게 50 피해와 5초 빙결");
    return true;
  }
  function useSkill(commitDash=false){
    if(!running||playerHp<=0||dashMotion)return false;
    const w=weapon(),now=performance.now();
    const remaining=Math.max(0,(skillReadyAt.get(w.id)||0)-now);
    if(remaining>0){log(w.skill+" 재사용까지 "+(remaining/1000).toFixed(1)+"초");return false;}
    let activated=false;
    if(w.id==="legend-araya"){
      if(!commitDash)return beginDashTarget();
      activated=dashSkill(w);
    }
    else if(w.id==="legend-thunder")activated=thunderSkill(w);
    else if(w.id==="legend-karambit"){
      playSkillSound(karambitSound);
      karambitBuffUntil=now+5000;
      view.burst(view.pred.x,1,view.pred.z,"#ffad73",26);
      log("초가속 · 5초간 공격속도 3배");activated=true;
    }else if(w.id==="legend-arbiter"){
      if(!commitDash)return beginDashTarget();
      activated=arbiterSkill();
    }
    if(activated){skillReadyAt.set(w.id,now+w.cooldown);sync();updateSkillHud();}
    return activated;
  }
  function updateBurn(dt){
    for(const e of enemies){
      if(e.hp<=0||e.burn<=0)continue;
      e.burnCarry+=e.burn*30*dt;
      const amount=Math.floor(e.burnCarry);
      if(amount>0){e.burnCarry-=amount;hurt(e,amount,"#ff7258",true);}
    }
  }
  function updateSkillHud(){
    const w=weapon(),now=performance.now();
    const remaining=Math.max(0,(skillReadyAt.get(w.id)||0)-now);
    const button=$("skill-button");
    button.disabled=remaining>0||!running||playerHp<=0;
    button.textContent=remaining>0?w.skill+" · "+(remaining/1000).toFixed(1)+"초":"Q · "+w.skill;
    $("skill-cooldown").textContent="재사용 "+Math.round(w.cooldown/1000)+"초";
    const buff=w.id==="legend-karambit"&&now<karambitBuffUntil?"초가속 "+((karambitBuffUntil-now)/1000).toFixed(1)+"초":"";
    $("skill-buff").textContent=buff;
  }
  function updateTargetLabels(){
    const holder=$("target-labels");
    if(!view||!view.camera)return;
    holder.innerHTML=enemies.filter((e)=>e.hp>0).map((e)=>{
      const point=new V(e.x,2.7,e.z).project(view.camera);
      if(point.z>1||point.z< -1)return "";
      const left=(point.x+1)*50;
      const top=(1-point.y)*50;
      if(left<0||left>100||top<0||top>100)return "";
      return '<div class="target-label" style="left:'+left+'%;top:'+top+'%"><b>'+e.name+'</b><span>'+(e.frozenUntil>performance.now()?"빙결 "+((e.frozenUntil-performance.now())/1000).toFixed(1)+"초 · ":"")+(e.immortal?"무한 체력":Math.ceil(e.hp)+" / "+e.maxHp)+'</span><i><em style="width:'+(e.immortal?100:100*e.hp/e.maxHp)+'%"></em></i></div>';
    }).join("");
  }
  function updateDps(now){
    dpsEvents=dpsEvents.filter(event=>now-event.at<=5000);
    const windowDamage=dpsEvents.reduce((sum,event)=>sum+event.damage,0);
    const elapsed=dpsStartedAt?Math.max(1,Math.min(5,(now-dpsStartedAt)/1000)):1;
    dpsNow=windowDamage/elapsed;
    dpsPeak=Math.max(dpsPeak,dpsNow);
    $("dps-now").textContent=Math.round(dpsNow).toLocaleString();
    $("dps-peak").textContent=Math.round(dpsPeak).toLocaleString();
    $("dps-total").textContent=Math.round(dpsTotal).toLocaleString();
  }
  function updateLabels(){
    $("hp-number").textContent=Math.ceil(playerHp)+"/100";
    $("hp-fill").style.width=playerHp+"%";
    $("stamina-fill").style.width=Math.max(0,view.movement.state.stamina)+"%";
    $("kills").textContent=String(kills);
    $("damage").textContent=String(Math.round(damageDone));
    $("targets").textContent=String(enemies.filter((e)=>e.hp>0&&!e.immortal).length);
  }
  function updateAi(dt){
    if(!ai)return;
    const px=view.pred.x,pz=view.pred.z,now=performance.now();
    for(const e of enemies){
      if(e.hp<=0||e.immortal||e.airborneUntil>now||e.frozenUntil>now)continue;
      const dx=px-e.x,dz=pz-e.z,d=Math.hypot(dx,dz);
      if(d>3&&d<18){
        const step=Math.min(d-3,2.7*dt);
        e.x+=dx/d*step;e.z+=dz/d*step;
      }
      if(d<=3&&now-e.attackAt>1400){
        e.attackAt=now;
        playerHp=Math.max(0,playerHp-7);
        view.reactHit("trainer");
        if(playerHp<=0){running=false;log("훈련 종료 · R 키로 재시작");}
      }
    }
  }
  function frame(now){
    requestAnimationFrame(frame);
    try{
      const dt=Math.min(.05,(now-(lastFrame||now))/1000);
      lastFrame=now;
      if(running){
        let mx=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
        let mz=Number(keys.has("s")||keys.has("arrowdown"))-Number(keys.has("w")||keys.has("arrowup"));
        const len=Math.hypot(mx,mz);
        if(len>1){mx/=len;mz/=len;}
        view.moveX=dashMotion?0:mx;view.moveZ=dashMotion?0:mz;
        view.sprinting=!dashMotion&&keys.has("shift");
        view.movement.lastReceived=now;
        updateDashMotion(now);
        updateAi(dt);
        updateBurn(dt);
        time+=dt;
        if(now-lastSnapshot>120){lastSnapshot=now;sync();}
      }else{view.moveX=0;view.moveZ=0;view.sprinting=false;}
      view.update(dt,dt);
      for(const e of enemies){
        const actor=view.actorMap.get(e.id);
        if(actor&&e.airborneUntil>now){
          const left=e.airborneUntil-now;
          actor.root.position.y=.75*Math.sin(Math.PI*(1-left/500));
        }
      }
      updateDashPreview();
      updateSkillVisuals(now);
      updateSkillHud();
      updateLabels();
      updateDps(now);
      updateTargetLabels();
    }catch(err){running=false;error(err);}
  }
  try{
    view=new vg(canvas); Q=view;
    reset();
    document.querySelectorAll(".weapon").forEach((b,i)=>b.addEventListener("click",()=>select(i)));
    $("reset").addEventListener("click",reset);
    $("attack").addEventListener("click",strike);
    $("skill-button").addEventListener("click",()=>{
      if(!["legend-araya","legend-arbiter"].includes(weapon().id))useSkill();
    });
    $("ai-toggle").addEventListener("change",(e)=>{ai=e.target.checked;log(ai?"표적 AI 이동 켜짐":"표적 AI 이동 꺼짐");});
    window.addEventListener("keydown",(e)=>{
      const k=e.key.toLowerCase();
      if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(k))e.preventDefault();
      keys.add(k);
      if(k>="1"&&k<="4"&&!e.repeat)select(Number(k)-1);
      if(k==="r"&&!e.repeat)reset();
      if(k===" "&&!e.repeat)strike();
      if(k==="q"&&!e.repeat){
        if(["legend-araya","legend-arbiter"].includes(weapon().id))beginDashTarget();
        else useSkill();
      }
      if(k==="escape")cancelDashTarget();
    });
    window.addEventListener("keyup",(e)=>{
      const k=e.key.toLowerCase();
      keys.delete(k);
      if(k==="q"&&dashTargeting)releaseDashTarget();
    });
    window.addEventListener("blur",()=>{keys.clear();cancelDashTarget();});
    canvas.addEventListener("pointermove",(e)=>view.pointerAim(e.clientX,e.clientY));
    canvas.addEventListener("pointerdown",(e)=>{
      if(e.button!==0)return;
      if(!dashTargeting)strike();
    });
    canvas.addEventListener("contextmenu",(e)=>{e.preventDefault();if(dashTargeting)cancelDashTarget();});
    window.__TRAINING__={get view(){return view;},get enemies(){return enemies;},
      get state(){return {weapon:weapon().id,position:{x:view.pred.x,z:view.pred.z},
        hp:playerHp,kills,damageDone,targets:enemies.filter((e)=>e.hp>0&&!e.immortal).length,dpsNow,dpsPeak,dpsTotal,
        drawCalls:view.renderer.info.render.calls,skillReadyIn:Math.max(0,(skillReadyAt.get(weapon().id)||0)-performance.now()),
        karambitBuff:Math.max(0,karambitBuffUntil-performance.now()),
        frozen:enemies.filter(e=>e.frozenUntil>performance.now()).map(e=>e.id),
        dashTargeting,dashTravel:dashPreviewTravel,dashMoving:!!dashMotion,
        airborne:enemies.filter(e=>e.airborneUntil>performance.now()).map(e=>e.id)};},strike,useSkill,beginDashTarget,releaseDashTarget,cancelDashTarget,reset,select};
    requestAnimationFrame(frame);
  }catch(err){error(err);}
})();
