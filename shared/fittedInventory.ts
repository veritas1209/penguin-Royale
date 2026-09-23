import type {ItemDef} from './catalog.ts';
export type FittedStack={itemId:string;quantity:number;fittings?:Record<string,string>};
export function stackWeight(stack:FittedStack,lookup:(id:string)=>ItemDef|undefined){return ((lookup(stack.itemId)?.weight??0)+Object.values(stack.fittings??{}).reduce((n,id)=>n+(lookup(id)?.weight??0),0))*stack.quantity;}
export function flattenFittedStacks(stacks:FittedStack[]){return stacks.flatMap(s=>[{itemId:s.itemId,quantity:s.quantity},...Object.values(s.fittings??{}).map(itemId=>({itemId,quantity:s.quantity}))]);}