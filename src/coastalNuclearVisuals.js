import {Group as H,BufferGeometry as oo,PlaneGeometry as Zc,ShaderMaterial as ul,Mesh as U,MeshStandardMaterial as fl} from 'three';
import {BoxGeometry,SphereGeometry,CylinderGeometry} from 'three';
const put=(g,c,x,y,z,geo)=>{const m=new U(geo,new fl({color:c,roughness:.85}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
const q=(g,c,x,y,z,w,h,d)=>put(g,c,x,y,z,new BoxGeometry(w,h,d));
const gh=(g,c,x,y,z,w,h,d)=>{const m=put(g,c,x,y,z,new SphereGeometry(1,12,8));m.scale.set(w,h,d);return m;};
const _h=(g,c,x,y,z,r,h)=>put(g,c,x,y,z,new CylinderGeometry(r,r,h,20));
const mg=group=>group;
// Bundle-native Three.js district art; aliases supplied by the shipped renderer.
export function __bcCoastalVisuals129(world){
 const root=new H,solid=new H,steam=[],materials=[],roofs=[];const temp=new Zc(1,1),Attribute=temp.attributes.position.constructor;temp.dispose();root.name='coastal-nuclear-districts-129';
 const waterRows=(world.terrain??[]).filter(t=>/^(coast-sea-|nuclear-lake-)/.test(t.id));
 for(const sea of [true,false]){
  const rows=waterRows.filter(t=>t.id.startsWith(sea?'coast-sea-':'nuclear-lake-'));if(!rows.length)continue;
  const vertices=[];for(const r of rows){const l=r.x-r.w/2,h=r.x+r.w/2,a=r.z-r.d/2,b=r.z+r.d/2;vertices.push(l,.055,a,h,.055,a,h,.055,b,l,.055,a,h,.055,b,l,.055,b);}
  const geo=new oo;geo.setAttribute('position',new Attribute(vertices,3));geo.computeVertexNormals();
  const material=new ul({side:2,uniforms:{time:{value:0},sea:{value:sea?1:0}},vertexShader:`varying vec3 wp;void main(){wp=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;uniform float sea;varying vec3 wp;void main(){vec2 p=wp.xz;float wave=sin(p.x*.72+p.y*.37-time*1.4)*sin(p.y*1.31-time*.72);float fine=pow(max(0.,sin(p.x*3.+p.y*1.9-time*2.)),20.);float swell=sin(p.x*.13-p.y*.11-time*.36);vec3 base=mix(vec3(.12,.31,.34),vec3(.055,.24,.33),sea);vec3 color=base+wave*.024+swell*.021+vec3(.26,.36,.35)*fine*.19;gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});root.add(new U(geo,material));materials.push(material);
  for(let i=0;i<rows.length;i+=2){const r=rows[i],x=r.x+(sea?1:-1)*(r.w/2+.25);q(solid,sea?'#b7ac88':'#9bada0',x,.05,r.z,1.3,.13,4.1);}
 }
 // Continuous stone quay and timber/steel safety rail, matching server colliders exactly.
 for(const o of world.obstacles.filter(o=>o.kind==='shore-rail')){
  q(solid,'#8c9384',o.x,.18,o.z,o.w,.36,o.d);const along=o.w>o.d,span=along?o.w:o.d;
  for(const y of [.62,1.12])q(solid,'#756b53',o.x,y,o.z,along?span:.1,.11,along?.1:span);
  for(let p=-span/2;p<=span/2+.01;p+=2)q(solid,'#514e42',o.x+(along?p:0),.72,o.z+(along?0:p),.19,1.44,.19);
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
 // Salt-weathered timber cottages; each roof belongs to the existing fadeable roof group.
 for(const b of (world.buildings??[]).filter(b=>b.id.startsWith('fishing-building')||(b.x>120&&b.x<215&&b.z>90&&b.z<235))){
  const g=new H;g.userData.buildingId=b.id;g.name='fishing-pitched-roof';const h=b.wallHeight,w=b.w,d=b.d,farm=b.z>90&&b.x>120;
  for(const side of [-1,1]){const panel=q(g,farm?'#454e48':'#48636a',b.x+side*w*.25,h+.8,b.z,w*.55,.17,d+.45);panel.rotation.z=-side*Math.atan2(1.6,w/2);}
  q(g,'#c4b899',b.x,h+1.65,b.z,.15,.16,d+.5);
  for(let y=0;y<1.5;y+=.18)for(const side of [-1,1])q(g,farm?'#a94335':'#bdaf88',b.x,h+y,b.z+side*d/2,Math.max(.1,w*(1-y/1.6)),.19,.12);
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
 root.add(mg(solid));return{root,roofs,dispose(){for(const m of materials)m.dispose();for(const {puff} of steam)puff.material.dispose();},update(t){for(const m of materials)if(m.uniforms)m.uniforms.time.value=t;for(const {puff,o,k}of steam){const phase=(t*.13+k/9)%1;puff.position.set(o.x+phase*4+Math.sin(k+t*.2),o.h+1+phase*15,o.z+phase*1.5);puff.scale.set(2+phase*4,1.4+phase*2,2+phase*4);puff.material.opacity=.15*Math.sin(phase*Math.PI);}}};
}
