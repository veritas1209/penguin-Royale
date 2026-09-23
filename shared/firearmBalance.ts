import type {ItemDef} from './catalog.ts';
/** World-space tolerance remains the same at every camera zoom level. */
export const FIREARM_HIT_RADIUS = 0.95;
export function firearmSpread(weapon: Pick<ItemDef, 'family'|'spread'|'pellets'>) {
  const family = weapon.family?.toUpperCase();
  const multiplier = (weapon.pellets ?? 1) > 1 ? 1 : family === 'SR' ? 0.35 : family === 'DMR' ? 0.4 : family === 'AR' ? 1.2 : family === 'PISTOL' ? 1.4 : 1;
  return (weapon.spread ?? 0.01) * multiplier;
}
export function firearmRange(weapon: Pick<ItemDef, 'family'|'range'|'ammo'|'mode'>) {
  const base = weapon.range ?? 35;
  if (!weapon.ammo || ['ammo-bolt', 'ammo-40', 'ammo-flare'].includes(weapon.ammo) || ['melee', 'flare', 'throw'].includes(weapon.mode ?? '')) return base;
  const family = weapon.family?.toUpperCase();
  return Math.max(base * 1.25, family === 'SR' ? 65 : family === 'DMR' ? 55 : 0);
}
export const PLAYER_SR_FIRE_COOLDOWN_MS = Object.freeze({
  kar98k: 1500,
  m24: 1500,
  awm: 2000,
  win94: 1000,
  'lynx-amr': 2300,
});
export function playerFireCooldown(weapon: Pick<ItemDef, 'id'|'baseId'|'family'|'fireRate'>) {
  const base=String(weapon.baseId??weapon.id??'').toLowerCase().replace(/-(broken|repaired|improved|refined)(?:-gold-lv[1-3])?$/,'').replace(/-gold-lv[1-3]$/,'');
  if(weapon.family?.toUpperCase()==='SR' && base in PLAYER_SR_FIRE_COOLDOWN_MS)return PLAYER_SR_FIRE_COOLDOWN_MS[base as keyof typeof PLAYER_SR_FIRE_COOLDOWN_MS];
  return 1000/Math.max(weapon.fireRate??2,.2);
}
