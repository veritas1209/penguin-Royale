export function paintCoastalMap(ctx,world,x,z,scale,structures=false){
 ctx.save();
 if(!structures)for(const sea of [true,false]){
  const rows=(world.terrain??[]).filter(t=>t.id?.startsWith(sea?'coast-sea-':'nuclear-lake-'));if(!rows.length)continue;
  const edge=v=>{const t=Math.max(0,Math.min(1,(v-(sea?100:-240))/140));return sea?-240+100*(1-Math.sqrt(1-t*t)):190+50*(1-Math.sqrt(1-t*t));};
  const start=sea?100:-240,end=sea?240:-100,outer=sea?-240:240;
  ctx.beginPath();ctx.moveTo(x(outer),z(start));for(let p=start;p<=end;p+=.5)ctx.lineTo(x(edge(p)),z(p));ctx.lineTo(x(outer),z(end));ctx.closePath();ctx.fillStyle=sea?'#497e88':'#638c8c';ctx.fill();
  ctx.beginPath();for(let p=start;p<=end;p+=.5){const px=x(edge(p)),pz=z(p);p===start?ctx.moveTo(px,pz):ctx.lineTo(px,pz);}ctx.strokeStyle=sea?'#c2b58a':'#9ba98a';ctx.lineWidth=(sea?3:1.5)*scale;ctx.stroke();
 }else for(const o of world.obstacles??[]){
  if(o.kind==='cooling-tower'){const px=x(o.x),pz=z(o.z),r=Math.max(2.5,o.w*.5*scale);ctx.fillStyle='#cbd1ba';ctx.strokeStyle='#345b58';ctx.lineWidth=Math.max(1,scale);ctx.beginPath();ctx.arc(px,pz,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#466764';ctx.beginPath();ctx.arc(px,pz,r*.53,0,Math.PI*2);ctx.fill();}
  if(o.kind==='nuclear-equipment'){ctx.fillStyle='#a9b4a2';ctx.fillRect(x(o.x-o.w/2),z(o.z-o.d/2),o.w*scale,o.d*scale);}
 }
 ctx.restore();
}
