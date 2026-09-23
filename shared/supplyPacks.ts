import type {ItemDef} from './catalog.ts';
export const SUPPLY_PACKS={
 weapon:{price:350000,goldChance:.02,category:'weapon',minTier:3,maxTier:5},
 armor:{price:350000,goldChance:.02,category:'armor',minTier:3,maxTier:5},
 'premium-armor':{price:2000000,goldChance:.5,category:'armor',minTier:6,maxTier:6},
 'premium-weapon':{price:1600000,goldChance:.5,category:'weapon',minTier:5,maxTier:5}
} as const;
export type SupplyKind=keyof typeof SUPPLY_PACKS;
/** Shop-only products. Rewards, rather than unopened crates, enter the owned inventory.
 * Premium armor normal rewards are Lv.6; premium weapon normal rewards are refined.
 */
export const SUPPLY_SHOP_ITEMS:ItemDef[]=(Object.keys(SUPPLY_PACKS) as SupplyKind[]).map(kind=>{
 const pack=SUPPLY_PACKS[kind],weapon=pack.category==='weapon',premium=kind.startsWith('premium-');
 return {
  id:'supply-crate-'+kind,name:(premium?'고급 ':'')+(weapon?'총기 상자':'방어구 상자'),category:'other',
  price:pack.price,sell:0,weight:0,tier:premium?7:5,effect:'supply-pack',family:'보급 상자',
  description:weapon?'무작위 총기 1개를 획득합니다.':'무작위 방탄조끼·헬멧·배낭 중 1개를 획득합니다.',
  acquisition:`황금 ${pack.goldChance*100}% · 일반 결과: ${weapon?(premium?'정밀':'양호~정밀'):(premium?'Lv.6':'Lv.3~5')}`,purchasable:true
 };
});
export function supplyKindFor(itemId:string):SupplyKind|null{
 const kind=itemId.startsWith('supply-crate-')?itemId.slice('supply-crate-'.length):'';
 return Object.hasOwn(SUPPLY_PACKS,kind)?kind as SupplyKind:null;
}

