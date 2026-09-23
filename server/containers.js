export const CONTAINER_SEARCH_SECONDS = Object.freeze({ normal: 3, military: 6, rare: 8 });

export function containerKind(spawn) {
  if (spawn.containerKind === 'rare' || spawn.pool === 'rare') return 'rare';
  if (spawn.containerKind === 'military' || spawn.pool === 'military') return 'military';
  return 'normal';
}

export function createContainer(spawn, index, items) {
  const kind = containerKind(spawn);
  const configured = Number(spawn.searchSeconds);
  const searchSeconds = Number.isFinite(configured) && configured >= 0 ? configured : CONTAINER_SEARCH_SECONDS[kind];
  return {
    id: spawn.id ?? `container-${index}`, x: spawn.x, z: spawn.z, kind,
    name: spawn.name ?? (spawn.pool==='documents'?'문서 캐비닛':kind === 'rare' ? '\ud76c\uadc0 \ubcf4\uae09\ud568' : kind === 'military' ? '\uad70\uc218\ud488 \uc0c1\uc790' : '\ubcf4\uae09 \uc0c1\uc790'),
    state: 'closed', searchSeconds, accessDoorId:spawn.accessDoorId, visualType:spawn.visualType??(spawn.pool==='documents'?'file-cabinet':spawn.containerKind),
    items: items.map(({ itemId, quantity, fittings },itemIndex) => ({ itemId, quantity,stackId:`${spawn.id??`container-${index}`}:item:${itemIndex}`,...(fittings?{fittings:{...fittings}}:{}) })),
  };
}

export function containerSnapshot(container) {
  const visible = { ...(container.accessDoorId?{accessDoorId:container.accessDoorId}:{}), ...(container.visualType?{visualType:container.visualType}:{}), id: container.id, x: container.x, z: container.z, kind: container.kind, name: container.name, state: container.state, searchSeconds: container.searchSeconds };
  if (container.openedBy) visible.openedBy = container.openedBy;
  if(container.state==='searching'&&Number.isFinite(container.searchStartedAt)&&Number.isFinite(container.searchCompleteAt))visible.search={playerId:container.openedBy,startedAt:container.searchStartedAt,completeAt:container.searchCompleteAt};
  if (container.state === 'open') visible.items = container.items.map((item) => ({ ...item }));
  return visible;
}
