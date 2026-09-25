import type {ItemDef} from './catalog.ts';
export function isFactionArmor(item:ItemDef){return ['armor','helmet'].includes(item.category)&&['one-eyed-snake','steel-front'].includes(item.armorVariant??'');}
/** Direct shop availability only; ownership, equipment and world loot remain independent. */
export function isDirectShopItem(item:ItemDef){return item.purchasable!==false&&item.quality!=='gold'&&!isFactionArmor(item);}