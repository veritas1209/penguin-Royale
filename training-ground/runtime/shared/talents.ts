import type {TalentDef} from './catalog.ts';
/** Sum the unlocked increments; saved levels never change when balancing effects. */
export function talentBonus(talent:TalentDef,level:number){
 const unlocked=Math.max(0,Math.min(talent.maxLevel,Number.isFinite(level)?Math.floor(level):0));
 return talent.levelBonuses?Math.round(talent.levelBonuses.slice(0,unlocked).reduce((sum,value)=>sum+value,0)*1e8)/1e8:unlocked*(talent.perLevel??0);
}

/** Show the next purchase and the cumulative effect already unlocked. */
export function talentUpgradeDescription(talent:TalentDef,level:number){
 const currentLevel=Math.max(0,Math.min(talent.maxLevel,Number.isFinite(level)?Math.floor(level):0));
 const current=talentBonus(talent,currentLevel);
 const atMax=currentLevel>=talent.maxLevel;
 const step=Math.min(talent.maxLevel,currentLevel+1);
 const increment=Math.round((talentBonus(talent,step)-current)*1e8)/1e8;
 const percent=Math.round(increment*10000)/100;
 const currentPercent=Math.round(current*10000)/100;
 const suffix=(next:string,currentText:string,maxText:string)=>atMax?`${maxText} (최대 레벨)`: `${next} (현재 ${currentText})`;
 switch(talent.effect){
  case 'health':return suffix('최대 체력 +'+increment,'+'+current,'최대 체력 +'+current);
  case 'speed':return suffix('이동 속도 +'+percent+'%','+'+currentPercent+'%','이동 속도 +'+currentPercent+'%');
  case 'capacity':return suffix('휴대 용량 +'+increment,'+'+current,'휴대 용량 +'+current);
  case 'heal':return suffix('일반 치료 회복량 +'+percent+'%','+'+currentPercent+'%','일반 치료 회복량 +'+currentPercent+'%')+' (구급상자·부스트 제외)';
  case 'accuracy':return suffix('탄퍼짐 -'+percent+'%','-'+currentPercent+'%','탄퍼짐 -'+currentPercent+'%');
  case 'sell':return suffix('전리품 판매가 +'+percent+'%','+'+currentPercent+'%','전리품 판매가 +'+currentPercent+'%');
  default:return talent.description;
 }
}

/** Price for the next level; both the UI and authoritative purchase route use this. */
export function talentUpgradeCost(talent:TalentDef,currentLevel:number){
 if(!Number.isSafeInteger(currentLevel)||currentLevel<0||currentLevel>=talent.maxLevel)return 0;
 return talent.levelCosts?.[currentLevel]??talent.baseCost*(currentLevel+1);
}
