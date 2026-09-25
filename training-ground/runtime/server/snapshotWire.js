/** Transport-only projection. Simulation objects never leave the server. */
export const PUBLIC_ENEMY_FIELDS=Object.freeze(['id','kind','x','z','yaw','hp','maxHp','bossId','goldenBoss','name','zoneName','phase','stunnedUntil','burningUntil','alertState','weaponId','attachments','scopeId','armorTier','ammoInMagazine','reloadEndsAt','healEndsAt','aimingUntil','reactionReadyAt','alertedAt','patrolSquadId','responsePlatoonId']);
export function publicEnemySnapshot(enemy){return Object.fromEntries(PUBLIC_ENEMY_FIELDS.filter(key=>enemy[key]!==undefined).map(key=>[key,enemy[key]]));}
const states=new WeakMap();
const staticFields=['id','x','z','kind','name','searchSeconds','accessDoorId','visualType'];
const staticContainer=c=>Object.fromEntries(staticFields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]]));
/** Negotiated per socket; legacy clients always receive complete v1 snapshots. */
export function encodeSnapshot(message,socket){
 if(message.type!=='snapshot'||!socket.snapshotStaticV1)return message;
 const raidId=message.raid.id,signature=JSON.stringify(message.containers.map(staticContainer)),previous=states.get(socket);
 const full=!previous||previous.raidId!==raidId||previous.signature!==signature||message.serverTime-previous.fullAt>=5000;
 if(full){states.set(socket,{raidId,signature,fullAt:message.serverTime,baseId:message.id});return {...message,snapshotFormat:'static-v1',staticBase:message.id};}
 return {...message,snapshotFormat:'static-v1',staticBase:previous.baseId,containerDelta:true,containers:message.containers.map(c=>Object.fromEntries(Object.entries(c).filter(([k])=>!staticFields.includes(k)||k==='id')))};
}
export function resetSnapshotWire(socket){states.delete(socket);}
