import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = await fs.realpath(process.argv[2]);
const bad = JSON.parse(await fs.readFile(process.argv[3], 'utf8'));
const output = path.resolve(process.argv[4]);
const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const load = file => import(pathToFileURL(path.join(installed.app, 'src', file)).href);
const { start, stop, status } = await load('control.mjs');
const { activateRelease, recoverRelease } = await load('releases.mjs');
const { readJson, writeJson } = await load('core.mjs');
const { call } = await load('client.mjs');
const results = { root, appSha256: installed.appSha256, checks: [] };
const check = (name, value) => { assert.ok(value, name); results.checks.push({ name, passed: true }); };
async function pdfs(directory, found = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await pdfs(file, found);
    else if (entry.isFile() && entry.name.endsWith('.pdf')) found[path.relative(root, file)] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  }
  return found;
}
try {
  const original = await start(root);
  const before = await pdfs(path.join(root, 'library'));
  check('fixture contains real PDF assets', Object.keys(before).length > 0);
  const papers = (await call(root, { action: 'list', payload: { pageSize: 100 } })).value.items.map(row => row.paper_id).sort();
  let failure;
  try { await activateRelease(root, bad); } catch (error) { failure = error.message; }
  check('bad native host fails activation', failure?.startsWith('host_exited'));
  check('automatic fallback restores the exact old code', (await readJson(path.join(root, 'installation.json'))).appSha256 === installed.appSha256);
  const restored = await status(root);
  check('previously running instance is running after failed upgrade', restored.status === 'running' && restored.instanceId === original.instanceId);
  check('existing PDF bytes survive failed upgrade', JSON.stringify(await pdfs(path.join(root, 'library'))) === JSON.stringify(before));
  check('library items survive failed upgrade', JSON.stringify((await call(root, { action: 'list', payload: { pageSize: 100 } })).value.items.map(row => row.paper_id).sort()) === JSON.stringify(papers));
  const failed = await readJson(path.join(root, 'state', 'last-release-failure.json'));
  check('upgrade has a real consistent backup', failed.backup?.status === 'completed' && /^[a-f0-9]{64}$/.test(failed.backup.sha256));
  results.backup = failed.backup;
  // An interrupted switch is simulated only in this disposable acceptance root.
  await writeJson(path.join(root, 'state', 'release-transition.json'), { previous: installed, candidate: bad, wasRunning: true, startedAt: new Date().toISOString() });
  await assert.rejects(start(root), /release_recovery_required/);
  check('ordinary start refuses an unresolved transition', true);
  const recovered = await recoverRelease(root);
  check('real recovery restores the old running host', recovered.status === 'recovered' && (await status(root)).status === 'running');
  check('recovery preserves PDFs and library content', JSON.stringify(await pdfs(path.join(root, 'library'))) === JSON.stringify(before)
    && JSON.stringify((await call(root, { action: 'list', payload: { pageSize: 100 } })).value.items.map(row => row.paper_id).sort()) === JSON.stringify(papers));
  results.passed = true;
} catch (error) { results.passed = false; results.error = error.stack; process.exitCode = 1; }
finally { await stop(root).catch(() => {}); await writeJson(output, results); console.log(JSON.stringify(results, null, 2)); }
