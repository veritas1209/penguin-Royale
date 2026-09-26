// Authored coastal districts. One set of volumes drives presentation and collision.
export function coastalNuclearWorld(world){
 const overlap=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
 world.terrain=world.terrain.filter(t=>!['fishing-ice','hydro-reservoir'].includes(t.id));
 const shoreEdge=(sea,z)=>{const t=Math.max(0,Math.min(1,(z-(sea?100:-240))/140));return sea?-240+100*(1-Math.sqrt(1-t*t)):190+50*(1-Math.sqrt(1-t*t));};
 const waters=[];
 for(let z=100;z<240;z+=.5){const t=(z+.5-100)/140,right=-240+100*(1-Math.sqrt(Math.max(0,1-t*t)));waters.push({id:'coast-sea-'+z,kind:'reservoir',x:(-240+right)/2,z:z+.25,w:Math.max(.001,right+240),d:.5});}
 for(let z=-240;z<-100;z+=.5){const t=(z+240)/140,left=190+50*(1-Math.sqrt(Math.max(0,1-t*t)));waters.push({id:'nuclear-lake-'+z,kind:'reservoir',x:(left+240)/2,z:z+.25,w:Math.max(.001,240-left),d:.5});}
 world.terrain.push(...waters);
 world.obstacles=world.obstacles.filter(o=>!['tree','rock'].includes(o.kind)||!world.terrain.filter(t=>t.kind==='field').some(t=>overlap(o,t,3)));
 for(const o of world.obstacles)if(o.id==='farm-red-barn-122')o.kind='hut';
 const district=o=>/^(fishing|hydro)-/.test(o.id);
 const reserved=[{id:'nuclear-cooling-1',kind:'cooling-tower',x:140,z:-218,w:19,d:19,h:25,rotation:0},{id:'nuclear-cooling-2',kind:'cooling-tower',x:163,z:-222,w:19,d:19,h:25,rotation:0}];
 reserved.push(...[
 {id:'nuclear-reactor-containment',kind:'nuclear-equipment',x:140,z:-198,w:13,d:13,h:13,rotation:0},
 {id:'nuclear-transformer-yard',kind:'nuclear-equipment',x:165,z:-198,w:12,d:10,h:4,rotation:0},
 {id:'nuclear-pump-station',kind:'nuclear-equipment',x:178,z:-219,w:6,d:10,h:4,rotation:0}
 ]);
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
 // Rail hitboxes follow the same half-metre shoreline curve as the visible beams.
 const shoreRails=[];
 for(const sea of [true,false]){
  const start=sea?100:-240,end=sea?240:-100,offset=sea?8:-3.5;
  for(let z=start;z<end;){
   const step=Math.min(end-z,end-z<=16?.5:2);
   const x0=shoreEdge(sea,z)+offset,x1=shoreEdge(sea,z+step)+offset;
   shoreRails.push({id:`coastal-rail-${sea?'sea':'lake'}-${z}`,kind:'shore-rail',x:(x0+x1)/2,z:z+step/2,w:Math.abs(x1-x0)+.22,d:step+.12,h:1.35,rotation:0,x0,x1,z0:z,z1:z+step});
   z+=step;
  }
 }
 // Keep the plant fence on land and stop it at the road edge; the central gap is its entrance.
 const plantRails=[
  {id:'nuclear-fence-north-west',from:133.5,to:146,z:-187},
  {id:'nuclear-fence-north-east',from:160,to:175.8,z:-187},
  {id:'nuclear-fence-south',from:123,to:183,z:-234}
 ].map(({id,from,to,z})=>({id,kind:'shore-rail',x:(from+to)/2,z,w:to-from,d:.3,h:2.1,rotation:0}));
 world.obstacles=world.obstacles.filter(o=>o.id!=='road-end-gate-4-minus'&&(!['tree','rock'].includes(o.kind)||![...shoreRails,...plantRails].some(r=>overlap(o,r,1))));
 world.obstacles.push(...shoreRails,...plantRails);
 // Solid water volumes prevent entry even through teleports or the end of a quay.
 for(const t of waters)world.obstacles.push({...t,id:'water-block-'+t.id,kind:'water-blocker',h:1,rotation:0});
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
