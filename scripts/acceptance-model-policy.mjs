import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = await fs.realpath(process.argv[2]);
const temporary = await fs.realpath(os.tmpdir());
assert.ok(path.dirname(root) === temporary && path.basename(root).startsWith('dlc-v02-'), 'only an owned temporary acceptance instance');
const fixture = await fs.realpath(process.argv[3]);
const output = path.resolve(process.argv[4] || 'outputs/model-policy-native.json');
const installed = JSON.parse(await fs.readFile(path.join(root, 'installation.json'), 'utf8'));
const fromApp = file => import(pathToFileURL(path.join(installed.app, 'src', file)).href);
const { start, stop, status } = await fromApp('control.mjs');
const { call } = await fromApp('client.mjs');
assert.equal((await status(root)).status, 'stopped');
const patchPath = path.join(root, 'state', 'dsh-home', 'profiles', 'workbench', 'cordis.patch.yml');
const originalPatch = await fs.readFile(patchPath);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const evidence = { mode: 'installed-native-host-synthetic-model', root, version: installed.version,
  appSha256: installed.appSha256, aSha256: installed.pins.plugin.sha256, checks: [] };
const check = (name, passed) => { assert.ok(passed, name); evidence.checks.push(name); };
const invoke = async (action, payload) => (await call(root, { action, payload })).value;
let running, originalPolicy;
const post = async (route, body) => {
  const response = await fetch(running.url + route, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: running.url, 'x-sr-csrf': '1' }, body: JSON.stringify(body) });
  const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value;
};
const policy = async () => (await fetch(running.url + '/sr/api/settings/models')).json();
try {
  await fs.writeFile(patchPath, JSON.stringify([{ insert: [{ id: 'acceptance-local', name: pathToFileURL(fixture).href,
    config: { dshEntry: installed.dsh } }] }], null, 2));
  running = await start(root);
  originalPolicy = await policy();
  check('安装后的设置包含 11 个 medium 默认步骤', Object.keys(originalPolicy.steps).length === 11
    && Object.values(originalPolicy.steps).every(row => row.reasoningEffort === 'medium'));
  const initial = await invoke('model_run', { step: 'radar_direction', input: '合成材料：仅验证调用路由。' });
  check('已安装的 Codex 桥接实际调用 Sol medium', initial.model === 'gpt-5.6-sol'
    && initial.text.includes('MODEL=gpt-5.6-sol EFFORT=medium'));
  await post('/sr/api/settings/models', { revision: originalPolicy.revision,
    steps: { radar_direction: { provider: 'acceptance-local', model: 'gpt-5.6-luna', reasoningEffort: 'high' } } });
  const changed = await invoke('model_run', { step: 'radar_direction', input: '合成材料：验证本步骤的新配置。' });
  check('设置改变后桥接实际调用 Luna high', changed.text.includes('MODEL=gpt-5.6-luna EFFORT=high'));
  await stop(root); running = await start(root);
  const restarted = await invoke('model_run', { step: 'radar_direction', input: '合成材料：验证重启后的配置。' });
  check('宿主重启后保留每步模型设置', restarted.text.includes('MODEL=gpt-5.6-luna EFFORT=high'));
  const after = await policy();
  check('修改单个步骤保持其他步骤不变', Object.keys(originalPolicy.steps).filter(key => key !== 'radar_direction')
    .every(key => JSON.stringify(after.steps[key]) === JSON.stringify(originalPolicy.steps[key])));
  const listing = await invoke('list', { pageSize: 100 });
  let reader;
  for (const item of listing.items) {
    try { reader = await invoke('reader', { paperId: item.paper_id }); evidence.paperId = item.paper_id; break; }
    catch (error) { if (!/artifact|reader/.test(error.message)) throw error; }
  }
  check('已安装的工作台校验并打开已有 Reader', reader && /^[a-f0-9]{64}$/.test(reader.displaySha256));
  const html = await (await fetch(reader.readerUrl)).text();
  check('已有 Reader 在线响应包含悬浮对话', html.includes('data-reader-mode="online"') && html.includes('sr-reader-launcher'));
  const download = await fetch(reader.readerUrl + '?download=1');
  const offline = await download.text();
  check('同一 Reader 可导出禁止联网的离线附件', download.ok
    && download.headers.get('content-disposition')?.includes('attachment')
    && offline.includes('data-reader-mode="offline"') && offline.includes("connect-src 'none'"));
  evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = error.stack; process.exitCode = 1; }
finally {
  try {
    if (originalPolicy && running) await post('/sr/api/settings/models', { revision: (await policy()).revision,
      steps: Object.fromEntries(Object.entries(originalPolicy.steps).map(([key, { provider, model, reasoningEffort }]) =>
        [key, { provider, model, reasoningEffort }])) });
  } catch (error) { evidence.restoreError = error.message; evidence.passed = false; process.exitCode = 1; }
  await stop(root).catch(() => {});
  await fs.writeFile(patchPath, originalPatch);
  check('测试 Profile 已按原始字节恢复', hash(await fs.readFile(patchPath)) === hash(originalPatch));
  check('隔离工作台已停止', (await status(root)).status === 'stopped');
  evidence.completedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
