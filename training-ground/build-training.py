from pathlib import Path
import base64
root=Path(__file__).resolve().parent
graphics=(root/'training-graphics-runtime.js').read_text(encoding='utf8')
controller=(root/'training-controller.js').read_text(encoding='utf8')
for marker,filename,mime in [
    ('__DASH_SOUND_DATA__','araya-issen.m4a','audio/mp4'),
    ('__LIGHTNING_SOUND_DATA__','thunderclap-lightning.mp3','audio/mpeg'),
    ('__MAGIC_SOUND_DATA__','skill-magic.mp3','audio/mpeg'),
    ('__ARBITER_SOUND_DATA__','arbiter-ice.m4a','audio/mp4'),
]:
    if controller.count(marker)!=1: raise SystemExit('Missing sound placeholder: '+marker)
    sound='data:'+mime+';base64,'+base64.b64encode((root/filename).read_bytes()).decode('ascii')
    controller=controller.replace(marker,sound)
shell=(root/'training-shell.html').read_text(encoding='utf8')
if shell.count('<!-- GAME_SCRIPT -->')!=1: raise SystemExit('Missing shell insertion point')
combined=(graphics+controller).replace('</script','<\\/script')
out=root/'training-ground.html'
out.write_text(shell.replace('<!-- GAME_SCRIPT -->','<script>'+combined+'</script>'),encoding='utf8')
print('Built',out,'from','training-graphics-runtime.js','bytes',out.stat().st_size)
