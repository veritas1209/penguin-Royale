from pathlib import Path
source = Path('dist/assets/index-river-126.js')
target = Path('dist/assets/index-party-127.js')
s = source.read_text(encoding='utf-8')
def change(old, new, count=1):
    global s
    found=s.count(old)
    if found != count:
        raise ValueError(f'Expected {count} occurrences, got {found}: {old[:100]!r}')
    s=s.replace(old,new)

change('hideout(){this.lobbyIdle.reset()', '''setLobbyParty(e,t,n){if(this.inRaid)return;this.lobbyParty??=new Map;let r=e.some(e=>e.id===t)?e:[{id:t}],i=new Set(r.filter(e=>e.id!==t).map(e=>e.id));for(let[e,t]of this.lobbyParty)if(!i.has(e)){this.actors.remove(t.root),this.lobbyParty.delete(e)}r.forEach((e,r)=>{let i=(r-(Math.max(1,e.length??0)-1)/2)*2.9,o=e.id===t?this.preview:this.lobbyParty.get(e.id);if(!o){o=Ch(),this.lobbyParty.set(e.id,o);let t=yh(o.root,String(e.username??`팀원`).slice(0,20),`#f2e8c8`,`#284646`,1.48,.34);t.position.set(0,2.68,.04)}o.root.position.set((r-(Math.max(1,arguments[0].length)-1)/2)*2.9,0,0),o.root.scale.setScalar(2.05),e.weaponId&&o.setWeapon(e.weaponId,n(e.weaponId),e.weaponAttachments??{})})}hideout(){this.lobbyIdle.reset()''')
# Correct the bundled lineup using the roster length, with no dependence on arguments inside the arrow.
change('let i=(r-(Math.max(1,e.length??0)-1)/2)*2.9,o=', 'let o=')
change('this.lobbyParty.delete(e)}r.forEach((e,r)=>', 'this.lobbyParty.delete(e)}let a=r.length;r.forEach((e,r)=>')
change('(r-(Math.max(1,arguments[0].length)-1)/2)*2.9', '(r-(a-1)/2)*2.9')
change('this.actorMap.clear(),this.actors.add(this.preview.root),this.preview.root.position.set(0,0,0)', 'this.actorMap.clear(),this.lobbyParty?.forEach(e=>this.actors.remove(e.root)),this.actors.add(this.preview.root),this.preview.root.position.set(0,0,0)')
change('!this.inRaid)this.lobbyIdle.update(this.preview,e);else if(this.snap)', '!this.inRaid){this.lobbyIdle.update(this.preview,e),this.lobbyParty?.forEach(t=>t.animate(this.elapsed,0,Math.PI*.1))}else if(this.snap)')
change('function V_(){', '''function __bcSyncLobbyParty127(){if($g?.mode===`coop`)S_=`coop`;if(!l_)Q.setLobbyParty($g?.mode===`coop`?$g.members??[]:[],t_,e=>Pg(Z(e)))}function __bcRefreshLobbyParty127(){void mt(`/rooms/current`).then(e=>{$g=e.room,__bcSyncLobbyParty127(),rv()}).catch(()=>{})}function V_(){''')
start=s.index('function U_(){')
end=s.index('function W_(){',start)
s=s[:start]+'''function U_(){let e=$g?.members??$g?.players??[],t=$g?.leaderId===t_,n=$g?.status===`raid`,r=e.some(e=>e.connected===!1);return`<div class="room-panel"><span class="eyebrow">INVITE CODE</span><button class="invite" data-action="copy-code">${X($g?.code??$g?.inviteCode??`SOLO`)} ⧉</button><div class="members">${e.map((e,t)=>`<span><i>${t+1}</i>${X(e.username??e.name)} <b>${e.connected===!1?`접속 대기`:e.id===$g?.leaderId?`방장`:`준비`}</b></span>`).join(``)}</div>${t?`<button class="primary" data-action="start-room" ${n||r?`disabled`:``}>${n?`팀원 원정 중`:`원정 시작`} <span>→</span></button>`:`<div class="room-waiting">${n?`팀원 원정 중`:`방장이 출발하면 함께 시작합니다`}</div>`}<button class="text-button" data-action="leave-room" ${n?`disabled`:``}>원정대 나가기</button></div>`}'''+s[end:]
change('$g=e.room,e.raid?(hv(', '$g=e.room,__bcSyncLobbyParty127(),e.raid?(hv(')
change('e.type===`room`&&($g=e.room,l_||rv())', 'e.type===`room`&&($g=e.room,__bcSyncLobbyParty127(),l_||rv())')
change('e_=null,P_=null,$g=null,Yg.close()', 'e_=null,P_=null,Yg.close()')
change('e===`create-room`&&z_(async()=>{$g=(await mt(`/rooms`,{mode:`coop`})).room,rv()})', 'e===`create-room`&&z_(async()=>{$g=(await mt(`/rooms`,{mode:`coop`})).room,__bcSyncLobbyParty127(),rv()})')
change('e===`join`&&z_(async()=>{$g=(await mt(`/rooms/join`,{code:Y(`#invite-code`).value.toUpperCase()})).room,rv()})', 'e===`join`&&z_(async()=>{$g=(await mt(`/rooms/join`,{code:Y(`#invite-code`).value.toUpperCase()})).room,__bcSyncLobbyParty127(),rv()})')
change('e===`leave-room`&&z_(async()=>{await mt(`/rooms/leave`,{}),$g=null,rv()})', 'e===`leave-room`&&z_(async()=>{await mt(`/rooms/leave`,{}),$g=null,__bcSyncLobbyParty127(),rv()})')
change('Y(`#raid-loading`).hidden=!0,$g=null,e_=null,n_=`home`,Q.hideout(),rv()', 'Y(`#raid-loading`).hidden=!0,e_=null,n_=`home`,Q.hideout(),__bcSyncLobbyParty127(),__bcRefreshLobbyParty127(),rv()')
change(' e_=null;\n $g=null;\n n_=`home`;\n', ' e_=null;\n n_=`home`;\n')
change(' Q.hideout();\n\n let e=document.querySelector(`#raid-loading`);', ' Q.hideout();\n __bcSyncLobbyParty127();\n __bcRefreshLobbyParty127();\n\n let e=document.querySelector(`#raid-loading`);')
# Clear lobby models on logout as well as the current room.
change('Qg=null,$g=null,rv()', 'Qg=null,$g=null,__bcSyncLobbyParty127(),rv()')
target.write_text(s,encoding='utf-8')
p=Path('dist/index.html');h=p.read_text(encoding='utf-8')
assert h.count('index-river-126.js')+h.count('index-party-127.js')==1
p.write_text(h.replace('index-river-126.js','index-party-127.js'),encoding='utf-8')
print('patched',target,len(s))
