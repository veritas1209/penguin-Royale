// The training arena is only a world definition. Combat, movement and AI use Raid.
const barrier=(id,x,z,w,d,h=2.8,kind='barrier',color='#82918b')=>({id,x,z,w,d,h,kind,color,rotation:0});
const obstacles=[
 barrier('warehouse-nw',-7,-10,8,1),barrier('warehouse-ne',7,-10,8,1),
 barrier('warehouse-sw',-7,10,8,1),barrier('warehouse-se',7,10,8,1),
 barrier('warehouse-wn',-11,-6,1,8),barrier('warehouse-ws',-11,6,1,8),
 barrier('warehouse-en',11,-6,1,8),barrier('warehouse-es',11,6,1,8),
 barrier('warehouse-inner-a',-4,-2,5,1,2.3),barrier('warehouse-inner-b',4,3,5,1,2.3),
 barrier('warehouse-inner-c',0,-6,1,3,2.3),
 barrier('warehouse-crate-a',-5,5,1.8,1.8,1.3,'crate'),
 barrier('warehouse-crate-b',5,-5,1.8,1.8,1.3,'crate'),
 barrier('west-container-n',-23,-19,8,3,2.5,'container','#718b84'),
 barrier('east-container-n',23,-19,8,3,2.5,'container','#8c816e'),
 barrier('west-container-s',-23,18,8,3,2.5,'container','#8c816e'),
 barrier('east-container-s',23,18,8,3,2.5,'container','#718b84'),
 barrier('west-flank',-18,-6,2,7,2.2,'container','#a16f59'),
 barrier('east-flank',18,6,2,7,2.2,'container','#a16f59'),
 barrier('west-sandbag',-19,8,4.5,1.2,1.1,'sandbag'),
 barrier('east-sandbag',19,-8,4.5,1.2,1.1,'sandbag'),
 barrier('south-cover-a',-12,22,4,1.2,1.1,'sandbag'),
 barrier('south-cover-b',12,22,4,1.2,1.1,'sandbag'),
 barrier('north-cover-a',-12,-24,4,1.2,1.1,'sandbag'),
 barrier('north-cover-b',12,-24,4,1.2,1.1,'sandbag'),
 barrier('west-crate',-27,1,2,2,1.2,'crate'),
 barrier('east-crate',27,1,2,2,1.2,'crate')
];
const enemySpawns=[
 {id:'training-front',kind:'raider',x:0,z:1,radius:30},
 {id:'training-left',kind:'raider',x:-22,z:0,radius:30},
 {id:'training-right',kind:'raider',x:19,z:-3,radius:30},
 {id:'training-rear',kind:'raider',x:0,z:-21,radius:30},
 {id:'training-heavy',kind:'heavy',x:-22,z:15,radius:30},
 {id:'training-far',kind:'heavy',x:22,z:15,radius:30},
 {id:'training-dps',kind:'heavy',x:-6,z:18,radius:0,trainingImmortal:true,name:'DPS 표적'}
];
export const TRAINING_WORLD={id:'warehouse-training',name:'창고 훈련장',size:82,
 spawn:{x:0,z:16},roads:[],buildings:[],terrain:[{id:'training-yard',kind:'yard',x:0,z:0,w:82,d:82}],
 landmarks:[],radiationZones:[],lootSpawns:[],enemySpawns,accessDoors:[],extractions:[],obstacles};
