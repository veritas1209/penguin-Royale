from pathlib import Path
s=Path('dist/assets/index-terrain-squad-133.js').read_text(encoding='utf8')
world=Path('shared/worldQuality.js').read_text(encoding='utf-8-sig').replace('export function','function')
visual=Path('src/worldQualityVisuals.js').read_text(encoding='utf-8-sig').replace('export function','function')
marker='// Bundle-native Three.js district art; aliases supplied by the shipped renderer.'
assert s.count(marker)==1
start=s.find('// Shared authoring pass:')
if start>=0:s=s[:start]+s[s.index(marker,start):]
s=s.replace(marker,world+'\n'+visual+'\n'+marker)
start=s.index('function og(')
if 'for(let e=0;e<130;e++)' in s[start:]:
 begin=s.index('for(let e=0;e<130;e++)',start);end=s.index('let c=t=>',begin)
 s=s[:begin]+'paintNaturalGround(i,e,r.width,o);'+s[end:]
needle='root.add(mg(solid));return'
assert s.count(needle)==1
if 'addWorldAccessPaths(root,world,oo,Attribute,U,fl);' not in s:s=s.replace(needle,'addWorldAccessPaths(root,world,oo,Attribute,U,fl);'+needle)
needle='if(__bcHydroInteriorCache118)__bcHydroInteriorCache118.buildingId=`hydro-building-2`;'
assert s.count(needle)==1
if 'improveWorldQuality(Cg,Gh);' not in s:s=s.replace(needle,needle+'improveWorldQuality(Cg,Gh);')
Path('dist/assets/index-terrain-squad-133.js').write_text(s,encoding='utf8')

