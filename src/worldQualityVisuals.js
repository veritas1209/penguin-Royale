// Ground-only detail is batched into one transparent mesh; no additional collision or update work.
export function addWorldAccessPaths(root,world,BufferGeometry,Attribute,Mesh,Material){
 const positions=[],colors=[];
 for(const p of world.mapQuality?.paths??[]){
  const dx=p.x1-p.x0,dz=p.z1-p.z0,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const offsets=[-p.width*.8,-p.width*.38,p.width*.38,p.width*.8],alpha=[0,.45,.45,0];
  const point=(end,j)=>[(end?p.x1:p.x0)+nx*offsets[j],.065,(end?p.z1:p.z0)+nz*offsets[j]];
  for(let j=0;j<3;j++)for(const [end,k]of [[0,j],[1,j],[1,j+1],[0,j],[1,j+1],[0,j+1]]){positions.push(...point(end,k));colors.push(.54,.51,.40,alpha[k]);}
 }
 if(!positions.length)return;
 const geo=new BufferGeometry;geo.setAttribute('position',new Attribute(positions,3));geo.setAttribute('color',new Attribute(colors,4));geo.computeVertexNormals();
 const material=new Material({vertexColors:true,transparent:true,depthWrite:false,roughness:1,side:2});
 const mesh=new Mesh(geo,material);mesh.name='district-access-paths-134';mesh.receiveShadow=true;root.add(mesh);
}

// Soft, overlapping patches retain the north-to-south climate gradient without polygon cut lines.
export function paintNaturalGround(ctx,world,pixels,random){
 for(let k=0;k<210;k++){
  const x=random()*pixels,z=random()*pixels,radius=24+random()*150;
  const gradient=ctx.createRadialGradient(x,z,0,x,z,radius);
  gradient.addColorStop(0,k%3===0?'rgba(74,94,74,.16)':'rgba(232,237,218,.22)');
  gradient.addColorStop(.48,k%3===0?'rgba(74,94,74,.08)':'rgba(232,237,218,.1)');
  gradient.addColorStop(1,'rgba(180,197,172,0)');
  ctx.save();ctx.translate(x,z);ctx.scale(1,.68);ctx.translate(-x,-z);ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,z,radius,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 const scale=pixels/world.size,coord=n=>(n+world.size/2)*scale;
 for(const landmark of world.landmarks){
  if(landmark.kind==='silo-sector'||landmark.kind==='silo')continue;
  const industrial=['nuclear','armory','industrial'].includes(landmark.kind),x=coord(landmark.x),z=coord(landmark.z),radius=44*scale;
  const gradient=ctx.createRadialGradient(x,z,5*scale,x,z,radius);
  gradient.addColorStop(0,industrial?'rgba(108,121,112,.22)':'rgba(148,155,113,.15)');gradient.addColorStop(1,'rgba(148,155,113,0)');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,z,radius,0,Math.PI*2);ctx.fill();
 }
}
