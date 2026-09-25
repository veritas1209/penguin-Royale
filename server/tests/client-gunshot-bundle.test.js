import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bundle=readFileSync(new URL('../../dist/assets/index-caliber-audio-01.js',import.meta.url),'utf8');
test('production bundle exposes every caliber in normal and suppressed gunshot profiles',()=>{
 for(const ammo of ['ammo-9','ammo-45','ammo-57','ammo-556','ammo-762','ammo-300','ammo-50','ammo-12','ammo-bolt'])assert.ok(bundle.includes(ammo),ammo);
 assert.ok(bundle.includes('suppressed'));assert.ok(bundle.includes("weapon === 'awm'"));assert.ok(bundle.includes("weapon === 'lynx-amr'"));
});
test('production bundle routes remote gunshot events and local fire exactly once',()=>{
 assert.match(bundle,/kind===.gunshot./);assert.match(bundle,/eventKey:.server:/);
 assert.equal((bundle.match(/\.play\(.shot.\)/g)??[]).length,0);assert.equal((bundle.match(/Jg\.gunshot\(/g)??[]).length,2);
});
