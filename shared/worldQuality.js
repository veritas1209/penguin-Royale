// Shared authoring pass: all added solid cover is visible on both peers.
const __bcQualityOverlaps=(a,b,g=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+g&&Math.abs(a.z-b.z)<(a.d+b.d)/2+g;
const __bcQualityPalette={
 camp:['#708d8b','#52747b','BASE'],armory:['#687369','#475a54','ARMORY'],
 support:['#8fa79a','#527c79','MEDICAL'],barracks:['#778a76','#536b61','BARRACKS'],
 market:['#a49676','#586956','MARKET'],coal:['#717b79','#485a60','LOGISTICS'],
 moon:['#899b9e','#596e83','MOON'],quiet:['#9aa88e','#637967','VILLAGE'],
 ruins:['#858c80','#616c66','OBSERVATORY']
};
export function improveWorldQuality(world,wallBuilder){
 const water=world.terrain.filter(t=>['river','reservoir'].includes(t.kind));
 const doorPoint=(b,distance=1.8)=>({x:b.x+(b.door.side==='east'?b.w/2+distance:b.door.side==='west'?-b.w/2-distance:0),z:b.z+(b.door.side==='south'?b.d/2+distance:b.door.side==='north'?-b.d/2-distance:0)});
 // A visible doorway must have a usable landing, including at relocated coastal structures.
 for(const b of world.buildings){
  const landingBlocked=()=>world.obstacles.some(o=>!o.id.startsWith(b.id+'-')&&__bcQualityOverlaps({...doorPoint(b),w:2.2,d:2.2},o,.25));
  if(landingBlocked())for(const side of ['north','south','east','west']){const old=b.door.side;b.door.side=side;if(!landingBlocked()){world.obstacles=world.obstacles.filter(o=>!o.id.startsWith(b.id+'-'));world.obstacles.push(...wallBuilder(b));break;}b.door.side=old;}
  const palette=__bcQualityPalette[b.id.split('-')[0]];
  if(palette&&b.wallColor!=='#a94335'){b.wallColor=palette[0];b.roof.color=palette[1];b.floor.markings=palette[2];for(const o of world.obstacles)if(o.id.startsWith(b.id+'-'))o.color=b.wallColor;}
 }
 const paths=[];
 // Short unpaved access spurs join the district buildings to the existing road network.
 // Reject crossings of water, buildings and authored solid objects, never paint fake passages.
 for(const target of [...world.buildings.map(b=>({...doorPoint(b,.85),id:b.id})),...world.extractions]){
  const roads=world.roads.map(r=>({x:Math.max(r.x-r.w/2,Math.min(r.x+r.w/2,target.x)),z:Math.max(r.z-r.d/2,Math.min(r.z+r.d/2,target.z))})).sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z));
  for(const road of roads.slice(0,5)){
   const length=Math.hypot(road.x-target.x,road.z-target.z);if(length<.6||length>48)continue;
   const samples=Array.from({length:Math.ceil(length*2)+1},()=>({x:0,z:0}));
   for(let i=0;i<samples.length;i++){const t=i/(samples.length-1);samples[i]={x:target.x+(road.x-target.x)*t,z:target.z+(road.z-target.z)*t,w:2.4,d:2.4};}
   if(samples.some(p=>water.some(w=>__bcQualityOverlaps(p,w,.3))||world.buildings.some(b=>__bcQualityOverlaps({...p,w:.9,d:.9},b,.15))||world.obstacles.some(o=>!o.id.startsWith(target.id+'-')&&!['tree','rock'].includes(o.kind)&&__bcQualityOverlaps(p,o,.2))))continue;
   world.obstacles=world.obstacles.filter(o=>!['tree','rock'].includes(o.kind)||!samples.some(p=>__bcQualityOverlaps(p,o,.7)));
   paths.push({id:'access-'+target.id,x0:target.x,z0:target.z,x1:road.x,z1:road.z,width:2.4});break;
  }
 }
 // Alternating shoulders create optional cover without blocking road travel or crossroad sightlines.
 let covers=0;
 for(const [ri,r]of world.roads.entries()){
  const vertical=r.d>r.w,length=vertical?r.d:r.w;
  for(let distance=-length/2+22;distance<length/2-12;distance+=31){
   const side=(Math.round((distance+length/2)/31)+ri)%2?1:-1;
   const o={id:`quality-route-cover-${ri}-${Math.round(distance)}`,kind:'rock',x:r.x+(vertical?side*(r.w/2+5.5):distance),z:r.z+(vertical?distance:side*(r.d/2+5.5)),w:3.8,d:2.8,h:1.7,rotation:0};
   if(world.roads.some(v=>__bcQualityOverlaps(o,v,3))||water.some(v=>__bcQualityOverlaps(o,v,3))||world.buildings.some(v=>__bcQualityOverlaps(o,v,4))||world.obstacles.some(v=>__bcQualityOverlaps(o,v,3))||world.extractions.some(e=>Math.hypot(e.x-o.x,e.z-o.z)<e.radius+6)||Math.hypot(world.spawn.x-o.x,world.spawn.z-o.z)<10||world.lootSpawns.some(l=>Math.hypot(l.x-o.x,l.z-o.z)<5)||world.enemySpawns.some(e=>Math.hypot(e.x-o.x,e.z-o.z)<5))continue;
   if(paths.some(p=>{const dx=p.x1-p.x0,dz=p.z1-p.z0,t=Math.max(0,Math.min(1,((o.x-p.x0)*dx+(o.z-p.z0)*dz)/(dx*dx+dz*dz)));return Math.hypot(o.x-p.x0-dx*t,o.z-p.z0-dz*t)<5;}))continue;
   world.obstacles.push(o);covers++;
  }
 }
 world.mapQuality={version:134,paths,coverCount:covers};
 return world;
}

