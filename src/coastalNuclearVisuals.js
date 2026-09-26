import {addWorldAccessPaths} from './worldQualityVisuals.js';
import {Group as H,BufferGeometry as oo,PlaneGeometry as Zc,ShaderMaterial as ul,Mesh as U,MeshStandardMaterial as fl} from 'three';
import {BoxGeometry,SphereGeometry,CylinderGeometry} from 'three';
const put=(g,c,x,y,z,geo)=>{const m=new U(geo,new fl({color:c,roughness:.85}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
const q=(g,c,x,y,z,w,h,d)=>put(g,c,x,y,z,new BoxGeometry(w,h,d));
const gh=(g,c,x,y,z,w,h,d)=>{const m=put(g,c,x,y,z,new SphereGeometry(1,12,8));m.scale.set(w,h,d);return m;};
const _h=(g,c,x,y,z,r,h)=>put(g,c,x,y,z,new CylinderGeometry(r,r,h,20));
const mg=group=>group;
// Bundle-native Three.js district art; aliases supplied by the shipped renderer.
export function __bcCoastalVisuals129(world){
 const root=new H,solid=new H,steam=[],materials=[],roofs=[];const temp=new Zc(1,1),Attribute=temp.attributes.position.constructor;temp.dispose();root.name='coastal-nuclear-districts-129';const outer=(world.size??480)/2+220;
 const edge=(sea,z)=>{const t=Math.max(0,Math.min(1,(z-(sea?100:-240))/140));return sea?-240+100*(1-Math.sqrt(1-t*t)):190+50*(1-Math.sqrt(1-t*t));};
 const shoreFade=(sea,z)=>{const t=Math.max(0,Math.min(1,sea?(z+20)/120:(20-z)/120));return t*t*(3-2*t);};
 const farEdge=(sea,z)=>{const e=edge(sea,z),fade=shoreFade(sea,z);return e+(sea?-1:1)*(outer-Math.abs(e))*fade;};
 const ribbon=(sea,near,far,y,color)=>{const v=[];for(let z=sea?-20:-outer;z<(sea?outer:20);z+=.5){const side=sea?1:-1,a=edge(sea,z),b=edge(sea,z+.5),fa=shoreFade(sea,z),fb=shoreFade(sea,z+.5);v.push(a+side*near*fa,y,z,b+side*near*fb,y,z+.5,b+side*far*fb,y,z+.5,a+side*near*fa,y,z,b+side*far*fb,y,z+.5,a+side*far*fa,y,z);}const geo=new oo;geo.setAttribute('position',new Attribute(v,3));geo.computeVertexNormals();const mat=new fl({color,roughness:1,side:2});root.add(new U(geo,mat));materials.push(mat);};
 for(const sea of [true,false]){
  const vertices=[];for(let z=sea?-20:-outer;z<(sea?outer:20);z+=.5){const a=edge(sea,z),b=edge(sea,z+.5),farA=farEdge(sea,z),farB=farEdge(sea,z+.5);vertices.push(farA,.12,z,a,.12,z,b,.12,z+.5,farA,.12,z,b,.12,z+.5,farB,.12,z+.5);}
  const geo=new oo;geo.setAttribute('position',new Attribute(vertices,3));geo.computeVertexNormals();
  const material=new ul({side:2,uniforms:{time:{value:0},sea:{value:sea?1:0}},vertexShader:`varying vec3 wp;void main(){wp=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;uniform float sea;varying vec3 wp;
float noise(vec2 p){return sin(p.x*.43+sin(p.y*.27))*cos(p.y*.36+sin(p.x*.21));}
void main(){vec2 p=wp.xz;float t=clamp((p.y-mix(-240.,100.,sea))/140.,0.,1.);float bend=1.-sqrt(max(0.,1.-t*t));float edge=mix(190.+50.*bend,-240.+100.*bend,sea);float distance=max(0.,(edge-p.x)*mix(-1.,1.,sea));float ripple=noise(p+vec2(time*.24,-time*.3))*.018+noise(p*.5+time*.08)*.028;vec3 deep=mix(vec3(.13,.30,.31),vec3(.06,.27,.35),sea);vec3 shallow=mix(vec3(.27,.43,.40),vec3(.27,.53,.53),sea);vec3 color=mix(shallow,deep,smoothstep(0.,14.,distance))+ripple;
float phase=distance*.92+sin(p.y*.23+time*.2)*.45+sin(p.y*.67)*.15+time*.95;float crest=pow(max(0.,cos(phase)),18.);float broken=smoothstep(-.5,.65,noise(p*.7+time*.08));float foam=crest*broken*(1.-smoothstep(1.,10.,distance))*sea;float lace=(1.-smoothstep(.1,.8,distance))* (.3+.2*sin(time+p.y*.3));color=mix(color,vec3(.78,.86,.77),clamp(foam*.62+lace,0.,.8));gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});root.add(new U(geo,material));materials.push(material);
  ribbon(sea,0,sea?2:1,.115,sea?'#aaa083':'#8e9b82');ribbon(sea,sea?2:1,sea?7:2.8,.10,sea?'#c1b38b':'#a0ac91');
  // The visible rails use the same endpoints as server collision, then disappear beyond the map edge.
  const railPiece=(x0,z0,x1,z1)=>{const dx=x1-x0,dz=z1-z0,span=Math.hypot(dx,dz);for(const y of [.62,1.1]){const beam=q(solid,sea?'#817253':'#758981',(x0+x1)/2,y,(z0+z1)/2,.09,.10,span+.06);beam.rotation.y=Math.atan2(dx,dz);}q(solid,sea?'#5d5e48':'#52675f',x0,.68,z0,.14,1.36,.14);};
  for(const rail of world.obstacles.filter(o=>o.id?.startsWith(sea?'coastal-rail-sea-':'coastal-rail-lake-')))railPiece(rail.x0,rail.z0,rail.x1,rail.z1);
  const farX=edge(sea,sea?240:-240)+(sea?8:-3.5);
  for(let z=sea?240:-outer;z<(sea?outer:-240);z+=3)railPiece(farX,z,farX,Math.min(z+3,sea?outer:-240));
  if(sea)for(let i=0;i<24;i++){const z=116+i*4.8,x=edge(true,z)-5-(i%4)*1.25;const rock=gh(solid,i%2?'#667a72':'#7f8a79',x,.17,z,.5+(i%3)*.22,.3+(i%4)*.12,.45+(i%2)*.25);rock.rotation.y=i*1.7;}
 }
 // Open-topped hyperboloid concrete shells with fluted sides and ring foundations.
 for(const o of world.obstacles.filter(o=>o.kind==='cooling-tower')){
  const vertices=[],segments=40,rings=22;
  const radius=y=>{const t=y/o.h;return 5.25+3.8*Math.pow((t-.7)/.7,2);};
  for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){const p=(jj,kk)=>{const y=jj/rings*o.h,a=kk/segments*Math.PI*2,r=radius(y);return[o.x+Math.cos(a)*r,y+.6,o.z+Math.sin(a)*r];};vertices.push(...p(j,k),...p(j+1,k),...p(j+1,k+1),...p(j,k),...p(j+1,k+1),...p(j,k+1));}
  const geo=new oo;geo.setAttribute('position',new Attribute(vertices,3));geo.computeVertexNormals();const shell=new U(geo,new fl({color:'#b5b5a2',roughness:.97,side:2}));shell.castShadow=true;shell.receiveShadow=true;root.add(shell);materials.push(shell.material);
  _h(solid,'#777f75',o.x,.25,o.z,9.3,.5);_h(solid,'#384c49',o.x,o.h+.48,o.z,radius(o.h)-.25,.15);
  for(let k=0;k<32;k++){const a=k*Math.PI/16;for(let j=0;j<10;j++){const y=(j+.5)*o.h/10,r=radius(y)+.03;q(solid,'#a5ab9b',o.x+Math.cos(a)*r,y+.6,o.z+Math.sin(a)*r,.075,o.h/10+.04,.075);}}
  for(let k=0;k<9;k++){const puff=gh(root,'#dce4dc',o.x,o.h+2+k*1.5,o.z,2.2+k*.3,1.4,2.2+k*.3);puff.material=puff.material.clone();puff.material.transparent=true;puff.material.opacity=.12;puff.material.depthWrite=false;puff.castShadow=false;steam.push({puff,o,k});}
 }
 // Industrial hardstand, overhead circulation pipes and security perimeter.
 q(solid,'#89968a',153,.065,-213,62,.08,49);
 for(const x of [139,142]){const pipe=_h(solid,'#6b8580',x,1.3,-208,.23,9);pipe.rotation.x=Math.PI/2;}
 for(const fence of world.obstacles.filter(o=>o.id?.startsWith('nuclear-fence-'))){const left=fence.x-fence.w/2,right=fence.x+fence.w/2,z=fence.z;for(let x=left;x<right;x+=3){const span=Math.min(3,right-x);q(solid,'#64796d',x,1.05,z,.10,2.1,.10);for(const y of [.7,1.8])q(solid,'#95a79b',x+span/2,y,z,span,.045,.045);for(let k=0;k<Math.ceil(span/.5);k++)q(solid,'#829489',x+k*.5,1.15,z,.025,1.5,.025);}q(solid,'#64796d',right,1.05,z,.10,2.1,.10);}

 for(const b of (world.buildings??[]).filter(b=>b.id.startsWith('hydro-'))){q(solid,'#8d988a',b.x,.05,b.z,b.w+2,.08,b.d+2);for(let i=0;i<4;i++)q(solid,'#c8b66e',b.x-b.w*.3+i*.7,.105,b.z+b.d/2+.5,.35,.015,.5);}
 // Containment dome, switchyard and water treatment building occupy server-reserved footprints.
 for(const o of world.obstacles.filter(o=>o.kind==='nuclear-equipment')){
  const g=new H;g.position.set(o.x,0,o.z);g.name=o.id;q(g,'#7d8982',0,.12,0,o.w,.24,o.d);
  if(o.id.includes('containment')){_h(g,'#b7bbae',0,4,0,5.6,8);gh(g,'#c7c8b7',0,8,0,5.6,4.1,5.6);_h(g,'#8e9b91',0,1,0,5.72,.6);q(g,'#61796f',0,2.2,5.62,3.3,4.2,.22);for(const x of [-3.6,3.6])q(g,'#e0bd63',x,1,5.7,.25,1.8,.2);}
  else if(o.id.includes('transformer')){for(const x of [-3.3,3.3]){q(g,'#40595c',x,1.4,0,3,2.6,5.5);for(let z=-2;z<=2;z+=.55)q(g,'#89958e',x,1.5,z,3.3,2.1,.12);for(const z of [-1.5,1.5]){_h(g,'#c5bca1',x,3.2,z,.24,1.2);for(let k=0;k<4;k++)_h(g,'#596968',x,2.85+k*.22,z,.36,.09);}}}
  else{q(g,'#8e9f96',0,1.6,0,5,3.2,8);q(g,'#566d68',0,3.3,0,5.4,.25,8.4);for(const z of [-2,2]){const pipe=_h(g,'#788c87',0,.7,z,.4,5.6);pipe.rotation.z=Math.PI/2;}}
  root.add(g);
 }
 for(const b of (world.buildings??[]).filter(b=>b.id.startsWith('hydro-'))){
  const g=new H;g.name='nuclear-turbine-roof';g.userData.buildingId=b.id;
  for(let x=-b.w/2+1;x<b.w/2;x+=2){q(g,'#acb4a9',b.x+x,b.wallHeight+.28,b.z,.65,.5,b.d*.7);}
  for(const x of [-b.w*.28,b.w*.28]){q(g,'#536b67',b.x+x,b.wallHeight+.8,b.z,1.4,1.5,2);}
  q(g,'#d8b851',b.x,b.wallHeight+.13,b.z+b.d*.35,b.w*.8,.16,.35);g.traverse(p=>p.userData.occluder=true);root.add(g);roofs.push({g,b});
 }
 // Salt-weathered timber cottages; each roof belongs to the existing fadeable roof group.
 for(const b of (world.buildings??[]).filter(b=>b.id.startsWith('fishing-building')||(b.x>120&&b.x<215&&b.z>90&&b.z<235))){
  const g=new H;g.userData.buildingId=b.id;g.name='fishing-pitched-roof';const h=b.wallHeight,w=b.w,d=b.d,farm=b.z>90&&b.x>120;
  for(const side of [-1,1]){const panel=q(g,farm?'#454e48':'#48636a',b.x+side*w*.25,h+.8,b.z,w*.55,.17,d+.45);panel.rotation.z=-side*Math.atan2(1.6,w/2);}
  q(g,'#c4b899',b.x,h+1.65,b.z,.15,.16,d+.5);
  for(let y=0;y<1.5;y+=.18)for(const side of [-1,1])q(g,farm?'#a94335':'#bdaf88',b.x,h+y,b.z+side*d/2,Math.max(.1,w*(1-y/1.6)),.19,.12);
  if(!farm){for(let j=-w*.45;j<w*.5;j+=.75)for(const side of [-1,1]){const seam=q(g,'#6e8b8b',b.x+side*w*.25,h+.9,b.z+j*d/w,w*.55,.06,.045);seam.rotation.z=-side*Math.atan2(1.6,w/2);}q(g,'#9b8870',b.x+w*.28,h+1.4,b.z-d*.25,.8,2,.8);q(g,'#48605c',b.x+w*.28,h+2.45,b.z-d*.25,1,.15,1);for(const side of [-1,1]){q(solid,'#d3c7a5',b.x+side*(w/2-.12),h*.5,b.z-d/2-.03,.17,h,.13);q(solid,'#d3c7a5',b.x+side*(w/2-.12),h*.5,b.z+d/2+.03,.17,h,.13);}for(const side of [-1,1]){const xx=b.x+side*w*.3;q(solid,'#31565c',xx,h*.58,b.z-d/2-.04,w*.17,.75,.05);q(solid,'#c5bd97',xx,h*.58,b.z-d/2-.09,.06,.85,.07);q(solid,'#c5bd97',xx,h*.58,b.z-d/2-.09,w*.18,.06,.07);}}
  g.traverse(part=>part.userData.occluder=true);roofs.push({g,b});root.add(g);
  if(farm){for(const [x,z] of [[-w*.27,-d*.25],[w*.27,d*.25]]){q(solid,'#ac934c',b.x+x,.42,b.z+z,1.5,.84,1.1);q(solid,'#786336',b.x+x,.43,b.z+z,.09,.86,1.13);for(let k=0;k<6;k++)q(solid,'#c3ac65',b.x+x-.65+k*.25,.86,b.z+z,.07,.07,1.07);}}
 }
 // Small dry land fishing stations, kept within individually reserved footprints.
 for(const o of world.obstacles.filter(o=>o.kind==='fishing-prop')){
  const g=new H;g.position.set(o.x,0,o.z);
  q(g,'#5c695e',0,.5,0,4,.5,1.4);for(const side of [-1,1]){const bow=q(g,'#b27550',side*1.6,.75,0,1.2,.3,1.5);bow.rotation.y=side*.35;}
  for(let x=-1.2;x<=1.2;x+=.6)q(g,'#bbaf86',x,.82,0,.2,.12,1.1);
  for(let x=-2;x<=2;x+=.4)for(let z=1;z<2;z+=.4)q(g,'#748477',x,1.3,z,.025,.6,.025);
  for(const x of [-2,2])q(g,'#705b40',x,.7,1.5,.13,1.4,.13);root.add(g);
 }
 addWorldAccessPaths(root,world,oo,Attribute,U,fl);root.add(mg(solid));return{root,roofs,dispose(){for(const m of materials)m.dispose();for(const {puff} of steam)puff.material.dispose();},update(t){for(const m of materials)if(m.uniforms)m.uniforms.time.value=t;for(const {puff,o,k}of steam){const phase=(t*.13+k/9)%1;puff.position.set(o.x+phase*4+Math.sin(k+t*.2),o.h+1+phase*15,o.z+phase*1.5);puff.scale.set(2+phase*4,1.4+phase*2,2+phase*4);puff.material.opacity=.15*Math.sin(phase*Math.PI);}}};
}
