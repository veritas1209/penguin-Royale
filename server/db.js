import {flattenFittedStacks} from '../shared/fittedInventory.ts';
import {weaponFitsSlot} from '../shared/weaponSlots.ts';
import {talentBonus} from '../shared/talents.ts';
import {armorSlotCount,armorAttachmentsFromEquipment,armorAttachmentEffects} from '../shared/armorAttachments.ts';
import {SECURE_CAPACITY,inventoryCapacity} from '../shared/metroInventory.ts';
import {secureCapacityForGear} from '../shared/goldEquipment.ts';
import {materializeGoldItem} from '../shared/catalog.ts';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import {installItemInstances} from './itemInstances.js';
import {equipmentLossPlan,EQUIPMENT_LOSS_CHANCE} from './settlementLoss.js';
import {WEAPON_ATTACHMENT_SLOTS,weaponAttachmentsFromEquipment,supportsWeaponAttachment} from '../shared/weaponAttachments.ts';

export class GameDatabase {
  constructor(path = 'penguin-extraction.sqlite', {lossRandom=Math.random,bagLossChance=1,upgradeRandom=Math.random} = {}) {
    this.lossRandom=lossRandom;this.bagLossChance=bagLossChance;this.upgradeRandom=upgradeRandom;
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_salt BLOB NOT NULL,
        password_hash BLOB NOT NULL,
        currency INTEGER NOT NULL DEFAULT 2500 CHECK(currency >= 0),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity >= 0),
        PRIMARY KEY(user_id, item_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS equipped (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slot TEXT NOT NULL,
        item_id TEXT,
        PRIMARY KEY(user_id, slot)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS item_instances (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,item_id TEXT NOT NULL,fittings_json TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'stash',slot TEXT) STRICT;
      CREATE TABLE IF NOT EXISTS item_instance_gold_traits (instance_id TEXT PRIMARY KEY REFERENCES item_instances(id) ON DELETE CASCADE,traits_json TEXT NOT NULL DEFAULT '{}') STRICT;
      CREATE TABLE IF NOT EXISTS packed (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        PRIMARY KEY(user_id,item_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS secure_packed (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
        PRIMARY KEY(user_id,item_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS talents (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        talent_id TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1 CHECK(level > 0),
        PRIMARY KEY(user_id, talent_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS stats (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        raids INTEGER NOT NULL DEFAULT 0,
        extracts INTEGER NOT NULL DEFAULT 0,
        deaths INTEGER NOT NULL DEFAULT 0,
        kills INTEGER NOT NULL DEFAULT 0
      ) STRICT;
      CREATE TABLE IF NOT EXISTS raids (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        settled_at INTEGER
      ) STRICT;
      CREATE TABLE IF NOT EXISTS raid_escrow (
        raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gear_json TEXT NOT NULL,
        loot_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        PRIMARY KEY(raid_id, user_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS raid_settlements (
        raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        outcome TEXT NOT NULL,
        settled_at INTEGER NOT NULL,
        PRIMARY KEY(raid_id, user_id)
      ) STRICT;
    `);
    const settlementColumns=new Set(this.db.prepare('PRAGMA table_info(raid_settlements)').all().map(row=>row.name));
    if(!settlementColumns.has('result_json'))this.db.exec("ALTER TABLE raid_settlements ADD COLUMN result_json TEXT NOT NULL DEFAULT '{}'");
    const escrowColumns=new Set(this.db.prepare('PRAGMA table_info(raid_escrow)').all().map(row=>row.name));
    if(!escrowColumns.has('secure_json'))this.db.exec("ALTER TABLE raid_escrow ADD COLUMN secure_json TEXT NOT NULL DEFAULT '[]'");
    this.transaction(()=>{
      for(const row of this.db.prepare("SELECT user_id,item_id FROM equipped WHERE slot='vest'").all()){
        const free=[0,1,2].find(i=>!this.db.prepare('SELECT 1 FROM equipped WHERE user_id=? AND slot=? AND item_id IS NOT NULL').get(row.user_id,`armor:${i}`));
        if(free!==undefined){this.db.prepare('DELETE FROM equipped WHERE user_id=? AND slot=? AND item_id IS NULL').run(row.user_id,`armor:${free}`);this.db.prepare("UPDATE equipped SET slot=? WHERE user_id=? AND slot='vest'").run(`armor:${free}`,row.user_id);}
        else this.db.prepare("DELETE FROM equipped WHERE user_id=? AND slot='vest'").run(row.user_id); // Reservation only: inventory ownership stays unchanged.
      }
      for(const slot of WEAPON_ATTACHMENT_SLOTS){
        this.db.prepare('INSERT INTO equipped(user_id,slot,item_id) SELECT user_id,?,item_id FROM equipped WHERE slot=? ON CONFLICT(user_id,slot) DO NOTHING').run(`primary:${slot}`,slot);
        this.db.prepare('DELETE FROM equipped WHERE slot=?').run(slot);
      }
      for(const row of this.db.prepare("SELECT raid_id,user_id,gear_json,loot_json FROM raid_escrow WHERE status='active'").all()){
        const gear=JSON.parse(row.gear_json);let changed=false;
        const loot=JSON.parse(row.loot_json||'[]');
        for(const stack of [...gear])if(stack.slot==='vest'){
          const free=[0,1,2].find(i=>!gear.some(s=>s!==stack&&s.slot===`armor:${i}`));
          if(free!==undefined)stack.slot=`armor:${free}`;
          else{gear.splice(gear.indexOf(stack),1);const bag=loot.find(s=>s.itemId===stack.itemId);if(bag)bag.quantity+=stack.quantity??1;else loot.push({itemId:stack.itemId,quantity:stack.quantity??1});}
          changed=true;
        }
        for(const stack of gear)if(WEAPON_ATTACHMENT_SLOTS.includes(stack.slot)){stack.slot=`primary:${stack.slot}`;changed=true;}
        if(changed)this.db.prepare('UPDATE raid_escrow SET gear_json=?,loot_json=? WHERE raid_id=? AND user_id=?').run(JSON.stringify(gear),JSON.stringify(loot),row.raid_id,row.user_id);
      }
    });
  }

  retireLegacyRadiationEquipment() {
    this.db.exec('CREATE TABLE IF NOT EXISTS catalog_migrations (id TEXT PRIMARY KEY) STRICT');
    const id = 'metro-rarity-20260915';
    if (this.db.prepare('SELECT id FROM catalog_migrations WHERE id=?').get(id)) return;
    this.transaction(() => {
      const legacy = this.db.prepare("SELECT user_id,quantity FROM inventory WHERE item_id='armor-6-lead'").all();
      for (const row of legacy) {
        this.db.prepare('INSERT INTO inventory VALUES (?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(row.user_id,'armor-6',row.quantity);
        this.db.prepare('UPDATE users SET currency=currency+? WHERE id=?').run(14000*row.quantity,row.user_id);
      }
      this.db.prepare("DELETE FROM inventory WHERE item_id='armor-6-lead'").run();
      this.db.prepare("UPDATE equipped SET item_id='armor-6' WHERE item_id='armor-6-lead'").run();
      for (const row of this.db.prepare('SELECT raid_id,user_id,gear_json,loot_json,status FROM raid_escrow').all()) {
        const gear=JSON.parse(row.gear_json),loot=JSON.parse(row.loot_json);let changed=false,refund=0;
        for(const stack of [...gear,...loot])if(stack.itemId==='armor-6-lead'){stack.itemId='armor-6';changed=true;if(row.status==='active')refund+=14000*(stack.quantity??1);}
        if(changed)this.db.prepare('UPDATE raid_escrow SET gear_json=?,loot_json=? WHERE raid_id=? AND user_id=?').run(JSON.stringify(gear),JSON.stringify(loot),row.raid_id,row.user_id);
        if(refund)this.db.prepare('UPDATE users SET currency=currency+? WHERE id=?').run(refund,row.user_id);
      }
      for(const row of this.db.prepare("SELECT user_id,level FROM talents WHERE talent_id='radiation-resistance'").all())this.db.prepare('UPDATE users SET currency=currency+? WHERE id=?').run(26000*Math.min(1,row.level),row.user_id);
      this.db.prepare("DELETE FROM talents WHERE talent_id='radiation-resistance'").run();
      this.db.prepare('INSERT INTO catalog_migrations VALUES (?)').run(id);
    });
  }

  retireDurabilityGoldWeapons() {
    this.db.exec('CREATE TABLE IF NOT EXISTS catalog_migrations (id TEXT PRIMARY KEY) STRICT');
    const id='remove-gold-durability-20260916';
    if(this.db.prepare('SELECT id FROM catalog_migrations WHERE id=?').get(id))return;
    const convert=itemId=>typeof itemId==='string'?itemId.replace(/-gold-durable-l([123])$/,'-gold-smart-l$1'):itemId;
    this.transaction(()=>{
      for(const table of ['inventory','packed','secure_packed']){
        const rows=this.db.prepare('SELECT user_id,item_id,quantity FROM '+table+" WHERE item_id LIKE '%-gold-durable-l_'").all();
        for(const row of rows){const target=convert(row.item_id);this.db.prepare('INSERT INTO '+table+' VALUES (?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity').run(row.user_id,target,row.quantity);this.db.prepare('DELETE FROM '+table+' WHERE user_id=? AND item_id=?').run(row.user_id,row.item_id);}
      }
      this.db.prepare("UPDATE equipped SET item_id=replace(item_id,'-gold-durable-','-gold-smart-') WHERE item_id LIKE '%-gold-durable-l_'").run();
      this.db.prepare("UPDATE item_instances SET item_id=replace(item_id,'-gold-durable-','-gold-smart-') WHERE item_id LIKE '%-gold-durable-l_'").run();
      for(const row of this.db.prepare('SELECT raid_id,user_id,gear_json,loot_json,secure_json FROM raid_escrow').all()){
        const rewrite=value=>value.replace(/-gold-durable-l([123])/g,'-gold-smart-l$1');
        const gear=rewrite(row.gear_json),loot=rewrite(row.loot_json),secure=rewrite(row.secure_json);
        if(gear!==row.gear_json||loot!==row.loot_json||secure!==row.secure_json)this.db.prepare('UPDATE raid_escrow SET gear_json=?,loot_json=?,secure_json=? WHERE raid_id=? AND user_id=?').run(gear,loot,secure,row.raid_id,row.user_id);
      }
      for(const row of this.db.prepare('SELECT raid_id,user_id,result_json FROM raid_settlements').all()){const result=row.result_json.replace(/-gold-durable-l([123])/g,'-gold-smart-l$1');if(result!==row.result_json)this.db.prepare('UPDATE raid_settlements SET result_json=? WHERE raid_id=? AND user_id=?').run(result,row.raid_id,row.user_id);}
      this.db.prepare('INSERT INTO catalog_migrations VALUES (?)').run(id);
    });
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  createUser(username, salt, passwordHash, starterItems = [], starterEquipped = {}, starterPacked = []) {
    const id = randomUUID();
    const now = Date.now();
    return this.transaction(() => {
      this.db.prepare('INSERT INTO users(id,username,password_salt,password_hash,created_at) VALUES(?,?,?,?,?)')
        .run(id, username, salt, passwordHash, now);
      this.db.prepare('INSERT INTO stats(user_id) VALUES(?)').run(id);
      const add = this.db.prepare('INSERT INTO inventory(user_id,item_id,quantity) VALUES(?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity');
      for (const stack of starterItems) add.run(id, stack.itemId, stack.quantity);
      const equip = this.db.prepare('INSERT INTO equipped(user_id,slot,item_id) VALUES(?,?,?)');
      for (const [slot, itemId] of Object.entries(starterEquipped)) if (itemId) equip.run(id, slot, itemId);
      for(const stack of starterPacked) if(stack.quantity>0 && this.inventoryQuantity(id,stack.itemId)>=stack.quantity)this.db.prepare('INSERT INTO packed VALUES (?,?,?)').run(id,stack.itemId,stack.quantity);
      return this.getUserById(id);
    });
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username=?').get(username);
  }

  getUserById(id) {
    return this.db.prepare('SELECT id,username,currency,created_at FROM users WHERE id=?').get(id);
  }

  createSession(tokenHash, userId, expiresAt) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
      this.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash, userId, expiresAt);
    });
  }

  getSession(tokenHash, now = Date.now()) {
    return this.db.prepare(`SELECT u.id,u.username,u.currency,s.expires_at
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash, now);
  }

  deleteSession(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
  }

  profile(userId) {
    const user = this.getUserById(userId);
    if (!user) return null;
    const instanceProfile=this.instanceProfile(userId);
    const stash = this.db.prepare('SELECT item_id AS itemId,quantity FROM inventory WHERE user_id=? AND quantity>0 ORDER BY item_id').all(userId);
    const equipped = Object.fromEntries(this.db.prepare('SELECT slot,item_id AS itemId FROM equipped WHERE user_id=?').all(userId).map((r) => [r.slot, r.itemId]));
    const talents = this.db.prepare('SELECT talent_id AS talentId,level FROM talents WHERE user_id=? ORDER BY talent_id').all(userId);
    const stats = this.db.prepare('SELECT raids,extracts,deaths,kills FROM stats WHERE user_id=?').get(userId);
    const packed = this.db.prepare('SELECT item_id AS itemId,quantity FROM packed WHERE user_id=? ORDER BY item_id').all(userId);
    const securePacked=this.db.prepare('SELECT item_id AS itemId,quantity FROM secure_packed WHERE user_id=? ORDER BY item_id').all(userId);
    const instanceBySlot=new Map(instanceProfile.instances.filter(row=>row.status==='equipped'&&row.slot).map(row=>[row.slot,row]));
    const lookup=id=>{const slot=Object.entries(equipped).find(([,itemId])=>itemId===id)?.[0],stored=slot?instanceBySlot.get(slot):null,base=this.instanceCatalog?.get(id);return materializeGoldItem(base,stored?.goldTraitLevels);};
    const secureCapacity=this.instanceCatalog?secureCapacityForGear(equipped,lookup,SECURE_CAPACITY):SECURE_CAPACITY;
    return { ...instanceProfile,currency: user.currency, stash, equipped, lastSettlement:this.latestRaidSettlement(userId), weaponAttachments:weaponAttachmentsFromEquipment(equipped),armorAttachments:armorAttachmentsFromEquipment(equipped), packed, securePacked,secureCapacity,talents,stats };
  }

  assertNotRaiding(userId) {
    if(this.db.prepare("SELECT 1 FROM raid_escrow WHERE user_id=? AND status='active'").get(userId))throw Object.assign(new Error('출격 중에는 적재와 장비를 변경할 수 없습니다.'),{code:'RAID_ACTIVE'});
  }

  migratePackedConsumables() {
    // Legacy medical/throwable slots become one explicitly visible packed stack.
    this.transaction(()=>{
      for(const row of this.db.prepare("SELECT user_id,item_id FROM equipped WHERE slot IN ('medical','throwable') AND item_id IS NOT NULL").all()){
        if(this.inventoryQuantity(row.user_id,row.item_id)>0)this.db.prepare('INSERT INTO packed VALUES (?,?,1) ON CONFLICT(user_id,item_id) DO NOTHING').run(row.user_id,row.item_id);
      }
      this.db.prepare("DELETE FROM equipped WHERE slot IN ('medical','throwable')").run();
    });
  }

  reconcilePacked(userId){this.reconcileLoadout(userId);}

  reconcileLoadout(userId){
    const owned=new Map(this.db.prepare('SELECT item_id AS itemId,quantity FROM inventory WHERE user_id=?').all(userId).map(r=>[r.itemId,r.quantity])),used=new Map();
    for(const row of this.db.prepare('SELECT slot,item_id AS itemId FROM equipped WHERE user_id=? AND item_id IS NOT NULL ORDER BY slot').all(userId)){
      const count=used.get(row.itemId)??0;
      if(count<(owned.get(row.itemId)??0))used.set(row.itemId,count+1);
      else this.db.prepare('DELETE FROM equipped WHERE user_id=? AND slot=?').run(userId,row.slot);
    }
    for(const table of ['secure_packed','packed'])for(const row of this.db.prepare(`SELECT item_id AS itemId,quantity FROM ${table} WHERE user_id=? ORDER BY item_id`).all(userId)){
      const remaining=Math.max(0,(owned.get(row.itemId)??0)-(used.get(row.itemId)??0)),kept=Math.min(row.quantity,remaining);
      if(kept){this.db.prepare(`UPDATE ${table} SET quantity=? WHERE user_id=? AND item_id=?`).run(kept,userId,row.itemId);used.set(row.itemId,(used.get(row.itemId)??0)+kept);}
      else this.db.prepare(`DELETE FROM ${table} WHERE user_id=? AND item_id=?`).run(userId,row.itemId);
    }
  }

  reservedQuantity(userId,itemId,exclude=null){
    const equipped=this.db.prepare('SELECT count(*) AS n FROM equipped WHERE user_id=? AND item_id=?').get(userId,itemId).n;
    const packed=exclude==='packed'?0:(this.db.prepare('SELECT quantity FROM packed WHERE user_id=? AND item_id=?').get(userId,itemId)?.quantity??0);
    const secure=exclude==='secure'?0:(this.db.prepare('SELECT quantity FROM secure_packed WHERE user_id=? AND item_id=?').get(userId,itemId)?.quantity??0);
    const mirrored=this.db.prepare("SELECT count(*) AS n FROM equipped WHERE user_id=? AND item_id=? AND slot LIKE '%:%'").get(userId,itemId).n;
    return equipped-mirrored+this.instanceReserved(userId,itemId)+packed+secure;
  }

  packedCapacity(profile,catalog) {
    const bag=catalog.byId.get(profile.equipped.backpack),vest=profile.equipped.armor?catalog.byId.get(profile.equipped.vest):null;
    const bonus=(profile.talents??[]).reduce((sum,row)=>{const t=catalog.talents.find(t=>t.id===row.talentId);return sum+(t?.effect==='capacity'?talentBonus(t,row.level):0);},0);
    return inventoryCapacity(bag?.capacity??0,bonus,armorAttachmentEffects(profile.equipped,id=>catalog.byId.get(id)).capacity);
  }

  pack(userId,itemId,quantity,catalog) {
    return this.transaction(()=>{
      this.assertNotRaiding(userId);
      const item=catalog.byId.get(itemId);
      if(!item||!(['ammo','medical','throwable'].includes(item.category)||/^password-letter-(white|red|yellow|green|black)$/.test(item.id)))throw Object.assign(new Error('탄약, 의료품, 투척물, 암호문만 가방에 적재할 수 있습니다.'),{code:'INVALID_PACK_ITEM'});
      if(!Number.isSafeInteger(quantity)||quantity<0||quantity>10000)throw Object.assign(new Error('적재 수량이 올바르지 않습니다.'),{code:'INVALID_QUANTITY'});
      if(this.inventoryQuantity(userId,itemId)<this.reservedQuantity(userId,itemId,'packed')+quantity)throw Object.assign(new Error('보관함 수량이 부족합니다.'),{code:'INSUFFICIENT_ITEMS'});
      const p=this.profile(userId);
      const weight=p.packed.filter(s=>s.itemId!==itemId).reduce((n,s)=>n+(catalog.byId.get(s.itemId)?.weight??0)*s.quantity,0)+(item.weight??0)*quantity;
      if(quantity>(p.packed.find(s=>s.itemId===itemId)?.quantity??0)&&weight>this.packedCapacity(p,catalog)+.000001)throw Object.assign(new Error('가방 적재 용량을 초과했습니다.'),{code:'OVER_CAPACITY'});
      if(quantity===0)this.db.prepare('DELETE FROM packed WHERE user_id=? AND item_id=?').run(userId,itemId);
      else this.db.prepare('INSERT INTO packed VALUES (?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=excluded.quantity').run(userId,itemId,quantity);
      return this.profile(userId);
    });
  }

  secure(userId,itemId,quantity,catalog){
    return this.transaction(()=>{
      this.assertNotRaiding(userId);const item=catalog.byId.get(itemId);
      if(!item)throw Object.assign(new Error('Unknown item'),{code:'ITEM_NOT_FOUND'});
      if(!Number.isSafeInteger(quantity)||quantity<0||quantity>10000)throw Object.assign(new Error('암호상자 수량이 올바르지 않습니다.'),{code:'INVALID_QUANTITY'});
      if(this.inventoryQuantity(userId,itemId)<this.reservedQuantity(userId,itemId,'secure')+quantity)throw Object.assign(new Error('장비 또는 다른 적재에 예약된 수량을 제외하면 부족합니다.'),{code:'INSUFFICIENT_ITEMS'});
      const others=this.db.prepare('SELECT item_id AS itemId,quantity FROM secure_packed WHERE user_id=? AND item_id<>?').all(userId,itemId),stacks=quantity?[...others,{itemId,quantity}]:others;
      const secureCapacity=this.profile(userId).secureCapacity??SECURE_CAPACITY;
      if(quantity>(this.db.prepare('SELECT quantity FROM secure_packed WHERE user_id=? AND item_id=?').get(userId,itemId)?.quantity??0)&&stacks.reduce((sum,s)=>sum+(catalog.byId.get(s.itemId)?.weight??0)*s.quantity,0)>secureCapacity+.000001)throw Object.assign(new Error(`암호상자의 ${secureCapacity} 용량을 초과했습니다.`),{code:'SECURE_OVER_CAPACITY'});
      if(quantity===0)this.db.prepare('DELETE FROM secure_packed WHERE user_id=? AND item_id=?').run(userId,itemId);
      else this.db.prepare('INSERT INTO secure_packed VALUES (?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=excluded.quantity').run(userId,itemId,quantity);
      return this.profile(userId);
    });
  }

  inventoryQuantity(userId, itemId) {
    return this.db.prepare('SELECT quantity FROM inventory WHERE user_id=? AND item_id=?').get(userId, itemId)?.quantity ?? 0;
  }

  addInventory(userId, itemId, quantity) {
    this.db.prepare(`INSERT INTO inventory(user_id,item_id,quantity) VALUES(?,?,?)
      ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=quantity+excluded.quantity`).run(userId, itemId, quantity);
  }

  removeInventory(userId, itemId, quantity) {
    const result = this.db.prepare('UPDATE inventory SET quantity=quantity-? WHERE user_id=? AND item_id=? AND quantity>=?')
      .run(quantity, userId, itemId, quantity);
    if (Number(result.changes) !== 1) throw Object.assign(new Error('Not enough items'), { code: 'INSUFFICIENT_ITEMS' });
    this.db.prepare('DELETE FROM inventory WHERE user_id=? AND item_id=? AND quantity=0').run(userId, itemId);
  }

  purchase(userId, itemId, quantity, total) {
    return this.transaction(() => {
      const paid = this.db.prepare('UPDATE users SET currency=currency-? WHERE id=? AND currency>=?').run(total, userId, total);
      if (Number(paid.changes) !== 1) throw Object.assign(new Error('Not enough currency'), { code: 'INSUFFICIENT_CURRENCY' });
      this.addInventory(userId, itemId, quantity);
      return this.profile(userId);
    });
  }

  sell(userId, itemId, quantity, total, instanceId = null, options = {}) {
    return this.transaction(() => {
      this.assertNotRaiding(userId);
      this.syncInstances(userId);let fittedParts=[];
      if(this.isInstanceItem(itemId)){
        if(instanceId&&quantity!==1)throw Object.assign(new Error('개별 장비는 한 개씩 판매하세요.'),{code:'INVALID_QUANTITY'});
        const candidates=instanceId?[this.selectInstance(userId,itemId,instanceId)]:this.instanceRows(userId).filter(r=>r.itemId===itemId&&r.status==='stash').slice(0,quantity);
        if(candidates.length!==quantity)throw Object.assign(new Error('여분 장비가 부족합니다.'),{code:'INSUFFICIENT_ITEMS'});
        fittedParts=candidates.flatMap(r=>Object.values(r.fittings??{}));if(this.instanceCatalog.get(itemId)?.category==='armor'&&fittedParts.length&&!options.includeFittings)throw Object.assign(new Error('장착 파츠까지 함께 판매할지 확인하세요.'),{code:'FITTINGS_CONFIRM_REQUIRED'});
        for(const r of candidates){if(r.status!=='stash')throw Object.assign(new Error('장비를 먼저 해제하세요.'),{code:'INSTANCE_EQUIPPED'});this.db.prepare('DELETE FROM item_instances WHERE id=?').run(r.id);}
      }else if(this.inventoryQuantity(userId,itemId)-this.instanceReserved(userId,itemId)<quantity)throw Object.assign(new Error('예약된 물품은 먼저 해제하세요.'),{code:'ITEM_RESERVED'});
      this.removeInventory(userId, itemId, quantity);
      if(options.includeFittings)for(const partId of fittedParts)this.removeInventory(userId,partId,1);
      if(options.catalog){const base=options.catalog.byId.get(itemId)?.sell??0,parts=(options.includeFittings?fittedParts:[]).reduce((sum,id)=>sum+(options.catalog.byId.get(id)?.sell??0),0);total=Math.floor((base*quantity+parts)*(1+(options.multiplier??0)));}
      this.reconcilePacked(userId);
      this.db.prepare('UPDATE users SET currency=currency+? WHERE id=?').run(total, userId);
      return this.profile(userId);
    });
  }

  dismantleGold(userId,itemId,instanceId,catalog){
    return this.transaction(()=>{
      this.assertNotRaiding(userId);this.instanceCatalog=catalog.byId;
      const item=catalog.byId.get(itemId);if(item?.quality!=='gold')throw Object.assign(new Error('골드 장비만 분해할 수 있습니다.'),{code:'NOT_GOLD'});
      const instance=this.selectInstance(userId,itemId,instanceId);if(instance.status!=='stash')throw Object.assign(new Error('장비를 먼저 해제하세요.'),{code:'INSTANCE_EQUIPPED'});
      this.db.prepare('DELETE FROM item_instances WHERE id=?').run(instance.id);this.removeInventory(userId,itemId,1);this.addInventory(userId,'gold-upgrade-part',1);this.reconcilePacked(userId);
      return this.profile(userId);
    });
  }

  upgradeGold(userId,itemId,instanceId,catalog){
    return this.transaction(()=>{
      this.assertNotRaiding(userId);this.instanceCatalog=catalog.byId;
      const item=catalog.byId.get(itemId);if(item?.quality!=='gold')throw Object.assign(new Error('골드 장비만 강화할 수 있습니다.'),{code:'NOT_GOLD'});
      const instance=this.selectInstance(userId,itemId,instanceId),levels={...(instance.goldTraitLevels??item.goldTraitLevels??{})},category=item.category;
      const allowed=category==='weapon'?['smart','precision','penetration','magazine','reload']:category==='helmet'?['helmet-tactical-lens','helmet-armor-set','helmet-composite-fiber','helmet-thick']:category==='armor'?['armor-ergonomics','armor-armor-set','armor-fireproof','armor-lead','armor-blastproof','armor-thick']:category==='backpack'?['backpack-elastic','backpack-encryption','backpack-advanced-elastic','backpack-advanced-encryption','backpack-first-aid','backpack-module-search']:[];
      const binary=new Set(['helmet-tactical-lens','armor-lead']),missing=allowed.filter(trait=>levels[trait]===undefined),levellable=Object.keys(levels).filter(trait=>!binary.has(trait)&&(levels[trait]??0)<3),canAdd=Object.keys(levels).length<4&&missing.length>0;
      if(!canAdd&&!levellable.length)throw Object.assign(new Error('이미 최대 강화 상태입니다.'),{code:'MAX_UPGRADE'});
      if(this.inventoryQuantity(userId,'gold-upgrade-part')<1)throw Object.assign(new Error('업그레이드 부품이 필요합니다.'),{code:'MISSING_UPGRADE_PART'});
      const addTriggered=this.upgradeRandom()<.15,levelTriggered=this.upgradeRandom()<.5,next={...levels},leveledTraits=[];let addedTrait=null;
      if(levelTriggered&&levellable.length){const trait=levellable[Math.min(levellable.length-1,Math.floor(this.upgradeRandom()*levellable.length))];next[trait]=Math.min(3,next[trait]+1);leveledTraits.push(trait);}
      if(addTriggered&&canAdd){addedTrait=missing[Math.min(missing.length-1,Math.floor(this.upgradeRandom()*missing.length))];const levelRoll=this.upgradeRandom(),addedLevel=binary.has(addedTrait)?1:levelRoll<.5?1:levelRoll<.8?2:3;next[addedTrait]=addedLevel;}
      const added=!!addedTrait,leveled=leveledTraits.length>0,outcome=added&&leveled?'added_and_leveled':added?'added':leveled?'leveled':'unchanged';
      this.removeInventory(userId,'gold-upgrade-part',1);
      this.db.prepare('INSERT INTO item_instance_gold_traits(instance_id,traits_json) VALUES(?,?) ON CONFLICT(instance_id) DO UPDATE SET traits_json=excluded.traits_json').run(instance.id,JSON.stringify(next));
      return {profile:this.profile(userId),outcome,itemId,targetId:itemId,beforeTraits:{...levels},afterTraits:{...next},addedTrait,leveledTraits};
    });
  }

  sellCollectibles(userId,catalog,multiplier=0){
    return this.transaction(()=>{
      this.assertNotRaiding(userId);let total=0,count=0;
      const rows=this.db.prepare('SELECT item_id AS itemId,quantity FROM inventory WHERE user_id=?').all(userId);
      for(const row of rows){const item=catalog.byId.get(row.itemId);if(item?.category!=='valuable'||/^password-letter-/.test(item.id))continue;const quantity=Math.max(0,row.quantity-this.reservedQuantity(userId,row.itemId));if(!quantity)continue;this.removeInventory(userId,row.itemId,quantity);total+=Math.floor(item.sell*quantity*(1+multiplier));count+=quantity;}
      if(total)this.db.prepare('UPDATE users SET currency=currency+? WHERE id=?').run(total,userId);
      return {profile:this.profile(userId),sold:count,total};
    });
  }

  equip(userId, slot, itemId, catalog = null, instanceId = null, hostInstanceId = null) {
    return this.transaction(() => {
      this.assertNotRaiding(userId);
      if(WEAPON_ATTACHMENT_SLOTS.includes(slot))slot=`primary:${slot}`;
      if(slot==='vest')slot='armor:0';
      if(catalog)this.instanceCatalog=catalog.byId;
      if(itemId!==null&&['primary','secondary','pistol','melee'].includes(slot)&&!weaponFitsSlot(this.instanceCatalog.get(itemId),slot))throw Object.assign(new Error('장비 슬롯과 호환되지 않습니다.'),{code:'INCOMPATIBLE_SLOT'});
      this.syncInstances(userId);
      const target=hostInstanceId?this.instanceRows(userId).find(r=>r.id===hostInstanceId&&r.status!=='raid'):null;
      if(hostInstanceId&&!target)throw Object.assign(new Error('개별 장비가 없습니다.'),{code:'ITEM_NOT_OWNED'});
      const armorFit=slot.match(/^armor:([0-2])$/);
      if(armorFit&&itemId!==null){const gear=this.profile(userId).equipped,armor=catalog?.byId.get(target?.itemId??gear.armor),part=catalog?.byId.get(itemId);if(Number(armorFit[1])>=armorSlotCount(armor)||part?.category!=='attachment'||part.slot!=='vest')throw Object.assign(new Error('방어구 부착물 슬롯과 호환되지 않습니다.'),{code:'INCOMPATIBLE_SLOT'});}
      const fit=slot.match(/^(primary|secondary|pistol):(scope|barrel|grip|magazine)$/);
      if(fit&&itemId!==null){
        const weaponId=this.db.prepare('SELECT item_id AS itemId FROM equipped WHERE user_id=? AND slot=?').get(userId,fit[1])?.itemId;
        const weapon=catalog?.byId.get(target?.itemId??weaponId),part=catalog?.byId.get(itemId);
        if(!weapon||!part||part.category!=='attachment'||part.slot!==fit[2]||!supportsWeaponAttachment(weapon,part))throw Object.assign(new Error('선택한 총기의 파츠 슬롯과 호환되지 않습니다.'),{code:'INCOMPATIBLE_SLOT'});
      }
      if(armorFit||fit){
        if(target&&((armorFit&&catalog.byId.get(target.itemId)?.category!=='armor')||(fit&&catalog.byId.get(target.itemId)?.category!=='weapon')))throw Object.assign(new Error('장비 종류가 맞지 않습니다.'),{code:'INCOMPATIBLE_SLOT'});
        this.saveInstanceFitting(userId,slot,itemId,hostInstanceId);
      }else if(['primary','secondary','pistol','melee','armor','helmet','backpack'].includes(slot)&&(itemId===null||this.isInstanceItem(itemId)))this.switchInstance(userId,slot,itemId,instanceId);
      else{
        const previous=this.db.prepare('SELECT item_id AS itemId FROM equipped WHERE user_id=? AND slot=?').get(userId,slot)?.itemId;
        if(itemId!==null&&this.inventoryQuantity(userId,itemId)<this.reservedQuantity(userId,itemId)+(previous===itemId?0:1))throw Object.assign(new Error('Item is not in stash'),{code:'ITEM_NOT_OWNED'});
        this.db.prepare('INSERT INTO equipped VALUES(?,?,?) ON CONFLICT(user_id,slot) DO UPDATE SET item_id=excluded.item_id').run(userId,slot,itemId);
      }
      if(catalog){const p=this.profile(userId),weight=p.packed.reduce((n,s)=>n+(catalog.byId.get(s.itemId)?.weight??0)*s.quantity,0);if(weight>this.packedCapacity(p,catalog)+.000001)throw Object.assign(new Error('가방의 물품을 먼저 줄여주세요.'),{code:'OVER_CAPACITY'});}
      return this.profile(userId);
    });
  }

  unlockTalent(userId, talentId, nextLevel, cost) {
    return this.transaction(() => {
      const paid = this.db.prepare('UPDATE users SET currency=currency-? WHERE id=? AND currency>=?').run(cost, userId, cost);
      if (Number(paid.changes) !== 1) throw Object.assign(new Error('Not enough currency'), { code: 'INSUFFICIENT_CURRENCY' });
      this.db.prepare(`INSERT INTO talents(user_id,talent_id,level) VALUES(?,?,?)
        ON CONFLICT(user_id,talent_id) DO UPDATE SET level=excluded.level`).run(userId, talentId, nextLevel);
      return this.profile(userId);
    });
  }

  beginRaid(raidId, roomId, userIds, ammoRequests = new Map(), now = Date.now()) {
    return this.transaction(() => {
      this.db.prepare('INSERT INTO raids(id,room_id,status,created_at) VALUES(?,?,?,?)').run(raidId, roomId, 'active', now);
      const escrow = [];
      for (const userId of userIds) {
        this.syncInstances(userId);
        this.reconcileLoadout(userId);
        const rows = this.db.prepare('SELECT slot,item_id AS itemId FROM equipped WHERE user_id=? AND item_id IS NOT NULL').all(userId);
        const instancesBySlot=Object.fromEntries(this.instanceRows(userId).filter(r=>r.status==='equipped').map(r=>[r.slot,r]));
        for(const instance of Object.values(instancesBySlot))this.db.prepare("UPDATE item_instances SET status='raid' WHERE id=?").run(instance.id);
        const counts = new Map();
        for (const row of rows) counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);
        for (const [itemId, quantity] of counts) this.removeInventory(userId, itemId, quantity);
        const gear = rows.map(({ slot, itemId }) => {const instance=instancesBySlot[slot];return {slot,itemId,quantity:1,...(instance?{instanceId:instance.id,goldTraitLevels:instance.goldTraitLevels}:{})};});
        for (const request of ammoRequests.get(userId) ?? []) {
          const available = this.inventoryQuantity(userId, request.itemId);
          const quantity = request.slot ? request.quantity : Math.min(available, request.quantity);
          if(quantity>available)throw Object.assign(new Error('Packed items are missing'),{code:'INSUFFICIENT_ITEMS'});
          if (quantity > 0) {
            this.removeInventory(userId, request.itemId, quantity);
            gear.push({ slot: request.slot ?? 'ammo', itemId: request.itemId, quantity });
          }
        }
        const secure=this.db.prepare('SELECT item_id AS itemId,quantity FROM secure_packed WHERE user_id=? ORDER BY item_id').all(userId);
        for(const stack of secure)this.removeInventory(userId,stack.itemId,stack.quantity);
        this.db.prepare('INSERT INTO raid_escrow(raid_id,user_id,gear_json,secure_json) VALUES(?,?,?,?)').run(raidId,userId,JSON.stringify(gear),JSON.stringify(secure));
        this.db.prepare('UPDATE stats SET raids=raids+1 WHERE user_id=?').run(userId);
        escrow.push({ userId, gear, secure });
      }
      return escrow;
    });
  }

  updateRaidLoot(raidId, userId, loot) {
    this.db.prepare("UPDATE raid_escrow SET loot_json=? WHERE raid_id=? AND user_id=? AND status='active'").run(JSON.stringify(loot), raidId, userId);
  }

  updateRaidSecure(raidId,userId,inventory,secure){
    return this.transaction(()=>{
      if(!this.db.prepare("SELECT 1 FROM raid_escrow WHERE raid_id=? AND user_id=? AND status='active'").get(raidId,userId))throw Object.assign(new Error('Active raid escrow missing'),{code:'ESCROW_MISSING'});
      this.db.prepare("UPDATE raid_escrow SET loot_json=?,secure_json=? WHERE raid_id=? AND user_id=? AND status='active'").run(JSON.stringify(inventory),JSON.stringify(secure),raidId,userId);
      return {inventory,secure};
    });
  }

  updateRaidInventoryState(raidId,userId,inventory,gear,reserveAmmo={},magazines={},loadedAmmo={}){
    return this.transaction(()=>{
      if(!this.db.prepare("SELECT 1 FROM raid_escrow WHERE raid_id=? AND user_id=? AND status='active'").get(raidId,userId))throw Object.assign(new Error('Active raid escrow missing'),{code:'ESCROW_MISSING'});
      const bag=inventory.map(s=>({...s})),ammo={...reserveAmmo};
      for(const slot of ['primary','secondary','pistol'])if(loadedAmmo[slot]&&magazines[slot]>0)ammo[loadedAmmo[slot]]=(ammo[loadedAmmo[slot]]??0)+magazines[slot];
      for(const [itemId,quantity] of Object.entries(ammo))if(quantity>0){const stack=bag.find(s=>s.itemId===itemId);if(stack)stack.quantity+=quantity;else bag.push({itemId,quantity});}
      const equipped=Object.entries(gear).filter(([,itemId])=>itemId).map(([slot,itemId])=>({slot,itemId,quantity:1}));
      this.db.prepare("UPDATE raid_escrow SET gear_json=?,loot_json=? WHERE raid_id=? AND user_id=? AND status='active'").run(JSON.stringify(equipped),JSON.stringify(bag),raidId,userId);
    });
  }

  updateRaidEquipment(raidId,userId,inventory,gear){
    return this.transaction(()=>{
      const row=this.db.prepare("SELECT gear_json FROM raid_escrow WHERE raid_id=? AND user_id=? AND status='active'").get(raidId,userId);
      if(!row)throw Object.assign(new Error('Active raid escrow missing'),{code:'ESCROW_MISSING'});
      const carried=JSON.parse(row.gear_json).filter(s=>s.slot==='ammo'||s.slot==='packed');
      const equipped=Object.entries(gear).filter(([,itemId])=>itemId).map(([slot,itemId])=>({slot,itemId,quantity:1}));
      this.db.prepare("UPDATE raid_escrow SET gear_json=?,loot_json=? WHERE raid_id=? AND user_id=? AND status='active'").run(JSON.stringify([...equipped,...carried]),JSON.stringify(inventory),raidId,userId);
      return {inventory,gear};
    });
  }

  getRaidSettlement(raidId,userId){
    const row=this.db.prepare('SELECT raid_id AS raidId,outcome,settled_at AS settledAt,result_json FROM raid_settlements WHERE raid_id=? AND user_id=?').get(raidId,userId);
    if(!row)return null;
    const result=JSON.parse(row.result_json||'{}');
    return {raidId:row.raidId,outcome:row.outcome,settledAt:row.settledAt,lossReport:result.lossReport??null,finalEquipped:result.finalEquipped??{}};
  }

  latestRaidSettlement(userId){
    const row=this.db.prepare('SELECT raid_id AS raidId FROM raid_settlements WHERE user_id=? ORDER BY settled_at DESC,rowid DESC LIMIT 1').get(userId);
    return row?this.getRaidSettlement(row.raidId,userId):null;
  }

  settleRaidPlayer(raidId, userId, outcome, returnedGear = [], loot = [], kills = 0, recoveryItems = [], finalEquipped = {}, now = Date.now(), runtimeGear = null) {
    return this.transaction(() => {
      const existing=this.getRaidSettlement(raidId,userId);
      if(existing)return {applied:false,...existing};
      if(!['dead','extracted'].includes(outcome))throw Object.assign(new Error('Invalid settlement outcome'),{code:'INVALID_OUTCOME'});
      const escrow=this.db.prepare("SELECT gear_json,loot_json,secure_json FROM raid_escrow WHERE raid_id=? AND user_id=? AND status='active'").get(raidId,userId);
      if(!escrow)throw Object.assign(new Error('Raid escrow missing'),{code:'ESCROW_MISSING'});
      const raidOnlyItems=new Set([
        'signal-flare',
        'ammo-flare'
      ]);

      const keepStack=stack=>
        stack &&
        !raidOnlyItems.has(stack.itemId);

      const rawEscrowGear=
        runtimeGear===null
          ?JSON.parse(escrow.gear_json)
          :Object.entries(runtimeGear)
            .filter(([,itemId])=>itemId)
            .map(([slot,itemId])=>({
              slot,
              itemId,
              quantity:1
            }));

      const escrowGear=
        rawEscrowGear.filter(keepStack);

      const secure=
        JSON.parse(escrow.secure_json||'[]')
         .filter(keepStack);

      const settledReturnedGear=
        returnedGear.filter(keepStack);

      const settledLoot=
        loot.filter(keepStack);

      for(const stack of secure)
        this.addInventory(
          userId,
          stack.itemId,
          stack.quantity
        );

      let equipment=
        Object.fromEntries(
          Object.entries(finalEquipped)
           .filter(([,itemId])=>
             itemId &&
             !raidOnlyItems.has(itemId)
           )
        ),
        lossReport;
      if(outcome==='extracted'){
        for(const stack of settledReturnedGear)this.addInventory(userId,stack.itemId,stack.quantity??1);
        for(const stack of flattenFittedStacks(settledLoot))this.addInventory(userId,stack.itemId,stack.quantity);
        lossReport={lossChance:EQUIPMENT_LOSS_CHANCE,bagLossChance:0,lost:[],retained:[...escrowGear.filter(s=>!['ammo','packed'].includes(s.slot)).map(s=>({itemId:s.itemId,quantity:s.quantity??1,slot:s.slot,source:'equipment'})),...settledLoot.map(s=>({...s,slot:'bag',source:'bag'}))],protected:secure.map(s=>({...s,slot:'secure',source:'secure'})),recovery:[]};
      }else{
        const bag=(
          runtimeGear!==null
            ?settledLoot
            :settledLoot.length
              ?settledLoot
              :JSON.parse(escrow.loot_json||'[]')
        ).filter(keepStack);
        const plan=equipmentLossPlan(escrowGear,bag,secure,this.lossRandom,this.bagLossChance);
        equipment=plan.finalEquipped;lossReport=plan.lossReport;
        for(const stack of plan.returned)this.addInventory(userId,stack.itemId,stack.quantity);
        const recoveryEligible=escrowGear.some(s=>['primary','secondary','pistol'].includes(s.slot));
        if(recoveryEligible&&!equipment.primary&&!equipment.secondary&&!equipment.pistol){
          for(const stack of recoveryItems)this.addInventory(userId,stack.itemId,stack.quantity);
          for(const [slot,itemId] of Object.entries(finalEquipped))if(itemId&&!equipment[slot]&&recoveryItems.some(s=>s.itemId===itemId))equipment[slot]=itemId;
          lossReport.recovery=recoveryItems.map(s=>({...s,slot:Object.entries(equipment).find(([,id])=>id===s.itemId)?.[0]??'bag',source:'recovery'}));
        }
        this.db.prepare('UPDATE users SET currency=max(currency,2500) WHERE id=?').run(userId);
      }
      const raidInstances=this.instanceRows(userId).filter(r=>r.status==='raid');
      const used=new Set();
      for(const [slot,itemId]of Object.entries(equipment))if(this.isInstanceItem(itemId)){
        const r=raidInstances.find(r=>r.itemId===itemId&&r.slot===slot&&!used.has(r.id))??raidInstances.find(r=>r.itemId===itemId&&!used.has(r.id));
        if(r){used.add(r.id);const fittings=Object.fromEntries(Object.entries(equipment).filter(([s,id])=>s.startsWith(slot+':')&&id).map(([s,id])=>[s.slice(slot.length+1),id]));this.db.prepare("UPDATE item_instances SET status='equipped',slot=?,fittings_json=? WHERE id=?").run(slot,JSON.stringify(fittings),r.id);}
      }
      const returnedHosts=(outcome==='extracted'?settledLoot:lossReport.retained.filter(x=>x.source==='bag')).filter(x=>this.isInstanceItem(x.itemId)).map(x=>({...x,available:x.quantity}));
      const signature=parts=>JSON.stringify(Object.entries(parts??{}).sort(([a],[b])=>a.localeCompare(b)));
      const consumeBundle=r=>{
        const candidates=returnedHosts.filter(x=>x.itemId===r.itemId&&x.available>0);
        const bundle=candidates.find(x=>signature(x.fittings)===signature(r.fittings))??candidates[0];
        if(bundle)bundle.available--;return bundle;
      };
      const remaining=new Map();
      for(const stack of (outcome==='extracted'?settledLoot:lossReport.retained.filter(r=>r.source==='bag')))remaining.set(stack.itemId,(remaining.get(stack.itemId)??0)+stack.quantity);
      for(const r of raidInstances)if(!used.has(r.id)){
        if((remaining.get(r.itemId)??0)>0){remaining.set(r.itemId,remaining.get(r.itemId)-1);const bundle=consumeBundle(r);this.db.prepare("UPDATE item_instances SET status='stash',slot=NULL,fittings_json=? WHERE id=?").run(JSON.stringify(bundle?.fittings??{}),r.id);}
        else this.db.prepare('DELETE FROM item_instances WHERE id=?').run(r.id);
      }
      // Materialize newly collected fitted hosts before generic reconciliation makes loose copies.
      const bundles=returnedHosts.filter(x=>x.fittings&&x.available>0);
      for(const bundle of bundles){
        const count=this.instanceRows(userId).filter(r=>r.itemId===bundle.itemId&&r.status!=='raid').length;
        const missing=Math.max(0,this.inventoryQuantity(userId,bundle.itemId)-count);
        for(let i=0;i<Math.min(missing,bundle.available);i++)this.db.prepare("INSERT INTO item_instances VALUES(?,?,?,?,'stash',NULL)").run(randomUUID(),userId,bundle.itemId,JSON.stringify(bundle.fittings));
      }
      this.db.prepare('DELETE FROM equipped WHERE user_id=?').run(userId);
      const equip=this.db.prepare('INSERT INTO equipped(user_id,slot,item_id) VALUES(?,?,?)');
      for(const [slot,itemId] of Object.entries(equipment))if(itemId)equip.run(userId,slot,itemId);
      // Returning to the lobby always empties the secure container.
      // Protected contents were already restored to inventory above.
      this.db.prepare(
       'DELETE FROM secure_packed WHERE user_id=?'
      ).run(userId);
      this.reconcilePacked(userId);
      // Reconciliation is authoritative if an old reservation is no longer owned.
      equipment=this.profile(userId).equipped;
      const stored={lossReport,finalEquipped:equipment};
      this.db.prepare('INSERT INTO raid_settlements(raid_id,user_id,outcome,settled_at,result_json) VALUES(?,?,?,?,?)').run(raidId,userId,outcome,now,JSON.stringify(stored));
      this.db.prepare('UPDATE raid_escrow SET status=? WHERE raid_id=? AND user_id=?').run(outcome,raidId,userId);
      this.db.prepare('UPDATE stats SET extracts=extracts+?,deaths=deaths+?,kills=kills+? WHERE user_id=?').run(outcome==='extracted'?1:0,outcome==='dead'?1:0,kills,userId);
      return {applied:true,outcome,raidId,settledAt:now,...stored};
    });
  }

  markRaidCompleteIfSettled(raidId, now = Date.now()) {
    const remaining = this.db.prepare("SELECT count(*) AS n FROM raid_escrow WHERE raid_id=? AND status='active'").get(raidId).n;
    if (remaining === 0) this.db.prepare("UPDATE raids SET status='settled',settled_at=? WHERE id=?").run(now, raidId);
  }

  recoverActiveRaids(now = Date.now(), recoveryItems = [], recoveryEquipped = {}) {
    const active = this.db.prepare("SELECT raid_id AS raidId,user_id AS userId FROM raid_escrow WHERE status='active'").all();
    for (const row of active) {
      this.settleRaidPlayer(row.raidId, row.userId, 'dead', [], [], 0, recoveryItems, recoveryEquipped, now);
      this.markRaidCompleteIfSettled(row.raidId, now);
    }
    return active.length;
  }

  close() { this.db.close(); }
}

installItemInstances(GameDatabase);

