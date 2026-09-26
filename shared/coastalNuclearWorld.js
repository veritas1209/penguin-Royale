// Authored coastal districts. One set of volumes drives presentation and collision.
export function coastalNuclearWorld(world){
 const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
 world.terrain=world.terrain.filter(t=>!['fishing-ice','hydro-reservoir'].includes(t.id));
 const waters=[];
 for(let z=110;z<240;z+=2){const t=(z-110)/130,right=-222+57*t*t;waters.push({id:'coast-sea-'+z,kind:'reservoir',x:(-240+right)/2,z:z+1,w:right+240,d:2});}
 for(let z=-240;z<-110;z+=2){const t=(z+240)/130,left=192+26*t*t;waters.push({id:'nuclear-lake-'+z,kind:'reservoir',x:(left+240)/2,z:z+1,w:240-left,d:2});}
 world.terrain.push(...waters);
 world.obstacles=world.obstacles.filter(o=>!['tree','rock'].includes(o.kind)||!world.terrain.filter(t=>t.kind==='field').some(t=>overlap(o,t,3)));
 for(const o of world.obstacles)if(o.id==='farm-red-barn-122')o.kind='hut';
 const district=o=>/^(fishing|hydro)-/.test(o.id);
 const reserved=[{id:'nuclear-cooling-1',kind:'cooling-tower',x:140,z:-218,w:19,d:19,h:25,rotation:0},{id:'nuclear-cooling-2',kind:'cooling-tower',x:163,z:-222,w:19,d:19,h:25,rotation:0}];
 reserved.push(...[{x:-198,z:125},{x:-196,z:147},{x:-158,z:199}].map((p,i)=>({...p,id:'fishing-boat-station-'+i,kind:'fishing-prop',w:5,d:5,h:1.4,rotation:0})));
 const occupied=()=>[...world.obstacles,...world.roads,...waters,...reserved];
 // Relocate authored objects away from new shoreline/towers, carrying their outdoor caches.
 for(const o of world.obstacles){
  if(['tree','rock'].includes(o.kind))continue;
  if(![...waters,...reserved].some(t=>overlap(o,t,2)))continue;
  const ox=o.x,oz=o.z;let site;
  for(let r=4;r<180&&!site;r+=3)for(let k=0;k<48;k++){const a=k*Math.PI/24,c={...o,x:ox+Math.cos(a)*r,z:oz+Math.sin(a)*r};if(Math.abs(c.x)+c.w/2>236||Math.abs(c.z)+c.d/2>236)continue;if(occupied().some(b=>b!==o&&!['tree','rock'].includes(b.kind)&&overlap(c,b,3)))continue;site=c;break;}
  if(!site)throw Error('No clear coastal site '+o.id);o.x=site.x;o.z=site.z;
  for(const l of world.lootSpawns)if(Math.abs(l.x-ox)<o.w/2+1&&Math.abs(l.z-oz)<o.d/2+1){l.x+=o.x-ox;l.z+=o.z-oz;}
 }
 world.obstacles=world.obstacles.filter(o=>!['tree','rock'].includes(o.kind)||![...waters,...reserved,...world.obstacles.filter(district)].some(b=>b!==o&&overlap(o,b,3)));
 // Solid water volumes prevent entry even through teleports or the end of a quay.
 for(const t of waters)world.obstacles.push({...t,id:'water-block-'+t.id,kind:'water-blocker',h:1,rotation:0});
 for(const family of ['coast-sea-','nuclear-lake-']){
  const rows=waters.filter(t=>t.id.startsWith(family));const sea=family==='coast-sea-';
  let last;
  for(const t of rows){const x=t.x+(sea?1:-1)*(t.w/2+.65);world.obstacles.push({id:'shore-rail-'+t.id,kind:'shore-rail',x,z:t.z,w:1,d:2.3,h:1.25,rotation:0});if(last){world.obstacles.push({id:'shore-join-'+t.id,kind:'shore-rail',x:(x+last.x)/2,z:t.z-1,w:Math.abs(x-last.x)+1,d:1,h:1.25,rotation:0});}last={x};}
  const end=sea?rows[0]:rows.at(-1);world.obstacles.push({id:'shore-cap-'+family,kind:'shore-rail',x:end.x,z:end.z+(sea?-1:1)*1.3,w:end.w+1.3,d:1,h:1.25,rotation:0});
 }
 for(const tower of reserved){if([...world.obstacles,...world.roads,...waters].some(o=>overlap(tower,o,2)))throw Error('Cooling tower collision '+tower.id);world.obstacles.push(tower);}
 for(const o of world.obstacles.filter(district)){if(o.kind==='hut')o.color=['#c47957','#648c8f','#d0b584','#758975'][Number(o.id.split('-').at(-1))%4];if(o.id.startsWith('hydro-building'))o.color='#a0a69d';}
 for(const p of [...world.enemySpawns,...world.lootSpawns]){if(!waters.some(t=>overlap({...p,w:2,d:2},t,2)))continue;let found=false;for(let r=3;r<160&&!found;r+=3)for(let k=0;k<32;k++){const a=k*Math.PI/16,c={x:p.x+Math.cos(a)*r,z:p.z+Math.sin(a)*r,w:2,d:2};if(Math.abs(c.x)>235||Math.abs(c.z)>235||occupied().some(o=>overlap(c,o,2)))continue;p.x=c.x;p.z=c.z;found=true;break;}if(!found)throw Error('No dry coastal spawn '+p.id);}
 for(const o of world.obstacles)if(o.x>120&&o.x<215&&o.z>90&&o.z<235&&!['tree','rock','wood-fence','road-gate','sandbag'].includes(o.kind)&&/building|barn/.test(o.id))o.color='#a94335';
 const plant=world.landmarks.find(l=>l.id==='hydro');if(plant){plant.name='원자력 발전소';plant.kind='nuclear';}
 const fishing=world.landmarks.find(l=>l.id==='fishing');if(fishing)fishing.name='해안 어촌';
 return world;
}


export function styleCoastalBuildings(world){
 for(const b of world.buildings??[]){
  if(b.id.startsWith('hydro-')){b.name='원자력 발전소 시설';b.floor.markings='NUCLEAR';}
  if(b.id.startsWith('fishing-')){b.name='어촌 가옥';b.roof.color='#48636a';b.floor.markings='FISHERY';}
  if(b.x>120&&b.x<215&&b.z>90&&b.z<235){b.name='붉은 농장 창고';b.wallColor='#a94335';b.roof.color='#454e48';b.floor.color='#84724f';b.floor.markings='FARM';for(const o of world.obstacles)if(o.id.startsWith(b.id+'-'))o.color=b.wallColor;}
 }
}
