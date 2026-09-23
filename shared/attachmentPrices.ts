export const ATTACHMENT_PRICE_SOURCE_URL='https://d.namu.moe/w/%EB%B0%B0%ED%8B%80%EA%B7%B8%EB%9D%BC%EC%9A%B4%EB%93%9C%20%EB%AA%A8%EB%B0%94%EC%9D%BC/%EB%A9%94%ED%8A%B8%EB%A1%9C%20%EB%A1%9C%EC%96%84';
/** Published armor accessory buy curve; resale values were not published. */
export const SOURCED_ARMOR_ATTACHMENT_PRICES=[2880,5760,18000,48000,112500] as const;
/** Project balance anchors, NOT observed original gun attachment prices. */
export const ESTIMATED_INTACT_GUN_ATTACHMENT_PRICES:Readonly<Record<string,number>>={
 'red-dot':9000,'scope-4x':18000,suppressor:24000,'vertical-grip':12000,'extended-mag':18000,
};
export const ESTIMATED_GUN_ATTACHMENT_PRICE_CURVE=[.12,.3,1,2.4,4.5] as const;
const estimatedResaleRatio=[1/3,1/3,1/3,.25,.2] as const;
export function attachmentTradePrice(baseId:string,qualityIndex:number){
 const index=Math.min(4,Math.max(0,qualityIndex));
 if(baseId==='lead-lined-fabric')return {price:300000,sell:60000,source:'published 300000 base price; single pink grade; resale estimated 20%'};
 const anchor=ESTIMATED_INTACT_GUN_ATTACHMENT_PRICES[baseId];
 const price=anchor===undefined?SOURCED_ARMOR_ATTACHMENT_PRICES[index]:Math.round(anchor*ESTIMATED_GUN_ATTACHMENT_PRICE_CURVE[index]/10)*10;
 return {price,sell:Math.floor(price*estimatedResaleRatio[index]),source:anchor===undefined?'published armor accessory quality buy table; resale estimated':'project-metro-scale-estimate: gun attachment anchors and nonlinear buy curve; resale estimated'};
}
