(()=>{
'use strict';
const base='/games/penguin-extraction';
const mapImage='assets/training-map.svg?v=136';
const mapOptions=[{id:'arctic',name:'아틱 베이스',kind:'raid'},{id:'warehouse-training',name:'창고 훈련장',kind:'training',image:mapImage}];
const selectedMap=()=>mapOptions.find(map=>map.id===selected)??mapOptions[0];
let selected='arctic',mountedPanel=null,controller=null;
const style=document.createElement('style');
style.textContent=[
'.sortie-panel .mission-line{display:none!important}',
'.sortie-panel .training-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:13px 0 14px}',
'.sortie-panel .training-heading h2{margin:0;min-width:0;white-space:nowrap;font-size:27px}',
'.training-map-picker{position:relative;flex:none}',
'.sortie-panel .training-map-toggle{border:1px solid #829b914d;background:#1f3d39!important;color:#bdd1c4!important;padding:6px 8px;font-size:11px;cursor:pointer;border-radius:3px}',
'.sortie-panel .training-map-toggle:hover,.sortie-panel .training-map-toggle:focus-visible{border-color:#b9cfb0;color:#f1e8c9!important}',
'.training-map-menu{position:absolute;right:0;top:calc(100% + 5px);z-index:30;min-width:140px;padding:4px;background:#203c39;border:1px solid #789087;box-shadow:0 12px 26px #10292588}',
'.training-map-menu[hidden]{display:none}',
'.sortie-panel .training-map-menu button{display:block;width:100%;padding:9px 11px;text-align:left;color:#d7e2d5!important;background:transparent!important;font-size:12px;cursor:pointer}',
'.sortie-panel .training-map-menu button:hover,.sortie-panel .training-map-menu button[aria-selected=true]{background:#385851!important;color:#f2e8c6!important}',
'.sortie-panel.training-selected .mode-switch,.sortie-panel.training-selected .join-line,.sortie-panel.training-selected .room-panel,.sortie-panel.training-selected .secure-kit-button,.sortie-panel.training-selected .kit-check{display:none!important}',
'.sortie-panel .training-launch{display:none;width:100%}',
'.sortie-panel.training-selected .training-launch{display:block}',
'.sortie-panel.training-selected .map-card{height:195px;background:#203b3b;border-color:#76908b}',
'.training-map-art{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}',
'.training-map-backdrop{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:20px;background:#0a1d1dd9}',
'.training-map-dialog{width:min(660px,100%);max-height:calc(100dvh - 40px);padding:18px;background:#203c39;border:1px solid #98ae9a;box-shadow:0 24px 70px #0008}',
'.training-map-dialog header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;color:#eff0d9;font-size:20px;font-weight:700}',
'.training-map-dialog button{width:34px;height:34px;color:#eff0d9;background:#2d5049;border:1px solid #79978c;cursor:pointer;font-size:25px}',
'.training-map-dialog img{display:block;width:100%;max-height:calc(100dvh - 125px);object-fit:contain;background:#183538}',
'.training-error{margin:9px 0 0;color:#f1c2a4;font-size:11px;line-height:1.4}',
'.training-error[hidden]{display:none}',
'#training-controls{position:fixed;right:18px;top:332px;z-index:90;display:grid;gap:7px;width:176px;padding:11px;background:#193b37e8;border:1px solid #729087;color:#e7ebd4;box-shadow:0 10px 24px #10242166}',
'#training-controls select,#training-controls button{min-height:34px;padding:6px 9px;color:#edf0dd;background:#31534d;border:1px solid #708e83;cursor:pointer;font-size:12px}',
'#training-controls label{font-size:11px;color:#c8d6c8}',
'#training-controls [data-training=exit]{background:#213d3b}',
 '@media(max-width:700px){#training-controls{right:8px;top:255px;width:145px;padding:7px}}'
].join('');
document.head.append(style);
function openMap(trigger){
 const backdrop=document.createElement('div');
 backdrop.className='training-map-backdrop';
 backdrop.innerHTML='<section class="training-map-dialog" role="dialog" aria-modal="true" aria-label="창고 훈련장 지도"><header><span>창고 훈련장</span><button type="button" aria-label="지도 닫기">×</button></header><img src="'+mapImage+'" alt="창고 훈련장 전체 지도"></section>';
 const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();}};
 const close=()=>{document.removeEventListener('keydown',onKey);backdrop.remove();trigger.focus();};
 backdrop.querySelector('button').addEventListener('click',close);
 backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
 document.addEventListener('keydown',onKey);
 document.body.append(backdrop);
 backdrop.querySelector('button').focus();
}
async function startTraining(button,error){
 if(button.disabled)return;
 button.disabled=true;
 const label=button.innerHTML;
 button.textContent='준비 중…';
 error.hidden=true;
 try{
  const [me,room]=await Promise.all([
   fetch(base+'/api/me',{credentials:'same-origin'}),
   fetch(base+'/api/rooms/current',{credentials:'same-origin'})
  ]);
  if(!me.ok||!room.ok)throw Error('계정 상태를 확인할 수 없습니다.');
  const data=await me.json(),state=await room.json();
  if(state.room?.status==='raid')throw Error('진행 중인 원정이 끝난 뒤 시작할 수 있습니다.');
  if(!['primary','secondary','pistol','melee'].some(slot=>data.profile?.equipped?.[slot]))throw Error('무기를 먼저 장착해 주세요.');
  const started=await fetch(base+'/api/training/start',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({mapId:selectedMap().id})});
  const result=await started.json();
  if(!started.ok)throw Error(result.error?.message||'훈련 세션을 시작할 수 없습니다.');
  sessionStorage.setItem('bluecap-training-raid',result.raidId);
  ensureTrainingHud();
 }catch(e){
  button.disabled=false;
  button.innerHTML=label;
  error.textContent=e.message||'훈련장을 시작할 수 없습니다.';
  error.hidden=false;
 }
}
async function trainingApi(path,body={}){
 const response=await fetch(base+'/api/training/'+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();
 if(!response.ok)throw Error(data.error?.message||'훈련 명령을 처리하지 못했습니다.');
 return data;
}
function ensureTrainingHud(){
 if(!sessionStorage.getItem('bluecap-training-raid')||!document.querySelector('#app.in-raid'))return;
 if(document.querySelector('#training-controls'))return;
 const panel=document.createElement('section');
 panel.id='training-controls';panel.setAttribute('aria-label','훈련장 조작');
 panel.innerHTML='<label for="training-type">시험 유형</label><select id="training-type"><option value="mixed">일반 적 + DPS</option><option value="normal">일반 적</option><option value="dps">무적 DPS</option></select><button type="button" data-training="ai">AI 동작</button><button type="button" data-training="reset">표적 초기화</button><button type="button" data-training="exit">나가기</button>';
 panel.addEventListener('click',async event=>{
  const button=event.target.closest('[data-training]');if(!button||button.disabled)return;
  button.disabled=true;
  try{
   if(button.dataset.training==='ai'){
    const active=button.dataset.active!=='true';
    const result=await trainingApi('ai',{active});
    button.dataset.active=String(result.aiActive);button.textContent=result.aiActive?'AI 정지':'AI 동작';
   }else if(button.dataset.training==='reset'){
    await trainingApi('reset',{type:panel.querySelector('#training-type').value});
    const ai=panel.querySelector('[data-training=ai]');ai.dataset.active='false';ai.textContent='AI 동작';
   }else{
    await trainingApi('exit');sessionStorage.removeItem('bluecap-training-raid');location.href=base+'/';
   }
  }catch(error){console.error(error);window.alert(error.message||'훈련 명령 오류');}
  finally{button.disabled=false;}
 });
 panel.querySelector('#training-type').addEventListener('change',async event=>{
  const type=event.target.value;
  try{await trainingApi('reset',{type});const ai=panel.querySelector('[data-training=ai]');ai.dataset.active='false';ai.textContent='AI 동작';}
  catch(error){console.error(error);window.alert(error.message||'시험 유형 변경 오류');}
 });
 document.body.append(panel);
}
function mount(){
 ensureTrainingHud();
 const panel=document.querySelector('.sortie-panel');
 if(!panel||panel===mountedPanel)return;
 controller?.abort();
 controller=new AbortController();
 mountedPanel=panel;
 const signal=controller.signal;
 const title=panel.querySelector('h2'),map=panel.querySelector('.map-card');
 if(!title||!map)return;
 const originalMap=map.innerHTML,originalAria=map.getAttribute('aria-label');
 const eyebrow=panel.querySelector('.eyebrow'),originalEyebrow=eyebrow?.textContent;
 const launch=panel.querySelector('.launch'),originalLaunch=launch?.innerHTML;
 const heading=document.createElement('div');
 heading.className='training-heading';
 title.before(heading);
 heading.append(title);
 const picker=document.createElement('div');
 picker.className='training-map-picker';
 picker.innerHTML='<button type="button" class="training-map-toggle" aria-haspopup="listbox" aria-expanded="false">맵 선택 ▾</button><div class="training-map-menu" role="listbox" hidden>'+mapOptions.map(option=>'<button type="button" role="option" data-map="'+option.id+'">'+option.name+'</button>').join('')+'</div>';
 heading.append(picker);
 const toggle=picker.querySelector('.training-map-toggle'),menu=picker.querySelector('.training-map-menu');
 const fallback=document.createElement('button');
 fallback.type='button';
 fallback.className='primary training-launch';
 fallback.innerHTML='훈련 시작 <span>→</span>';
 panel.append(fallback);
 const error=document.createElement('p');
 error.className='training-error';
 error.hidden=true;
 panel.append(error);
 const closeMenu=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');};
 const update=()=>{
  const choice=selectedMap(),training=choice.kind==='training';
  panel.classList.toggle('training-selected',training);
  title.textContent=choice.name;
  if(eyebrow)eyebrow.textContent=training?'TRAINING':originalEyebrow;
  map.innerHTML=training?'<img class="training-map-art" src="'+choice.image+'" alt="'+choice.name+' 배치도">':originalMap;
  map.setAttribute('aria-label',training?choice.name+' 전체 지도 보기':originalAria||'아틱 베이스 전체 지도 보기');
  if(launch)launch.innerHTML=training?'훈련 시작 <span>→</span>':originalLaunch;
  fallback.style.display=training&&!launch?'block':'none';
  for(const option of menu.querySelectorAll('[data-map]'))option.setAttribute('aria-selected',String(option.dataset.map===selected));
  error.hidden=true;
 };
 toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));},{signal});
 picker.addEventListener('click',e=>{
  const option=e.target.closest('[data-map]');
  if(!option)return;
  selected=option.dataset.map;
  closeMenu();
  update();
 },{signal});
 document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))closeMenu();},{signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();},{signal});
 map.addEventListener('click',e=>{
  if(selectedMap().kind!=='training')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  openMap(map);
 },{capture:true,signal});
 if(launch)launch.addEventListener('click',e=>{
  if(selectedMap().kind!=='training')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  startTraining(launch,error);
 },{capture:true,signal});
 fallback.addEventListener('click',()=>startTraining(fallback,error),{signal});
 update();
}
new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
fetch(base+'/api/training/current',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{if(!data?.active)sessionStorage.removeItem('bluecap-training-raid');else{sessionStorage.setItem('bluecap-training-raid','active');ensureTrainingHud();}}).catch(()=>{});
mount();
})();
