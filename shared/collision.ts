import type { BuildingDoorSide, WorldBuilding, WorldObstacle } from './world.ts';

type Side=BuildingDoorSide;

/** Compound 2D movement perimeter. Window spans still block movement but are skipped by ballistic rays. */
export function buildingWallObstacles(building:WorldBuilding):WorldObstacle[]{
 const {x,z,w,d,wallThickness:t,wallHeight:h,door}=building,walls:WorldObstacle[]=[];
 const windowSides=new Set((['north','east','south','west'] as Side[]).filter(side=>side!==door.side).slice(0,2));
 const add=(id:string,x:number,z:number,w:number,d:number,window=false)=>walls.push({id:`${building.id}-${window?'window':'wall'}-${id}`,x,z,w,d,h,kind:window?'interior-window':'interior-wall',rotation:0,color:building.wallColor,bulletPassable:window||undefined});
 const horizontal=(side:Side,cz:number)=>{
  if(side===door.side){const a=(w-door.width)/2+door.offset,c=(w-door.width)/2-door.offset;add(`${side}-left`,x-w/2+a/2,cz,a,t);add(`${side}-right`,x+w/2-c/2,cz,c,t);return;}
  if(!windowSides.has(side)){add(side,x,cz,w,t);return;}
  const windowWidth=Math.min(1.6,w-2.6),pier=(w-windowWidth)/2;add(`${side}-left`,x-w/2+pier/2,cz,pier,t);add(side,x,cz,windowWidth,t,true);add(`${side}-right`,x+w/2-pier/2,cz,pier,t);
 };
 const vertical=(side:Side,cx:number)=>{
  if(side===door.side){const a=(d-door.width)/2+door.offset,c=(d-door.width)/2-door.offset;add(`${side}-top`,cx,z-d/2+a/2,t,a);add(`${side}-bottom`,cx,z+d/2-c/2,t,c);return;}
  if(!windowSides.has(side)){add(side,cx,z,t,d);return;}
  const windowWidth=Math.min(1.6,d-2.6),pier=(d-windowWidth)/2;add(`${side}-top`,cx,z-d/2+pier/2,t,pier);add(side,cx,z, t,windowWidth,true);add(`${side}-bottom`,cx,z+d/2-pier/2,t,pier);
 };
 horizontal('north',z-d/2);horizontal('south',z+d/2);vertical('west',x-w/2);vertical('east',x+w/2);
 return walls.filter(o=>o.w>.05&&o.d>.05);
}
