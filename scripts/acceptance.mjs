import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = await fs.realpath(process.argv[2]);
const output = path.resolve(process.argv[3] || 'outputs/installed-acceptance.json');
const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const { start, status, stop } = await import(pathToFileURL(path.join(installed.app, 'src', 'control.mjs')));
const { readJson, writeJson, verifyFile } = await import(pathToFileURL(path.join(installed.app, 'src', 'core.mjs')));
const results = { schema: 1, startedAt: new Date().toISOString(), root,
  version: installed.version, candidate: installed.candidate, checks: [] };
const check = (name, value) => { assert.ok(value, name); results.checks.push({ name, passed: true }); };
const sentinel = http.createServer((_request, response) => response.end('csr-owned-3080-sentinel'));
let sentinelOwned = false;
let before;

async function listening3080() {
  return new Promise(resolve => {
    const connection = net.createConnection({ host: '127.0.0.1', port: 3080 });
    connection.setTimeout(1000);
    connection.on('connect', () => { connection.destroy(); resolve(true); });
    connection.on('error', () => resolve(false));
    connection.on('timeout', () => { connection.destroy(); resolve(false); });
  });
}

try {
  await new Promise((resolve, reject) => {
    sentinel.once('error', error => error.code === 'EADDRINUSE' ? resolve() : reject(error));
    sentinel.listen(3080, '127.0.0.1', () => { sentinelOwned = true; resolve(); });
  });
  check('3080 is already occupied', await listening3080());
  results.port3080 = sentinelOwned ? 'owned test sentinel' : 'existing listener left untouched';
  const foreign = path.join(root, 'state', 'acceptance-foreign-home');
  await fs.mkdir(foreign, { recursive: true });
  const trap = path.join(foreign, 'cordis.patch.yml');
  await fs.writeFile(trap, 'this is deliberately not a valid DSH patch\n');
  const trapSha = createHash('sha256').update(await fs.readFile(trap)).digest('hex');
  before = { ...process.env };
  process.env.DSH_HOME = foreign;
  process.env.NODE_PATH = path.join(foreign, 'nonexistent_modules');
  process.env.NODE_OPTIONS = '--import=does-not-exist';
  process.env.PYTHONPATH = path.join(foreign, 'nonexistent_python');
  process.env.OPENAI_API_KEY = 'synthetic-acceptance-key-never-used';
  process.env.CODEX_HOME = foreign;
  await stop(root);
  const [first, repeated] = await Promise.all([start(root), start(root)]);
  check('concurrent starts reuse one host', first.pid === repeated.pid && first.launchId === repeated.launchId);
  check('independent port', new URL(first.url).port !== '3080');
  check('actual HTTP identity', (await fetch(`${first.url}/__workbench/identity`).then(r => r.json())).instanceId === first.instanceId);
  const page = await fetch(first.url);
  check('DSH HTML is served', page.ok && /html/i.test(page.headers.get('content-type') ?? '') && /<html/i.test(await page.text()));
  const library = await fetch(`${first.url}/sr/api/library`);
  results.libraryHttpStatus = library.status;
  check('A library HTTP route is available', library.ok && /json/i.test(library.headers.get('content-type') ?? ''));
  await verifyFile(trap, trapSha);
  check('foreign DSH patch was neither loaded nor modified', true);
  await verifyFile(path.join(installed.slot, 'runtime', 'npm', 'scientific-reading.tgz'), installed.pins.plugin.sha256);
  check('exact A package', true);

  let links = 0;
  async function verifyLinks(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = await fs.realpath(file);
        const relative = path.relative(root, target);
        assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `external module ${entry.name}`);
        links++;
      } else if (entry.isDirectory()) await verifyLinks(file);
    }
  }
  await verifyLinks(path.join(root, 'state', 'dsh-home', 'profiles'));
  await verifyLinks(installed.profileModules);
  check('all profile module links stay inside this installation', links > 0);
  results.profileLinks = links;
  await stop(root);
  check('stop is observable', (await status(root)).status === 'stopped');
  check('3080 survives stop', await listening3080());
  const restarted = await start(root);
  check('restart keeps instance and creates fresh launch identity', restarted.instanceId === first.instanceId && restarted.launchId !== first.launchId);
  results.running = restarted;
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.error = error.message;
  await stop(root).catch(() => {});
  process.exitCode = 1;
} finally {
  if (before) process.env = before;
  if (sentinelOwned) await new Promise(resolve => sentinel.close(resolve));
  results.completedAt = new Date().toISOString();
  await writeJson(output, results);
  console.log(JSON.stringify(results, null, 2));
}
