type Cue='ui'|'error'|'loot'|'hit'|'reload'|'heal'|'flare'|'shot'|'explosion';
type GunshotOptions={ammoId?:string;weaponId?:string;weaponFamily?:string;soundClass?:string;weaponFamily?:string;soundClass?:string;suppressed?:boolean;distance?:number;pan?:number;eventKey?:string};
type SampleRef={file:string;gain:number;pitch:number;burst?:boolean};
const SAMPLES:Record<string,SampleRef>={
 'ammo-9':{file:'shot3.mp3',gain:.78,pitch:1.03}, 'ammo-45':{file:'shot3.mp3',gain:.9,pitch:.88},
 'ammo-57':{file:'auto2.mp3',gain:.68,pitch:1.14,burst:true}, 'ammo-556':{file:'auto1.mp3',gain:.8,pitch:1,burst:true},
 'ammo-762':{file:'shot4.mp3',gain:.92,pitch:.96}, 'ammo-300':{file:'shot5.wav',gain:1,pitch:.86},
 'ammo-50':{file:'shot5.wav',gain:1.18,pitch:.72}, 'ammo-12':{file:'shotgun2.wav',gain:1.05,pitch:.94},
};
const FILES=['shot1.mp3','shot3.mp3','shot4.mp3','shot5.wav','auto1.mp3','auto2.mp3','shotgun2.wav','reload.mp3','explosion5.wav'];
const BASE='./assets/audio/guns-freesori/';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const weaponBase=(id='')=>id.toLowerCase().replace(/-(broken|repaired|improved|refined|gold)(?:-gold-lv[1-3])?$/,'').replace(/-gold-lv[1-3]$/,'');
export class Sound{
 ctx:AudioContext|null=null;master:GainNode|null=null;muted=false;volume=.34;
 private buffers=new Map<string,AudioBuffer>(); private pending=new Map<string,Promise<AudioBuffer|null>>();
 private gunSeen=new Map<string,number>(); private mg3Until=0;
 unlock(){if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:this.volume;this.master.connect(this.ctx.destination);void this.prime();}void this.ctx.resume();}
 setMute(value:boolean){this.muted=value;if(this.master)this.master.gain.value=value?0:this.volume;}
 private async prime(){await Promise.all(FILES.map(f=>this.load(f)));}
 private async load(file:string):Promise<AudioBuffer|null>{
  const old=this.buffers.get(file);if(old)return old;const inflight=this.pending.get(file);if(inflight)return inflight;
  const p=(async()=>{try{const r=await fetch(new URL(BASE+file,document.baseURI));if(!r.ok)throw new Error(String(r.status));const b=await this.ctx!.decodeAudioData(await r.arrayBuffer());this.buffers.set(file,b);return b;}catch{return null;}})();
  this.pending.set(file,p);const out=await p;this.pending.delete(file);return out;
 }
 private transient(b:AudioBuffer):{offset:number;duration:number}{
  const d=b.getChannelData(0),sr=b.sampleRate,step=256,limit=Math.min(d.length,Math.floor(sr*2.5));let best=0,bestR=0;
  for(let i=step;i<limit-step;i+=step){let s=0;for(let j=0;j<step;j++){const v=d[i+j];s+=v*v;}const rms=s/step;if(rms>bestR){bestR=rms;best=i;}}
  const offset=Math.max(0,best/sr-.028);return {offset,duration:Math.min(.72,b.duration-offset)};
 }
 private playBuffer(file:string,opts:{gain:number;pitch:number;distance:number;pan:number;suppressed:boolean;burst?:boolean;raw?:boolean}){
  if(!this.ctx||!this.master||this.muted)return;const b=this.buffers.get(file);if(!b){void this.load(file).then(()=>this.playBuffer(file,opts));return;}
  const distance=opts.distance,range=opts.suppressed?52:180,falloff=clamp(1-distance/range,0,1);if(falloff<=.002)return;
  const now=this.ctx.currentTime,source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),pan=this.ctx.createStereoPanner();
  source.buffer=b;source.playbackRate.value=opts.raw?1:opts.pitch*(.985+Math.random()*.03);
  filter.type=opts.suppressed?'lowpass':'highpass';filter.frequency.value=opts.suppressed?1650:28;filter.Q.value=opts.suppressed?.55:.28;
  gain.gain.value=clamp(opts.gain*falloff*(opts.suppressed?.88:1),.001,1.8);pan.pan.value=clamp(opts.pan,-1,1);
  if(opts.raw)source.connect(gain).connect(pan).connect(this.master);else source.connect(filter).connect(gain).connect(pan).connect(this.master);
  const seg=opts.raw?{offset:0,duration:b.duration}:opts.burst?this.transient(b):{offset:0,duration:b.duration},duration=opts.raw?seg.duration:Math.min(seg.duration,.82);source.start(now,seg.offset,duration);source.stop(now+duration+.015);
 }
 gunshot(options:GunshotOptions={}){
  if(!this.ctx||!this.master||this.muted)return;const key=options.eventKey;
  if(key){const t=performance.now(),last=this.gunSeen.get(key);if(last&&t-last<1200)return;this.gunSeen.set(key,t);if(this.gunSeen.size>160)for(const [k,v]of this.gunSeen)if(t-v>3000)this.gunSeen.delete(k);}
  const weapon=weaponBase(options.weaponId),family=String(options.weaponFamily??'').toUpperCase();
  if(weapon==='mg3'){const t=performance.now();if(t<this.mg3Until)return;this.mg3Until=t+1800;this.playBuffer('auto2.mp3',{gain:1,pitch:1,distance:Math.max(0,options.distance??0),pan:options.pan??0,suppressed:false,raw:true});return;}
  let sample:SampleRef=SAMPLES[options.ammoId??'ammo-556']??SAMPLES['ammo-556'];
  if(weapon==='crossbow'||family==='CROSSBOW')sample={file:'shot1.mp3',gain:.86,pitch:1};
  else if(weapon==='lynx-amr')sample={file:'shotgun2.wav',gain:1.625,pitch:1};
  else if(weapon==='awm')sample={file:'shotgun2.wav',gain:1.25,pitch:1};
  else if(weapon==='mk14')sample={file:'shot5.wav',gain:1.28,pitch:.96};
  else if(weapon==='mg3')sample={file:'auto2.mp3',gain:1.05,pitch:1,burst:true};
  else if(weapon==='s12k'||family==='SG')sample={file:'shotgun2.wav',gain:1.3,pitch:1};
  else if(family==='SR')sample={file:'shot4.mp3',gain:1.22,pitch:1};
  else if(family==='DMR')sample={file:'shot5.wav',gain:1.22,pitch:1};
  else if(family==='PISTOL'||family==='HG')sample={file:'shot3.mp3',gain:.92,pitch:1};
  else if(family==='AR'||family==='SMG'||family==='LMG')sample={file:'auto1.mp3',gain:.88,pitch:1,burst:true};
  this.playBuffer(sample.file,{gain:sample.gain,pitch:sample.pitch,distance:Math.max(0,options.distance??0),pan:options.pan??0,suppressed:weapon==='mg3'?false:!!options.suppressed,burst:sample.burst});
 }
 play(cue:Cue){
  if(cue==='shot'){this.gunshot();return;}if(cue==='reload'){this.playBuffer('reload.mp3',{gain:.55,pitch:1,distance:0,pan:0,suppressed:false});return;}if(cue==='explosion'){this.playBuffer('explosion5.wav',{gain:1,pitch:1,distance:0,pan:0,suppressed:false});return;}
  if(!this.ctx||!this.master||this.muted)return;const ctx=this.ctx,t=ctx.currentTime,g=ctx.createGain(),o=ctx.createOscillator();g.connect(this.master);o.connect(g);
  const f=cue==='loot'?820:cue==='hit'?95:cue==='error'?120:cue==='heal'?580:cue==='flare'?460:650,d=cue==='hit'?.14:.2;
  o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime((cue==='loot'||cue==='heal')?f*1.5:f*.35,t+d);g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.start();o.stop(t+d);
 }
 ambience(enabled:boolean){void enabled;}
}