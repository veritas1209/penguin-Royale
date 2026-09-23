import {advanceMovement,type MoveInput,type MoveState,type MoveWorld} from '../shared/movement.ts';
type Frame={start:number;end:number;input:MoveInput};
export class MovementPrediction {
 cpu={reconcileMs:0,reconcileMaxMs:0,advanceMs:0,advanceMaxMs:0,replayedFrames:0};
 history:Frame[]=[];state:MoveState={x:0,z:0,stamina:100,maxStamina:100,moveMultiplier:1,coldUntil:0,staminaRecoveryAt:0};
 lastSnapshot=-Infinity;lastReceived=0;clockOffset=0;ready=false;correction=0;
 reset(){this.history=[];this.ready=false;this.lastSnapshot=-Infinity;this.correction=0;}
 reconcile(player:any,serverTime:number,now:number,world:MoveWorld){
  if(serverTime<this.lastSnapshot)return false;
  const cpuStart=performance.now();let replayedFrames=0;
  this.lastSnapshot=serverTime;this.lastReceived=now;
  const acknowledged=Number.isFinite(player.movement?.clientTime)?Math.min(now,player.movement.clientTime):now;
  const simulatedTime=player.movement?.serverTime??serverTime;
  this.clockOffset=simulatedTime-acknowledged;
  const previous={x:this.state.x,z:this.state.z};
  this.state={x:player.x,z:player.z,stamina:player.stamina,maxStamina:player.maxStamina??100,moveMultiplier:player.movement?.moveMultiplier??1,coldUntil:player.coldUntil??0,staminaRecoveryAt:player.staminaRecoveryAt??0};
  // An absent/expired acknowledgement is a resync, never replay an unbounded backlog.
  if(this.ready&&now-acknowledged<=1500&&player.alive&&!player.downed&&!player.boarded){
   for(const frame of this.history){const start=Math.max(frame.start,acknowledged),end=Math.min(frame.end,now);if(end>start){replayedFrames++;advanceMovement(this.state,frame.input,(end-start)/1000,this.clockOffset+end,world);}}
  }
  this.history=this.history.filter(f=>f.end>acknowledged&&f.end>now-1500);
  this.correction=this.ready?Math.hypot(previous.x-this.state.x,previous.z-this.state.z):0;this.ready=true;this.cpu.reconcileMs=performance.now()-cpuStart;this.cpu.reconcileMaxMs=Math.max(this.cpu.reconcileMaxMs,this.cpu.reconcileMs);this.cpu.replayedFrames=replayedFrames;return true;
 }
 advance(input:MoveInput,dt:number,now:number,world:MoveWorld,active:boolean){
  if(!this.ready)return this.state;
  const cpuStart=performance.now();
  const end=now,start=now-dt*1000,command=active?{...input}:{moveX:0,moveZ:0,sprint:false};
  this.history.push({start,end,input:command});this.history=this.history.filter(f=>f.end>now-1500);
  if(active&&now-this.lastReceived<1500)advanceMovement(this.state,command,dt,now+this.clockOffset,world);
  this.cpu.advanceMs=performance.now()-cpuStart;this.cpu.advanceMaxMs=Math.max(this.cpu.advanceMaxMs,this.cpu.advanceMs);return this.state;
 }
}
