import {ITEM_BY_ID,rarityColor,rarityLabel} from '../shared/catalog';
import {itemArtwork} from './itemArtwork';
import {emptyContainerEquipmentSlots} from '../shared/containerEquipment';
import {stackWeight} from '../shared/fittedInventory';
import './containerUI.css';
type Obj=Record<string,any>;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Snapshot-driven container inventory. Never reveals unopened server contents. */
export class ContainerUI {
 private id:string|null=null;
 private signature='';
 private panel:HTMLElement|null=null;
 private progress:HTMLElement|null=null;
 constructor(private send:(type:string,data?:Obj)=>void){}
 mount(parent:HTMLElement){
  this.id=null;this.signature='';
  this.progress=document.createElement('div');this.progress.className='search-progress';this.progress.hidden=true;
  this.panel=document.createElement('section');this.panel.className='container-inventory';this.panel.hidden=true;this.panel.setAttribute('aria-label','상자 내용물');
  parent.append(this.progress,this.panel);
 }
 focus(id:string){this.id=id;this.signature='';}
 /** An authoritative error invalidates the pending view; next snapshot restores valid actions. */
 rejectPending(_message?:unknown){this.signature='';}
 /** Hide overlays temporarily while preserving the selected chest and its server timer. */
 suspendView(){if(this.panel)this.panel.hidden=true;if(this.progress)this.progress.hidden=true;}
 close(cancel=false){const handled=!!this.id||!!this.progress&&!this.progress.hidden;this.id=null;this.signature='';if(this.panel)this.panel.hidden=true;if(cancel)this.send('cancel_search');return handled;}
 update(player:Obj,containers:Obj[],position:{x:number;z:number},now:number,paused:boolean){
  if(!this.panel||!this.progress)return;
  const focused=containers.find(c=>c.id===this.id);
  const observer=!player.searching&&focused?.state==='searching'&&focused.search&&Math.hypot(focused.x-position.x,focused.z-position.z)<=2.65;
  const search=player.searching??(observer?{...focused.search,containerId:focused.id}:null);
  this.progress.hidden=!search||paused||!player.alive||player.downed;
  if(search&&!this.progress.hidden){
   const c=containers.find(c=>c.id===search.containerId),duration=Math.max(1,search.completeAt-search.startedAt),amount=Math.min(1,Math.max(0,(now-search.startedAt)/duration));
   this.progress.innerHTML=`<div><span>${observer?'동료 · ':''}${esc(c?.name??'보급 상자')} 수색 중</span><b>${Math.max(0,(search.completeAt-now)/1000).toFixed(1)}초</b></div><div class="search-track"><i style="width:${amount*100}%"></i></div><footer>${observer?'수색이 끝나면 함께 획득할 수 있습니다.':''}<button aria-label="${observer?'수색 진행 닫기':'상자 수색 취소'}">${observer?'닫기':'취소'}</button></footer>`;
   this.progress.querySelector('button')!.onclick=()=>this.close(!observer);
  }
  const container=containers.find(c=>c.id===this.id);
  if(!container||!player.alive||player.downed||player.boarded||Math.hypot(container.x-position.x,container.z-position.z)>2.65){this.close();return;}
  this.panel.hidden=paused||container.state!=='open';if(this.panel.hidden)return;
  const stacks:Obj[]=container.items??[],remaining=Math.max(0,(player.carryCapacity??150)-(player.carriedWeight??0));
  const ground=container.visualType==='ground-loot'||String(container.id).startsWith('ground-loot-');
  const gear=player.equipment??{};
  const signature=JSON.stringify([this.id,stacks,Math.floor(remaining*100),gear,container.visualType,container.name]);if(signature===this.signature)return;this.signature=signature;
  const scroll=this.panel.querySelector('.container-items')?.scrollTop??0;
  this.panel.innerHTML=`<header><div><span>${ground?'GROUND LOOT · 바닥 물품':container.visualType==='player-loot'?'PLAYER LOOT · 즉시 획득':'SEARCH COMPLETE'}</span><h2>${esc(container.name??(ground?'바닥 물품':'보급 상자'))}</h2></div><button class="container-close" aria-label="상자 닫기">×</button></header><p class="container-capacity">배낭 여유 <b>${remaining.toFixed(1)} 용량</b><span>빈 슬롯은 바로장착</span></p><div class="container-items">${stacks.length?stacks.map(s=>{
   const item=ITEM_BY_ID[s.itemId];if(!item)return '';const unitWeight=stackWeight({...s,itemId:s.itemId,quantity:1},id=>ITEM_BY_ID[id]),fit=unitWeight>0?Math.floor((remaining+1e-6)/unitWeight):s.quantity,max=Math.max(0,Math.min(s.quantity,fit));
   const targets=emptyContainerEquipmentSlots(item,gear,id=>ITEM_BY_ID[id]);
   const direct=targets.map(t=>`<button class="container-equip" data-equip="${esc(s.itemId)}" data-stack-id="${esc(s.stackId??'')}" data-slot="${esc(t.slot)}" ${t.weaponSlot?`data-weapon-slot="${t.weaponSlot}"`:''} ${t.armorSlot===undefined?'':`data-armor-slot="${t.armorSlot}"`} aria-label="${esc(item.name)} ${esc(t.label)} 빈 슬롯에 바로 장착">바로장착 <small>${esc(t.label)}</small></button>`).join('');
   return `<article style="--rarity:${rarityColor(item)}">${itemArtwork(item)}<div><strong>${esc(item.name)}</strong><small>${esc(rarityLabel(item))} · ${unitWeight} 용량</small><div class="container-fittings">${Object.values(s.fittings??{}).map(id=>ITEM_BY_ID[String(id)]).filter(Boolean).map(part=>`<span title="${esc(part.name)}" aria-label="${esc(part.name)}" style="--part-rarity:${rarityColor(part)}">${itemArtwork(part)}</span>`).join('')}</div><span>보유 ×${s.quantity} · 판매 ${new Intl.NumberFormat('ko-KR').format(item.sell??0)}</span></div><div class="container-take">${direct}<input type="number" min="1" max="${Math.max(1,max)}" value="${Math.max(1,max)}" aria-label="${esc(item.name)} 가져갈 수량" ${max?'':'disabled'}><button data-take="${esc(s.itemId)}" data-stack-id="${esc(s.stackId??'')}" ${max?'':'disabled'}>${max?(container.visualType==='player-loot'?'획득':'담기'):'공간 부족'}</button></div></article>`;
  }).join(''):`<div class="container-empty"><b>${container.visualType==='player-loot'?'전리품 회수 완료':'수색 완료'}</b><span>${container.visualType==='player-loot'?'가방이 비었습니다.':'상자가 비었습니다.'}</span></div>`}</div><footer>E 다시 열기 · ESC 닫기</footer>`;
  this.panel.querySelector<HTMLButtonElement>('.container-close')!.onclick=()=>this.close();
  this.panel.querySelector<HTMLElement>('.container-items')!.scrollTop=scroll;
  this.panel.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach(button=>button.onclick=()=>{
   this.send('equip_container',{containerId:this.id,itemId:button.dataset.equip,...(button.dataset.stackId?{stackId:button.dataset.stackId}:{}),slot:button.dataset.slot,...(button.dataset.weaponSlot?{weaponSlot:button.dataset.weaponSlot}:{}),...(button.dataset.armorSlot===undefined?{}:{armorSlot:Number(button.dataset.armorSlot)})});
   button.closest('article')!.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);
   setTimeout(()=>{this.signature='';},450);
  });
  this.panel.querySelectorAll<HTMLButtonElement>('[data-take]').forEach(button=>button.onclick=()=>{
   const input=button.parentElement!.querySelector('input')!,quantity=Number(input.value);
   if(!Number.isSafeInteger(quantity)||quantity<1||quantity>Number(input.max)){input.reportValidity();return;}
   this.send('take_container',{containerId:this.id,itemId:button.dataset.take,...(button.dataset.stackId?{stackId:button.dataset.stackId}:{}),quantity});button.disabled=true;
   // Re-enable after a response or an error without optimistic inventory mutations.
   setTimeout(()=>{this.signature='';},450);
  });
 }
}
