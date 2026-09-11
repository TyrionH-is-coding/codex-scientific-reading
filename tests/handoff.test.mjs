import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Handoff } from '../src/handoff.mjs';
import { initializeRoot } from '../src/core.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-handoff-'));
  const instance = await initializeRoot(root);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const counters = { started: 0, prompted: 0 };
  const state = { folder: 'f1', job: 'waiting_user', reader: false, messages: [], loseReceipt: false, chats: new Map(), archived: new Set() };
  const engine = async (args, _input, scope) => {
    if (args[0] === 'paper-chat') {
      if (_input.action === 'scope') return { paper_id: [...state.chats].find(([, id]) => id === _input.session_id)?.[0] ?? null };
      if (_input.action === 'ensure') {
        if (!state.chats.has(_input.paper_id)) state.chats.set(_input.paper_id, 'chat-' + _input.paper_id);
        return { paper_id: _input.paper_id, session_id: state.chats.get(_input.paper_id), paper: { title: '论文', folder_id: state.folder } };
      }
      if (_input.action === 'legacy_register') { state.legacy = _input.entries; return { sessions: state.legacy }; }
    }
    if (args[0] === 'folder-list') return [{ folder_id: 'f1', name: '分类一' }, { folder_id: 'f2', name: '分类二' }];
    if (args[0] === 'library-item-v2') {
      if (scope && (state.archived.has(state.folder) || (scope.scopeFolderId !== '__paper__' && scope.scopeFolderId !== state.folder))) throw new Error('scope_changed');
      return { paper_id: 'paper1', folder_id: state.folder };
    }
    if (args[0] === 'full-read-pipeline-start') { counters.started++; return { parent_job_id: 'job_1234567890abcdef' }; }
    if (args[0] === 'job-status') return { paper_id: 'paper1', status: state.job, job_id: 'job_1234567890abcdef',
      detail: { error: state.jobError, reason_code: state.job === 'waiting_agent' ? 'translate_full_read' : 'pdf_required', required_input: { batch_id: 'b1' } } };
    if (args[0] === 'scope-folder-state') { state.archived.add(args[2]); return { archived: true }; }
    throw new Error('unexpected engine action ' + args[0]);
  };
  const rpcCalls = [];
  const rpc = async (method, payload, rpcId) => {
    rpcCalls.push({ method, payload, rpcId });
    if (method === 'session.list') return { items: state.nativeSessions || [] };
    if (method === 'session.prompt') {
      counters.prompted++;
      state.messages.push({ event: { type: 'user/message', data: { source: { kind: 'user', rpcId } } } });
      if (state.loseReceipt) throw new Error('receipt_lost');
      return { accepted: true };
    }
    if (method === 'session.history') return { events: state.messages, hasMore: false };
    if (method === 'workspace.create') {
      return {
        workspace: {
          workspaceId: 'ws-1', path: payload.path, title: 'workspace',
          sessionIds: [], createdAt: 't', updatedAt: 't',
        },
        created: rpcCalls.filter(call => call.method === 'workspace.create').length === 1,
      };
    }
    if (method === 'settings.describe') {
      return {
        writable: true, hasDocument: true,
        namespaces: [{
          ns: 'agent-presets',
          value: { default: state.presetDefault ?? 'standard' },
          user: state.presetUser,
          revision: state.presetRevision ?? 1,
        }],
      };
    }
    if (method === 'settings.update') {
      state.presetUser = { ...(state.presetUser ?? {}), ...payload.patch };
      state.presetDefault = payload.patch.default ?? state.presetDefault;
      return { ns: payload.ns, value: { default: state.presetDefault }, user: state.presetUser, revision: 2 };
    }
    return {};
  };
  const deps = { instance, engine, rpc,
    dispatchEvidence: async (_sessionId, rpcId) => state.evidence ?? (state.messages.some(({ event }) =>
      event.type === 'user/message' && event.data.source.rpcId === rpcId) ? 'delivered' : 'uncertain'),
    reader: async () => {
    if (!state.reader) throw new Error('artifact_not_ready');
    return { readerUrl: '/sr/reader/paper1', sha256: 'verified-reader' };
  } };
  return { root, deps, state, counters, rpcCalls, service: await Handoff.open(root, deps) };
}

test('并发重复交接只启动一个任务，重命名不改变绑定，重启后读回同一任务', async t => {
  const { root, deps, service, counters } = await fixture(t);
  const request = { idempotencyKey: 'same', folderId: 'f1', paperId: 'paper1', runAgent: false };
  const [a, b] = await Promise.all([service.submit(request), service.submit(request)]);
  assert.equal(a.taskId, b.taskId);
  assert.equal(counters.started, 1);
  await assert.rejects(service.submit({ ...request, paperId: 'different' }), /idempotency_conflict/);
  const restored = await Handoff.open(root, deps);
  assert.equal((await restored.task(a.taskId)).jobId, a.jobId);
  assert.equal((await restored.bindPaper('paper1')).sessionId, a.sessionId);
});

test('Reader 已创建的单篇 chat 保留原工作区和稳定会话', async t => {
  const { root, service, state, rpcCalls } = await fixture(t);
  const priorCwd = path.join(root, 'library');
  state.nativeSessions = [{ sessionId: 'chat-paper1', cwd: priorCwd }];
  const binding = await service.bindPaper('paper1');
  assert.equal(binding.sessionId, 'chat-paper1');
  assert.equal(rpcCalls.filter(row => row.method === 'workspace.create').at(-1).payload.path, priorCwd);
});

test('聊天或任务说完成但没有正式 Reader 时，不能报精读完成', async t => {
  const { service, state } = await fixture(t);
  const task = await service.submit({ idempotencyKey: 'a', folderId: 'f1', paperId: 'paper1', runAgent: false });
  state.job = 'completed';
  assert.equal((await service.task(task.taskId)).status, 'failed');
  state.reader = true;
  assert.equal((await service.task(task.taskId)).status, 'completed');
});

test('投递回执丢失后从 DSH 历史调和，不重复提示导致重复执行', async t => {
  const { root, deps, service, state, counters } = await fixture(t);
  state.job = 'waiting_agent';
  state.loseReceipt = true;
  const task = await service.submit({ idempotencyKey: 'a', folderId: 'f1', paperId: 'paper1', runAgent: false });
  await service.dispatch(task.taskId);
  const restored = await Handoff.open(root, deps);
  const reconciled = await restored.dispatch(task.taskId);
  assert.equal(reconciled.dispatch.status, 'accepted');
  assert.equal(counters.prompted, 1);
});

test('单篇 chat 随论文移动继续，归档后停止写入；真实父子会话范围可继承', async t => {
  const { service, state } = await fixture(t);
  const task = await service.submit({ idempotencyKey: 'a', folderId: 'f1', paperId: 'paper1', runAgent: false });
  service.observeSession('child', task.sessionId);
  assert.equal((await service.scopeFor('child')).scopePaperId, 'paper1');
  assert.equal((await service.scopeFor('child')).scopeSessionId, task.sessionId);
  assert.equal(await service.scopeFor('unknown'), null);
  state.folder = 'f2';
  assert.equal((await service.task(task.taskId)).folderId, 'f2');
  assert.equal((await service.bindPaper('paper1')).sessionId, task.sessionId);
  await service.archive('f2', true);
  assert.equal((await service.task(task.taskId)).error, 'scope_changed');
});

test('失败后的显式重试另记回执，同一重试仍幂等', async t => {
  const { service, state, counters } = await fixture(t);
  state.job = 'waiting_agent';
  const task = await service.submit({ idempotencyKey: 'a', folderId: 'f1', paperId: 'paper1' });
  assert.equal(counters.prompted, 1);
  await service.dispatch(task.taskId);
  assert.equal(counters.prompted, 1);
  await service.dispatch(task.taskId, 'retry-1');
  await service.dispatch(task.taskId, 'retry-1');
  assert.equal(counters.prompted, 2);
});

test('正常停止撤销原生队列后重新核对已接收回执，同键不重发，显式重试另记回执', async t => {
  const { root, deps, service, state, counters } = await fixture(t);
  state.job = 'waiting_agent'; state.evidence = 'pending';
  const request = { idempotencyKey: 'graceful', folderId: 'f1', paperId: 'paper1' };
  const task = await service.submit(request);
  const originalRpc = Object.values(task.dispatches)[0].rpcId;
  state.evidence = 'canceled';
  const restored = await Handoff.open(root, deps);
  const reconciled = await restored.dispatch(task.taskId);
  assert.equal(reconciled.dispatch.status, 'canceled');
  assert.equal(reconciled.dispatch.evidence, 'canceled');
  await restored.submit(request);
  assert.equal(counters.prompted, 1);
  const saved = await Handoff.open(root, deps);
  assert.equal(Object.values((await saved.task(task.taskId)).dispatches)[0].status, 'canceled');
  state.evidence = 'pending';
  const retried = await saved.dispatch(task.taskId, 'explicit-retry');
  assert.notEqual(retried.dispatch.rpcId, originalRpc);
  await saved.dispatch(task.taskId, 'explicit-retry');
  assert.equal(counters.prompted, 2);
});

test('已接收回执缺乏原生证据时持久化 uncertain，不把未知当作已交付或自动重发', async t => {
  const { root, deps, service, state, counters } = await fixture(t);
  state.job = 'waiting_agent';
  const task = await service.submit({ idempotencyKey: 'unknown', folderId: 'f1', paperId: 'paper1' });
  state.evidence = 'uncertain';
  const restored = await Handoff.open(root, deps);
  assert.equal((await restored.dispatch(task.taskId)).dispatch.status, 'uncertain');
  const saved = await Handoff.open(root, deps);
  assert.equal(Object.values((await saved.task(task.taskId)).dispatches)[0].status, 'uncertain');
  deps.dispatchEvidence = async () => { throw new Error('native_session_unavailable'); };
  const unavailable = await Handoff.open(root, deps);
  assert.equal((await unavailable.dispatch(task.taskId)).dispatch.status, 'uncertain');
  assert.equal(counters.prompted, 1);
});

test('绑定单篇 chat 时使用自有工作区；重复绑定不新建工作区身份', async t => {
  const { root, service, rpcCalls } = await fixture(t);
  const first = await service.bindPaper('paper1');
  const created = rpcCalls.filter(call => call.method === 'workspace.create');
  assert.equal(created.length, 1);
  assert.equal(created[0].payload.path, await fs.realpath(path.join(root, 'workspace')));
  const sessions = rpcCalls.filter(call => call.method === 'session.create');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].payload.sessionId, first.sessionId);
  assert.equal(sessions[0].payload.workspaceId, 'ws-1');
  assert.equal(sessions[0].payload.agentPreset, 'scientific-reading');
  assert.equal(sessions[0].payload.cwd, undefined);
  await service.bindPaper('paper1');
  assert.equal(rpcCalls.filter(call => call.method === 'workspace.create').length, 2);
  assert.equal(rpcCalls.filter(call => call.method === 'workspace.create')[1].payload.path, created[0].payload.path);
  assert.deepEqual(rpcCalls.filter(call => call.method === 'session.create').map(call => call.payload.sessionId), [first.sessionId, first.sessionId]);
});

test('同分类两篇文献使用不同 chat；重启后仍以 SQLite 绑定为准', async t => {
  const { root, deps, service } = await fixture(t);
  const a = await service.bindPaper('paper1'), b = await service.bindPaper('paper2');
  assert.notEqual(a.sessionId, b.sessionId);
  assert.equal(a.folderId, b.folderId);
  const reopened = await Handoff.open(root, deps);
  assert.equal((await reopened.bindPaper('paper1')).sessionId, a.sessionId);
  assert.equal((await reopened.scopeFor(b.sessionId)).scopePaperId, 'paper2');
});

test('v0.1 分类会话升级保留原始备份和独立历史入口，不建立错误单篇归属', async t => {
  const { root, deps, state } = await fixture(t);
  const old = { schema: 1, instanceId: deps.instance.instanceId,
    bindings: { legacy: { sessionId: 'old-category', folderId: 'f1', active: true } },
    children: { review: 'old-category' }, tasks: {} };
  const bytes = JSON.stringify(old);
  await fs.mkdir(path.join(root, 'state'), { recursive: true });
  await fs.writeFile(path.join(root, 'state', 'handoff.json'), bytes);
  const service = await Handoff.open(root, deps);
  assert.equal(service.data.schema, 2);
  assert.equal(await fs.readFile(path.join(root, 'state', 'handoff.v1.json'), 'utf8'), bytes);
  assert.equal(state.legacy[0].session_id, 'old-category');
  assert.notEqual((await service.bindPaper('paper1')).sessionId, 'old-category');
  assert.deepEqual(service.data.bindings, old.bindings);
  assert.deepEqual(service.data.children, old.children);
  assert.equal((await Handoff.open(root, deps)).data.schema, 2);
});

test('全新实例在用户未设置时把默认 Agent 设为文献模式，已有用户选择则保留', async t => {
  const { service, rpcCalls, state } = await fixture(t);
  await service.bindPaper('paper1');
  const updates = rpcCalls.filter(call => call.method === 'settings.update');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].payload, { ns: 'agent-presets', patch: { default: 'scientific-reading' }, expectedRevision: 1 });
  rpcCalls.length = 0;
  state.presetUser = { default: 'standard' };
  state.presetRevision = 4;
  await service.bindPaper('paper1');
  assert.equal(rpcCalls.filter(call => call.method === 'settings.update').length, 0);
});

test('任务失败时透传 job.detail.error，不把顶层 error 留空', async t => {
  const { service, state } = await fixture(t);
  const task = await service.submit({ idempotencyKey: 'fail', folderId: 'f1', paperId: 'paper1', runAgent: false });
  state.job = 'failed';
  state.jobError = 'full_read_parent_mismatch';
  const refreshed = await service.task(task.taskId);
  assert.equal(refreshed.status, 'failed');
  assert.equal(refreshed.error, 'full_read_parent_mismatch');
  assert.equal(refreshed.job.detail.error, 'full_read_parent_mismatch');
});
