import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Handoff } from '../src/handoff.mjs';
import { initializeRoot } from '../src/core.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dlc-acquire-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const instance = await initializeRoot(root);
  const state = { reason: 'pdf_required', status: 'waiting_user', folder: 'f1', attached: 0, downloads: 0 };
  const task = { taskId: 'task-one', paperId: 'paper-one', jobId: 'job_1234567890abcdef', folderId: 'f1', sessionId: 's1', operations: {}, dispatches: {} };
  const pdf = Buffer.from('%PDF-1.4\n' + ' '.repeat(1200) + '\n%%EOF\n');
  const deps = { instance, engine: async args => {
    if (args[0] === 'library-item-v2') return { paper_id: task.paperId, folder_id: state.folder };
    if (args[0] === 'job-status') return { paper_id: task.paperId, job_id: task.jobId, status: state.status, detail: { reason_code: state.reason } };
    if (args[0] === 'full-read-pdf-attach-resume') { state.attached++; state.status = 'queued'; return {}; }
    throw new Error('unexpected_engine_call');
  }, downloadPdf: async ({ destination }) => {
    state.downloads++;
    if (state.downloadError) throw new Error(state.downloadError);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, pdf);
    return { pdf: destination };
  } };
  const service = await Handoff.open(root, deps);
  service.data.bindings.one = { folderId: 'f1', sessionId: 's1', active: true };
  service.data.tasks.one = task;
  await service.save();
  const change = async (event, fields = {}) => {
    const value = await service.task(task.taskId);
    return service.acquire({ taskId: task.taskId, idempotencyKey: `${event}-${value.acquisition.revision}`,
      expectedRevision: value.acquisition.revision, event, ...fields });
  };
  return { root, deps, state, task, service, change };
}

test('缺 PDF 才询问高校权限；普通轮询与重启保留用户选择', async t => {
  const { root, deps, service, state, task, change } = await fixture(t);
  state.reason = 'mineru_key_required';
  assert.equal((await service.task(task.taskId)).acquisition, undefined);
  state.reason = 'pdf_required';
  const pending = await service.task(task.taskId);
  assert.equal(pending.acquisition.status, 'awaiting_institution_choice');
  assert.equal(pending.acquisition.nextAction.kind, 'ask_institution');
  await change('institution', { hasAccess: false });
  const restored = await Handoff.open(root, deps);
  const result = await restored.task(task.taskId);
  assert.equal(result.acquisition.status, 'manual_required');
  assert.equal(result.acquisition.reason, 'no_institution_access');
  assert.equal(state.downloads, 0);
});

test('同一回复幂等，陈旧回复或敏感字段不写入持久状态', async t => {
  const { root, service, task } = await fixture(t);
  await service.task(task.taskId);
  const request = { taskId: task.taskId, idempotencyKey: 'answer', expectedRevision: 0, event: 'institution', hasAccess: true };
  const first = await service.acquire(request);
  assert.equal(first.acquisition.status, 'awaiting_library_url');
  assert.equal((await service.acquire(request)).acquisition.revision, first.acquisition.revision);
  await assert.rejects(service.acquire({ ...request, hasAccess: false }), /idempotency_conflict/);
  await assert.rejects(service.acquire({ ...request, idempotencyKey: 'stale' }), /acquisition_revision_conflict/);
  await assert.rejects(service.acquire({ ...request, expectedRevision: 1, password: 'not-a-real-secret' }), /invalid_acquisition_request/);
  await assert.rejects(service.acquire({ taskId: task.taskId, idempotencyKey: 'portal', expectedRevision: 1,
    event: 'library', libraryUrl: 'https://library.example/login?ticket=not-a-real-secret' }), /public_library_url_required/);
  assert.doesNotMatch(await fs.readFile(path.join(root, 'state', 'handoff.json'), 'utf8'), /not-a-real-secret/);
});

test('用户暂不使用机构访问保留未知权限，不误记为没有账号', async t => {
  const { change } = await fixture(t);
  const task = await change('manual');
  assert.equal(task.acquisition.status, 'manual_required');
  assert.equal(task.acquisition.hasAccess, undefined);
  assert.equal(task.acquisition.reason, 'user_declined');
});

for (const event of ['no_entitlement', 'no_pdf', 'browser_unavailable', 'download_failed']) {
  test(`${event}明确保存失败原因并保留原任务`, async t => {
    const { change, state } = await fixture(t);
    await change('institution', { hasAccess: true, libraryUrl: 'https://library.example/#/resources' });
    await change('begin');
    const task = await change(event);
    assert.equal(task.status, 'waiting_user');
    assert.equal(task.acquisition.reason, event);
    assert.equal(task.acquisition.status, 'manual_required');
    assert.equal(state.attached, 0);
  });
}

test('有权限后获取门户、本人登录和有限重试；认证不等于下载成功', async t => {
  const { service, task, change, state } = await fixture(t);
  await change('institution', { hasAccess: true });
  await change('library', { libraryUrl: 'https://library.example/resources' });
  await change('begin');
  let value = await change('login_required');
  assert.equal(value.acquisition.nextAction.kind, 'user_login');
  value = await change('retry');
  assert.equal(value.acquisition.attempts, 2);
  await change('verification_required');
  value = await change('retry');
  assert.equal(value.acquisition.status, 'manual_required');
  assert.equal(value.acquisition.reason, 'attempt_limit');
  assert.equal((await service.task(task.taskId)).status, 'waiting_user');
  assert.equal(state.attached, 0);
});

test('未经选择不下载，下载按同键读回，校验后通过原 attach 续接', async t => {
  const { root, deps, service, task, change, state } = await fixture(t);
  const request = { taskId: task.taskId, idempotencyKey: 'get-pdf', expectedRevision: 0,
    proxy: 'http://127.0.0.1:3456', target: 'visible-tab', url: 'https://publisher.example/article.pdf' };
  await assert.rejects(service.acquireDownload(request), /institution_download_not_ready/);
  await change('institution', { hasAccess: true, libraryUrl: 'https://library.example/resources' });
  const browsing = await change('begin');
  request.expectedRevision = browsing.acquisition.revision;
  const downloaded = await service.acquireDownload(request);
  assert.equal(downloaded.acquisition.status, 'pdf_ready');
  assert.equal(downloaded.acquisition.nextAction.kind, 'attach');
  assert.match(downloaded.acquisition.sha256, /^[a-f0-9]{64}$/);
  const restored = await Handoff.open(root, deps);
  assert.equal((await restored.acquireDownload(request)).acquisition.pdf, downloaded.acquisition.pdf);
  assert.equal(state.downloads, 1);
  await restored.operate(task.taskId, 'attach-result', 'attach', {
    pdf: downloaded.acquisition.pdf, sourceType: 'codex_authorized' });
  assert.equal((await restored.task(task.taskId)).acquisition.status, 'attached');
  assert.equal(state.attached, 1);
});

test('浏览器无可用 PDF 保留原任务；归档、取消和其他 gate 不能继续下载', async t => {
  const { service, task, change, state } = await fixture(t);
  await change('institution', { hasAccess: true, libraryUrl: 'https://library.example/' });
  const browsing = await change('begin');
  state.downloadError = 'invalid_pdf';
  const request = { taskId: task.taskId, idempotencyKey: 'bad-pdf', expectedRevision: browsing.acquisition.revision,
    proxy: 'http://127.0.0.1:3456', target: 'tab', url: 'https://publisher.example/pdf' };
  const result = await service.acquireDownload(request);
  assert.equal(result.acquisition.reason, 'invalid_pdf');
  assert.equal(result.status, 'waiting_user');
  assert.equal(state.attached, 0);
  task.cancelRequested = true;
  await assert.rejects(change('retry'), /pdf_acquisition_not_active/);
  task.cancelRequested = false; state.reason = 'user_reading_confirmation';
  await assert.rejects(change('retry'), /pdf_acquisition_not_active/);
  state.reason = 'pdf_required'; state.folder = 'other';
  await assert.rejects(change('retry'), /scope_changed|pdf_acquisition_not_active/);
});

test('下载准备回执重启后仅核对原文件，绝不静默重发浏览器请求', async t => {
  const { root, deps, service, task, change, state } = await fixture(t);
  await change('institution', { hasAccess: true, libraryUrl: 'https://library.example/' });
  const browsing = await change('begin');
  const request = { taskId: task.taskId, idempotencyKey: 'lost-receipt', expectedRevision: browsing.acquisition.revision,
    proxy: 'http://127.0.0.1:3456', target: 'tab', url: 'https://publisher.example/pdf?ticket=temporary-link' };
  await service.acquireDownload(request);
  const receipt = Object.values(task.acquisitionReceipts).find(value => value.pdf);
  receipt.status = 'prepared'; task.acquisition.status = 'downloading';
  await service.save();
  const restored = await Handoff.open(root, deps);
  const result = await restored.acquireDownload(request);
  assert.equal(result.acquisition.status, 'pdf_ready');
  assert.equal(result.acquisition.sourceUrl, 'https://publisher.example/pdf');
  assert.equal(state.downloads, 1);
  assert.doesNotMatch(await fs.readFile(path.join(root, 'state', 'handoff.json'), 'utf8'), /temporary-link/);
  await fs.writeFile(result.acquisition.pdf, '%PDF-1.4\n' + 'x'.repeat(1200) + '\n%%EOF\n');
  await assert.rejects(restored.acquireDownload(request), /downloaded_pdf_changed/);
});
