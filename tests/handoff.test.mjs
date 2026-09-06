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
  const state = { folder: 'f1', job: 'waiting_user', reader: false, messages: [], loseReceipt: false };
  const engine = async (args, _input, scope) => {
    if (args[0] === 'folder-list') return [{ folder_id: 'f1', name: '分类一' }, { folder_id: 'f2', name: '分类二' }];
    if (args[0] === 'library-item-v2') {
      if (scope && scope.scopeFolderId !== state.folder) throw new Error('scope_changed');
      return { paper_id: 'paper1', folder_id: state.folder };
    }
    if (args[0] === 'full-read-pipeline-start') { counters.started++; return { parent_job_id: 'job_1234567890abcdef' }; }
    if (args[0] === 'job-status') return { paper_id: 'paper1', status: state.job, job_id: 'job_1234567890abcdef',
      detail: { reason_code: state.job === 'waiting_agent' ? 'translate_full_read' : 'pdf_required', required_input: { batch_id: 'b1' } } };
    if (args[0] === 'scope-folder-state') return { archived: true };
    throw new Error('unexpected engine action ' + args[0]);
  };
  const rpc = async (method, _payload, rpcId) => {
    if (method === 'session.prompt') {
      counters.prompted++;
      state.messages.push({ event: { type: 'user/message', data: { source: { kind: 'user', rpcId } } } });
      if (state.loseReceipt) throw new Error('receipt_lost');
      return { accepted: true };
    }
    if (method === 'session.history') return { events: state.messages, hasMore: false };
    return {};
  };
  const deps = { instance, engine, rpc,
    dispatchEvidence: async (_sessionId, rpcId) => state.evidence ?? (state.messages.some(({ event }) =>
      event.type === 'user/message' && event.data.source.rpcId === rpcId) ? 'delivered' : 'uncertain'),
    reader: async () => {
    if (!state.reader) throw new Error('artifact_not_ready');
    return { readerUrl: '/sr/reader/paper1', sha256: 'verified-reader' };
  } };
  return { root, deps, state, counters, service: await Handoff.open(root, deps) };
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
  assert.equal((await restored.bind('f1')).sessionId, a.sessionId);
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

test('论文移出分类后旧任务拒绝继续；真实父子会话范围可继承', async t => {
  const { service, state } = await fixture(t);
  const task = await service.submit({ idempotencyKey: 'a', folderId: 'f1', paperId: 'paper1', runAgent: false });
  service.observeSession('child', task.sessionId);
  assert.equal(service.scopeFor('child').scopeFolderId, 'f1');
  assert.equal(service.scopeFor('child').scopeSessionId, task.sessionId);
  assert.equal(service.scopeFor('unknown'), null);
  state.folder = 'f2';
  assert.equal((await service.task(task.taskId)).error, 'scope_changed');
  await service.archive('f1', true);
  assert.equal(service.scopeFor('child'), null);
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
