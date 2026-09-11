import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, verifyFile } from '../src/core.mjs';

const pins = await readJson(new URL('../runtime/pins.json', import.meta.url));
const target = path.resolve('inputs/scientific-reading.tgz');
try {
  await verifyFile(target, pins.plugin.sha256);
  console.log('Local pinned engine SHA verified.');
  process.exit(0);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!pins.plugin.url?.startsWith('https://github.com/TyrionH-is-coding/')) throw new Error('engine_unpublished_candidate_requires_bundled_archive');
await fs.mkdir(path.dirname(target), { recursive: true });
const response = await fetch(pins.plugin.url, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error('engine_download_http_' + response.status);
const partial = target + '.part';
await fs.writeFile(partial, Buffer.from(await response.arrayBuffer()));
await verifyFile(partial, pins.plugin.sha256);
await fs.rename(partial, target);
console.log('Pinned engine download SHA verified.');
