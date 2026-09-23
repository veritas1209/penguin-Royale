const CELL_SIZE=12;
const caches=new WeakMap();

const cell=value=>Math.floor(value/CELL_SIZE);
const key=(x,z)=>`${x},${z}`;

function obstacleIndex(world){
 const source=world?.obstacles??[];
 const previous=world&&caches.get(world);
 if(previous?.source===source&&previous.count===source.length)return previous.buckets;
 const buckets=new Map();
 for(const obstacle of source){
  const halfW=(obstacle.w??obstacle.width??1)/2,halfD=(obstacle.d??obstacle.depth??1)/2;
  for(let x=cell(obstacle.x-halfW);x<=cell(obstacle.x+halfW);x++)for(let z=cell(obstacle.z-halfD);z<=cell(obstacle.z+halfD);z++){
   const bucketKey=key(x,z),bucket=buckets.get(bucketKey);
   if(bucket)bucket.push(obstacle);else buckets.set(bucketKey,[obstacle]);
  }
 }
 if(world)caches.set(world,{source,count:source.length,buckets});
 return buckets;
}

// Returns only obstacles in grid cells crossed by the segment's bounding box.
// Combat rays are short, so this avoids scanning and allocating the whole map list.
export function segmentObstacles(world,from,to){
 const buckets=obstacleIndex(world),matches=new Set();
 const minX=cell(Math.min(from.x,to.x)),maxX=cell(Math.max(from.x,to.x));
 const minZ=cell(Math.min(from.z,to.z)),maxZ=cell(Math.max(from.z,to.z));
 for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)for(const obstacle of buckets.get(key(x,z))??[])matches.add(obstacle);
 return matches;
}
