import type { ItemDef } from './catalog.ts';

export type MetroEconomySource = 'pubg-official-survival-guide' | 'namu-mirror-current';

export interface MetroPriceEvidence {
  price?: number;
  sell?: number;
  source: MetroEconomySource;
  note: string;
}

const currentSource = 'namu-mirror-current' as const;

/** Exact values published in Metro Cash. Missing fields are deliberately not inferred. */
export const METRO_PRICE_EVIDENCE: Readonly<Record<string, MetroPriceEvidence>> = {
  'helmet-1': { price: 8100, sell: 2700, source: currentSource, note: 'Current helmet table.' },
  'helmet-2': { price: 21600, sell: 7200, source: currentSource, note: 'Current helmet table.' },
  'helmet-3': { price: 67500, sell: 22500, source: currentSource, note: 'Current helmet table.' },
  'helmet-4': { price: 224000, sell: 56000, source: currentSource, note: 'Current helmet table.' },
  'helmet-5': { price: 500000, sell: 100000, source: currentSource, note: 'Current helmet table.' },
  'helmet-6': { price: 750000, sell: 150000, source: currentSource, note: 'Current helmet table.' },
  'armor-1': { price: 8100, sell: 2700, source: currentSource, note: 'Current vest table.' },
  'armor-2': { price: 21600, sell: 8100, source: currentSource, note: 'Current vest table.' },
  'armor-3': { price: 67500, sell: 22500, source: currentSource, note: 'Current vest table.' },
  'armor-4': { price: 224000, sell: 56000, source: currentSource, note: 'Current vest table.' },
  'armor-5': { price: 500000, sell: 100000, source: currentSource, note: 'Current vest table.' },
  'armor-6': { price: 750000, sell: 150000, source: currentSource, note: 'Current vest table.' },
  // Backpack resale follows the published equipment resale bands: 1/3 of
  // purchase price through tier 3, then 1/4 at tier 4 and 1/5 at tiers 5-6.
  // The backpack buy table has its own tier-4 value, so sell values are
  // calculated from each backpack's actual buy price rather than copied from
  // the armor/helmet rows.
  'backpack-1': { price: 8100, sell: 2700, source: currentSource, note: 'Backpack resale normalized to the tier-1 equipment band (1/3 of purchase price).' },
  'backpack-2': { price: 21600, sell: 7200, source: currentSource, note: 'Backpack resale normalized to the tier-2 equipment band (1/3 of purchase price).' },
  'backpack-3': { price: 67500, sell: 22500, source: currentSource, note: 'Backpack resale normalized to the tier-3 equipment band (1/3 of purchase price).' },
  'backpack-4': { price: 180000, sell: 45000, source: currentSource, note: 'Backpack resale normalized to the tier-4 equipment band (1/4 of purchase price).' },
  'backpack-5': { price: 405000, sell: 81000, source: currentSource, note: 'Backpack resale normalized to the tier-5 equipment band (1/5 of purchase price).' },
  'backpack-6': { price: 607500, sell: 121500, source: currentSource, note: 'Backpack resale normalized to the tier-6 equipment band (1/5 of purchase price).' },
  'underbarrel-launcher': { price: 12000, source: currentSource, note: 'Intact M203; only current quality.' },
  'lead-lined-fabric': { price: 300000, source: currentSource, note: 'Single-quality armor attachment.' },
};


/** Inventory values observed in the supplied Korean client image, NOT verified buy/sell prices.
 * The FAMAS has four gold options; neither observation maps to a current catalog variant.
 */
export const METRO_WEAPON_VALUE_OBSERVATIONS = [
  {baseId:'mg3',quality:'cobra',inventoryValue:222000,source:'user-reference-2026-09-15',tradePriceVerified:false},
  {baseId:'famas',quality:'gold-steel',inventoryValue:148500,source:'user-reference-2026-09-15',tradePriceVerified:false,
   options:['hollow-lv1','colored-bullet-lv1','extended-mag-lv1','precision-lv2']},
] as const;

export interface MetroWeaponPriceEstimate {
 price:number;sell:number;certainty:'estimated';source:'project-metro-scale-estimate';note:string;
}
/** Model-specific project estimates, in Metro Cash. These are NOT official or observed prices.
 * Community evidence places ordinary refined guns around 400k, desirable guns above 800k,
 * and the AMR around 1.4m. Individual anchors below are balance choices within that scale.
 */
export const METRO_WEAPON_REFINED_ANCHORS:Readonly<Record<string,number>>={
 akm:450000,groza:810000,'beryl-m762':495000,'mk47-mutant':420000,ace32:480000,
 'honey-badger':465000,m416:495000,m16a4:405000,'scar-l':450000,aug:525000,qbz:435000,
 g36c:435000,famas:660000,'asm-abakan':570000,
 'mini-14':450000,mk12:525000,qbu:435000,sks:480000,mk14:900000,slr:540000,vss:405000,
 kar98k:525000,m24:675000,awm:1200000,win94:405000,'lynx-amr':1400000,
 'micro-uzi':405000,ump:420000,'tommy-gun':405000,vector:480000,mp5k:435000,js9:570000,
 'pp19-bizon':405000,p90:675000,
 s1897:405000,s686:405000,s12k:450000,dbs:600000,ns2000:525000,
 m249:810000,mg3:990000,dp28:450000,crossbow:300000,
 p92:90000,p18c:135000,skorpion:150000,'dual-mp7':360000,deagle:180000,p1911:90000,
 r45:105000,r1895:105000,'sawed-off':120000,
};
/** Independent family curves replace the old uniform small-currency multiplication.
 * Broken/repaired/intact/improved fractions and resale ratios are all project estimates.
 */
const weaponPriceCurves:Readonly<Record<string,{buy:readonly number[];resale:readonly number[]}>>={
 AR:{buy:[.018,.045,.16,.48,1],resale:[.10,.18,.28,.24,.20]},
 DMR:{buy:[.016,.04,.15,.46,1],resale:[.10,.18,.26,.23,.20]},
 SR:{buy:[.014,.035,.14,.44,1],resale:[.10,.16,.24,.22,.20]},
 SMG:{buy:[.022,.055,.18,.50,1],resale:[.12,.20,.30,.25,.20]},
 SG:{buy:[.025,.06,.19,.52,1],resale:[.12,.20,.30,.25,.20]},
 LMG:{buy:[.016,.04,.15,.45,1],resale:[.10,.18,.26,.23,.20]},
 Pistol:{buy:[.035,.08,.24,.55,1],resale:[.14,.22,.32,.26,.20]},
 Other:{buy:[.03,.07,.22,.54,1],resale:[.12,.20,.30,.25,.20]},
};
const weaponQualities=['broken','repaired','intact','improved','refined'] as const;
export function getMetroWeaponPriceEstimate(item:Pick<ItemDef,'category'|'baseId'|'id'|'quality'|'family'>):MetroWeaponPriceEstimate|undefined{
 if(item.category!=='weapon')return undefined;
 const anchor=METRO_WEAPON_REFINED_ANCHORS[item.baseId??item.id],index=weaponQualities.indexOf(item.quality as typeof weaponQualities[number]);
 if(anchor===undefined||index<0)return undefined;
 const curve=weaponPriceCurves[item.family??'Other']??weaponPriceCurves.Other;
 const price=Math.max(100,Math.round(anchor*curve.buy[index]/100)*100);
 return {price,sell:Math.max(1,Math.round(price*curve.resale[index])),certainty:'estimated',source:'project-metro-scale-estimate',
  note:'Model anchor and family quality/resale curve are provisional Metro-scale balance; no verified target-chapter trade table.'};
}

interface MetroValuableSeed {
  id: string;
  name: string;
  sell: number;
  tier: number;
  weight?: number;
  acquisition?: string;
}

const valuableSeeds: readonly MetroValuableSeed[] = [
  { id: 'postcard', name: '엽서', sell: 600, tier: 1 },
  { id: 'magazine', name: '잡지', sell: 600, tier: 1 },
  { id: 'playing-cards', name: '플레잉 카드', sell: 700, tier: 1 },
  { id: 'travel-guide', name: '여행 수첩', sell: 700, tier: 1 },
  { id: 'military-canteen', name: '군용 수통', sell: 800, tier: 1 },
  { id: 'portable-ledger', name: '휴대용 장부', sell: 800, tier: 1 },
  { id: 'can', name: '통조림', sell: 800, tier: 1 },
  { id: 'old-video-tape', name: '낡은 비디오테이프', sell: 900, tier: 1 },
  { id: 'compass', name: '나침반', sell: 1000, tier: 1 },
  { id: 'pocket-watch', name: '회중시계', sell: 1800, tier: 2 },
  { id: 'motor-oil', name: '엔진오일', sell: 2100, tier: 2 },
  { id: 'heart-necklace', name: '하트 목걸이', sell: 2100, tier: 2 },
  { id: 'parts-box', name: '부품 상자', sell: 2400, tier: 2 },
  { id: 'fuel', name: '연료', sell: 4000, tier: 3 },
  { id: 'gas-bottle', name: '가스병', sell: 4000, tier: 3 },
  { id: 'lubricating-oil', name: '윤활유', sell: 4400, tier: 3 },
  { id: 'metro-2036', name: 'Metro 2036', sell: 5200, tier: 3 },
  { id: 'car-key', name: '자동차 열쇠', sell: 5200, tier: 3 },
  { id: 'military-watch', name: '군용 시계', sell: 5200, tier: 3 },
  { id: 'water-purifier', name: '정수기', sell: 12000, tier: 4 },
  { id: 'cpu-processor', name: 'CPU 프로세서', sell: 13200, tier: 4 },
  { id: 'signal-generator', name: '신호 발생기', sell: 15600, tier: 4 },
  { id: 'tech-part', name: '기술 부품', sell: 18000, tier: 4 },
  { id: 'dog-tag', name: '인식표', sell: 25000, tier: 4, acquisition: 'PvP 처치자만 획득 가능' },
  { id: 'torn-map', name: '찢어진 지도', sell: 30000, tier: 5 },
  { id: 'torn-blueprint', name: '찢어진 설계 도면', sell: 30000, tier: 5 },
  { id: 'tablet-pc', name: '태블릿 PC', sell: 43200, tier: 5 },
  { id: 'detector', name: '탐측기', sell: 48000, tier: 5 },
  { id: 'biological-sample', name: '생물학 샘플', sell: 57200, tier: 5 },
  { id: 'military-battery', name: '군사용 배터리', sell: 57600, tier: 5 },
  { id: 'precision-blueprint', name: '정밀 기계 설계도', sell: 96000, tier: 6 },
  { id: 'lens', name: '렌즈', sell: 112000, tier: 6 },
  { id: 'military-circuit-board', name: '군사용 회로판', sell: 112000, tier: 6 },
  { id: 'gpu', name: 'GPU', sell: 128000, tier: 6 },
  { id: 'top-secret-intelligence', name: '특급 기밀 정보', sell: 128000, tier: 6 },
  { id: 'gold-bar', name: '금괴 한 덩이', sell: 200000, tier: 6 },
  { id: 'pure-gold-canteen', name: '순금 수통', sell: 210000, tier: 6 },
  { id: 'pure-gold-necklace', name: '순금 하트 목걸이', sell: 210000, tier: 6 },
  { id: 'pure-gold-watch', name: '순금 손목시계', sell: 210000, tier: 6 },
  { id: 'quantum-matrix', name: '양자 매트릭스', sell: 450000, tier: 6, weight: 20 },
  { id: 'gold-brick', name: '골드 브릭', sell: 500000, tier: 6, weight: 20 },
  { id: 'portable-microscope', name: '휴대용 현미경', sell: 2000000, tier: 6, weight: 75 },
  { id: 'portable-centrifuge', name: '휴대용 원심분리기', sell: 2000000, tier: 6, weight: 75 },
  { id: 'cash', name: '현금 상자', sell: 10, tier: 2, weight: 0.01 },
  { id: 'full-cash-crate', name: '가득 찬 현금 상자', sell: 500, tier: 4, weight: 0.02 },
  { id: 'password-letter-white', name: '암호 편지 · 화이트', sell: 30000, tier: 5 },
  { id: 'password-letter-red', name: '암호 편지 · 레드', sell: 30000, tier: 5 },
  { id: 'password-letter-yellow', name: '암호 편지 · 옐로', sell: 30000, tier: 5 },
  { id: 'password-letter-green', name: '암호 편지 · 그린', sell: 30000, tier: 5 },
  { id: 'password-letter-black', name: '암호 편지 · 블랙', sell: 100000, tier: 6 },
];

export const METRO_VALUABLE_ITEMS: ItemDef[] = valuableSeeds.map((seed) => ({
  ...seed,
  category: 'valuable',
  price: seed.sell,
  weight: seed.weight ?? 10,
  description: seed.acquisition
    ? `판매 전용 전리품 · ${seed.acquisition}`
    : '판매 전용 전리품',
  purchasable: false,
}));

export const METRO_VALUABLE_EVIDENCE: Readonly<Record<string, MetroPriceEvidence>> =
  Object.fromEntries(valuableSeeds.map((seed) => [seed.id, {
    sell: seed.sell,
    source: currentSource,
    note: seed.acquisition ?? 'Current sellable-item table.',
  }]));

export interface MetroMapLootContext {
  nodeTier: number;
  radiationZone?: boolean;
}

export interface MetroMapLootRule {
  mapLoot: boolean;
  minNodeTier?: number;
  radiationOnly?: boolean;
  relativeWeight: number;
  note: string;
}

/** Rules prevent PvP-only and ultra-rare rewards from entering ordinary flat loot pools. */
export const METRO_MAP_LOOT_RULES: Readonly<Record<string, MetroMapLootRule>> = {
  'dog-tag': { mapLoot: false, relativeWeight: 0, note: 'Generated only when a player kills another player.' },
  'biological-sample': { mapLoot: true, minNodeTier: 5, relativeWeight: 0.12, note: 'Source limits it to maps 4 and 5.' },
  lens: { mapLoot: true, minNodeTier: 5, relativeWeight: 0.07, note: 'Source limits it to maps 4 and 5.' },
  gpu: { mapLoot: true, minNodeTier: 5, relativeWeight: 0.05, note: 'Source limits it to maps 4 and 5.' },
  'pure-gold-canteen': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.015, note: 'Extremely rare current high-value loot.' },
  'pure-gold-necklace': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.015, note: 'Extremely rare current high-value loot.' },
  'pure-gold-watch': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.015, note: 'Extremely rare current high-value loot.' },
  'gold-brick': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.008, note: 'Later-map radiation/password-zone loot.' },
  'quantum-matrix': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.01, note: 'Current exceptional loot; restricted from ordinary crates.' },
  'portable-microscope': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.001, note: 'Ultra-rare current high-value loot.' },
  'portable-centrifuge': { mapLoot: true, minNodeTier: 5, radiationOnly: true, relativeWeight: 0.001, note: 'Ultra-rare current high-value loot.' },
};

const metroValuableIds = new Set(valuableSeeds.map(({ id }) => id));

export function getMetroMapLootWeight(item: Pick<ItemDef, 'id' | 'tier' | 'sell'>, context: MetroMapLootContext): number {
  const canonicalId = valuableAliases[item.id] ?? item.id;
  if (!metroValuableIds.has(canonicalId)) return 0;
  const rule = METRO_MAP_LOOT_RULES[canonicalId];
  if (rule?.mapLoot === false) return 0;
  if (context.nodeTier < (rule?.minNodeTier ?? Math.min(5,item.tier))) return 0;
  if (rule?.radiationOnly && !context.radiationZone) return 0;
  if (item.sell >= 210000 && !rule) return 0;
  return rule?.relativeWeight ?? Math.max(0.04, 1.3 - item.tier * 0.2);
}
const valuableAliases: Readonly<Record<string, string>> = {
  watch: 'military-watch',
  'water-filter': 'water-purifier',
  cpu: 'cpu-processor',
  'graphics-card': 'gpu',
  blueprint: 'precision-blueprint',
  jewelry: 'heart-necklace',
};

/**
 * Applies separately documented weapon estimates, then exact sourced values.
 * It mutates existing objects so catalog references remain stable,
 * and appends missing Metro valuables without deleting unrelated original loot.
 */
export function applyMetroEconomy<T extends ItemDef>(items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  // Estimates are separate from exact evidence; exact rows below take precedence.
  for(const item of items){const estimate=getMetroWeaponPriceEstimate(item);if(estimate){item.price=estimate.price;item.sell=estimate.sell;}}

  for (const [id, evidence] of Object.entries(METRO_PRICE_EVIDENCE)) {
    const item = byId.get(id);
    if (!item) continue;
    if (evidence.price !== undefined) item.price = evidence.price;
    if (evidence.sell !== undefined) item.sell = evidence.sell;
  }

  for (const metroItem of METRO_VALUABLE_ITEMS) {
    const existingId = Object.entries(valuableAliases).find(([, target]) => target === metroItem.id)?.[0] ?? metroItem.id;
    const existing = byId.get(existingId) ?? byId.get(metroItem.id);
    if (existing) {
      existing.name = metroItem.name;
      existing.price = metroItem.price;
      existing.sell = metroItem.sell;
      existing.weight = metroItem.weight;
      existing.tier = metroItem.tier;
      existing.description = metroItem.description;
      existing.acquisition = metroItem.acquisition;
      existing.purchasable = false;
      continue;
    }
    const added = { ...metroItem } as T;
    items.push(added);
    byId.set(added.id, added);
  }

  return items;
}


