import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,ITEM_BY_ID as items,rarityColor,rarityLabel} from '../../shared/catalog.ts';
import {ATTACHMENT_QUALITIES,QUALITY_ATTACHMENT_BASE_IDS,weaponAttachmentQualityEffects,attachmentQualityFactor} from '../../shared/attachmentQualities.ts';
import {armorAttachmentEffects} from '../../shared/armorAttachments.ts';
const lookup=id=>items[id];
const variant=(id,q)=>q==='intact'?items[id]:items[`${id}-${q}`];
test('six ordinary attachments have five named qualities and preserve base IDs and weights',()=>{
 for(const id of QUALITY_ATTACHMENT_BASE_IDS){
  const group=ITEMS.filter(i=>i.category==='attachment'&&i.baseId===id);
  assert.equal(group.length,5,id);
  assert.equal(items[id].quality,'intact');assert.equal(items[id].tier,3);
  for(const q of ATTACHMENT_QUALITIES){const i=variant(id,q.id);assert.equal(i.weight,id==='lead-lined-fabric'?50:15);assert.equal(rarityLabel(i),q.label);assert.equal(rarityColor(i),q.color);assert.equal(attachmentQualityFactor(i),q.factor);assert.equal(i.slot,items[id].slot);assert.ok(i.qualityPriceSource);}
 }
});
test('single blue launcher and 40mm show no quality label or quality variants',()=>{
 for(const id of ['underbarrel-launcher','ammo-40']){assert.equal(items[id].tier,3);assert.equal(rarityColor(items[id]),'#579de0');assert.equal(rarityLabel(items[id]),'');assert.equal(items[id].quality,undefined);assert.equal(ITEMS.filter(i=>i.id===id||i.baseId===id).length,1);}
 assert.equal(items['underbarrel-launcher'].price,12000);
});
test('quality scales actual armor bonuses while radiation immunity remains unconditional',()=>{
 for(const q of ATTACHMENT_QUALITIES){
  const gear={armor:'armor-6','armor:0':variant('steel-plate',q.id).id,'armor:1':variant('exoskeleton',q.id).id,'armor:2':variant('tactical-pouch',q.id).id};
  const e=armorAttachmentEffects(gear,lookup);assert.equal(e.protection,.05*q.factor);assert.equal(e.mobility,.1*q.factor);assert.equal(e.capacity,10*(ATTACHMENT_QUALITIES.indexOf(q)+1));assert.equal(variant('tactical-pouch',q.id).description,`배낭 휴대 용량 ${e.capacity} 증가.`);
  assert.equal(armorAttachmentEffects({armor:'armor-1','armor:0':'lead-lined-fabric'},lookup).radiationProtected,true);
 }
});
test('gun quality helpers scale bonuses around neutral defaults and retain baseline values',()=>{
 const neutral=weaponAttachmentQualityEffects({});assert.deepEqual(neutral,{accuracyBonus:0,rangeMultiplier:1,magazineMultiplier:1,reloadMultiplier:1,noiseMultiplier:1,suppressed:false});
 for(const q of ATTACHMENT_QUALITIES){
  const e=weaponAttachmentQualityEffects({scope:variant('scope-4x',q.id),grip:variant('vertical-grip',q.id),magazine:variant('extended-mag',q.id),barrel:variant('suppressor',q.id)});
  assert.ok(Math.abs(e.accuracyBonus-(.1+.2*q.factor))<1e-10);assert.equal(e.rangeMultiplier,1.2);assert.equal(e.magazineMultiplier,1+.3*q.factor);assert.equal(e.reloadMultiplier,1-.15*q.factor);assert.equal(e.noiseMultiplier,Math.max(.05,1-(1-12/38)*q.factor));assert.equal(e.suppressed,true);
 }
});

test('pouch grades add capacity only in available armor sockets',()=>{
 const gear={armor:'armor-6','armor:0':'tactical-pouch','armor:1':'tactical-pouch-improved','armor:2':'tactical-pouch-refined'};
 assert.equal(armorAttachmentEffects(gear,lookup).capacity,120);
 assert.equal(armorAttachmentEffects({...gear,armor:'armor-1'},lookup).capacity,30);
 assert.equal(armorAttachmentEffects({...gear,armor:null},lookup).capacity,0);
});
