type Obj=Record<string,any>;
const staticFields=['id','x','z','kind','name','searchSeconds','accessDoorId','visualType'];
/** Rebuild the original full snapshot before any game/UI consumer sees it. */
export class SnapshotDecoder {
 private raidId:string|null=null;private baseId:number|null=null;private containers=new Map<string,Obj>();
 reset(){this.raidId=null;this.baseId=null;this.containers.clear();}
 decode(message:Obj):Obj|null{
  if(message.type==='welcome'){this.reset();if(message.raid)this.decode(message.raid);return message;}
  if(message.type==='raid_started'){this.reset();return message;}
  if(message.type!=='snapshot'||message.snapshotFormat!=='static-v1')return message;
  if(!message.containerDelta){this.reset();this.raidId=message.raid.id;this.baseId=message.staticBase;for(const c of message.containers)this.containers.set(c.id,Object.fromEntries(staticFields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])));return message;}
  if(this.raidId!==message.raid.id||this.baseId!==message.staticBase||message.containers.some((c:Obj)=>!this.containers.has(c.id)))return null;
  const {containerDelta:_,...full}=message;return {...full,containers:message.containers.map((c:Obj)=>({...this.containers.get(c.id),...c}))};
 }
}

/** Passive wire measurements, independent of simulation and UI state. */
export class NetworkDiagnostics {
 private samples:{at:number;bytes:number}[]=[];private encoder=new TextEncoder();private snapshotAt:number|null=null;
 private intervalMs:number|null=null;private maxIntervalMs=0;private rttMs:number|null=null;
 reset(){this.samples=[];this.snapshotAt=null;this.intervalMs=null;this.maxIntervalMs=0;this.rttMs=null;}
 received(raw:string,at:number){this.samples.push({at,bytes:this.encoder.encode(raw).byteLength});this.prune(at);}
 message(data:Obj,at:number,wallTime:number){
  if(data.type==='snapshot'){if(this.snapshotAt!==null){this.intervalMs=at-this.snapshotAt;this.maxIntervalMs=Math.max(this.maxIntervalMs,this.intervalMs);}this.snapshotAt=at;}
  if(data.type==='pong'&&Number.isFinite(data.clientTime))this.rttMs=Math.max(0,wallTime-data.clientTime);
 }
 private prune(at:number){while(this.samples.length&&this.samples[0].at<=at-1000)this.samples.shift();}
 read(at:number){this.prune(at);return {receivedBytesPerSecond:this.samples.reduce((n,s)=>n+s.bytes,0),snapshotIntervalMs:this.intervalMs,maxSnapshotIntervalMs:this.maxIntervalMs,pongRttMs:this.rttMs};}
}
