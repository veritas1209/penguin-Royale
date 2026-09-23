export type FirearmCadenceMode='auto'|'burst'|'semi'|'bolt';
export type FirearmCadenceRule={
 intervalMs:number;
 mode:FirearmCadenceMode;
 burst?:number;
 dbs?:boolean;
};

export const FIREARM_CADENCE:Record<string,FirearmCadenceRule>=Object.freeze({
 akm:{intervalMs:100,mode:'auto'},
 groza:{intervalMs:80,mode:'auto'},
 'beryl-m762':{intervalMs:85.7,mode:'auto'},
 'mk47-mutant':{intervalMs:75,mode:'burst',burst:2},
 ace32:{intervalMs:88,mode:'auto'},
 'honey-badger':{intervalMs:92,mode:'auto'},
 m416:{intervalMs:85.7,mode:'auto'},
 m16a4:{intervalMs:75,mode:'burst',burst:3},
 'scar-l':{intervalMs:100,mode:'auto'},
 aug:{intervalMs:85.7,mode:'auto'},
 qbz:{intervalMs:92,mode:'auto'},
 g36c:{intervalMs:85.7,mode:'auto'},
 famas:{intervalMs:60,mode:'auto'},
 'asm-abakan':{intervalMs:90.9,mode:'auto'},

 'mini-14':{intervalMs:100,mode:'semi'},
 mk12:{intervalMs:100,mode:'semi'},
 qbu:{intervalMs:100,mode:'semi'},
 sks:{intervalMs:100,mode:'semi'},
 mk14:{intervalMs:90,mode:'auto'},
 slr:{intervalMs:100,mode:'semi'},
 vss:{intervalMs:85.7,mode:'auto'},

 kar98k:{intervalMs:1900,mode:'bolt'},
 m24:{intervalMs:1800,mode:'bolt'},
 awm:{intervalMs:1850,mode:'bolt'},
 win94:{intervalMs:600,mode:'bolt'},
 'lynx-amr':{intervalMs:1380,mode:'semi'},

 'micro-uzi':{intervalMs:48,mode:'auto'},
 ump:{intervalMs:92,mode:'auto'},
 'tommy-gun':{intervalMs:86,mode:'auto'},
 vector:{intervalMs:55,mode:'auto'},
 mp5k:{intervalMs:67,mode:'auto'},
 js9:{intervalMs:65,mode:'auto'},
 'pp19-bizon':{intervalMs:86,mode:'auto'},
 p90:{intervalMs:60,mode:'auto'},

 s1897:{intervalMs:750,mode:'bolt'},
 s686:{intervalMs:200,mode:'semi'},
 s12k:{intervalMs:250,mode:'semi'},
 dbs:{intervalMs:125,mode:'semi',dbs:true},
 ns2000:{intervalMs:800,mode:'bolt'},

 m249:{intervalMs:75,mode:'auto'},
 mg3:{intervalMs:60000/990,mode:'auto'},
 dp28:{intervalMs:109,mode:'auto'},

 crossbow:{intervalMs:3549.655,mode:'bolt'},

 p92:{intervalMs:100,mode:'semi'},
 p18c:{intervalMs:50,mode:'auto'},
 skorpion:{intervalMs:70,mode:'auto'},
 'dual-mp7':{intervalMs:37.5,mode:'auto'},
 deagle:{intervalMs:200,mode:'semi'},
 p1911:{intervalMs:110,mode:'semi'},
 r45:{intervalMs:250,mode:'semi'},
 r1895:{intervalMs:200,mode:'semi'},
 'sawed-off':{intervalMs:250,mode:'semi'},
});

export function firearmBaseId(item:any){
 let id=String(item?.baseId??item?.id??'').toLowerCase();

 id=id.replace(
  /-(broken|repaired|intact|improved|refined)$/,
  ''
 );

 if(id==='ump45')id='ump';
 if(id==='pp-19-bizon')id='pp19-bizon';

 return id;
}

export function firearmCadence(item:any):FirearmCadenceRule{
 const rule=FIREARM_CADENCE[firearmBaseId(item)];

 if(rule)return rule;

 const fireRate=Math.max(
  .001,
  Number(item?.fireRate??1)
 );

 return {
  intervalMs:1000/fireRate,
  mode:item?.mode??'semi',
  burst:item?.burst??1,
 };
}

/*
 DBS:
 14 -> 13 : 첫 발 후 125ms
 13 -> 12 : 둘째 발 후 펌프 450ms
 12 -> 11 : 125ms
 11 -> 10 : 450ms
 ...
*/
export function nextShotIntervalMs(
 item:any,
 roundsBeforeShot?:number
){
 const rule=firearmCadence(item);

 if(
  rule.dbs &&
  Number.isFinite(roundsBeforeShot)
 ){
  return Number(roundsBeforeShot)%2===0
   ?125
   :450;
 }

 return rule.intervalMs;
}

/*
 클라이언트는 "직전 발사 이후 남은 탄"을 보고
 DBS 로컬 입력 제한을 맞춘다.
*/
export function clientShotIntervalMs(
 item:any,
 currentRounds?:number,
 hasFired=true
){
 const rule=firearmCadence(item);

 if(
  rule.dbs &&
  hasFired &&
  Number.isFinite(currentRounds)
 ){
  return Number(currentRounds)%2===1
   ?125
   :450;
 }

 return rule.intervalMs;
}

export function applyFirearmCadence(items:any[]){
 for(const item of items??[]){
  if(item?.category!=='weapon')continue;

  const rule=
   FIREARM_CADENCE[firearmBaseId(item)];

  if(!rule)continue;

  item.fireRate=1000/rule.intervalMs;
  item.mode=rule.mode;
  item.burst=rule.burst??1;
 }
}
