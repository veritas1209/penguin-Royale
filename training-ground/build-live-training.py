from pathlib import Path
import shutil
import base64
root=Path(__file__).resolve().parent
repo=root.parent
assets=repo/'dist'/'assets'
assets.mkdir(parents=True,exist_ok=True)
graphics=(root/'training-graphics-runtime.js').read_text(encoding='utf8').replace(' \t','\t')
graphics='\n'.join(line.rstrip(' \t') for line in graphics.splitlines()).rstrip('\n')+'\n'
(assets/'training-graphics-runtime.js').write_text(graphics,encoding='utf8')
shutil.copy2(root/'training-entry.js',assets/'training-entry.js')
import runpy
runpy.run_path(str(root/'generate-training-map.py'))
controller=(root/'training-controller.js').read_text(encoding='utf8')
for marker,filename in {
 '__DASH_SOUND_DATA__':'araya-issen.m4a',
 '__LIGHTNING_SOUND_DATA__':'thunderclap-lightning.mp3',
 '__MAGIC_SOUND_DATA__':'skill-magic.mp3',
 '__ARBITER_SOUND_DATA__':'arbiter-ice.m4a',
}.items():
 assert controller.count(marker)==1
 mime='audio/mp4' if filename.endswith('.m4a') else 'audio/mpeg'
 controller=controller.replace(marker,'data:'+mime+';base64,'+base64.b64encode((root/filename).read_bytes()).decode('ascii'))
(assets/'training-controller-live.js').write_text(controller,encoding='utf8')
shell=(root/'training-shell.html').read_text(encoding='utf8')
shell=shell.replace('BLUECAP / OFFLINE COMBAT RANGE','BLUECAP / COMBAT TRAINING')
shell=shell.replace('<aside class="panel">','<aside class="panel"><div id="live-controls"><h2>훈련 설정</h2></div>')
shell=shell.replace('</header>','<a class="live-return" href="/games/penguin-extraction/">← 은신처 돌아가기</a></header>',1)
shell=shell.replace('</style>', '''
.panel>.section,.panel>.note{display:none!important}.panel{height:auto!important;bottom:auto!important;max-height:none!important}
#live-controls{display:grid;gap:15px}#live-controls h2{margin:0;font-size:18px;color:#ffdc91}
#live-controls .row{display:grid;gap:8px}#live-controls select,#live-controls button{width:100%;padding:11px;background:#253f42;color:#f2e9cf;border:1px solid #739088;border-radius:4px;font-size:14px}
#live-controls button{cursor:pointer;background:#d5a954;color:#1d3534;font-weight:bold}
.live-return{display:block;margin-top:14px;color:#eacb7b;text-decoration:none;font-size:12px}
</style>''')
bootstrap='''<script>window.__peAudio={gunshot:()=>{}};</script>
<script src="assets/weapon-audio-30.js"></script><script src="assets/weapon-audio-map-28.js"></script>
<script src="assets/training-graphics-runtime.js"></script>
<script>
(async()=>{
 try{
  const base='/games/penguin-extraction';
  const [meResponse,catalogResponse]=await Promise.all([fetch(base+'/api/me',{credentials:'same-origin'}),fetch(base+'/api/catalog',{credentials:'same-origin'})]);
  if(meResponse.status===401){location.replace(base+'/');return;}
  if(!meResponse.ok||!catalogResponse.ok)throw new Error('계정의 장착 장비를 불러오지 못했습니다.');
  const me=await meResponse.json(),catalog=await catalogResponse.json(),items=new Map(catalog.items.map(i=>[i.id,i]));
  const profiles=me.profile?.equipped||{},slots=['primary','secondary','pistol','melee'];
  const families={AR:'rifle',SMG:'smg',DMR:'dmr',SR:'sniper',SG:'shotgun',LMG:'lmg',PISTOL:'pistol',HG:'pistol',CROSSBOW:'crossbow'};
  const weapons=slots.map(slot=>{
   const id=profiles[slot],def=items.get(id);if(!def||def.category!=='weapon')return null;
   const attachments=me.profile?.weaponAttachments?.[slot]||{};
   return {id:def.id,name:def.name,damage:Number(def.damage)||8,fireRate:Number(def.fireRate)||1.5,
    range:Number(def.range)||5,color:def.mode==='melee'?'#edc65a':'#f9d795',mode:def.mode||'semi',
    modelFamily:def.mode==='melee'?'melee':families[def.family]||String(def.family||'pistol').toLowerCase(),
    attachments,suppressed:/suppress|silenc|소음/i.test(String(attachments.barrel||'')),
    skill:'',skillText:'',cooldown:0};
  }).filter(Boolean);
  if(!weapons.length)throw new Error('은신처에서 무기를 먼저 장착해 주세요.');
  window.__LIVE_TRAINING__={weapons,username:me.user?.username||''};
  const controls=document.getElementById('live-controls');
  controls.append(document.getElementById('ai-mode').closest('label'),document.getElementById('reset'));
  const script=document.createElement('script');script.src='assets/training-controller-live.js';document.body.append(script);
 }catch(error){const status=document.getElementById('status');status.textContent=String(error.message||error);status.classList.add('error');}
})();
</script>'''
assert shell.count('<!-- GAME_SCRIPT -->')==1
(repo/'dist'/'training.html').write_text(shell.replace('<!-- GAME_SCRIPT -->',bootstrap),encoding='utf8')
print('built live training assets')
