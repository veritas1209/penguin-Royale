import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, TALENTS } from '../shared/catalog.ts';
import { WORLD } from '../shared/world.ts';
import { createGameServer } from './app.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number.parseInt(process.env.PENGUIN_PORT ?? '18090', 10);
const host = process.env.PENGUIN_HOST ?? '127.0.0.1';
const dbPath = process.env.PENGUIN_DB_PATH ?? resolve(root, 'data', 'penguin-extraction.sqlite');
const staticDir = process.env.PENGUIN_STATIC_DIR ?? resolve(root, 'dist');
const allowedOrigins = (process.env.PENGUIN_ALLOWED_ORIGINS ?? 'http://127.0.0.1:5189,http://localhost:5189,http://127.0.0.1:10000,http://localhost:10000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
allowedOrigins.push(`http://${host}:${port}`);
const trustProxy = process.env.PENGUIN_TRUST_PROXY === '1';

const game = createGameServer({ dbPath, catalog: { items: ITEMS, talents: TALENTS }, world: WORLD, staticDir, allowedOrigins, trustProxy });
const address = await game.listen(port, host);
console.log(`Penguin Extraction server listening at http://${address.address}:${address.port}/games/penguin-extraction`);
if (game.recoveredRaids > 0) console.log(`Recovered ${game.recoveredRaids} unfinished raid participant(s) as deaths.`);

async function shutdown(signal) {
  console.log(`${signal}: closing Penguin Extraction server`);
  await game.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
