import {TRAINING_WORLD} from './trainingWorld.js';

// Add future practice arenas here. RoomManager keeps the combat implementation shared.
export const TRAINING_MAPS=new Map([
 ['warehouse-training',{id:'warehouse-training',name:'창고 훈련장',world:TRAINING_WORLD}],
]);
export function trainingMap(id){return TRAINING_MAPS.get(id)??null;}
