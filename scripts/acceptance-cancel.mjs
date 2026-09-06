import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = await fs.realpath(process.argv[2]);
const output = path.resolve(process.argv[3]);
const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const fromApp = file => import(pathToFileURL(path.join(installed.app, 'src', file)).href);
const { start, stop, status } = await fromApp('control.mjs');
const { call } = await fromApp('client.mjs');
const { readJson, writeJson } = await fromApp('core.mjs');
const report = { root, appSha256: installed.appSha256, checks: [], startedAt: new Date().toISOString() };
const check = (name, condition) => { assert.ok(condition, name); report.checks.push({ name, passed: true }); };
const invoke = async (action, payload = {}) => (await call(root, { action, payload })).value;
const patch = path.join(root, 'state', 'dsh-home', 'profiles', 'workbench', 'cordis.patch.yml');
const original = await fs.readFile(patch);
try {
  await start(root);
  const stamp = Date.now();
  const folder = await invoke('folder_create', { name: '取消验收-' + stamp });
  const paper = await invoke('ingest', { metadata: { title: 'Synthetic durable cancellation ' + stamp, year: 2026 } });
  await invoke('move', { paperId: paper.paper_id, folderId: folder.folder_id });
  const submission = { idempotencyKey: 'cancel-' + stamp,
    paperId: paper.paper_id, folderId: folder.folder_id, runAgent: false };
  let task;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { task = await invoke('submit', submission); break; }
    catch (error) {
      // Older A builds finish their global ingestion job before scoped start.
      if (error.message !== 'scope_job_conflict' || attempt === 29) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  await stop(root);
  // Synthetic setup only: give this real task a dispatch receipt, then enqueue
  // those IDs through the native Inbox API. No model completion is fabricated.
  const handoffFile = path.join(root, 'state', 'handoff.json');
  const handoff = await readJson(handoffFile);
  const savedTask = Object.values(handoff.tasks).find(value => value.taskId === task.taskId);
  const rpcId = randomUUID(), otherRpcId = randomUUID();
  savedTask.dispatches['acceptance-only'] = { rpcId, status: 'accepted' };
  await writeJson(handoffFile, handoff);
  const fixture = fileURLToPath(new URL('./fixtures/cancel-queue.mjs', import.meta.url));
  await writeJson(patch, [{ insert: [{ id: 'csr-acceptance-cancel', name: pathToFileURL(fixture).href,
    config: { sessionId: task.sessionId, rpcId, otherRpcId,
      bridgeModule: pathToFileURL(path.join(installed.app, 'src', 'bridge-services.mjs')).href } }] }]);
  let running = await start(root);
  await invoke('bind', { folderId: folder.folder_id });
  const probe = async action => {
    const response = await fetch(running.url + '/__workbench/acceptance-cancel?' + action);
    const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value;
  };
  const queued = await probe('queue');
  check('real durable inbox holds both task inputs and another prompt without starting',
    queued.queued.length === 3 && queued.running === false);
  // Give native persistence time to flush this fixture before simulating a crash.
  await new Promise(resolve => setTimeout(resolve, 500));
  await probe('crash');
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await status(root)).status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  check('only the disposable DSH host exits unexpectedly', (await status(root)).status === 'failed');
  running = await start(root);
  check('session is cold after crash restart', (await probe('status')).live === false);
  const canceled = await invoke('cancel', { taskId: task.taskId });
  report.cancellation = canceled.cancellation;
  check('cold cancellation restores native inbox and removes both owned entries', canceled.cancellation.removedQueued === 2);
  const after = await probe('status');
  check('other prompt remains queued and no model turn was started', after.live && !after.running
    && after.queued.length === 1 && after.queued[0].rpcId === otherRpcId && after.canceled >= 2);
  await probe('crash');
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await status(root)).status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  running = await start(root);
  await invoke('bind', { folderId: folder.folder_id });
  const replayed = await probe('status');
  check('canceled task remains absent after another durable replay', replayed.queued.length === 1
    && replayed.queued[0].rpcId === otherRpcId && !replayed.running);
  const pending = await probe('queue-owned');
  check('installed dispatch inspector sees real pending native inputs', pending.queued.length === 3
    && pending.evidence === 'pending' && pending.otherEvidence === 'pending');
  // Graceful shutdown has a different contract: native DSH cancels all queued
  // inputs. The installed inspector must report that evidence after resume.
  await stop(root);
  running = await start(root);
  check('session is cold after graceful restart', (await probe('status')).live === false);
  await invoke('bind', { folderId: folder.folder_id });
  const graceful = await probe('status');
  report.gracefulRestart = graceful;
  check('graceful cancellation is reported from persisted native evidence', graceful.live && !graceful.running
    && graceful.queued.length === 0 && graceful.evidence === 'canceled' && graceful.otherEvidence === 'canceled');
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
finally {
  await stop(root).catch(() => {});
  await fs.writeFile(patch, original);
  check('test-only profile restored', (await fs.readFile(patch)).equals(original));
  report.completedAt = new Date().toISOString();
  await writeJson(output, report); console.log(JSON.stringify(report, null, 2));
}
