export type MoveInput={moveX:number;moveZ:number;sprint:boolean};
export type MoveState={x:number;z:number;stamina:number;maxStamina:number;moveMultiplier:number;coldUntil:number;staminaRecoveryAt?:number};
export type MoveWorld={size:number;
 obstacles:readonly {id?:string;x:number;z:number;w?:number;d?:number;width?:number;depth?:number}[];
 terrain?:readonly {kind:string;x:number;z:number;w:number;d:number}[];
 roads?:readonly {x:number;z:number;w:number;d:number}[]};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function riverBlocked(world:MoveWorld,x:number,z:number){
 const inWater=world.terrain?.some(t=>t.kind==='river'&&Math.abs(x-t.x)<=t.w/2+.45&&Math.abs(z-t.z)<=t.d/2+.45);
 if(!inWater)return false;
 // Crossing roads are elevated bridge decks; all other river coordinates are impassable.
 return !(world.roads??[]).some(r=>r.w>r.d&&Math.abs(x-r.x)<r.w/2-.45&&Math.abs(z-r.z)<r.d/2-.45);
}
export function movementBlocked(world:MoveWorld,x:number,z:number){
 return riverBlocked(world,x,z)||world.obstacles.some(o=>Math.abs(x-o.x)<=(o.w??o.width??1)/2+.45&&Math.abs(z-o.z)<=(o.d??o.depth??1)/2+.45);
}
export function normalizeMove(input:MoveInput):MoveInput{
 const x=clamp(input.moveX,-1,1),z=clamp(input.moveZ,-1,1),length=Math.hypot(x,z),m=Math.min(1,Math.hypot(input.moveX,input.moveZ));
 return {moveX:length?x/length*m:0,moveZ:length?z/length*m:0,sprint:input.sprint===true};
}
/** Same bounded substeps, collision radius, speed and stamina rules on both peers. */
export function advanceMovement(state:MoveState,input:MoveInput,dt:number,now:number,world:MoveWorld){
 const move=normalizeMove(input);let remaining=Math.max(0,Math.min(dt,.25)),at=now-remaining*1000;
 while(remaining>1e-8){const step=Math.min(.01,remaining);at+=step*1000;
 const recoveryAt=state.staminaRecoveryAt??0;
 const sprinting=Math.hypot(move.moveX,move.moveZ)>.01&&move.sprint&&state.stamina>0&&at>=recoveryAt;
 const speed=(sprinting?9:5.5)*state.moveMultiplier*(state.coldUntil>at?.65:1);
 const nx=clamp(state.x+move.moveX*speed*step,-world.size/2,world.size/2),nz=clamp(state.z+move.moveZ*speed*step,-world.size/2,world.size/2);
 if(!movementBlocked(world,nx,state.z))state.x=nx;
 if(!movementBlocked(world,state.x,nz))state.z=nz;
 if(sprinting){
  state.stamina=clamp(state.stamina-22*step,0,state.maxStamina);
  if(state.stamina<=0)state.staminaRecoveryAt=at+5000;
 }else if(at>=recoveryAt)state.stamina=clamp(state.stamina+14*step,0,state.maxStamina);remaining-=step;
 }
 return state;
}
