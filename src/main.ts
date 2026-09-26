import {paintCoastalMap} from '../shared/coastalMap.js';
import {PingIndicator,updatePingIndicator} from './pingIndicator';
import {bindCombatInput} from './combatInput';
import {isFixedOptic} from '../shared/attachmentQualities';
import {isDirectShopItem} from '../shared/shopAvailability';
import {CARRIED_WEAPON_SLOTS} from '../shared/weaponSlots.ts';
import {WEAPON_SLOT_LABELS,weaponSlotForCode,compatibleWeaponSlots,isFirearmSlot} from './weaponSlotUI';
import {firearmRange} from '../shared/firearmBalance';
import {clientShotIntervalMs} from '../shared/firearmCadence.ts';
import {kitAddMaximum,syncKitRange} from './kitQuantity';
import './kitQuantity.css';
import {storageRows,instanceCaption,instanceSlots,looseQuantity,type StoredInstance} from './stashInstances';
import {SUPPLY_SHOP_ITEMS,supplyKindFor} from '../shared/supplyPacks';
import {captureMenuView} from './menuViewState';
import {talentBonus,talentUpgradeDescription,talentUpgradeCost} from '../shared/talents';
import {openArmorFittings} from './armorFittingsUI';
import {armorSlotCount,armorAttachmentsFromEquipment,armorAttachmentEffects} from '../shared/armorAttachments';
import {openWeaponFittings} from './weaponFittingsUI';
import {SecureUI} from './secureUI';
import {openSecureLoadout} from './secureLoadout';
import {inventoryCapacity,equipmentWeights} from '../shared/metroInventory';
import './styles.css';
import {RadiationMedicalUI} from './radiationMedicalUI';
import {renderDebriefScreen,bindDebriefReport} from './debriefReport';
import {SceneView} from './scene';
import {scopeKind} from './scopeView';
import {ContainerUI} from './containerUI';
import {Connection,api} from './net';
import {Sound} from './sound';
import {ITEMS,ITEM_BY_ID,TALENTS,QUALITY_LABELS,GOLD_OPTIONS,rarityColor,rarityLabel,type ItemDef} from '../shared/catalog';
import {itemArtwork as icon} from './itemArtwork';
import {WORLD} from '../shared/world';
import {openMapPreview} from './mapPreview';
import './metroReference.css';

type Obj=Record<string,any>;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(n:number)=>new Intl.NumberFormat('ko-KR').format(n??0);
const round1=(n:number|null|undefined)=>(Math.round((Number(n)||0)*10)/10).toFixed(1);
const item=(id:string|null|undefined)=>(id?ITEM_BY_ID[id]:undefined)??SUPPLY_SHOP_ITEMS.find(i=>i.id===id);
const family=(i?:ItemDef)=>i?.mode==='melee'?'melee':i?.mode==='throw'||i?.mode==='flare'?'throwable':({AR:'rifle',SMG:'smg',DMR:'dmr',SR:'sniper',SG:'shotgun',LMG:'lmg',PISTOL:'pistol',HG:'pistol',CROSSBOW:'crossbow'}[i?.family??'']??i?.family?.toLowerCase()??'pistol');
const categories:Record<string,string>={all:'전체',weapon:'총기',helmet:'헬멧',armor:'방탄조끼',backpack:'배낭',attachment:'부착물',medical:'의료',throwable:'투척물',valuable:'수집품',upgrade:'강화 재료',other:'기타',ammo:'탄약'};
const RUNTIME_ITEMS=ITEMS;
const slots:Record<string,string>={...WEAPON_SLOT_LABELS,armor:'방탄조끼',helmet:'헬멧',backpack:'배낭',medical:'의료품',throwable:'투척물',flare:'신호탄',scope:'조준경',barrel:'총구',magazine:'탄창',grip:'손잡이',vest:'방호 소재'};
const qualityNames=QUALITY_LABELS;
const ammoGroups=[['ammo-762','7.62 mm'],['ammo-556','5.56 mm'],['ammo-9','9 mm'],['ammo-45','.45 ACP'],['ammo-12','12 게이지'],['ammo-57','5.7 mm'],['ammo-300','.300 매그넘'],['ammo-50','.50 BMG'],['ammo-bolt','석궁 화살'],['ammo-40','40 mm 유탄'],['ammo-flare','파란 신호탄']];
const ammoKey=(i:ItemDef)=>i.category==='ammo'?(i.caliber??i.id):(i.ammo??'');
const ammoLabel=(i:ItemDef)=>ammoGroups.find(([id])=>id===ammoKey(i))?.[1]??'';
const shopPrice=(i:ItemDef)=>i.price*(i.category==='ammo'?(i.packSize??1):1);
const rarityStyle=(i?:ItemDef)=>`--rarity:${i?rarityColor(i):'#7a8880'}`;
const logo='<span class="crest"><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M9 37V20C9 4 31 4 31 20V37L20 43Z" fill="currentColor"/><path d="M13 35V23C13 13 27 13 27 23V35L20 39Z" fill="#243f40"/><circle cx="15" cy="18" r="2" fill="#243f40"/><circle cx="25" cy="18" r="2" fill="#243f40"/><path d="M17 23H23L20 27Z" fill="currentColor"/></svg></span><span>BLUECAP<small>EXTRACTION</small></span>';

$('#app').innerHTML=`<canvas id="game-canvas" aria-label="블루캡 3D 게임"></canvas><section id="raid-loading" class="raid-loading" hidden aria-live="polite" aria-busy="true"><div class="raid-loading-grid" aria-hidden="true"></div><div class="raid-loading-card"><span class="eyebrow">ARCTIC BASE / DEPLOYMENT</span><div class="raid-loading-mark" aria-hidden="true"><i></i><b>07</b></div><h1>원정 준비 중</h1><p id="raid-loading-status">원정 데이터를 확인하고 있습니다.</p><div class="raid-loading-track"><i id="raid-loading-progress"></i></div><div class="raid-loading-meta"><span>BLUECAP FIELD DIVISION</span><b id="raid-loading-percent">10%</b></div></div></section><div class="vignette"></div><main id="interface"></main><aside id="ping-badge" class="ping-badge" hidden aria-label="서버 연결 지연"><span class="ping-signal" aria-hidden="true">▂▄▆</span><span id="ping-value">연결 중</span></aside><div id="toast" role="status" aria-live="polite"></div><div id="damage-flash"></div><div id="reticle"><i></i><i></i><i></i><i></i></div>`;
const pingIndicator=new PingIndicator();function updatePing(){updatePingIndicator($('#ping-value'),pingIndicator,Date.now());}function sendPing(){if(net.socket?.readyState===WebSocket.OPEN){const time=Date.now();pingIndicator.sent(time);net.send('ping',{clientTime:time});}}const view=new SceneView($('#game-canvas'));const net=new Connection(),sound=new Sound();const containersUI=new ContainerUI((type,data)=>net.send(type,data));const secureUI=new SecureUI((type,data)=>net.send(type,data));const medicalUI=new RadiationMedicalUI((type,data)=>net.send(type,data),message=>toast(message));
let profile:Obj|null=null,user:Obj|null=null,room:Obj|null=null,snapshot:Obj|null=null,playerId='',tab='home',filter='all',ammoFilter='all',query='',selected:string|null=null,authMode='login',busy=false,raid=false,raidLoading=false,paused=false,showMap=false,activeSlot='primary',lastFire=0,lastInput=0,lastHud=0,sessionLoot:Obj[]=[],kills=0,status='연결 확인 중',ping=0,serverOffset=0,roomMode='solo',settled=false,scopeHeld=false,scopeSignature='',mapZoom=1,fiveMinuteWarned=false;const keys=new Set<string>();let firing=false,touchMove={x:0,z:0},touchAim=false;let toastTimer=0,raidLoadToken=0,pendingRaidSnapshot:Obj|null=null,applyingPendingSnapshot=false;let combatInput:ReturnType<typeof bindCombatInput>|undefined;
let spectating=false;
let spectatorId:string|null=null;
let spectatorOutcome='dead';
let spectatorLossReport:Obj|undefined;
let spectatorFinishing=false;
let ignoreRaidTraffic=false;


type FloatingLabel={
 root:HTMLSpanElement;
 name:HTMLElement;
 fill?:HTMLElement;
 value?:HTMLElement;
 enemy:boolean;
};

const floatingLabels=new Map<string,FloatingLabel>();

function ensureFloatingLabel(id:string,enemy:boolean,boss=false){
 let label=floatingLabels.get(id);

 if(label){
  if(!label.root.isConnected)$('#world-labels').appendChild(label.root);
  label.root.className=enemy
   ?`world-label enemy-health ${boss?'boss':''}`.trim()
   :'world-label';
  return label;
 }

 const root=document.createElement('span');
 root.className=enemy
  ?`world-label enemy-health ${boss?'boss':''}`.trim()
  :'world-label';
 root.style.display='none';

 const name=document.createElement('b');
 root.appendChild(name);

 let fill:HTMLElement|undefined;
 let value:HTMLElement|undefined;

 if(enemy){
  const track=document.createElement('i');
  fill=document.createElement('em');
  track.appendChild(fill);

  value=document.createElement('small');

  root.appendChild(track);
  root.appendChild(value);
 }

 $('#world-labels').appendChild(root);

 label={root,name,fill,value,enemy};
 floatingLabels.set(id,label);
 return label;
}

function placeFloatingLabel(
 el:HTMLElement,
 pos:{x:number;y:number;z:number}
){
 const canvas=view.renderer.domElement;
 const x=(pos.x*.5+.5)*canvas.clientWidth;
 const y=(pos.y*-.5+.5)*canvas.clientHeight;

 el.style.display='';
 el.style.transform=
  `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;

 el.style.zIndex=
  String(((-pos.z*.5+.5)*100000)|0);
}

function hideUnusedFloatingLabels(active:Set<string>){
 for(const[id,label]of floatingLabels)
  if(!active.has(id))
   label.root.style.display='none';
}

const routeError=(error:unknown)=>toast(error instanceof Error?error.message:'요청을 처리하지 못했습니다.',true);
function toast(text:string,error=false){$('#toast').textContent=text;$('#toast').className=error?'show error':'show';clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('show'),3600);sound.play(error?'error':'ui');}
async function action(fn:()=>Promise<void>){if(busy)return;busy=true;try{await fn();}catch(e){routeError(e);}finally{busy=false;}}
function setProfile(p:Obj){profile=p;const slot=CARRIED_WEAPON_SLOTS.find(s=>p.equipped?.[s]),gun=item(slot?p.equipped[slot]:null);if(gun)view.setWeapon(gun.id,family(gun),slot&&isFirearmSlot(slot)?p.weaponAttachments?.[slot]:undefined);}
function syncLobbyParty(){
 if(room?.mode==='coop')roomMode='coop';
 if(!raid)view.setLobbyParty(room?.mode==='coop'?room.members??[]:[],playerId,id=>family(item(id)));
}
function refreshLobbyParty(){void api('/rooms/current').then(d=>{room=d.room;syncLobbyParty();render();}).catch(()=>{});}

function auth(){return `<section class="auth-panel"><span class="eyebrow">북극 원정대 · 대원 등록</span><h2>${authMode==='login'?'다시 만나서 반가워요.':'첫 원정을 준비해요.'}</h2><p>나만의 은신처와 장비를 안전하게 보관하세요.</p><form id="auth-form"><label>대원 이름<input name="username" aria-label="대원 이름" placeholder="bluecap_07" pattern="[A-Za-z0-9_-]{3,20}" minlength="3" maxlength="20" autocomplete="username" required></label><label>비밀번호<input name="password" aria-label="비밀번호" type="password" minlength="8" maxlength="128" placeholder="8자 이상" autocomplete="${authMode==='login'?'current-password':'new-password'}" required></label><button class="primary" type="submit">${authMode==='login'?'은신처 입장':'대원 등록하기'} <span>→</span></button></form><button class="text-button" data-action="auth-toggle">${authMode==='login'?'처음 오셨나요? 새 대원 등록':'이미 등록했다면 로그인'}</button><div class="smallprint">솔로 PvE · 최대 4인 온라인 협동</div></section>`;}
function home(){const e=profile!.equipped;const gun=item(CARRIED_WEAPON_SLOTS.map(s=>e[s]).find(Boolean));return `<section class="home-left"><span class="eyebrow">OPERATIVE / ${esc(user?.username)}</span><h1>PENGUIN ROYALE</h1><p>밖은 춥고, 배낭은 아직 가벼워요.<br>필요한 것을 챙기고 무사히 돌아오세요.</p><div class="record-strip"><span><b>${profile!.stats.extracts}</b>탈출 성공</span><span><b>${profile!.stats.kills}</b>처치</span><span><b>${profile!.stats.raids}</b>원정</span></div><button class="outline small" data-action="guide">작전 안내 <span>↗</span></button></section><div class="operator-label"><span class="tag">BLUECAP • 07</span><strong>${esc(user?.username)}</strong><span>${gun?esc(gun.name):'장비를 선택하세요'} · 원정 준비 중</span></div><aside class="sortie-panel"><span class="eyebrow">NEXT EXPEDITION</span><h2>아틱 베이스</h2><button class="map-card map-preview-trigger" type="button" data-action="map-preview" aria-label="아틱 베이스 전체 지도 보기"><div class="map-grid"></div><span class="map-n">N ↑</span><i class="map-zone"></i><b class="map-label">ARCTIC BASE</b><span class="map-coordinates">78° 13′ N · 15° 38′ E</span><span class="map-preview-hint">전체 지도 보기 ↗</span></button><div class="mission-line"><span>위험 구역</span><b>미사일 사일로 · 방사능</b></div><div class="mode-switch"><button data-action="solo" class="${roomMode==='solo'?'selected':''}">혼자 원정</button><button data-action="coop" class="${roomMode==='coop'?'selected':''}">함께 원정</button></div>${room?roomPanel():roomMode==='coop'?`<div class="join-line"><input id="invite-code" maxlength="6" placeholder="초대 코드" aria-label="초대 코드"><button class="outline" data-action="join">참가</button></div><button class="primary" data-action="create-room">협동 원정대 만들기 <span>＋</span></button>`:`<button class="primary launch" data-action="launch">원정 출발 <span>→</span></button>`}<button class="secure-kit-button" data-action="secure-loadout"><span>암호상자</span><b>열기 →</b></button><div class="kit-check"><i></i>${gun?'출발 장비 준비 완료':'무기를 장착하세요'}</div></aside>`;}
function roomPanel(){
 const members=room?.members??room?.players??[];
 const own=members.find((member:Obj)=>member.id===playerId);
 const inLobby=room?.status==='lobby';
 const allReady=members.length>0&&members.every((member:Obj)=>member.connected!==false&&member.ready===true);
 const rows=members.map((member:Obj,index:number)=>`<span><i>${index+1}</i>${esc(member.username??member.name)} <b>${member.connected===false?'연결 끊김':member.ready?'준비 완료':'준비 전'}</b></span>`).join('');
 const readyButton=inLobby?`<button class="${own?.ready?'outline':'primary'}" data-action="room-ready">${own?.ready?'준비 취소':'준비'} <span>${own?.ready?'↶':'✓'}</span></button>`:`<div class="room-waiting">팀원 원정 중</div>`;
 const startButton=inLobby&&room?.leaderId===playerId?`<button class="primary" data-action="start-room" ${allReady?'':'disabled'}>원정 시작 <span>→</span></button>`:inLobby?`<div class="room-waiting">${allReady?'방장의 출발을 기다립니다':'모든 팀원의 준비를 기다립니다'}</div>`:'';
 return `<div class="room-panel"><span class="eyebrow">INVITE CODE</span><button class="invite" data-action="copy-code">${esc(room?.code??room?.inviteCode??'SOLO')} ⧉</button><div class="members">${rows}</div>${readyButton}${startButton}<button class="text-button" data-action="leave-room">원정대 나가기</button></div>`;
}
function matchingItems(){
 let list=tab==='stash'?(profile!.stash as Obj[]).filter(s=>s.quantity>0).map(s=>item(s.itemId)).filter((i):i is ItemDef=>!!i&&(i.category!=='attachment'||looseQuantity(profile!,i.id)>0)):[...RUNTIME_ITEMS.filter(i=>isDirectShopItem(i)&&i.category!=='valuable'),...SUPPLY_SHOP_ITEMS];
 if(filter!=='all')list=list.filter(i=>i.category===filter);
 if(ammoFilter!=='all')list=list.filter(i=>ammoKey(i)===ammoFilter);
 if(query)list=list.filter(i=>(i.name+' '+i.family+' '+i.description+' '+ammoLabel(i)).toLowerCase().includes(query.toLowerCase()));
 if(tab==='shop')list=list.filter(i=>!['weapon','attachment'].includes(i.category)||!i.baseId||i.id===i.baseId);
 const order=(i:ItemDef)=>{const n=ammoGroups.findIndex(([key])=>key===ammoKey(i));return n<0?100+Object.keys(categories).indexOf(i.category):n;};
 return list.sort((a,b)=>order(a)-order(b)||a.tier-b.tier||a.name.localeCompare(b.name,'ko'));
}
function inventory(){
 if(tab==='shop'&&filter==='all')filter='weapon';
 const visibleAmmoGroups=tab==='shop'?ammoGroups.filter(([id])=>ITEMS.some(i=>ammoKey(i)===id&&isDirectShopItem(i)&&i.category!=='valuable')):ammoGroups.filter(([id])=>id!=='ammo-flare');
 if(ammoFilter!=='all'&&!visibleAmmoGroups.some(([id])=>id===ammoFilter))ammoFilter='all';
 const list=matchingItems(),current=item(selected);
 if(!current||!list.some(i=>i.id===current.id||i.id===current.baseId))selected=list[0]?.id??null;
 const rows=tab==='stash'?storageRows(list,profile):list.map(i=>({item:i,instance:null as StoredInstance|null}));
 if(tab==='stash'){const found=rows.find(r=>r.instance?.id===selectedInstance&&r.item.id===selected);selectedInstance=found?.instance?.id??rows.find(r=>r.item.id===selected)?.instance?.id??null;}
 const selectedHost:StoredInstance|undefined=rows.find(r=>r.instance?.id===selectedInstance)?.instance;
 const focus=item(selected),owned=tab==='stash'&&focus?.category==='attachment'?looseQuantity(profile!,focus.id):profile!.stash.find((s:Obj)=>s.itemId===selected)?.quantity??0;
 const sellMaximum=selectedHost?(selectedHost.status==='stash'?1:0):focus?looseQuantity(profile!,focus.id):0;
 const displayGoldOptionIds=
  selectedHost?.goldTraitLevels
   ?Object.entries(selectedHost.goldTraitLevels).map(
     ([trait,level])=>
      GOLD_OPTIONS[trait+'-l'+level]
       ?trait+'-l'+level
       :trait
    )
   :(focus?.optionIds??[]);

 let previous='';const tiles=rows.map(({item:i,instance})=>{const group=ammoLabel(i)||categories[i.category];const heading=group!==previous?`<div class="caliber-heading"><span>${esc(group)}</span><i></i></div>`:'';previous=group;const q=tab==='stash'&&i.category==='attachment'?looseQuantity(profile!,i.id):profile!.stash.find((s:Obj)=>s.itemId===i.id)?.quantity??0;return heading+`<button class="item-tile ${selected===i.id&&(!instance||instance.id===selectedInstance)?'active':''} ${i.quality==='gold'?'gold-item':''}" style="${rarityStyle(i)}" data-item="${i.id}" ${instance?`data-instance="${instance.id}"`:""}><span class="item-kind">${esc(i.family??categories[i.category])}<b>${esc(ammoLabel(i))}</b></span>${icon(i)}<strong>${esc(i.name)}</strong><span class="item-grade">${i.effect==='supply-pack'?'보급 상자':esc(rarityLabel(i))}</span>${instance?instanceSlots(instance,true):''}<span>${tab==='shop'?`${money(shopPrice(i))} ◈`:instance?esc(instanceCaption(instance)):`${q}개 보관`}${i.category==='ammo'?`<b>${i.packSize??1}발 묶음</b>`:''}</span></button>`;}).join('');
 return `<section class="inventory-screen"><div class="screen-heading"><div><span class="eyebrow">${tab==='shop'?'SUPPLY EXCHANGE':'PERSONAL STORAGE'}</span><h1>${tab==='shop'?'보급 교역소':'나의 보관함'}<small>${rows.length} 품목</small></h1></div><input id="item-search" placeholder="총기 이름 · 탄종으로 찾기" aria-label="장비 검색" value="${esc(query)}">${tab==='stash'?`<button class="outline bulk-sell" data-action="sell-collectibles">수집품 일괄 판매</button>`:''}<button class="close" data-action="home" aria-label="은신처로 돌아가기">×</button></div>
 <div class="caliber-filters" aria-label="사용 탄종"><button data-ammo="all" class="${ammoFilter==='all'?'active':''}">모든 탄종</button>${visibleAmmoGroups.map(([id,label])=>`<button data-ammo="${id}" class="${ammoFilter===id?'active':''}">${label}</button>`).join('')}</div>
 <div class="inventory-body"><nav class="category-list">${Object.entries(categories).filter(([k])=>tab==='shop'?!['all','ammo'].includes(k):!['ammo','other'].includes(k)).map(([k,v])=>`<button class="${filter===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}</nav><div class="item-grid">${tiles||'<div class="empty-state">조건에 맞는 장비가 없습니다.<br>탄종이나 분류를 바꿔보세요.</div>'}</div>
 <aside class="item-inspect" style="${rarityStyle(focus)}">${focus?`<span class="eyebrow">${esc(focus.family??categories[focus.category])} / ${esc(ammoLabel(focus)||'EQUIPMENT')}</span><div class="large-item">${icon(focus)}</div>${focus.effect!=='supply-pack'&&rarityLabel(focus)?`<span class="rarity-badge">${esc(rarityLabel(focus))}</span>`:''}<h2>${esc(focus.name)}</h2>${selectedHost?`${selectedHost.slot?`<span class="instance-status">${esc(instanceCaption(selectedHost))}</span>`:''}${instanceSlots(selectedHost)}`:''}<p>${esc(inspectDescription(focus))}</p>
 ${displayGoldOptionIds.length?`<div class="gold-options">${displayGoldOptionIds.map(id=>`<div><b>✦ ${esc(GOLD_OPTIONS[id]?.name??id)}</b><span>${esc(GOLD_OPTIONS[id]?.description??'')}</span></div>`).join('')}</div>`:''}
 ${['weapon','attachment'].includes(focus.category)&&focus.quality&&focus.baseId&&!isFixedOptic(focus)&&tab==='shop'?`<div class="quality-options">${RUNTIME_ITEMS.filter(i=>i.baseId===focus.baseId&&isDirectShopItem(i)).sort((a,b)=>a.tier-b.tier).map(i=>`<button class="${i.id===focus.id?'active':''}" style="${rarityStyle(i)}" data-quality="${i.id}">${qualityNames[i.quality??'']??'양호'}</button>`).join('')}</div>`:''}
 ${focus.effect==='supply-pack'?`<dl><div><dt>획득 확률</dt><dd>${esc(focus.acquisition)}</dd></div><div><dt>개봉</dt><dd>구매 즉시</dd></div></dl>`:`<dl>${focus.damage?`<div><dt>피해량</dt><dd>${focus.damage}${(focus.pellets??1)>1?' × '+focus.pellets:''}</dd></div><div><dt>사거리</dt><dd>${firearmRange(focus)} m</dd></div><div><dt>탄창 / 재장전</dt><dd>${focus.magazine} / ${focus.reload}초</dd></div><div><dt>사용 탄약</dt><dd>${esc(ammoLabel(focus)||'없음')}</dd></div>`:''}${focus.category==='upgrade'?'':`<div><dt>무게</dt><dd>${focus.weight+(selectedHost?Object.values(selectedHost.fittings??{}).reduce((n,id)=>n+(item(id)?.weight??0),0):0)} 용량</dd></div>`}${focus.capacity?`<div><dt>적재 용량</dt><dd>${focus.capacity} 용량</dd></div>`:''}${focus.reduction?`<div><dt>피해 감소</dt><dd>${Math.round(focus.reduction*100)}%</dd></div>`:''}${selectedHost?'':`<div><dt>보유 수량</dt><dd>${owned}</dd></div>`}</dl>`}
 <div class="inspect-actions">${tab==='shop'?`<button class="primary" data-action="${supplyKindFor(focus.id)?'crate-'+supplyKindFor(focus.id):'buy'}">${money(shopPrice(focus))} ◈ 구매 <span>＋</span></button><span class="smallprint">${focus.effect==='supply-pack'?'구매 즉시 개봉되며, 획득한 장비는 보관함에 추가됩니다.':focus.category==='ammo'?`${focus.packSize??1}발 묶음 · 발당 ${money(focus.price)} ◈`:'구매한 장비는 보관함에 추가됩니다.'}</span>`:`${selectedHost&&focus.quality==='gold'&&selectedHost.status==='stash'?`<div class="gold-upgrade-actions"><span>특성 강화 · 장비 분해</span><button class="primary" data-action="gold-workshop">특성 강화 <span>→</span></button><button class="outline danger" data-action="dismantle-gold">분해</button></div>`:''}${selectedHost&&['weapon','armor'].includes(focus.category)?'<button class="outline" data-action="instance-parts">파츠 장착 / 변경 ↗</button>':''}${!['valuable','upgrade'].includes(focus.category)&&!packable(focus)?`<select id="equip-slot" aria-label="장착 위치">${compatibleSlots(focus).map(s=>`<option value="${s}">${slots[s]}</option>`).join('')}</select><button class="primary" data-action="equip">장착하기 <span>→</span></button>`:''}${packable(focus)?'<button class="primary" data-action="kit">배낭에 챙기기 →</button>':''}<label class="sell-quantity">판매 수량<input id="sell-quantity" type="range" min="${sellMaximum?1:0}" max="${sellMaximum}" step="1" value="${sellMaximum?1:0}" aria-label="판매 수량" ${sellMaximum<=1?'disabled':''}><output id="sell-quantity-output">${sellMaximum?1:0} / ${sellMaximum}</output></label><button class="outline" data-action="sell" ${selectedHost?.slot||!sellMaximum?'disabled title="장착 해제 후 판매할 수 있습니다"':''}>${money(sellMaximum?focus.sell:0)} ◈ 판매</button>${selectedHost&&focus.category==='armor'?'':''}` }</div>`:''}</aside></div></section>`;
}
function compatibleSlots(i:ItemDef){if(i.mode==='flare')return['flare'];if(i.category==='weapon')return compatibleWeaponSlots(i);if(i.category==='attachment')return[i.slot??'scope'];return[i.category];}
const packable=(i?:ItemDef)=>!!i&&(['ammo','medical','throwable'].includes(i.category)||/^password-letter-(white|red|yellow|green|black)$/.test(i.id));
const inspectDescription=(item?:ItemDef)=>item?.category==='weapon' ? `${item.name} · ${item.family??'Other'}` : item?.description??'';
let selectedInstance:string|null=null;
let packFilter='all',medicalChoice='',throwChoice='';
function packedQuantity(id:string){return profile?.packed?.find((s:Obj)=>s.itemId===id)?.quantity??0;}
function kit(){
 const e=profile!.equipped,bag=item(e.backpack),packed:Obj[]=profile!.packed??[],weights=equipmentWeights(e,item);
 const weight=packed.reduce((sum:number,s:Obj)=>sum+(item(s.itemId)?.weight??0)*s.quantity,0);
 const capacity=profile!.packCapacity??inventoryCapacity(bag?.capacity??0,talentBonus(TALENTS.find(t=>t.id==='pack-mule')!,profile!.talentLevels?.['pack-mule']??profile!.talents?.find((t:Obj)=>t.talentId==='pack-mule')?.level??0),armorAttachmentEffects(e,id=>item(id)).capacity);
 const equipment=(slot:string,wide=false)=>{const i=item(e[slot]);return `<button class="metro-equipment ${wide?'gun-slot':''} ${i?'equipped':''}" data-slot="${slot}" style="${rarityStyle(i)}"><span class="equipment-label">${slots[slot]}</span>${icon(i)}<strong>${esc(i?.name??'장비 선택')}</strong><small>${i?`${esc(rarityLabel(i))} · 무게 ${weights.bySlot[slot]??i.weight}`:'＋ 보관함에서 장착'}</small></button>`;};
 const available=profile!.stash.filter((stack:Obj)=>{const i=item(stack.itemId);return packable(i)&&(packFilter==='all'||i?.category===packFilter||packFilter==='credentials'&&i?.id.startsWith('password-letter-'));});
 return `<section class="kit-screen metro-loadout"><div class="screen-heading"><div><span class="eyebrow">METRO / EXPEDITION LOADOUT</span><h1>장비</h1></div><button class="close" data-action="home" aria-label="닫기">×</button></div><div class="metro-loadout-body">
 <aside class="metro-equipment-column">${['primary','secondary'].map(slot=>equipment(slot,true)+`<button class="weapon-change-link" data-change-weapon="${slot}">${slots[slot]} 교체 / 해제 ↗</button>`).join('')}<div class="armor-pair sidearm-pair">${equipment('pistol')}${equipment('melee')}</div><div class="weapon-link-pair"><button class="weapon-change-link" data-change-weapon="pistol">권총 교체 / 해제 ↗</button><button class="weapon-change-link" data-change-weapon="melee">근접 무기 교체 / 해제 ↗</button></div><div class="armor-pair">${equipment('helmet')}${equipment('armor')}</div><button class="weapon-change-link" data-change-weapon="armor">방탄조끼 교체 / 해제 ↗</button>${equipment('backpack')}<button class="secure-kit-button" data-action="secure-loadout"><span>암호상자</span><b>열기 →</b></button>
 <div class="equipment-total-weight">장비 총 무게 ${weights.total}</div>${e.armor?`<div class="prep-armor-fittings" aria-label="방탄조끼 부착물">${armorAttachmentsFromEquipment(e).slice(0,armorSlotCount(item(e.armor))).map((id,index)=>`<button data-slot="armor" style="${rarityStyle(item(id))}" aria-label="방탄조끼 부착 슬롯 ${index+1}">${icon(item(id))}<span>${esc(item(id)?.name??'빈 부착 슬롯')}</span></button>`).join('')}</div>`:''}</aside>
 <section class="packed-panel"><header><div><span class="eyebrow">TAKE INTO RAID</span><h2>배낭</h2></div><span class="pack-capacity ${weight>capacity?'over':''}"><b>${weight.toFixed(1)}</b> / ${capacity} 용량</span></header><div class="pack-meter"><i style="width:${Math.min(100,weight/capacity*100)}%"></i></div>
 <div class="packed-grid">${packed.map(stack=>{const i=item(stack.itemId);if(!i)return '';return `<article class="packed-item" style="${rarityStyle(i)}">${icon(i)}<strong>${esc(i.name)}</strong><span>${esc(rarityLabel(i))}</span><div class="pack-counter"><button data-pack="${i.id}" data-delta="-1" aria-label="한 개 빼기">−</button><b>×${stack.quantity}</b><button data-pack="${i.id}" data-delta="1" aria-label="한 개 추가">＋</button></div><button class="unpack" data-pack="${i.id}" data-quantity="0">보관함으로</button></article>`;}).join('')||'<div class="pack-empty"><b>아직 빈 배낭입니다.</b><span>오른쪽 보관함에서 탄약과 보급품을 담으세요.</span></div>'}</div>
 <footer class="packing-footer"><button class="primary" data-action="home">준비 완료 <span>✓</span></button></footer></section>
 <section class="pack-storage"><header><span class="eyebrow">STORAGE / SUPPLIES</span><h2>보관함</h2></header><nav class="pack-tabs">${[['all','전체'],['ammo','탄약'],['medical','치료'],['throwable','투척'],['credentials','암호문']].map(([key,label])=>`<button data-pack-filter="${key}" class="${packFilter===key?'active':''}">${label}</button>`).join('')}</nav><div class="pack-storage-list">${available.map((stack:Obj)=>{const i=item(stack.itemId)!,maximum=kitAddMaximum(profile!,i.id,capacity,item),value=Math.min(maximum,i.category==='ammo'?30:1);return `<article class="pack-supply-row" style="${rarityStyle(i)}">${icon(i)}<div><strong>${esc(i.name)}</strong></div><label class="pack-supply-range"><input type="range" min="0" max="${maximum}" step="1" value="${value}" data-pack-input="${i.id}" aria-label="${esc(i.name)} 담을 수량" ${maximum===0?'disabled':''}><output data-pack-output="${i.id}">${value} / ${maximum}</output></label><button data-pack-add="${i.id}" ${value===0?'disabled':''}>담기</button></article>`;}).join('')||'<p class="empty-state">보급품이 없습니다.<br>교역소에서 구매하세요.</p>'}</div><button class="outline" data-action="shop">교역소 열기 ↗</button></section>
 </div></section>`;
}
function packItem(id:string,quantity:number){void action(async()=>{const d=await api('/loadout/pack',{itemId:id,quantity});setProfile(d.profile);render();});}

function talents(){return `<section class="talent-screen"><div class="screen-heading"><div><span class="eyebrow">PERMANENT PROGRESSION</span><h1>특성</h1></div><button class="close" data-action="home" aria-label="닫기">×</button></div><div class="talent-grid">${TALENTS.map((t:any,i:number)=>{const level=profile!.talentLevels?.[t.id]??profile!.talents?.find((a:any)=>a.talentId===t.id)?.level??0;const cost=talentUpgradeCost(t,level);return `<article class="talent"><div class="talent-symbol">${['✚','↗','◇','◉','▤','♧','☢'][i%8]}</div><div><span class="eyebrow">${String(i+1).padStart(2,'0')} / TALENT</span><h2>${esc(t.name)}</h2><p>${esc(talentUpgradeDescription(t,level))}</p><div class="level-pips">${Array.from({length:t.maxLevel},(_,j)=>`<i class="${j<level?'filled':''}"></i>`).join('')}<span>${level} / ${t.maxLevel}</span></div><button class="${level>=t.maxLevel?'outline':'primary'}" data-talent="${t.id}" ${level>=t.maxLevel?'disabled':''}>${level>=t.maxLevel?'훈련 완료':`${money(cost)} ◈ 훈련하기`}</button></div></article>`}).join('')}</div></section>`;}
let menuViewKey='';
function render(){if(raid){menuViewKey='';renderHudShell();return;}const nextViewKey=JSON.stringify([tab,filter,ammoFilter,query,packFilter,!!profile]);const restoreView=menuViewKey===nextViewKey?captureMenuView():null;menuViewKey=nextViewKey;$('#reticle').style.display='none';$('#app').classList.remove('in-raid');$('#ping-badge').hidden=!user;$('#interface').className='menu-interface';$('#interface').innerHTML=`<header class="topbar"><button class="brand" data-action="home">${logo}</button>${profile?`<nav class="main-nav"><button class="${tab==='home'?'active':''}" data-action="home">은신처</button><button class="${tab==='kit'?'active':''}" data-action="kit">장비</button><button class="${tab==='stash'?'active':''}" data-action="stash">보관함</button><button class="${tab==='shop'?'active':''}" data-action="shop">교역소</button><button class="${tab==='talents'?'active':''}" data-action="talents">특성</button></nav><div class="wallet"><span>◈</span> ${money(profile.currency)}</div>`:'<div class="top-note">작고 용감한 북극 원정대</div>'}<button class="sound-toggle" data-action="sound" aria-label="소리 켜기 또는 끄기">${sound.muted?'♪̸':'♪'}</button></header>${!profile?`<section class="welcome-copy"><span class="eyebrow">AN ARCTIC EXTRACTION ADVENTURE</span><h1>따뜻한 집으로<br>돌아오기 위해.</h1><p>탐색하고. 챙기고. 무사히 탈출하세요.<br>작은 펭귄의 커다란 생존 원정.</p><span class="welcome-tag">북극 기지 / 첫 번째 원정</span></section>${auth()}`:tab==='home'?home():tab==='kit'?kit():tab==='talents'?talents():inventory()}<footer class="menu-footer"><span><i class="online-dot"></i>${esc(status)}</span><span>BLUECAP FIELD DIVISION · ARCTIC BASE</span>${profile?'<button data-action="logout">로그아웃</button>':'<span>WASD 이동 · 마우스 조준</span>'}</footer>`;wireMenu();restoreView?.();}
function wireMenu(){
 const saleInput=document.querySelector<HTMLInputElement>('#sell-quantity');if(saleInput)saleInput.oninput=()=>{const quantity=Number(saleInput.value);$('#sell-quantity-output').textContent=`${quantity} / ${saleInput.max}`;const button=document.querySelector<HTMLButtonElement>('[data-action="sell"]');if(button)button.textContent=`${money((item(selected)?.sell??0)*quantity)} ◈ 판매`;};
 document.querySelectorAll<HTMLElement>('[data-pack-filter]').forEach(b=>b.onclick=()=>{packFilter=b.dataset.packFilter!;render();});
 document.querySelectorAll<HTMLElement>('[data-pack]').forEach(b=>b.onclick=()=>packItem(b.dataset.pack!,b.dataset.quantity!==undefined?Number(b.dataset.quantity):Math.max(0,packedQuantity(b.dataset.pack!)+Number(b.dataset.delta))));
 document.querySelectorAll<HTMLInputElement>('[data-pack-input]').forEach(input=>input.oninput=()=>syncKitRange(input));
 document.querySelectorAll<HTMLElement>('[data-pack-add]').forEach(b=>b.onclick=()=>{const input=document.querySelector<HTMLInputElement>(`[data-pack-input="${b.dataset.packAdd}"]`);const n=Number(input?.value);if(!Number.isSafeInteger(n)||n<1||n>Number(input?.max))return;packItem(b.dataset.packAdd!,packedQuantity(b.dataset.packAdd!)+n);});
document.querySelectorAll<HTMLElement>('[data-ammo]').forEach(b=>b.onclick=()=>{ammoFilter=b.dataset.ammo!;selected=null;render();});$('#auth-form')?.addEventListener('submit',e=>{e.preventDefault();void action(async()=>{const fd=new FormData(e.currentTarget as HTMLFormElement);const d=await api(`/auth/${authMode}`,{username:fd.get('username'),password:fd.get('password')});user=d.user;setProfile(d.profile);net.connect();render();});});document.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.onclick=()=>handle(b.dataset.action!));document.querySelectorAll<HTMLElement>('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter!;ammoFilter='all';render();});document.querySelectorAll<HTMLElement>('[data-item],[data-quality]').forEach(b=>b.onclick=()=>{selected=b.dataset.item??b.dataset.quality!;selectedInstance=b.dataset.instance??null;const i=item(selected);if(i?.category==='weapon')view.setWeapon(i.id,family(i));render();});$('#item-search')?.addEventListener('input',e=>{query=(e.target as HTMLInputElement).value;const start=(e.target as HTMLInputElement).selectionStart;render();$('#item-search')?.focus();($('#item-search') as HTMLInputElement)?.setSelectionRange(start,start);});document.querySelectorAll<HTMLElement>('[data-slot]').forEach(b=>b.onclick=()=>{const slot=b.dataset.slot!;if(isFirearmSlot(slot)&&profile?.equipped?.[slot])openWeaponFittings(profile,p=>{setProfile(p);render();},routeError,slot);else if(slot==='armor'&&profile?.equipped?.armor)openArmorFittings(profile,p=>{setProfile(p);render();},routeError);else showEquipPicker(slot);});document.querySelectorAll<HTMLElement>('[data-change-weapon]').forEach(b=>b.onclick=()=>showEquipPicker(b.dataset.changeWeapon!));document.querySelectorAll<HTMLElement>('[data-talent]').forEach(b=>b.onclick=()=>void action(async()=>{const d=await api('/talents/unlock',{talentId:b.dataset.talent});setProfile(d.profile);render();toast('훈련을 완료했습니다.');}));}
function showEquipPicker(slot:string){const items=(profile!.stash as Obj[]).filter(v=>v.quantity>0).map(v=>item(v.itemId)).filter((i):i is ItemDef=>!!i&&compatibleSlots(i).includes(slot));const options=storageRows(items,profile);const panel=document.createElement('div');panel.className='modal-backdrop';panel.innerHTML=`<section class="picker"><div class="screen-heading"><h2>${slots[slot]} 선택</h2><button class="close" aria-label="닫기">×</button></div><div class="picker-list">${options.map(({item:i,instance})=>`<button style="${rarityStyle(i)}" data-equip="${i.id}" ${instance?`data-instance="${instance.id}"`:''}>${icon(i)}<span><strong>${esc(i.name)}</strong><small>${instance?esc(instanceCaption(instance)):`${profile!.stash.find((v:Obj)=>v.itemId===i.id)?.quantity??0}개 보관`}</small>${instance?instanceSlots(instance,true):''}</span><b>＋</b></button>`).join('')||'<p>호환되는 장비가 없어요. 교역소에서 구매하세요.</p>'}</div><button class="outline unequip">장착 해제</button></section>`;document.body.append(panel);panel.querySelector('.close')!.addEventListener('click',()=>panel.remove());panel.querySelector('.unequip')!.addEventListener('click',()=>equipSlot(null));panel.querySelectorAll<HTMLElement>('[data-equip]').forEach(b=>b.onclick=()=>equipSlot(b.dataset.equip!,b.dataset.instance));function equipSlot(id:string|null,instanceId?:string){void action(async()=>{const d=await api('/loadout/equip',{slot,itemId:id,instanceId});setProfile(d.profile);panel.remove();render();toast('장비를 변경했습니다.');});}}


let goldWorkshopSelection:string|null=null,goldWorkshopTrait:string|null=null,goldWorkshopResult:Obj|null=null;
const goldOptionId=(trait:string,level:number)=>GOLD_OPTIONS[trait+'-l'+level]?trait+'-l'+level:trait;
const goldTraitButton=(trait:string,level:number,side:'before'|'after',changed=false,added=false)=>{const id=goldOptionId(trait,level),option=GOLD_OPTIONS[id]??GOLD_OPTIONS[trait];return `<button data-gold-trait="${id}" class="gold-trait-chip ${goldWorkshopTrait===id?'active':''} ${changed?'changed':''} ${added?'added':''}" data-side="${side}"><b>${esc(option?.name??trait)}</b></button>`;};
function playGoldUpgradeEffect(){if(sound.muted)return;const audio=new Audio(new URL('assets/gold-upgrade-intro.mp3',document.baseURI).href);audio.playbackRate=2;(audio as any).preservesPitch=false;audio.volume=.72;void audio.play().catch(()=>{});}
function openGoldWorkshop(preferred?:string){
 const panel=document.createElement('div');panel.className='gold-workshop-backdrop';let category:'weapon'|'gear'='weapon';goldWorkshopSelection=preferred??goldWorkshopSelection;goldWorkshopResult=null;
 const refresh=()=>{const all=(profile!.instances??[]).filter((host:StoredInstance)=>host.status==='stash'&&item(host.itemId)?.quality==='gold'),initial=all.find((host:StoredInstance)=>host.id===goldWorkshopSelection);if(initial)category=item(initial.itemId)?.category==='weapon'?'weapon':'gear';const rows=all.filter((host:StoredInstance)=>category==='weapon'?item(host.itemId)?.category==='weapon':item(host.itemId)?.category!=='weapon');if(!rows.some((host:StoredInstance)=>host.id===goldWorkshopSelection))goldWorkshopSelection=rows[0]?.id??null;const host=rows.find((host:StoredInstance)=>host.id===goldWorkshopSelection),gear=item(host?.itemId),parts=profile!.stash.find((stack:Obj)=>stack.itemId==='gold-upgrade-part')?.quantity??0,currentLevels=(host as Obj)?.goldTraitLevels??gear?.goldTraitLevels??{},result=goldWorkshopResult?.instanceId===host?.id?goldWorkshopResult:null,before:Record<string,number>=result?.beforeTraits??currentLevels,after:Record<string,number>=result?.afterTraits??currentLevels,addedTrait:string|null=result?.addedTrait??null,keys=[...Object.keys(before),...Object.keys(after).filter(key=>before[key]===undefined)],canShowEmpty=!result&&Object.keys(before).length<4,detail=goldWorkshopTrait?GOLD_OPTIONS[goldWorkshopTrait]:null;
 const comparisons=keys.map(trait=>`<div class="gold-trait-row">${before[trait]===undefined?'<span class="gold-trait-empty">빈자리</span>':goldTraitButton(trait,before[trait],'before')}<i>›</i>${goldTraitButton(trait,after[trait],'after',before[trait]!==undefined&&after[trait]>before[trait],trait===addedTrait)}</div>`).join('')+(canShowEmpty?'<div class="gold-trait-row pending"><span class="gold-trait-empty">빈자리</span><i>›</i><span class="gold-trait-empty next">새로운 특성</span></div>':'');
 panel.innerHTML=`<section class="gold-workshop"><header><div class="gold-workshop-title"><span>특성 강화</span><i></i></div><div class="gold-part-balance">`+icon(item('gold-upgrade-part'))+`<b>`+parts+`</b></div><button class="close" data-gold-close aria-label="강화소 닫기">×</button></header><div class="gold-workshop-body"><main class="gold-upgrade-stage">`+(gear&&host?`<div class="gold-focus-item" style="`+rarityStyle(gear)+`">`+icon(gear)+`<strong>`+esc(gear.name)+`</strong><span>`+esc(gear.family??categories[gear.category])+`</span></div><div class="gold-trait-flow"><h2>기존 특성</h2><i></i><h2>강화 후</h2><div class="gold-trait-rows">`+(comparisons||'<p>등록된 특성이 없습니다.</p>')+`</div></div><footer><span>업그레이드 부품 1개 사용</span><button class="primary" data-gold-commit `+(parts<1?'disabled':'')+`>강화 <b>1 / `+parts+`</b></button></footer>`:`<div class="gold-workshop-empty"><b>선택할 골드 장비가 없습니다.</b><span>보관함에 있는 골드 장비만 강화할 수 있습니다.</span></div>`)+`</main><aside class="gold-workshop-list"><nav><button data-gold-category="weapon" class="`+(category==='weapon'?'active':'')+`">무기</button><button data-gold-category="gear" class="`+(category==='gear'?'active':'')+`">방어구</button></nav><div>`+(rows.map((stored:StoredInstance)=>{const current=item(stored.itemId)!;return `<button data-gold-instance="`+stored.id+`" class="`+(stored.id===goldWorkshopSelection?'active':'')+`" style="`+rarityStyle(current)+`">`+icon(current)+`<strong>`+esc(current.name)+`</strong><span>`+(Object.keys((stored as Obj).goldTraitLevels??current.goldTraitLevels??{}).length)+`개 특성</span></button>`;}).join('')||'<p>보관 중인 골드 장비가 없습니다.</p>')+`</div></aside></div>`+(detail?`<div class="gold-trait-popup"><button data-gold-detail-close aria-label="특성 설명 닫기">×</button><b>`+esc(detail.name)+`</b><p>`+esc(detail.description)+`</p></div>`:'')+`</section>`;
 panel.querySelector<HTMLElement>('[data-gold-close]')!.onclick=()=>{panel.remove();goldWorkshopTrait=null;goldWorkshopResult=null;render();};panel.querySelector<HTMLElement>('[data-gold-detail-close]')?.addEventListener('click',()=>{goldWorkshopTrait=null;refresh();});panel.querySelectorAll<HTMLElement>('[data-gold-trait]').forEach(button=>button.onclick=()=>{goldWorkshopTrait=button.dataset.goldTrait!;refresh();});panel.querySelectorAll<HTMLElement>('[data-gold-category]').forEach(button=>button.onclick=()=>{category=button.dataset.goldCategory as typeof category;goldWorkshopSelection=null;goldWorkshopTrait=null;goldWorkshopResult=null;refresh();});panel.querySelectorAll<HTMLElement>('[data-gold-instance]').forEach(button=>button.onclick=()=>{goldWorkshopSelection=button.dataset.goldInstance!;goldWorkshopTrait=null;goldWorkshopResult=null;refresh();});const commit=panel.querySelector<HTMLButtonElement>('[data-gold-commit]');if(commit&&gear&&host)commit.onclick=()=>void action(async()=>{const workshop=panel.querySelector<HTMLElement>('.gold-workshop')!;workshop.classList.add('enhancing');commit.disabled=true;playGoldUpgradeEffect();const minimum=new Promise(resolve=>window.setTimeout(resolve,900));try{const d=await api('/gold/upgrade',{itemId:gear.id,instanceId:host.id});await minimum;setProfile(d.profile);goldWorkshopSelection=host.id;goldWorkshopTrait=null;goldWorkshopResult={...d,instanceId:host.id};refresh();requestAnimationFrame(()=>panel.querySelector('.gold-workshop')?.classList.add('upgrade-revealed'));toast(d.outcome==='added_and_leveled'?'새 특성이 추가되고 기존 특성이 강화됐습니다.':d.outcome==='added'?'새 특성이 추가됐습니다.':d.outcome==='leveled'?'기존 특성 레벨이 올랐습니다.':'강화 결과가 유지됐습니다.');}catch(error){workshop.classList.remove('enhancing');throw error;}});};
 document.body.append(panel);refresh();
}


function openGoldDismantleConfirm(itemId:string,instanceId:string){
 const gear=item(itemId);if(!gear)return;const modal=document.createElement('div');modal.className='gold-dismantle-backdrop';
 modal.innerHTML=`<section class="gold-dismantle-dialog" role="dialog" aria-modal="true" aria-labelledby="gold-dismantle-title"><header><span>GOLD EQUIPMENT / DISMANTLE</span><button data-dismantle-cancel aria-label="분해 취소">×</button></header><main><h2 id="gold-dismantle-title">골드 장비를 분해할까요?</h2><p>선택한 장비는 사라지고 업그레이드 부품 1개를 획득합니다.</p><div class="gold-dismantle-flow"><article style="${rarityStyle(gear)}">${icon(gear)}<strong>${esc(gear.name)}</strong><small>분해할 장비</small></article><i>›</i><article class="result">${icon(item('gold-upgrade-part'))}<strong>업그레이드 부품</strong><small>× 1 획득</small></article></div><p class="gold-dismantle-note">장착 파츠는 분해되지 않고 보관함에 남습니다.</p></main><footer><button class="outline" data-dismantle-cancel>취소</button><button class="danger" data-dismantle-confirm>분해하기</button></footer></section>`;
 const close=()=>{modal.remove();window.removeEventListener('keydown',onKey,true);},onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};
 window.addEventListener('keydown',onKey,true);modal.onclick=event=>{if(event.target===modal)close();};modal.querySelectorAll<HTMLElement>('[data-dismantle-cancel]').forEach(button=>button.onclick=close);
 const confirm=modal.querySelector<HTMLButtonElement>('[data-dismantle-confirm]')!;confirm.onclick=()=>void action(async()=>{confirm.disabled=true;try{const d=await api('/gold/dismantle',{itemId,instanceId});close();setProfile(d.profile);selected='gold-upgrade-part';selectedInstance=null;render();toast('업그레이드 부품 1개를 획득했습니다.');}finally{if(modal.isConnected)confirm.disabled=false;}});
 document.body.append(modal);confirm.focus();
}

function handle(a:string){
 if(a==='gold-workshop'){openGoldWorkshop(selectedInstance??undefined);return;}
 if(a==='sell-collectibles'){if(!window.confirm('암호편지를 제외한 모든 수집품을 판매할까요?'))return;void action(async()=>{const d=await api('/shop/sell-collectibles',{});setProfile(d.profile);render();toast(`수집품 ${d.sold}개를 ${money(d.total)} ◈에 판매했습니다.`);});return;}
 if(a==='dismantle-gold'&&selected&&selectedInstance){openGoldDismantleConfirm(selected,selectedInstance);return;}
 if(a==='upgrade-gold'&&selected&&selectedInstance){void action(async()=>{const d=await api('/gold/upgrade',{itemId:selected,instanceId:selectedInstance});setProfile(d.profile);selected=d.targetId;render();toast(d.outcome==='added'?'새 특성이 추가됐습니다.':d.outcome==='leveled'?'특성 레벨이 올랐습니다.':'강화 효과가 발생하지 않았습니다.');});return;}
 if(a==='instance-parts'&&profile&&selectedInstance){const host=profile.instances?.find((v:StoredInstance)=>v.id===selectedInstance);if(host){const changed=(p:Obj)=>{setProfile(p);render();};if(item(host.itemId)?.category==='armor')openArmorFittings(profile,changed,routeError,host.id);else openWeaponFittings(profile,changed,routeError,host.slot&&isFirearmSlot(host.slot)?host.slot:compatibleWeaponSlots(item(host.itemId)!)[0]==='pistol'?'pistol':'primary',host.id);}return;}sound.unlock();sound.play('ui');if(a==='map-preview'){openMapPreview(WORLD);return;}if(['home','kit','stash','shop','talents'].includes(a)){tab=a;selected=null;filter=a==='shop'?'weapon':'all';ammoFilter='all';query='';menuViewKey='';render();return;}if(a==='secure-loadout'&&profile){openSecureLoadout(profile,p=>{setProfile(p);render();},routeError);return;}if(a==='auth-toggle'){authMode=authMode==='login'?'register':'login';render();}if(a==='sound'){sound.setMute(!sound.muted);localStorage.setItem('bluecap-muted',String(sound.muted));if(raid)renderHudShell();else render();}if(a==='solo'||a==='coop'){roomMode=a;render();}if(['crate-weapon','crate-armor','crate-premium-weapon','crate-premium-armor'].includes(a))void action(async()=>{const d=await api('/shop/crate',{kind:a.slice('crate-'.length)});setProfile(d.profile);render();toast(`${item(d.reward.itemId)?.name??'장비'} 획득`);});if(a==='buy')void action(async()=>{const d=await api('/shop/buy',{itemId:selected,quantity:1});setProfile(d.profile);render();toast('보관함에 보급품이 도착했습니다.');});if(a==='sell')void action(async()=>{const input=document.querySelector<HTMLInputElement>('#sell-quantity'),quantity=Number(input?.value),itemId=selected,instanceId=selectedInstance??undefined;if(!itemId||!Number.isSafeInteger(quantity)||quantity<1||quantity>Number(input?.max))return;const host=instanceId?profile?.instances?.find((v:Obj)=>v.id===instanceId):null,includeFittings=item(itemId)?.category==='armor'&&Object.keys(host?.fittings??{}).length>0;if(includeFittings&&!window.confirm('이 방탄조끼에 장착된 파츠까지 함께 판매할까요?'))return;let remaining=quantity;try{while(remaining>0){const batch=Math.min(1000,remaining),d=await api('/shop/sell',{itemId,quantity:batch,instanceId,includeFittings});setProfile(d.profile);remaining-=batch;}}finally{render();}toast(`${quantity}개 판매했습니다.`);});if(a==='equip')void action(async()=>{const d=await api('/loadout/equip',{slot:($('#equip-slot') as HTMLSelectElement).value,itemId:selected,instanceId:selectedInstance??undefined});setProfile(d.profile);render();toast('장비에 장착했습니다.');});if(a==='launch')void action(async()=>{const d=await api('/rooms',{mode:'solo'});room=d.room;await api('/rooms/start',{});});if(a==='create-room')void action(async()=>{const d=await api('/rooms',{mode:'coop'});room=d.room;syncLobbyParty();render();});if(a==='join')void action(async()=>{const d=await api('/rooms/join',{code:($('#invite-code') as HTMLInputElement).value.toUpperCase()});room=d.room;syncLobbyParty();render();});if(a==='room-ready')void action(async()=>{const own=room?.members?.find((member:Obj)=>member.id===playerId);const d=await api('/rooms/ready',{ready:!own?.ready});room=d.room;syncLobbyParty();render();});if(a==='start-room')void action(async()=>{await api('/rooms/start',{});});if(a==='leave-room')void action(async()=>{await api('/rooms/leave',{});room=null;syncLobbyParty();render();});if(a==='copy-code'){void navigator.clipboard.writeText(room?.code??room?.inviteCode??'');toast('초대 코드를 복사했습니다.');}if(a==='logout')void action(async()=>{await api('/auth/logout',{});net.disconnect();pingIndicator.setStatus('연결 중');updatePing();profile=null;user=null;room=null;syncLobbyParty();render();});if(a==='guide')showGuide();}
function showGuide(){const p=document.createElement('div');p.className='modal-backdrop';p.innerHTML=`<section class="guide"><span class="eyebrow">FIELD MANUAL / 01</span><h2>돌아오면, 모두 내 것.</h2><p>보급 상자에 다가가 <kbd>E</kbd>로 수집하세요. 매번 다른 진입 위치에서 출발합니다. 가장 먼 탈출구 두 곳에서 8초를 버티거나, F로 철수 플레어건을 발사하세요. 발사 위치에 30초 뒤 60초 동안 탈출 구역이 열리며 3초간 버티면 탈출합니다. 피격되면 탈출 대기가 취소됩니다.</p><div class="guide-keys"><span><kbd>W A S D</kbd> 이동</span><span><kbd>마우스</kbd> 조준 · 사격</span><span><kbd>Shift</kbd> 달리기</span><span><kbd>R</kbd> 재장전</span><span><kbd>1 2 3 4</kbd> 무기 전환</span><span><kbd>H</kbd> 치료</span><span><kbd>G</kbd> 투척물</span><span><kbd>B</kbd> 하부 유탄</span><span><kbd>F</kbd> 파란 신호탄</span><span><kbd>M</kbd> 지도</span></div><p>중앙 사일로의 방사능은 현재 체력과 최대 체력을 줄입니다. 주연 직물이나 납 주입 옵션 방어구를 먼저 준비하세요.</p><button class="primary">확인했어요 <span>✓</span></button></section>`;document.body.append(p);p.querySelector('button')!.onclick=()=>p.remove();}
function me(){return snapshot?.players.find((p:Obj)=>p.id===playerId);}
function renderHudShell(){floatingLabels.clear();$('#app').classList.add('in-raid');$('#ping-badge').hidden=false;$('#interface').className='raid-interface';$('#interface').innerHTML=`<div class="raid-top"><div class="raid-item-value" aria-label="현재 아이템 가치"><i aria-hidden="true"></i><strong id="raid-item-value">0</strong></div><div class="raid-location"><span class="eyebrow">ARCTIC BASE / LIVE EXPEDITION</span><strong>북극 기지</strong><span id="raid-timer">15:00</span></div><div class="raid-team" id="raid-team"></div><button id="secure-button" class="hud-button" aria-label="인벤토리 열기">I 인벤토리</button><button id="pause-button" class="hud-button" aria-label="일시 메뉴">Ⅱ</button></div><div id="extraction-banner"></div><div id="radiation-banner"></div><div id="boss-status"></div><div id="world-labels"></div><div class="minimap-wrap"><canvas id="minimap" width="250" height="250" aria-label="원정 지도"></canvas><div class="map-zoom-controls"><button id="map-zoom-out" aria-label="지도 축소">−</button><output id="map-zoom-label">1.0×</output><button id="map-zoom-in" aria-label="지도 확대">＋</button></div><button id="map-button">M 지도 확대</button></div><div class="health-cluster"><div class="health-title"><span>BLUECAP <b>07</b></span><strong id="health-number">100 / 100</strong></div><div class="health-track"><i id="health-fill"></i></div><div class="stamina-track"><i id="stamina-fill"></i></div><span id="carry-weight">배낭 0 용량</span><span id="cold-status"></span><div class="bag-quick-select"><select id="quick-med-select" aria-label="배낭 치료제 선택"></select><select id="quick-throw-select" aria-label="배낭 투척물 선택"></select></div><div class="quick-actions"><button data-raid="heal"><kbd>H</kbd> 치료</button><button data-raid="throw"><kbd>G</kbd> 투척</button><button data-raid="flare"><kbd>F</kbd> 신호탄</button><button data-raid="underbarrel"><kbd>B</kbd> 유탄</button></div></div><div class="weapon-cluster"><div id="weapon-name"></div><div class="ammo-display"><strong id="ammo-count">0</strong><span>/ <b id="reserve-count">0</b></span><button data-raid="reload"><kbd>R</kbd> 재장전</button></div><select id="ammo-type-select" class="ammo-type-select" aria-label="장전할 탄환 선택"></select><div id="reload-state"></div><div class="weapon-select">${CARRIED_WEAPON_SLOTS.map((slot,index)=>`<button data-switch="${slot}"><kbd>${index+1}</kbd> ${slots[slot]}</button>`).join('')}</div></div><div id="interact-prompt"></div><div class="touch-controls"><div id="move-stick" class="stick"><i></i></div><div id="aim-stick" class="stick aim-stick"><span>조준 / 사격</span><i></i></div><button id="touch-interact" class="touch-interact">E</button></div><div id="pause-overlay"></div>`;$('#secure-button').onclick=()=>toggleSecure();$('#pause-button').onclick=()=>togglePause();$('#map-button').onclick=()=>toggleMap();$('#map-zoom-out').onclick=()=>setMapZoom(mapZoom-.5);$('#map-zoom-in').onclick=()=>setMapZoom(mapZoom+.5);$('.minimap-wrap').addEventListener('wheel',event=>{if(!showMap)return;event.preventDefault();setMapZoom(mapZoom+(event.deltaY<0?.5:-.5));},{passive:false});document.querySelectorAll<HTMLElement>('[data-raid]').forEach(b=>b.onclick=()=>raidAction(b.dataset.raid!));document.querySelectorAll<HTMLElement>('[data-switch]').forEach(b=>b.onclick=()=>switchWeapon(b.dataset.switch!));$('#touch-interact').onclick=()=>interact();setupStick($('#move-stick'),false);setupStick($('#aim-stick'),true);containersUI.mount($('#interface'));secureUI.mount($('#interface'));medicalUI.mount($('.health-cluster'));updateHUD();}
function raidWorld(data:Obj){const source=data.world??WORLD;return {...source,spawn:data.entry??source.spawn,extractions:data.extractions??source.extractions,obstacles:[...(source.obstacles??[])]};}
const nextPaint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
function setRaidLoading(stage:string,progress:number){const overlay=$<HTMLElement>('#raid-loading');overlay.hidden=false;overlay.classList.remove('ready','failed');$('#raid-loading-status').textContent=stage;$('#raid-loading-progress').style.width=`${Math.max(0,Math.min(100,progress))}%`;$('#raid-loading-percent').textContent=`${Math.round(progress)}%`;}
function consumePendingRaidSnapshot(){if(!pendingRaidSnapshot)return false;const next=pendingRaidSnapshot;pendingRaidSnapshot=null;applyingPendingSnapshot=true;try{receive(next);}finally{applyingPendingSnapshot=false;}return true;}
async function loadRaid(world:Obj,pid:string,token:number){
 try{
  setRaidLoading('원정 데이터를 확인하고 있습니다.',10);await nextPaint();await nextPaint();if(token!==raidLoadToken)return;
  setRaidLoading('아틱 베이스를 구성하고 있습니다.',38);await nextPaint();
  view.start(world,pid);view.pred.set(world.spawn?.x??0,0,world.spawn?.z??44);renderHudShell();setRaidLoading('환경과 장비를 배치하고 있습니다.',72);
  const waitStarted=performance.now();while(token===raidLoadToken&&!pendingRaidSnapshot){if(performance.now()-waitStarted>4000)setRaidLoading('서버 상태를 동기화하고 있습니다.',82);await new Promise(resolve=>setTimeout(resolve,40));}
  if(token!==raidLoadToken)return;consumePendingRaidSnapshot();setRaidLoading('첫 화면을 준비하고 있습니다.',94);
  const renderedAt=view.renderedFrames;while(token===raidLoadToken&&view.renderedFrames<=renderedAt)await nextPaint();if(token!==raidLoadToken)return;
  consumePendingRaidSnapshot();await nextPaint();setRaidLoading('원정 준비 완료',100);await new Promise(resolve=>setTimeout(resolve,140));if(token!==raidLoadToken)return;
  raidLoading=false;const overlay=$<HTMLElement>('#raid-loading');overlay.classList.add('ready');overlay.setAttribute('aria-busy','false');window.setTimeout(()=>{if(!raidLoading){overlay.hidden=true;overlay.classList.remove('ready');}},280);sound.ambience(true);toast('원정 시작 · 주변 보급 상자를 살펴보세요.');
 }catch(error){console.error(error);const overlay=$<HTMLElement>('#raid-loading');overlay.classList.add('failed');setRaidLoading('원정 지형을 불러오지 못했습니다. 연결을 확인해 주세요.',100);overlay.classList.add('failed');}
}
function begin(world:Obj=WORLD,pid=playerId){if(raidLoading)return;ignoreRaidTraffic=false;raid=true;raidLoading=true;settled=false;paused=false;showMap=false;mapZoom=1;fiveMinuteWarned=false;playerId=pid;activeSlot='primary';sessionLoot=[];kills=0;snapshot=null;pendingRaidSnapshot=null;containersUI.close();secureUI.close();combatInput?.reset();firing=false;keys.clear();const overlay=$<HTMLElement>('#raid-loading');overlay.setAttribute('aria-busy','true');const token=++raidLoadToken;void loadRaid(world,pid,token);}
const eventSeen=new Set<number>();
function playWorldGunshot(d:Obj,eventId?:number){
 if((d.sourceKind==='player'&&d.sourceId===playerId)||d.playerId===playerId)return;
 const x=Number(d.x),z=Number(d.z);if(!Number.isFinite(x)||!Number.isFinite(z))return;
 const dx=x-view.pred.x,dz=z-view.pred.z,distance=Math.hypot(dx,dz);
 sound.gunshot({ammoId:d.ammoId,weaponId:d.weaponId,suppressed:!!d.suppressed,distance,pan:distance>.001?Math.max(-1,Math.min(1,dx/distance)):0,eventKey:`server:${eventId??d.serverTime}`});
}
function receive(data:Obj){
 if(
  (ignoreRaidTraffic||(settled&&!spectating)) &&
  (data.type==='snapshot'||data.type==='event')
 )return;
if(data.type==='snapshot'&&raidLoading&&!applyingPendingSnapshot){pendingRaidSnapshot=data;return;}if(data.type==='welcome'){playerId=data.playerId;serverOffset=data.serverTime-Date.now();room=data.room;syncLobbyParty();if(data.raid){begin(raidWorld(data.raid),playerId);receive(data.raid);}else render();}if(data.type==='room'){room=data.room;syncLobbyParty();if(!raid)render();}if(data.type==='raid_started'){eventSeen.clear();begin(raidWorld(data),data.playerId??playerId);}if(data.type==='snapshot'){if(!raid&&!settled){begin(raidWorld(data),playerId);pendingRaidSnapshot=data;return;}snapshot=data;serverOffset=data.serverTime-Date.now();view.setSnapshot(data);const p=me();if(p?.weaponId){const i=item(p.weaponId);view.setWeapon(p.weaponId,family(i),p.attachments??p.weaponAttachments?.[p.activeWeaponSlot]);activeSlot=p.activeWeaponSlot??activeSlot;}if(p&&(!p.alive||p.downed||p.boarded||p.searching)){combatInput?.reset();firing=false;scopeHeld=false;scopeSignature='';view.resetScope();}else if(scopeHeld)updateScopeFromGear(true);for(const actor of [...data.players,...data.enemies]){const i=item(actor.weaponId);if(i)view.actorMap.get(actor.id)?.setWeapon(i.id,family(i),actor.attachments??actor.weaponAttachments?.[actor.activeWeaponSlot]);}for(const ev of data.events??[])receive({...ev,type:'event'});}if(data.type==='pong'&&pingIndicator.pong(data.clientTime,Date.now())){ping=pingIndicator.latency!;serverOffset=data.serverTime-Date.now()+ping/2;updatePing();}if(data.type==='error'){secureUI.rejectPending(data.message??'요청을 처리하지 못했습니다.');containersUI.rejectPending(data.message);const translated:Record<string,string>={REVIVE_BUSY:'다른 동료가 구조 중입니다.',REVIVE_BLOCKED:'벽이나 창문 너머에서는 구조할 수 없습니다.',INVALID_REVIVE:'지금 구조할 수 없는 동료입니다.',REVIVE_EXPIRED:'구조 가능 시간이 지났습니다.',EQUIPMENT_SLOT_OCCUPIED:'이미 장착된 장비가 있습니다.',SLOT_OCCUPIED:'이미 장착된 장비가 있습니다.',INVALID_QUANTITY:'수량을 다시 확인하세요.',INSUFFICIENT_ITEMS:'배낭에 그 수량만큼 남아 있지 않습니다.',INSUFFICIENT_CONTAINER_ITEMS:'다른 대원이 먼저 가져간 물품입니다.',CONTAINER_NOT_FOUND:'바닥 물품이나 상자를 찾을 수 없습니다.',PLAYER_INACTIVE:'현재 상태에서는 물품을 옮길 수 없습니다.',ACCESS_DOOR_NOT_FOUND:'출입문을 찾을 수 없습니다.',PASSWORD_LETTER_REQUIRED:'같은 색의 암호문을 배낭에 챙기세요.',ACCESS_DOOR_LOCKED:'암호문으로 보급실 문을 먼저 여세요.',FLARE_NOT_READY:'탈출 지점이 아직 준비 중입니다.',FLARE_EXPIRED:'플레어 탈출 지점이 닫혔습니다.',CONTAINER_BUSY:'동료가 수색 중입니다.',CONTAINER_CLOSED:'먼저 상자를 수색하세요.',NO_LINE_OF_SIGHT:'벽 너머의 상자에는 손이 닿지 않습니다.',NO_AMMO:'탄약이 부족합니다.',EMPTY_MAGAZINE:'탄창이 비었습니다. R로 재장전하세요.',RELOADING:'재장전 중입니다.',NO_FLARE_AMMO:'파란 신호탄 탄약이 필요합니다.',NO_FLARE:'배낭 또는 장비에 철수 플레어건이 필요합니다.',TOO_FAR:'조금 더 가까이 다가가세요.',OVER_CAPACITY:'배낭이 가득 찼습니다.',NO_UNDERBARREL:'하부 유탄 발사기를 장착하세요.'};if(!['FIRE_COOLDOWN','COOLDOWN','NOT_ALIVE'].includes(data.code))toast(translated[data.code]??data.message,true);}if(data.type==='event'){if(eventSeen.has(data.id))return;eventSeen.add(data.id);const d=data.data??{},own=d.playerId===playerId;if(data.kind==='gunshot')playWorldGunshot(d,data.id);if(data.kind==='explosion')sound.play('explosion');if(data.kind==='shot'){const p=snapshot?.players.find((p:Obj)=>p.id===d.playerId);if(p&&!own)view.shot(p.x,p.z,Math.sin(p.yaw),Math.cos(p.yaw),false,p.id);}if(data.kind==='enemy_shot'){const e=snapshot?.enemies.find((e:Obj)=>e.id===d.enemyId),p=snapshot?.players.find((p:Obj)=>p.id===d.playerId);if(e&&(p||Number.isFinite(d.aimX))){const dx=p?p.x-e.x:0,dz=p?p.z-e.z:0,len=Math.max(.001,Math.hypot(dx,dz)),ax=Number.isFinite(d.aimX)?d.aimX:dx/len,az=Number.isFinite(d.aimZ)?d.aimZ:dz/len;view.shot(e.x,e.z,ax,az,true,e.id);}}if(data.kind==='player_hit')view.reactHit(d.playerId);if(data.kind==='hit'&&d.enemyId)view.reactHit(d.enemyId);if(data.kind==='player_hit'&&own){sound.play('hit');$('#damage-flash').animate([{opacity:.42},{opacity:0}],{duration:280});view.trauma=.18;}if(data.kind==='hit'&&own){sound.play('hit');$('#reticle').animate([{filter:'drop-shadow(0 0 5px #fff0ae)'},{filter:'drop-shadow(0 1px 2px #0a1e19)'}],{duration:150});}if(data.kind==='loot'&&own){sessionLoot.push(d);sound.play('loot');toast(`${item(d.itemId)?.name??d.itemId} ×${d.quantity} 획득`);}if(data.kind==='kill'&&(d.playerId===playerId||d.killerId===playerId)){kills++;sound.play('hit');toast('위협을 제압했습니다.');}if(data.kind==='container_equipped'&&own){sound.play('loot');toast(`${item(d.itemId)?.name??'장비'} 바로 장착했습니다.`);}if(data.kind==='container_bonus_item'&&own){sound.play('loot');toast(`모듈 탐색 · ${item(d.itemId)?.name??'보너스 아이템'} 추가 획득`);}if(data.kind==='patrol_squad_started')toast(`${d.baseName??'부대'} 인근 · ${d.count}인 순찰대 출현`);if(data.kind==='boss_defeated')toast(`${d.name} 제압 · 전리품을 바로 획득할 수 있습니다.`);if(data.kind==='boss_phase')toast(`${d.name} 격노 · 특수 공격을 조심하세요.`,true);if(data.kind==='medical_started'&&own){(window as any).__peAudio?.medicalUse?.(d.itemId);}if(data.kind==='heal'&&own){toast('치료했습니다.');}if(data.kind==='flare_fired'){sound.play('flare');toast('철수 신호탄 발사 · 30초 뒤 이 위치에 탈출 구역이 열립니다.');}if(data.kind==='flare_activated')toast('플레어 탈출 구역 개방 · 60초 동안 이용할 수 있습니다.');if(data.kind==='extraction_cancelled'&&own)toast(d.reason==='hit'?'피격! 탈출이 취소됐습니다. E로 다시 시작하세요.':d.reason==='expired'?'플레어가 만료되어 탈출이 취소됐습니다.':'탈출 대기가 취소됐습니다.',true);if(data.kind==='access_door_opened')toast('암호문 확인 · 보급실 문이 열렸습니다.');if(data.kind==='downed'&&own)toast('쓰러졌습니다. 동료가 구조할 수 있습니다.',true);if(data.kind==='revive_cancelled'&&own)toast('구조가 중단됐습니다. 다시 시도하세요.',true);if(data.kind==='revived'&&own)toast('동료가 구조했습니다.');if(data.kind==='settled'&&own&&!settled){
 settled=true;
 if(
  d.outcome==='dead' &&
  spectatorCandidates().length
 ){
  enterSpectator(d.outcome,d.lossReport);
 }else{
  void debrief(d.outcome,d.lossReport);
 }
}}}
const clientCPU={messageMs:0,messageMaxMs:0,frameMs:0,frameMaxMs:0,elapsedMs:0,elapsedMaxMs:0,inputGapMs:0};net.onMessage=data=>{const started=performance.now();receive(data);clientCPU.messageMs=performance.now()-started;clientCPU.messageMaxMs=Math.max(clientCPU.messageMaxMs,clientCPU.messageMs);};net.onStatus=s=>{status=s;pingIndicator.setStatus(s);updatePing();if(s==='온라인')sendPing();if(!raid&&profile)render();};
function nearest():Obj|null{const p=me();if(!p||!snapshot)return null;const targets:Obj[]=[...(snapshot.accessDoors??[]).filter((d:Obj)=>d.state==='locked').map((d:Obj)=>({...d,targetType:'door'})),...(snapshot.containers??[]).map((c:Obj)=>({...c,targetType:'container'})),...snapshot.loot.map((l:Obj)=>({...l,targetType:'loot'})),...snapshot.players.filter((a:Obj)=>a.downed&&a.id!==playerId).map((a:Obj)=>({...a,targetType:'revive'})),...snapshot.extractions.filter((e:Obj)=>e.state!=='expired').map((e:Obj)=>({...e,targetType:'exit'}))];return targets.map((t):Obj=>({...t,distance:Math.hypot(t.x-view.pred.x,t.z-view.pred.z)})).filter(t=>t.distance<=(t.targetType==='exit'?(t.radius??3):2.5)).sort((a,b)=>a.distance-b.distance)[0]??null;}
function toggleSecure(){if(!raid||paused||settled)return;scopeHeld=false;scopeSignature='';view.resetScope();containersUI.suspendView();firing=false;touchAim=false;touchMove={x:0,z:0};keys.clear();view.moveX=view.moveZ=0;secureUI.toggle();}
function interact(){if(me()?.reviving){net.send('cancel_revive');return;}secureUI.close();const t=nearest();if(!t)return;if(me()?.extracting)return;if(t.targetType==='door'){net.send('unlock_door',{doorId:t.id});return;}if(t.targetType==='exit'&&t.state==='arming'){toast('플레어 탈출 구역이 아직 준비 중입니다.');return;}if(t.targetType==='container'){containersUI.focus(t.id);if(t.state==='open'||t.state==='searching')return;updateScopeFromGear(false);firing=false;}net.send('interact',{targetId:t.id});}
function updateScopeFromGear(enabled:boolean){scopeHeld=enabled;if(!enabled){scopeSignature='';view.resetScope();return;}const p=me(),slot=p?.activeWeaponSlot??activeSlot,weaponId=p?.equipment?.[slot]??p?.weaponId,weapon=item(weaponId);const equipment=p?.attachments??p?.weaponAttachments?.[slot],kind=scopeKind(equipment?.scope,item),signature=slot+'|'+(weaponId??'')+'|'+(equipment?.scope??'');if(!p?.alive||p.downed||p.searching||!isFirearmSlot(slot)||!weapon||weapon.mode==='melee'||!kind){scopeHeld=false;scopeSignature='';view.resetScope();return;}if(signature!==scopeSignature){scopeSignature=signature;view.setScope(kind,true,weapon.aimTimeMultiplier??1);}}
function switchWeapon(slot:string){combatInput?.reset();firing=false;scopeHeld=false;scopeSignature='';view.resetScope();activeSlot=slot;net.send('switch_weapon',{weaponSlot:slot});const id=me()?.equipment?.[slot]??profile?.equipped?.[slot],i=item(id);if(i)view.setWeapon(i.id,family(i),me()?.weaponAttachments?.[slot]??profile?.weaponAttachments?.[slot]);sound.play('reload');}
function raidAction(a:string){if(secureUI.isOpen)return;sound.unlock();if(a==='reload'){net.send('reload',{weaponSlot:activeSlot});sound.play('reload');}if(a==='heal'){if(me()?.medicalUse){net.send('use_medical',{cancel:true});return;}const id=medicalChoice||me()?.inventory?.find((stack:Obj)=>item(stack.itemId)?.category==='medical')?.itemId;if(id)net.send('use_medical',{itemId:id});else toast('배낭에 치료제가 없습니다.',true);}if(a==='throw'){const id=throwChoice||me()?.inventory?.find((stack:Obj)=>item(stack.itemId)?.category==='throwable')?.itemId;if(id)net.send('throw',{itemId:id,aimX:view.aim.x,aimZ:view.aim.z});else toast('배낭에 투척물이 없습니다.',true);}if(a==='underbarrel'){net.send('underbarrel',{aimX:view.aim.x,aimZ:view.aim.z});}if(a==='flare')net.send('flare',{});}
function togglePause(){paused=!paused;combatInput?.reset();scopeHeld=false;scopeSignature='';view.resetScope();firing=false;keys.clear();view.moveX=view.moveZ=0;touchMove={x:0,z:0};const p=$('#pause-overlay');p.innerHTML=paused?`<section class="pause-panel"><span class="eyebrow">FIELD RADIO / 연결 유지 중</span><h2>잠깐 숨 고르기.</h2><p>온라인 원정은 계속 진행됩니다.<br>안전한 엄폐물 뒤에서 쉬어가세요.</p><button class="primary" id="resume">원정 계속하기 <span>→</span></button><button class="outline" id="pause-sound">${sound.muted?'소리 켜기':'소리 끄기'}</button><button class="text-button" id="pause-guide">조작 안내</button></section>`:'';p.classList.toggle('visible',paused);if(paused){$('#resume').onclick=()=>togglePause();$('#pause-sound').onclick=()=>{sound.setMute(!sound.muted);togglePause();togglePause();};$('#pause-guide').onclick=()=>showGuide();}}
function updateAmmoPicker(p:Obj,w?:ItemDef){
 for(const [category,selector]of [['medical','#quick-med-select'],['throwable','#quick-throw-select']]){
  const el=$<HTMLSelectElement>(selector);if(!el)continue;const stacks=(p.inventory??[]).filter((stack:Obj)=>stack.quantity>0&&item(stack.itemId)?.category===category);
  let chosen=category==='medical'?medicalChoice:throwChoice;if(!stacks.some((stack:Obj)=>stack.itemId===chosen))chosen=stacks[0]?.itemId??'';
  if(category==='medical')medicalChoice=chosen;else throwChoice=chosen;
  const signature=stacks.map((stack:Obj)=>stack.itemId+':'+stack.quantity).join('|')+chosen;
  if(el.dataset.state!==signature){el.dataset.state=signature;el.innerHTML=stacks.length?stacks.map((stack:Obj)=>`<option value="${stack.itemId}" ${stack.itemId===chosen?'selected':''}>${esc(item(stack.itemId)?.name)} ×${stack.quantity}</option>`).join(''):`<option>${category==='medical'?'치료제 없음':'투척물 없음'}</option>`;}
  el.disabled=category==='medical'&&!!p.medicalUse;
  el.onchange=()=>{if(category==='medical')medicalChoice=el.value;else throwChoice=el.value;};
 }

 const select=$<HTMLSelectElement>('#ammo-type-select');if(!select)return;
 const pool=ITEMS.filter(i=>i.category==='ammo'&&ammoKey(i)===w?.ammo&&((p.reserveAmmo?.[i.id]??0)>0||p.loadedAmmo?.[activeSlot]===i.id));
 const picked=p.preferredAmmo?.[activeSlot]??p.loadedAmmo?.[activeSlot]??w?.ammo;
 const key=pool.map(i=>i.id+':'+(p.reserveAmmo?.[i.id]??0)).join('|')+'|'+picked;
 select.hidden=pool.length===0;
 if(select.dataset.state!==key){select.dataset.state=key;select.innerHTML=pool.map(i=>`<option value="${i.id}" ${picked===i.id?'selected':''}>${rarityLabel(i)?esc(rarityLabel(i))+' · ':''}${esc(ammoLabel(i))} · 예비 ${p.reserveAmmo?.[i.id]??0}</option>`).join('');}
 select.onchange=()=>{if(!paused)net.send('select_ammo',{weaponSlot:activeSlot,itemId:select.value});};
}
function toggleMap(){showMap=!showMap;if(!showMap)mapZoom=1;$('.minimap-wrap').classList.toggle('expanded',showMap);setMapZoom(mapZoom);}
function setMapZoom(value:number){mapZoom=Math.max(1,Math.min(4,Math.round(value*2)/2));const label=document.querySelector<HTMLOutputElement>('#map-zoom-label');if(label)label.value=mapZoom.toFixed(1)+'×';drawMap();}
function updateHUD(){if(!raid||!snapshot)return;const p=me();if(!p)return;medicalUI.update(p,Date.now()+serverOffset,paused);secureUI.update(p,paused);containersUI.update(p,snapshot.containers??[],view.pred,Date.now()+serverOffset,paused||secureUI.isOpen);const now=Date.now()+serverOffset,w=item(p.weaponId),remaining=Math.max(0,900-Math.floor(snapshot.raid.elapsedMs/1000));$('#raid-timer').textContent=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;$('#raid-item-value').textContent=money(p.itemValue??0);if(remaining<=300&&remaining>0&&!fiveMinuteWarned){fiveMinuteWarned=true;toast('원정 종료까지 5분 남았습니다. 탈출 지점으로 이동하세요.',true);}$('#health-number').textContent=`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;$('#health-fill').style.width=`${p.hp/(p.baseMaxHp??p.maxHp)*100}%`;$('#health-fill').classList.toggle('low',p.hp<35);$('#stamina-fill').style.width=`${p.stamina/p.maxStamina*100}%`;$('#carry-weight').textContent=`배낭 ${round1(p.carriedWeight)} / ${p.carryCapacity??150} 용량 · 장비 ${round1(p.equipmentWeight)}`;updateAmmoPicker(p,w);$('#weapon-name').textContent=w?`${w.name} · ${p.fittedWeights?.[p.activeWeaponSlot]??p.fittedWeights?.[activeSlot]??w.weight}`:'맨손';$('#weapon-name').style.color=w?rarityColor(w):'';$('#ammo-count').textContent=String(p.ammoInMagazine??0);$('#reserve-count').textContent=String(p.reserveAmmo?.[p.loadedAmmo?.[activeSlot]??w?.ammo??'']??0);$('#reload-state').textContent=p.reloadEndsAt&&p.reloadEndsAt>now?`재장전 · ${((p.reloadEndsAt-now)/1000).toFixed(1)}초`:w?.caliber??item(w?.ammo)?.name??'';document.querySelectorAll<HTMLElement>('[data-switch]').forEach(b=>b.classList.toggle('active',b.dataset.switch===activeSlot));$('#raid-team').innerHTML=snapshot.players.filter((q:Obj)=>q.id!==playerId).map((q:Obj)=>`<span><i class="${q.downed?'downed':''}"></i>${esc(q.username)}<b>${q.downed?'구조 필요':Math.ceil(q.hp)+' HP'}</b></span>`).join('');const radiation=$('#radiation-banner'),drugProtected=(p.radiationMedicineUntil??0)>now,protectedRadiation=p.radiationProtected||drugProtected;
radiation.className=p.radiation?(protectedRadiation?'protected':'exposed'):'';
radiation.innerHTML=p.radiation?`<b>☢ ${protectedRadiation?(drugProtected?'방사능 약품 보호 중':'방사능 방호 중'):'방사능 노출'}</b><span>${protectedRadiation?(drugProtected?'약품 보호 효과 적용':'방호 소재 / 면역 특성 적용'):'최대 체력 감소 · 즉시 구역을 벗어나세요'}</span>`:'';
const boss=snapshot.enemies.filter((e:Obj)=>e.bossId&&Math.hypot(e.x-view.pred.x,e.z-view.pred.z)<36).sort((a:Obj,b:Obj)=>Math.hypot(a.x-view.pred.x,a.z-view.pred.z)-Math.hypot(b.x-view.pred.x,b.z-view.pred.z))[0];$('#boss-status').innerHTML=boss?`<span>위험 구역 · ${esc(boss.zoneName)}</span><div><strong>${esc(boss.name)}</strong><b>${boss.phase===2?'격노':'경계'}</b></div><div class="boss-health"><i style="width:${boss.hp/boss.maxHp*100}%"></i></div>`:'';$('#boss-status').classList.toggle('visible',!!boss);$('#cold-status').textContent=p.coldUntil>now?`❄ 냉기 · 이동 속도 감소 ${Math.ceil((p.coldUntil-now)/1000)}초`:'';
const ex=snapshot.extractions.filter((e:Obj)=>e.kind==='flare'&&e.state!=='expired').sort((a:Obj,b:Obj)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];let banner='';const rescue=p.reviving??(p.beingRevivedBy?snapshot.players.find((q:Obj)=>q.id===p.beingRevivedBy)?.reviving:null);if(rescue)banner=`<span>${p.reviving?'동료 구조 중 · E 또는 ESC 취소':'동료가 구조 중 · 출혈 정지'}</span><strong>${Math.max(0,(rescue.completeAt-now)/1000).toFixed(1)}<small>초</small></strong>`;else if(p.extracting)banner=`<span>탈출 준비 중 · 피격되면 취소됩니다</span><strong>${Math.max(0,(p.extracting.completeAt-now)/1000).toFixed(1)}<small>초</small></strong>`;else if(ex){const sec=Math.max(0,Math.ceil(((ex.state==='arming'?ex.activatesAt:ex.expiresAt)-now)/1000));banner=`<span>${ex.state==='arming'?'BLUE SIGNAL · 탈출 구역 준비 중':'플레어 탈출 구역 · 폐쇄까지'}</span><strong>${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}</strong>`;}$('#extraction-banner').innerHTML=banner;$('#extraction-banner').classList.toggle('visible',!!banner);const n=nearest();$('#interact-prompt').innerHTML=n?`<kbd>E</kbd><span>${n.targetType==='container'?`${esc(n.name??'보급 상자')} · ${n.state==='open'?(n.visualType==='player-loot'?'즉시 획득':'내용물 보기'):n.state==='searching'?'수색 중':`${n.searchSeconds}초 수색`}`:n.targetType==='loot'?`${esc(item(n.itemId)?.name??'보급품')} 수집`:n.targetType==='revive'?`${esc(n.username)} · 10초 구조`:n.targetType==='door'?`${esc(n.name??'보급실')} · ${({yellow:'노랑',red:'빨강',black:'검정'} as Record<string,string>)[n.color]??''} 암호문 사용`:n.kind==='fixed'?'탈출 시작 · 8초 대기':n.state==='arming'?'플레어 준비 중':'탈출 시작 · 3초 대기'}</span>`:'';drawMap();}
function drawMap(){
 const canvas=$<HTMLCanvasElement>('#minimap');if(!canvas||!snapshot)return;
 const c=canvas.getContext('2d')!,world=snapshot.world??WORLD,size=world.size??WORLD.size,half=size/2,expanded=showMap;
 const px=expanded?900:250;if(canvas.width!==px){canvas.width=px;canvas.height=px;}
 const span=expanded?size/mapZoom:Math.min(150,size),cx=Math.max(-half+span/2,Math.min(half-span/2,view.pred.x)),cz=Math.max(-half+span/2,Math.min(half-span/2,view.pred.z));
 const scale=px/span,x=(v:number)=>(v-cx+span/2)*scale,z=(v:number)=>(v-cz+span/2)*scale;
 c.clearRect(0,0,px,px);c.fillStyle='#233d38';c.fillRect(0,0,px,px);
 for(const terrain of world.terrain??[]){if(/^(coast-sea-|nuclear-lake-)/.test(terrain.id))continue;c.fillStyle=terrain.kind==='field'?'#666c43':terrain.kind==='reservoir'?'#638a92':'#90aca8';c.fillRect(x(terrain.x-terrain.w/2),z(terrain.z-terrain.d/2),terrain.w*scale,terrain.d*scale);}
 paintCoastalMap(c,world,x,z,scale);
 c.strokeStyle='#58766b66';c.lineWidth=.6;for(let n=-half;n<=half;n+=40){c.beginPath();c.moveTo(x(n),0);c.lineTo(x(n),px);c.moveTo(0,z(n));c.lineTo(px,z(n));c.stroke();}
 c.fillStyle='#788676';for(const road of world.roads??[])c.fillRect(x(road.x-road.w/2),z(road.z-road.d/2),road.w*scale,road.d*scale);
 for(const r of world.radiationZones??[]){c.fillStyle='#c4b55733';c.beginPath();c.arc(x(r.x),z(r.z),r.radius*scale,0,Math.PI*2);c.fill();c.strokeStyle='#ddbc6d';c.stroke();}
 c.fillStyle='#b0b9a1';for(const o of world.obstacles??[])if(!['water-blocker','shore-rail','cooling-tower'].includes(o.kind))c.fillRect(x(o.x-o.w/2),z(o.z-o.d/2),o.w*scale,o.d*scale);paintCoastalMap(c,world,x,z,scale,true);
 for(const e of snapshot.extractions){if(e.state==='expired')continue;c.fillStyle=e.kind==='fixed'?'#efd077':e.state==='active'?'#8de1e0':'#7c9ba8';const ex=Math.max(8,Math.min(px-8,x(e.x))),ez=Math.max(8,Math.min(px-8,z(e.z)));c.beginPath();c.arc(ex,ez,expanded?6:4,0,Math.PI*2);c.fill();if(expanded){c.font='11px sans-serif';c.fillText(e.name??'탈출',ex+9,ez+4);}}
 if(snapshot.entry&&expanded){c.strokeStyle='#eee9cf';c.beginPath();c.arc(x(snapshot.entry.x),z(snapshot.entry.z),7,0,Math.PI*2);c.stroke();c.fillStyle='#eee9cf';c.font='11px sans-serif';c.fillText('진입 위치',x(snapshot.entry.x)+9,z(snapshot.entry.z)+4);}
 for(const zone of snapshot.bossZones??[]){if(!expanded&&Math.hypot(zone.x-view.pred.x,zone.z-view.pred.z)>span*.7)continue;c.strokeStyle=zone.defeated?'#81a69b':zone.color??'#d99a70';c.lineWidth=1;c.beginPath();c.arc(x(zone.x),z(zone.z),zone.radius*scale,0,Math.PI*2);c.stroke();if(expanded){c.font='bold 10px sans-serif';c.fillStyle=c.strokeStyle;c.fillText((zone.defeated?'✓ ':'⚠ ')+zone.bossName,x(zone.x)+6,z(zone.z)-6);}}
 for(const e of snapshot.enemies){if(Math.hypot(e.x-view.pred.x,e.z-view.pred.z)>24||e.hp<=0)continue;c.fillStyle='#e48870';c.beginPath();c.arc(x(e.x),z(e.z),expanded?3:2.5,0,Math.PI*2);c.fill();}
 for(const p of snapshot.players){if(!p.alive)continue;const pxp=x(p.x),pzp=z(p.z);c.fillStyle=p.id===playerId?'#fff0b9':'#72dbd4';c.strokeStyle='#102a28';c.lineWidth=expanded?4:2;c.beginPath();c.arc(pxp,pzp,p.id===playerId?(expanded?10:6):(expanded?6:4),0,Math.PI*2);c.fill();c.stroke();if(p.id===playerId){c.strokeStyle='#fff0b9';c.lineWidth=expanded?3:2;c.beginPath();c.moveTo(pxp,pzp);c.lineTo(pxp+Math.sin(p.yaw??0)*(expanded?20:11),pzp+Math.cos(p.yaw??0)*(expanded?20:11));c.stroke();}}
 if(expanded){c.textAlign='center';c.font='bold 12px sans-serif';for(const l of world.landmarks??[]){const lx=x(l.x),lz=z(l.z);c.lineWidth=4;c.strokeStyle='#142e2b';c.strokeText(l.name,lx,lz-8);c.fillStyle='#eee9cc';c.fillText(l.name,lx,lz-8);}c.textAlign='left';}
 c.fillStyle='#eee5c5';c.font='bold 11px sans-serif';c.fillText('N ↑',10,18);c.font='10px monospace';c.fillText(`${span} × ${span} m`,10,px-10);
}

const corpseBeamLabels=
 new Map<string,HTMLElement>();

const corpseBeamColors=[
 '',
 '#9bea63',
 '#55b8ff',
 '#ad72ff',
 '#ff66bd',
 '#ff5147',
 '#ffe13d'
];

function corpseBeamRank(i:Obj|undefined){
 if(!i)return 0;

 if(i.quality==='gold')
  return 6;

 return Math.max(
  0,
  Math.min(
   5,
   Number(
    i.equipmentLevel??
    i.tier??
    1
   )-1
  )
 );
}

function updateCorpseBeams(){
 if(!snapshot)return;

 const root=
  $('#world-labels');

 const width=
  root.clientWidth||
  innerWidth;

 const height=
  root.clientHeight||
  innerHeight;

 const active=
  new Set<string>();

 for(const c of snapshot.containers??[]){
  const corpse=
   c.visualType==='player-loot' ||
   /전리품$/.test(
    String(c.name??'').trim()
   );

  if(!corpse)continue;

  const model=
   view.containerMap.get(c.id);

  if(!model)continue;

  let rank=0;

  for(const stack of c.items??[]){
   rank=Math.max(
    rank,
    corpseBeamRank(
     item(stack.itemId)
    )
   );
  }

  if(rank<=0)continue;

  active.add(c.id);

  let beam=
   corpseBeamLabels.get(c.id);

  if(!beam){
   beam=document.createElement('i');

   Object.assign(
    beam.style,
    {
     position:'absolute',
     left:'0',
     top:'0',
     width:'7px',
     height:'62px',
     borderRadius:'4px 4px 1px 1px',
     pointerEvents:'none',
     transformOrigin:'50% 100%',
     willChange:'transform',
     backfaceVisibility:'hidden',
     contain:'layout paint style'
    }
   );

   root.appendChild(beam);
   corpseBeamLabels.set(c.id,beam);
  }

  const pos=
   model.position.clone();

  pos.y+=1.02;
  pos.project(view.camera);

  if(
   Math.abs(pos.x)>.98 ||
   Math.abs(pos.y)>.98 ||
   pos.z< -1 ||
   pos.z>1
  ){
   beam.style.display='none';
   continue;
  }

  const x=
   (pos.x+1)*.5*width;

  const y=
   (1-pos.y)*.5*height;

  const color=
   corpseBeamColors[rank];

  beam.style.display='block';

  beam.style.transform=
   `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;

  beam.style.background=
   `linear-gradient(to top,
    ${color} 0%,
    ${color} 55%,
    ${color}dd 72%,
    ${color}88 86%,
    transparent 100%)`;

  beam.style.boxShadow=
   `0 0 5px ${color},
    0 0 10px ${color}cc`;

  beam.style.opacity='.96';
 }

 for(
  const [id,beam]
  of corpseBeamLabels
 ){
  if(!active.has(id)){
   beam.remove();
   corpseBeamLabels.delete(id);
  }
 }
}

function worldLabels(){
 if(!snapshot){
  for(const[,label]of floatingLabels)
   label.root.style.display='none';
  return;
 }

 const active=new Set<string>();
 const self=me();

 for(const p of snapshot.players){
  if(p.id===playerId||(!p.alive&&!p.downed))continue;

  const actor=view.actorMap.get(p.id);
  const pos=actor?.root.position.clone();
  if(!pos)continue;

  pos.y+=2.8;
  pos.project(view.camera);

  const label=ensureFloatingLabel(p.id,false);
  label.root.classList.toggle('downed',!!p.downed);
  label.name.textContent=
   `${p.downed?'✚ ':''}${String(p.username??'동료')}`;

  if(
   Math.abs(pos.x)<.95 &&
   Math.abs(pos.y)<.9 &&
   pos.z>=-1 &&
   pos.z<=1
  ){
   placeFloatingLabel(label.root,pos);
   active.add(p.id);
  }else{
   label.root.style.display='none';
  }
 }

 for(const enemy of snapshot.enemies??[]){
  if(enemy.hp<=0)continue;

  const actor=view.actorMap.get(enemy.id);
  const pos=actor?.root.position.clone();
  if(!pos)continue;

  const distance=self
   ?Math.hypot(enemy.x-self.x,enemy.z-self.z)
   :0;

  if(distance>60)continue;

  pos.y+=enemy.bossId?3.5:2.65;
  pos.project(view.camera);

  const label=
   ensureFloatingLabel(enemy.id,true,!!enemy.bossId);

  const pct=Math.max(
   0,
   Math.min(
    100,
    enemy.hp/Math.max(1,enemy.maxHp)*100
   )
  );

  label.name.textContent=
   String(enemy.name??(enemy.bossId?'보스':'적'));

  if(label.fill)
   label.fill.style.width=`${pct}%`;

  if(label.value)
   label.value.textContent=
    `${Math.ceil(enemy.hp)} / ${Math.ceil(enemy.maxHp)}`;

  if(
   Math.abs(pos.x)<.96 &&
   Math.abs(pos.y)<.9 &&
   pos.z>=-1 &&
   pos.z<=1
  ){
   placeFloatingLabel(label.root,pos);
   active.add(enemy.id);
  }else{
   label.root.style.display='none';
  }
 }

 hideUnusedFloatingLabels(active);
 updateCorpseBeams();
}

function spectatorCandidates(){
 return (snapshot?.players??[]).filter(
  (p:Obj)=>
   p.id!==playerId &&
   p.alive &&
   !p.boarded
 );
}

function renderSpectatorOverlay(){
 if(!spectating||!snapshot)return;

 const candidates=spectatorCandidates();
 const target=candidates.find((p:Obj)=>p.id===spectatorId);

 let overlay=document.querySelector<HTMLElement>('#spectator-overlay');

 if(!overlay){
  overlay=document.createElement('div');
  overlay.id='spectator-overlay';
  overlay.style.cssText=
   'position:fixed;left:50%;bottom:36px;transform:translateX(-50%);'+
   'z-index:1200;background:rgba(8,14,17,.88);border:1px solid #65706d;'+
   'padding:12px 16px;display:flex;align-items:center;gap:12px;'+
   'color:#eee;font:600 14px sans-serif;backdrop-filter:blur(8px)';

  document.body.append(overlay);
 }

 overlay.innerHTML=
  `<button id="spectate-prev" style="padding:8px 12px">‹</button>`+
  `<div style="min-width:190px;text-align:center">`+
   `<small style="display:block;color:#aaa">관전 중</small>`+
   `<b style="font-size:16px">${esc(target?.username??'팀원')}</b>`+
   `<span style="display:block;color:#aaa;margin-top:3px">`+
    `${candidates.length}명 생존`+
   `</span>`+
  `</div>`+
  `<button id="spectate-next" style="padding:8px 12px">›</button>`+
  `<button id="spectate-home" style="padding:8px 14px;margin-left:8px">로비로 나가기</button>`;

 overlay.querySelector<HTMLElement>('#spectate-prev')!.onclick=
  ()=>refreshSpectator(-1);

 overlay.querySelector<HTMLElement>('#spectate-next')!.onclick=
  ()=>refreshSpectator(1);

 overlay.querySelector<HTMLElement>('#spectate-home')!.onclick=
  ()=>leaveSpectatorToHome();
}

function refreshSpectator(step=0){
 if(!spectating||!snapshot)return;

 const candidates=spectatorCandidates();

 if(!candidates.length){
  if(!spectatorFinishing){
   spectatorFinishing=true;
   spectating=false;
   spectatorId=null;
   view.playerId=playerId;
   document.querySelector('#spectator-overlay')?.remove();

   void debrief(
    spectatorOutcome,
    spectatorLossReport
   );
  }

  return;
 }

 let index=candidates.findIndex(
  (p:Obj)=>p.id===spectatorId
 );

 if(index<0)index=0;
 else if(step)
  index=(index+step+candidates.length)%candidates.length;

 const target=candidates[index];

 spectatorId=target.id;

 /*
  SceneView는 playerId 기준으로 카메라를 잡으므로
  관전 중에만 camera owner를 팀원으로 변경.
 */
 view.playerId=target.id;
 view.pred.set(target.x,0,target.z);

 if(Number.isFinite(target.yaw)){
  view.aim.set(
   Math.sin(target.yaw),
   0,
   Math.cos(target.yaw)
  );
 }

 renderSpectatorOverlay();
}

function enterSpectator(
 outcome:string,
 lossReport?:Obj
){
 secureUI.close();
 containersUI.close();
 combatInput?.reset();

 firing=false;
 keys.clear();
 touchMove={x:0,z:0};

 view.moveX=0;
 view.moveZ=0;
 view.sprinting=false;
 view.resetScope();

 spectatorOutcome=outcome;
 spectatorLossReport=lossReport;
 spectatorFinishing=false;
 spectating=true;
 ignoreRaidTraffic=false;

 refreshSpectator(0);

 toast(
  '완전 사망했습니다. 살아있는 팀원을 관전합니다.',
  true
 );
}

function leaveSpectatorToHome(){
 spectating=false;
 spectatorId=null;
 spectatorFinishing=false;
 ignoreRaidTraffic=true;
 settled=false;

 document.querySelector('#spectator-overlay')?.remove();

 combatInput?.reset();
 firing=false;
 keys.clear();

 raid=false;
 raidLoading=false;
 raidLoadToken++;
 pendingRaidSnapshot=null;

 snapshot=null;
 tab='home';

 view.playerId=playerId;
 view.hideout();
 syncLobbyParty();
 refreshLobbyParty();

 $('#raid-loading').hidden=true;

 render();

 void api('/me')
  .then(d=>setProfile(d.profile))
  .then(()=>render())
  .catch(()=>{});
}

async function debrief(outcome:string,lossReport?:Obj){
 spectating=false;
 spectatorId=null;
 view.playerId=playerId;
 document.querySelector('#spectator-overlay')?.remove();
 secureUI.close();containersUI.close();combatInput?.reset();scopeHeld=false;scopeSignature='';view.resetScope();firing=false;keys.clear();view.moveX=view.moveZ=0;sound.ambience(false);
 const success=outcome==='extracted'||outcome==='extract',disconnected=outcome==='disconnected'||outcome==='disconnect';
 let d:Obj;try{d=await api('/me');setProfile(d.profile);}catch(e){routeError(e);return;}
 const p=me(),saved=profile?.lastSettlement;
 const report=lossReport??p?.lossReport??(saved?.raidId===snapshot?.raid?.id?saved.lossReport:undefined);
 const resultPlayer={...(p??{}),kills:p?.kills??kills,inventory:p?.inventory??sessionLoot};
 $('#interface').innerHTML=renderDebriefScreen(report,resultPlayer,success,{elapsedMs:snapshot?.raid.elapsedMs??0,disconnected,username:user?.username});
 bindDebriefReport($('#interface'));
 $('#return-home').onclick=()=>{
 ignoreRaidTraffic=true;
 spectating=false;
 spectatorId=null;
 settled=false;
 raid=false;
 raidLoading=false;
 raidLoadToken++;
 pendingRaidSnapshot=null;
 $('#raid-loading').hidden=true;
 snapshot=null;
 tab='home';
 view.playerId=playerId;
 view.hideout();
 syncLobbyParty();
 refreshLobbyParty();
 render();
};
}
function setupStick(el:HTMLElement,isAim:boolean){let origin={x:0,y:0};const knob=el.querySelector<HTMLElement>('i')!;function release(){knob.style.transform='translate(0,0)';if(isAim){firing=false;touchAim=false;}else touchMove={x:0,z:0};}el.onpointerdown=e=>{if(raidLoading||paused||secureUI.isOpen)return;el.setPointerCapture(e.pointerId);origin={x:e.clientX,y:e.clientY};sound.unlock();if(isAim){firing=true;touchAim=true;}};el.onpointermove=e=>{if(!el.hasPointerCapture(e.pointerId))return;let dx=e.clientX-origin.x,dz=e.clientY-origin.y;const len=Math.hypot(dx,dz);if(len>42){dx=dx/len*42;dz=dz/len*42;}knob.style.transform=`translate(${dx}px,${dz}px)`;if(isAim){if(len>8)view.directionAim(dx,dz);}else touchMove={x:dx/42,z:dz/42};};el.onpointerup=release;el.onpointercancel=release;el.onlostpointercapture=release;}
addEventListener('keydown',e=>{if(!raid||raidLoading||settled||(e.code!=='Escape'&&(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)))return;if(['KeyW','KeyA','KeyS','KeyD','Space','Tab'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='KeyI'){e.preventDefault();toggleSecure();return;}if(secureUI.isOpen){if(e.code==='Escape')secureUI.close();return;}keys.add(e.code);sound.unlock();if(e.code==='Escape'){if(me()?.reviving){net.send('cancel_revive');return;}if(containersUI.close(true))return;togglePause();return;}if(paused)return;if(e.code==='KeyE')interact();if(e.code==='KeyR')raidAction('reload');if(e.code==='KeyH')raidAction('heal');if(e.code==='KeyG')raidAction('throw');if(e.code==='KeyF')raidAction('flare');if(e.code==='KeyB')raidAction('underbarrel');const weaponSlot=weaponSlotForCode(e.code);if(weaponSlot)switchWeapon(weaponSlot);if(e.code==='KeyM')toggleMap();});
function releaseMovement(){combatInput?.reset();keys.clear();firing=false;scopeHeld=false;scopeSignature='';view.resetScope();touchMove={x:0,z:0};view.moveX=view.moveZ=0;view.sprinting=false;if(raid)net.send('input',{clientTime:performance.now(),moveX:0,moveZ:0,aimX:view.aim.x,aimZ:view.aim.z,sprint:false});}addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',releaseMovement);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseMovement();});combatInput=bindCombatInput($('#game-canvas'),window,{canStart:()=>!!(raid&&!raidLoading&&!paused&&!settled&&!secureUI.isOpen&&me()?.alive&&!me()?.downed&&!me()?.boarded),setScope:held=>updateScopeFromGear(held),setFire:held=>{if(held)firing=true;else if(!touchAim)firing=false;},aim:(x,y)=>view.pointerAim(x,y),unlock:()=>sound.unlock()});addEventListener('pointermove',e=>{if(!raid||raidLoading||touchAim||secureUI.isOpen||e.pointerType==='touch')return;view.pointerAim(e.clientX,e.clientY);const r=$('#reticle');r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';r.style.display=paused?'none':'block';});document.addEventListener('contextmenu',e=>{if(raid)e.preventDefault();});
sound.setMute(localStorage.getItem('bluecap-muted')==='true');render();void api('/me').then(d=>{user=d.user;setProfile(d.profile);net.connect();render();}).catch(()=>{status='은신처 대기';render();});
setInterval(sendPing,4000);setInterval(updatePing,1000);setInterval(()=>{if(spectating)refreshSpectator(0);},200);
let prior=performance.now(),nextFrameAt=0;function frame(now:number){const frameInterval=1000/240;if(now+.25<nextFrameAt){requestAnimationFrame(frame);return;}nextFrameAt=now>nextFrameAt+frameInterval?now+frameInterval:nextFrameAt+frameInterval;const started=performance.now(),frameElapsed=(now-prior)/1000;clientCPU.elapsedMs=frameElapsed*1000;clientCPU.elapsedMaxMs=Math.max(clientCPU.elapsedMaxMs,clientCPU.elapsedMs);const dt=Math.min(.05,frameElapsed);prior=now;if(raid){if(scopeHeld)updateScopeFromGear(true);view.refreshAim();}if(raid&&!raidLoading&&!paused&&!settled&&!secureUI.isOpen){view.moveX=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;view.moveZ=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)+touchMove.z;view.sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');if(now-lastInput>50){clientCPU.inputGapMs=now-lastInput;lastInput=now;net.send('input',{clientTime:now,moveX:view.moveX,moveZ:view.moveZ,aimX:view.aim.x,aimZ:view.aim.z,sprint:view.sprinting});}if(firing){const p=me(),w=item(p?.equipment?.[activeSlot]??p?.weaponId);const cooldown=clientShotIntervalMs(w,p?.ammoInMagazine,lastFire>0);if(now-lastFire>cooldown&&p?.alive&&!p.downed){lastFire=now;net.send('fire',{weaponSlot:activeSlot,aimX:view.aim.x,aimZ:view.aim.z});if((p.ammoInMagazine>0||w?.mode==='melee')&&!p.reloadEndsAt){view.shot(view.pred.x,view.pred.z,view.aim.x,view.aim.z,false,playerId);const parts=p.weaponAttachments?.[activeSlot]??p.attachments??{},ammoId=p.loadedAmmo?.[activeSlot]??w?.ammo;sound.gunshot({ammoId,weaponId:w?.id,suppressed:String(parts.barrel??'').startsWith('suppressor')});}if(w?.mode!=='auto')firing=false;}}}else{view.moveX=view.moveZ=0;if(raid&&!raidLoading&&now-lastInput>100){lastInput=now;net.send('input',{clientTime:now,moveX:0,moveZ:0,aimX:view.aim.x,aimZ:view.aim.z,sprint:false});}}view.update(dt,frameElapsed);if(raid&&!raidLoading&&!settled)worldLabels();if(raid&&!raidLoading&&!settled&&now-lastHud>100){lastHud=now;updateHUD();}clientCPU.frameMs=performance.now()-started;clientCPU.frameMaxMs=Math.max(clientCPU.frameMaxMs,clientCPU.frameMs);requestAnimationFrame(frame);}requestAnimationFrame(frame);
Object.defineProperty(window,'__THREE_GAME_DIAGNOSTICS__',{value:{get renderer(){const i=view.renderer.info;return {calls:i.render.calls,triangles:i.render.triangles,geometries:i.memory.geometries,textures:i.memory.textures};},get network(){return net.diagnostics;},get clientPerformance(){return {...clientCPU};},get state(){return{...view.diagnostics(),playerId,player:me(),snapshot,position:{x:view.pred.x,z:view.pred.z},camera:{position:view.camera.position.toArray(),quaternion:view.camera.quaternion.toArray(),left:view.camera.left,right:view.camera.right,top:view.camera.top,bottom:view.camera.bottom},ping,tab};}}});
