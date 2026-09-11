import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { apply } from '../src/bridge.mjs';

test('真实 HTTP 管理接口返回高校询问并持久保存回答，分类工具仍无浏览器能力', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dlc-acquisition-api-'));
  const plugin = path.join(root, 'node_modules', '@dsh-external', 'dsh-scientific-reading');
  await fs.mkdir(plugin, { recursive: true });
  await fs.mkdir(path.join(root, 'state'));
  await fs.writeFile(path.join(plugin, 'package.json'), JSON.stringify({ type: 'module', main: 'index.mjs' }));
  await fs.writeFile(path.join(plugin, 'index.mjs'), `
    export const withEngineScope = (scope, next) => next();
    export const withoutEngineScope = next => next();
    export const createNativeRpc = () => () => { throw new Error('fixture_rpc_unavailable') };
    export async function engineJson(config, args) {
      if(args[0] === 'paper-chat') return {ok:true,json:{paper_id:null}};
      if(args[0] === 'library-item-v2') return {ok:true,json:{paper_id:'paper-one',folder_id:'f1'}};
      if(args[0] === 'job-status') return {ok:true,json:{paper_id:'paper-one',job_id:'job_1234567890abcdef',
        status:'waiting_user',detail:{reason_code:'pdf_required'}}};
      throw new Error('unexpected_engine_action');
    }
  `);
  await fs.writeFile(path.join(root, '.workbench.json'), JSON.stringify({ instanceId: 'fixture' }));
  await fs.writeFile(path.join(root, 'installation.json'), JSON.stringify({ dsh: path.join(root, 'host.mjs') }));
  await fs.writeFile(path.join(root, 'state', 'handoff.json'), JSON.stringify({ schema: 1, instanceId: 'fixture',
    bindings: { one: { sessionId: 'bound', folderId: 'f1', active: true } }, children: {}, tasks: { one: {
      taskId: 'task-one', paperId: 'paper-one', folderId: 'f1', sessionId: 'bound', jobId: 'job_1234567890abcdef', operations: {}, dispatches: {},
    } } }));
  let handler;
  const server = http.createServer((request, response) => {
    if (request.url === '/__workbench/api' && handler) return handler(request, response);
    response.writeHead(404); response.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const registeredTools = [];
  const ctx = { on() {}, tools: { guard() {}, register: tool => registeredTools.push(tool.name) },
    systemPrompt: { section() {} }, agents: { get() {} },
    webServer: { port: server.address().port, register: route => { handler = route.handler; } } };
  await apply(ctx, { root, engineConfig: {} });
  const invoke = async (action, payload) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/__workbench/api`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: 'fixture', action, payload }) });
    return { status: response.status, ...await response.json() };
  };
  const task = await invoke('task', { taskId: 'task-one' });
  assert.equal(task.value.acquisition.nextAction.kind, 'ask_institution');
  const answer = await invoke('acquisition', { taskId: 'task-one', idempotencyKey: 'no-access', expectedRevision: 0, event: 'institution', hasAccess: false });
  assert.equal(answer.status, 200);
  assert.equal(answer.value.acquisition.reason, 'no_institution_access');
  const blocked = await invoke('acquisition_download', { taskId: 'task-one', idempotencyKey: 'blocked', expectedRevision: 1,
    proxy: 'http://127.0.0.1:3456', target: 'tab', url: 'https://publisher.example/pdf' });
  assert.equal(blocked.error, 'institution_download_not_ready');
  assert.deepEqual(registeredTools, ['csr_read_job_input']);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'state', 'handoff.json'), 'utf8'));
  assert.equal(saved.tasks.one.acquisition.status, 'manual_required');
});
