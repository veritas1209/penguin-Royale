import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainSource=fs.readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8');
const secureSource=fs.readFileSync(new URL('../../src/secureUI.ts',import.meta.url),'utf8');

test('UI removes redundant secure-container and equipment guidance copy',()=>{
  const forbidden=[
    '40 용량 · 사망해도 내용물 회수',
    '장비 총무게 ${weights.total} · 부착물',
    '장비별 25% 손실',
    '배낭 전부 손실',
    '암호상자 100% 보존',
    '장착 장비는<br>배낭 용량에서 제외',
    '장착 장비와 배낭은 각각 표시됩니다.',
    '사망해도 100% 회수'
  ];
  for(const copy of forbidden){
    assert.equal(mainSource.includes(copy),false,`main.ts still contains: ${copy}`);
    assert.equal(secureSource.includes(copy),false,`secureUI.ts still contains: ${copy}`);
  }
});

test('weapon inspector uses catalog name and family format',()=>{
  assert.match(mainSource,/inspectDescription=\(item\?:ItemDef\)=>item\?\.category==='weapon'/);
  assert.match(secureSource,/inspectDescription=\(item\?:ItemDef\)=>item\?\.category==='weapon'/);
  assert.match(mainSource,/esc\(inspectDescription\(focus\)\)/);
  assert.match(secureSource,/esc\(inspectDescription\(item\)\)/);
});