(()=>{
  'use strict';
  const base='/games/penguin-extraction';
  let selected='arctic';
  const style=document.createElement('style');
  style.textContent=`.training-map-picker{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:13px 0}.sortie-panel .training-map-picker button{border:1px solid #819b91;background:#223e3d!important;color:#d9e5d8!important;padding:9px 5px;font-size:12px;cursor:pointer}.sortie-panel .training-map-picker button.active{background:#d7b468!important;color:#1c3838!important;border-color:#e4c67f;font-weight:800}.sortie-panel.training-selected .map-card,.sortie-panel.training-selected .mission-line,.sortie-panel.training-selected .mode-switch,.sortie-panel.training-selected .join-line,.sortie-panel.training-selected .room-panel,.sortie-panel.training-selected .launch,.sortie-panel.training-selected .secure-kit-button,.sortie-panel.training-selected .kit-check{display:none!important}.training-map-description{color:#d2e3d9;font-size:12px;line-height:1.6;margin:16px 0}.training-enter{display:block;width:100%;border:0;background:#e6bc71;color:#213b3a;padding:14px;font-weight:850;cursor:pointer}`;
  document.head.append(style);
  function mount(){
    const panel=document.querySelector('.sortie-panel');
    if(!panel||panel.querySelector('.training-map-picker'))return;
    const title=panel.querySelector('h2');if(!title)return;
    const picker=document.createElement('div');picker.className='training-map-picker';
    picker.innerHTML='<button type="button" data-map="arctic">아틱 베이스</button><button type="button" data-map="training">창고 훈련장</button>';
    const description=document.createElement('p');description.className='training-map-description';description.textContent='현재 장착한 총기와 근접 무기를 그대로 시험합니다. 훈련 기록과 탄약 소모는 보관함에 반영되지 않습니다.';
    const enter=document.createElement('button');enter.type='button';enter.className='training-enter';enter.textContent='훈련장 입장 →';
    title.after(picker,description,enter);
    const update=()=>{
      panel.classList.toggle('training-selected',selected==='training');
      title.textContent=selected==='training'?'창고 훈련장':'아틱 베이스';
      for(const b of picker.querySelectorAll('button')){const active=b.dataset.map===selected;b.classList.toggle('active',active);b.style.setProperty('background-color',active?'#d7b468':'#223e3d','important');b.style.setProperty('color',active?'#1c3838':'#d9e5d8','important');}
      description.hidden=enter.hidden=selected!=='training';
    };
    picker.addEventListener('click',event=>{const b=event.target.closest('button[data-map]');if(!b)return;selected=b.dataset.map;update();});
    enter.addEventListener('click',async()=>{
      enter.disabled=true;enter.textContent='장착 장비 확인 중…';
      try{
        const [me,room]=await Promise.all([fetch(base+'/api/me',{credentials:'same-origin'}),fetch(base+'/api/rooms/current',{credentials:'same-origin'})]);
        if(!me.ok||!room.ok)throw Error('계정 상태를 확인할 수 없습니다.');
        const data=await me.json(),state=await room.json();
        if(state.room?.status==='raid')throw Error('진행 중인 원정이 끝난 뒤 입장할 수 있습니다.');
        if(!['primary','secondary','pistol','melee'].some(slot=>data.profile?.equipped?.[slot]))throw Error('은신처에서 무기를 먼저 장착해 주세요.');
        location.href=base+'/training.html';
      }catch(error){enter.disabled=false;enter.textContent=error.message+' · 다시 시도';}
    });
    update();
  }
  new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
  mount();
})();
