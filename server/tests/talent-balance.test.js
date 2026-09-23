import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,TALENTS} from '../../shared/catalog.ts';
import {talentBonus,talentUpgradeDescription} from '../../shared/talents.ts';
import {Raid,normalizeCatalog} from '../game.js';
import {raidEquipmentStats} from '../raidEquipment.js';
import {SUPPLY_PACKS} from '../loot.js';

test('saved five-level talents produce 120 HP and runner 2/2/2/2/4 increments',()=>{
 const catalog=normalizeCatalog({items:ITEMS,talents:TALENTS}),runner=TALENTS.find(t=>t.id==='runner'),vitality=TALENTS.find(t=>t.id==='vitality');
 assert.deepEqual([0,1,2,3,4,5,6].map(level=>talentBonus(runner,level)),[0,.02,.04,.06,.08,.12,.12]);
 assert.equal(100+talentBonus(vitality,5),120);
 const raid=Object.create(Raid.prototype);raid.catalog=catalog;raid.db={profile(){return {talents:[{talentId:'vitality',level:5},{talentId:'runner',level:5}]};}};
 assert.equal(100+raid.talentValue('p','health',0),120);assert.equal(raid.talentValue('p','speed',0),.12);
 const player={talentLevels:{runner:5,'pack-mule':5},gear:{}};
 const stats=raidEquipmentStats(player,{},catalog);assert.equal(stats.moveMultiplier,1.12);assert.equal(stats.carryCapacity,410);
});

test('ordinary weapon supply rewards cannot be repeatedly sold at guaranteed profit',()=>{
 const standard=ITEMS.filter(i=>i.category==='weapon'&&i.baseId&&i.quality!=='gold'&&i.tier>=3&&i.tier<=5);
 assert.ok(standard.length>100);const maxSell=Math.max(...standard.map(i=>Math.floor(i.sell*1.1)));
 assert.ok(SUPPLY_PACKS.weapon.price>maxSell,`${SUPPLY_PACKS.weapon.price} <= ${maxSell}`);
});

test('storage adds 10/20/40/70/120 and upgrade descriptions show the next and current effects',()=>{
 const pack=TALENTS.find(t=>t.id==='pack-mule'),runner=TALENTS.find(t=>t.id==='runner');
 assert.deepEqual([0,1,2,3,4,5].map(level=>talentBonus(pack,level)),[0,10,30,70,140,260]);
 assert.equal(talentUpgradeDescription(pack,3),'휴대 용량 +70 (현재 +70)');
 assert.equal(talentUpgradeDescription(pack,4),'휴대 용량 +120 (현재 +140)');
 assert.equal(talentUpgradeDescription(runner,3),'이동 속도 +2% (현재 +6%)');
 assert.equal(talentUpgradeDescription(runner,4),'이동 속도 +4% (현재 +8%)');
 assert.equal(talentUpgradeDescription(TALENTS.find(t=>t.id==='vitality'),0),'최대 체력 +4 (현재 +0)');
 assert.equal(talentUpgradeDescription(TALENTS.find(t=>t.id==='vitality'),5),'최대 체력 +20 (최대 레벨)');
 assert.equal(talentUpgradeDescription(TALENTS.find(t=>t.id==='field-medic'),2),'일반 치료 회복량 +3% (현재 +6%) (구급상자·부스트 제외)');
 assert.equal(talentUpgradeDescription(TALENTS.find(t=>t.id==='steady-flippers'),2),'탄퍼짐 -2% (현재 -4%)');
 assert.equal(talentUpgradeDescription(TALENTS.find(t=>t.id==='bargainer'),2),'전리품 판매가 +2% (현재 +4%)');
 for(const t of TALENTS)for(let level=0;level<=5;level++)assert.ok(!talentUpgradeDescription(t,level).includes('최종'));
});
