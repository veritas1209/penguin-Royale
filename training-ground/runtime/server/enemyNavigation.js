// Server-only bounded navigation. Static world queries are cached; tactical decisions remain per enemy.
import {consumeEnemySprint,enemyMovementSpeed} from './enemyStamina.js';
const RADIUS=.46,FINE_CELL=.75,BUCKET=4;
export const NAVIGATION_POLICY=Object.freeze({routeTtlMs:6000,targetReplanDistance:8,retryMs:1200,failedRetryMs:2400,maxNodes:360,midCell:1.5,coarseCell:3});
const indices=new WeakMap(),routes=new WeakMap();
function hash(value){let result=0;for(const char of String(value??''))result=(Math.imul(result,31)+char.charCodeAt(0))>>>0;return result;}
function indexFor(world){
 let index=indices.get(world);
 if(index?.source===world.obstacles)return index;
 index={source:world.obstacles,buckets:new Map(),querySerial:0};
 let id=0;
 for(const o of world.obstacles??[]){
  const box={id:id++,minX:o.x-(o.w??o.width??1)/2-RADIUS,maxX:o.x+(o.w??o.width??1)/2+RADIUS,minZ:o.z-(o.d??o.depth??1)/2-RADIUS,maxZ:o.z+(o.d??o.depth??1)/2+RADIUS,seenAt:0};
  for(let x=Math.floor(box.minX/BUCKET);x<=Math.floor(box.maxX/BUCKET);x++)for(let z=Math.floor(box.minZ/BUCKET);z<=Math.floor(box.maxZ/BUCKET);z++){
   const key=x+','+z;let bucket=index.buckets.get(key);if(!bucket)index.buckets.set(key,bucket=[]);bucket.push(box);
  }
 }
 indices.set(world,index);return index;
}
function queryToken(index){index.querySerial=(index.querySerial+1)%Number.MAX_SAFE_INTEGER||1;return index.querySerial;}
function nearbyBoxes(index,point){
 const boxes=[],token=queryToken(index),bx=Math.floor(point.x/BUCKET),bz=Math.floor(point.z/BUCKET);
 for(let x=bx-1;x<=bx+1;x++)for(let z=bz-1;z<=bz+1;z++)for(const box of index.buckets.get(x+','+z)??[]){
  if(box.seenAt===token)continue;box.seenAt=token;boxes.push(box);
 }
 return boxes;
}
export function movementSegmentClear(world,a,b){
 const half=world.size/2;
 if(Math.abs(a.x)>half||Math.abs(a.z)>half||Math.abs(b.x)>half||Math.abs(b.z)>half)return false;
 const index=indexFor(world),dx=b.x-a.x,dz=b.z-a.z,token=queryToken(index);
 for(let x=Math.floor(Math.min(a.x,b.x)/BUCKET);x<=Math.floor(Math.max(a.x,b.x)/BUCKET);x++)for(let z=Math.floor(Math.min(a.z,b.z)/BUCKET);z<=Math.floor(Math.max(a.z,b.z)/BUCKET);z++){
  for(const box of index.buckets.get(x+','+z)??[]){
   if(box.seenAt===token)continue;box.seenAt=token;let near=0,far=1;
   for(const [p,d,lo,hi]of [[a.x,dx,box.minX,box.maxX],[a.z,dz,box.minZ,box.maxZ]]){
    if(Math.abs(d)<1e-9){if(p<lo||p>hi){near=2;break;}continue;}
    const t1=(lo-p)/d,t2=(hi-p)/d;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
   }
   if(near<=far)return false;
  }
 }
 return true;
}
class Heap{
 data=[];
 push(n){let i=this.data.length;this.data.push(n);while(i){const p=(i-1)>>1;if(this.data[p].f<=n.f)break;this.data[i]=this.data[p];i=p;}this.data[i]=n;}
 pop(){const top=this.data[0],end=this.data.pop();if(this.data.length){let i=0;while(i*2+1<this.data.length){let c=i*2+1;if(c+1<this.data.length&&this.data[c+1].f<this.data[c].f)c++;if(this.data[c].f>=end.f)break;this.data[i]=this.data[c];i=c;}this.data[i]=end;}return top;}
}
const nodeKey=(x,z)=>((x+32768)&65535)*65536+((z+32768)&65535);
function finish(meta,reason,expanded){if(meta){meta.reason=reason;meta.expanded=expanded;}return reason;}
/** Returns only a fully connected route; never a partial route through a wall. */
export function findEnemyPath(world,start,goal,{maxNodes=NAVIGATION_POLICY.maxNodes,margin=12,deadlineNs=null,meta=null}={}){
 const direct=movementSegmentClear(world,start,goal);
 // Cover belongs to tactical goal selection. Clear locomotion never needs a global search.
 if(direct){finish(meta,'direct',0);return [{x:goal.x,z:goal.z}];}
 const distanceToGoal=Math.hypot(goal.x-start.x,goal.z-start.z),cell=distanceToGoal>48?NAVIGATION_POLICY.coarseCell:distanceToGoal>24?NAVIGATION_POLICY.midCell:FINE_CELL;
 const searchMargin=Math.max(margin,cell*5),index=indexFor(world),minX=Math.min(start.x,goal.x)-searchMargin,maxX=Math.max(start.x,goal.x)+searchMargin,minZ=Math.min(start.z,goal.z)-searchMargin,maxZ=Math.max(start.z,goal.z)+searchMargin;
 const heuristicScale=1,heap=new Heap(),best=new Map(),root={x:start.x,z:start.z,ix:0,iz:0,g:0,f:distanceToGoal,parent:null};
 heap.push(root);best.set(nodeKey(0,0),0);let expanded=0,deadlineReached=false;if(meta)meta.cell=cell;
 while(heap.data.length&&expanded<maxNodes){
  if(deadlineNs&&expanded%16===0&&process.hrtime.bigint()>=deadlineNs){deadlineReached=true;break;}
  const n=heap.pop();if(n.g!==best.get(nodeKey(n.ix,n.iz)))continue;expanded++;
  if(Math.hypot(n.x-goal.x,n.z-goal.z)<cell*1.5&&movementSegmentClear(world,n,goal)){
   const path=[{x:goal.x,z:goal.z}];for(let p=n;p.parent;p=p.parent)path.push({x:p.x,z:p.z});finish(meta,'complete',expanded);return path.reverse();
  }
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   if(!dx&&!dz)continue;
   const ix=n.ix+dx,iz=n.iz+dz,x=start.x+ix*cell,z=start.z+iz*cell,key=nodeKey(ix,iz);
   if(x<minX||x>maxX||z<minZ||z>maxZ||!movementSegmentClear(world,n,{x,z}))continue;
   const step=cell*Math.hypot(dx,dz),g=n.g+step;
   if(g>=(best.get(key)??Infinity))continue;
   best.set(key,g);heap.push({x,z,ix,iz,g,f:g+Math.hypot(goal.x-x,goal.z-z)*heuristicScale,parent:n});
  }
 }
 finish(meta,deadlineReached?'deadline':expanded>=maxNodes?'node-limit':'no-path',expanded);return [];
}
export function advanceEnemyNavigation(world,enemy,target,dt,now,budget,{speedMultiplier=1,speedOverride=null,replanDistance=NAVIGATION_POLICY.targetReplanDistance}={}){
 const requestedSpeed=speedOverride??enemy.speed*speedMultiplier,speed=enemyMovementSpeed(enemy,requestedSpeed),sprinting=speed>enemy.speed+1e-6,travel=Math.max(0,Math.min(dt,.25))*speed;if(!travel)return;
 budget??={remaining:0};
 let route=routes.get(enemy),direct=movementSegmentClear(world,enemy,target);
 if(direct){routes.delete(enemy);route={points:[target]};budget.directs=(budget.directs??0)+1;}
 else{
  const stale=!route||route.source!==world.obstacles||now>=route.expiresAt||Math.hypot(target.x-route.target.x,target.z-route.target.z)>replanDistance;
  if(stale&&budget.remaining>0&&(!budget.deadlineNs||process.hrtime.bigint()<budget.deadlineNs)){
   budget.remaining--;const started=process.hrtime.bigint(),meta={},points=findEnemyPath(world,enemy,target,{deadlineNs:budget.deadlineNs,meta}),elapsed=Number(process.hrtime.bigint()-started)/1e6;
   budget.searches=(budget.searches??0)+1;budget.spentMs=(budget.spentMs??0)+elapsed;budget.expanded=(budget.expanded??0)+(meta.expanded??0);
   if(meta.reason==='deadline')budget.timeouts=(budget.timeouts??0)+1;
   else if(meta.reason==='node-limit')budget.nodeLimits=(budget.nodeLimits??0)+1;
   else if(meta.reason==='no-path')budget.noPaths=(budget.noPaths??0)+1;
   else if(meta.reason==='complete')budget.completed=(budget.completed??0)+1;
   if(points.length){route={source:world.obstacles,expiresAt:now+NAVIGATION_POLICY.routeTtlMs+hash(enemy.id)%1000,target:{x:target.x,z:target.z},points};routes.set(enemy,route);}
   else{
    const retry=now+(meta.reason==='node-limit'||meta.reason==='no-path'?NAVIGATION_POLICY.failedRetryMs:NAVIGATION_POLICY.retryMs)+hash(enemy.id)%400;
    if(route?.points?.length)route.expiresAt=retry;
    else{route={source:world.obstacles,expiresAt:retry,target:{x:target.x,z:target.z},points:[]};routes.set(enemy,route);}
   }
  }
  if(!route||route.source!==world.obstacles)return;
 }
 const points=route.points;
 while(points.length>1&&Math.hypot(points[0].x-enemy.x,points[0].z-enemy.z)<.12)points.shift();
 // Path-corridor visibility optimization: skip corners that have become directly reachable.
 for(let i=Math.min(points.length-1,8);i>0;i--)if(movementSegmentClear(world,enemy,points[i])){points.splice(0,i);break;}
 const next=points[0];if(!next)return;
 const dx=next.x-enemy.x,dz=next.z-enemy.z,d=Math.hypot(dx,dz),step=Math.min(travel,d);if(d<1e-8)return;
 const to={x:enemy.x+dx/d*step,z:enemy.z+dz/d*step};
 if(movementSegmentClear(world,enemy,to)){enemy.x=to.x;enemy.z=to.z;enemy.yaw=Math.atan2(dx,dz);consumeEnemySprint(enemy,{sprinting,distance:step,speed,now});}
 else if(route.expiresAt!==undefined)route.expiresAt=0;
}
