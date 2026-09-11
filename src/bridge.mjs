import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readJson } from './core.mjs';
import { Handoff } from './handoff.mjs';
import { engineAdapter, verifyReader, readJobInput, categoryGuard, cancelOwnedDispatch, inspectDispatchEvidence, CATEGORY_TOOLS } from './bridge-services.mjs';

export const name = 'codex-scientific-reading-bridge';
export const inject = ['tools', 'webServer', 'systemPrompt', 'agents', 'typertGateway'];

export async function apply(ctx, config) {
  const { root, engineConfig } = config;
  const instance = await readJson(path.join(root, '.workbench.json'));
  const installed = await readJson(path.join(root, 'installation.json'));
  const require = createRequire(installed.dsh);
  const api = await import(pathToFileURL(require.resolve('@dsh-external/dsh-scientific-reading')).href);
  const engine = engineAdapter(api, engineConfig);
  const url = () => `http://127.0.0.1:${ctx.webServer.port}`;
  const rpc = api.createNativeRpc(ctx);
  const claims = new WeakMap();
  ctx.on('agent/inbox/claimed', ({ agent, message, turn }) => {
    let claimed = claims.get(agent);
    if (claimed?.turn !== turn) claims.set(agent, claimed = { turn, rpcIds: new Set() });
    if (message.source?.kind === 'user') claimed.rpcIds.add(message.source.requestId ?? message.source.rpcId);
  });
  const service = await Handoff.open(root, { instance, engine,
    rpc,
    dispatchEvidence: async (sessionId, rpcId) => inspectDispatchEvidence(await sessionAgent(sessionId), rpcId),
    cancelTask: async task => {
      const agent = await sessionAgent(task.sessionId);
      return cancelOwnedDispatch(agent, task, claims.get(agent));
    },
    reader: (paper, scope) => verifyReader(engine, url(), paper, scope) });
  await service.prepareHost().catch(() => {});
  async function sessionAgent(sessionId) {
    // Native session.create restores a persisted inbox without sending a prompt.
    if (!ctx.agents.get(sessionId)) {
      const workspace = service.data.workspace ?? await service.prepareHost();
      await rpc('session.create', {
        sessionId, workspaceId: workspace.workspaceId, agentPreset: 'scientific-reading' });
    }
    const agent = ctx.agents.get(sessionId);
    if (!agent) throw new Error('native_session_unavailable');
    return agent;
  }
  // DSH guards are synchronous. Resolve the live binding in the async dispatch hook.
  ctx.tools.guard(categoryGuard);
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembly = await next();
    const bound = await service.scopeFor(context.agent?.session?.id);
    return { ...assembly, tools: bound?.scopeFolderId === '__paper__' ? assembly.tools.filter(tool => CATEGORY_TOOLS.has(tool.name)) : [] };
  });
  ctx.on('tools/execute', async (exec, next) => {
    const scope = await service.scopeFor(exec.agent?.session?.id);
    if (!scope || scope.scopeFolderId !== '__paper__' || !CATEGORY_TOOLS.has(exec.name)) throw new Error('scope_command_forbidden');
    // A's download status has a TS fast path; require the scoped Python fact first.
    if (exec.name === 'sr_job_status') {
      await engine(['job-status', '--job-id', exec.arguments.job_id], undefined, scope);
    }
    if (exec.name === 'sr_continue_full_read') {
      const job = await engine(['job-status', '--job-id', exec.arguments.job_id], undefined, scope);
      if (job.detail?.reason_code === 'translation_retry_limit') throw new Error('translation_retry_requires_user');
    }
    return api.withEngineScope(scope, next);
  });
  ctx.on('agent/created', ({ agent }) => {
    service.observeSession(agent.session.id, agent.session.header.parentSession);
    service.serial(() => service.save()).catch(() => {});
  });
  ctx.systemPrompt.section({ name: 'codex-reading-boundary', order: 190, text:
    '你负责本 chat 绑定的单篇论文。每轮先用 sr_paper_context 核对 paperId、已确认结论和最新 Figure 上下文；分类只用于归档。最新 Figure 版本取代之前选图，不能混用其他图片。图片未提供或模型不支持图像时明确说明；区分图像可见事实、作者原文结论和自己的推断，引用页码、block_id 与来源链接。用 csr_read_job_input 按 job_id 分页读取当前 gate 的 source_manifest_path 或 translations_json，再用 sr_continue_full_read 提交当前 required_input 指定的 JSON 合同；不要使用文件编辑器、shell 或浏览器。提交回执仅表示已交给后台，需用 sr_job_status 等待 queued/running 结束。翻译只补 remaining_block_ids 的缺失部分；每批最多自动补试两次，包括提交格式被工具拒绝后的修正。修订时读取最新 gate，保留已接受译文。translation_retry_limit 需要用户确认，不能自行重启任务。复核 revision_required 按 validation_error 修正后继续。遇到 PDF、密钥、用户阅读确认时保留任务并报告等待。跨文献读取、全局设置、移动归档和浏览器下载交给 Codex 总管理员。' });
  ctx.tools.register({ name: 'csr_read_job_input', description: '分页读取本篇论文真实任务 gate 的翻译源或复核材料，不接受任意文件路径。',
    parameters: { type: 'object', properties: { job_id: { type: 'string' }, field: { type: 'string', enum: ['source_manifest_path', 'translations_json'] }, offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 50000 } }, required: ['job_id', 'field'], additionalProperties: false },
    output: { schema: { type: 'object', properties: { job_id: { type: 'string' }, field: { type: 'string' }, offset: { type: 'integer' }, total: { type: 'integer' }, text: { type: 'string' }, nextOffset: { oneOf: [{ type: 'integer' }, { type: 'null' }] } }, required: ['job_id', 'field', 'offset', 'total', 'text', 'nextOffset'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async (args, exec) => readJobInput(root, engine, await service.scopeFor(exec.agent?.session?.id), args) });

  const required = value => {
    if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error('required_value');
    return value;
  };
  async function action(action, p = {}, signal) {
    switch (action) {
      case 'bind': return service.bindPaper(p.paperId);
      case 'chats_read': return api.readSelectedChats(engine, (method, payload) => rpc(method, payload),
        p.selection ? p : { ...await engine(['paper-chat'], { action: 'selection_get' }), ...p });
      case 'chats_select': return engine(['paper-chat'], { ...p, action: 'selection_save' });
      case 'chats_selection': return engine(['paper-chat'], { action: 'selection_get' });
      case 'chats_legacy': return engine(['paper-chat'], { action: 'legacy_list' });
      case 'chats_legacy_read': return api.readLegacyChat(engine, rpc, p);
      case 'figure_discuss': {
        const response = await fetch(url() + '/sr/api/chats/figure', {method:'POST', headers:{'Content-Type':'application/json', 'Origin':url(), 'x-sr-csrf':'1'}, body:JSON.stringify(p)});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'figure_discuss_failed');
        return result;
      }
      case 'model_run': {
        const response = await fetch(url() + '/sr/api/models/run', {method:'POST', signal, headers:{'Content-Type':'application/json', 'Origin':url(), 'x-sr-csrf':'1'}, body:JSON.stringify(p)});
        const result = await response.json();
        if (!response.ok) throw new Error('model_step_failed');
        return result;
      }
      case 'submit': return service.submit(p);
      case 'task': return service.task(p.taskId);
      case 'tasks': return service.list();
      case 'dispatch': return service.dispatch(p.taskId, p.retryKey);
      case 'resume': return service.operate(p.taskId, p.idempotencyKey, 'resume', p);
      case 'attach': return service.operate(p.taskId, p.idempotencyKey, 'attach', p);
      case 'acquisition': return service.acquire(p);
      case 'acquisition_download': return service.acquireDownload(p);
      case 'cancel': return service.cancel(p.taskId);
      case 'folder_archive':
        if (typeof p.archived !== 'boolean') throw new Error('archived_boolean_required');
        return service.archive(p.folderId, p.archived);
      case 'folders': return engine(['folder-list']);
      case 'folder_create': return engine(['folder-create', '--name', required(p.name)]);
      case 'folder_rename': {
        const result = await engine(['folder-rename', '--folder-id', required(p.folderId), '--name', required(p.name)]);
        return result;
      }
      case 'ingest': {
        const result = await engine(['library-ingest'], p.metadata);
        // The same detached metadata/abstract/XLSX pipeline used by A's tool.
        let derived;
        try { derived = await engine(['derived-enqueue', '--paper-id', result.paper_id]); }
        catch { derived = { status: 'pending', reason: 'enqueue_failed' }; }
        return { ...result, derived };
      }
      case 'item': return engine(['library-item-v2', '--paper-id', required(p.paperId)]);
      case 'personal_update': return engine(['personal-record-update', '--paper-id', required(p.paperId)], { fields: p.fields, expected: p.expected });
      case 'library_views': return engine(['library-views'], p);
      case 'radar': return engine(['radar'], p);
      case 'excel_sync': return engine(['xlsx-refresh', ...(p.folderId ? ['--folder-id', required(p.folderId)] : [])]);
      case 'excel_open': return engine(['xlsx-locate', '--paper-id', required(p.paperId), ...(p.folderId ? ['--folder-id', required(p.folderId)] : [])]);
      case 'environment': return engine(['environment-status']);
      case 'list': return engine(['library-list-v2', '--page', String(p.page ?? 1), '--page-size', String(p.pageSize ?? 50),
        ...(p.folderId ? ['--folder-id', required(p.folderId)] : []), ...(p.query ? ['--query', required(p.query)] : []),
        ...(p.readingState ? ['--reading-state', required(p.readingState)] : []),
        ...(p.personalRecentDays != null ? ['--personal-recent-days', String(p.personalRecentDays)] : []),
        ...(p.orderBy ? ['--order-by', required(p.orderBy)] : [])]);
      case 'move': {
        const folders = await engine(['folder-list']);
        const folder = folders.find(row => row.folder_id === p.folderId);
        if (!folder) throw new Error('folder_not_found');
        return engine(['classification-apply', '--input', '-'], { proposals: [{ paper_id: required(p.paperId), folder_name: folder.name, confidence: 1, tags: p.tags ?? [] }] });
      }
      case 'reader': return verifyReader(engine, url(), required(p.paperId));
      default: throw new Error('unknown_action');
    }
  }
  ctx.webServer.register({ kind: 'exact', path: '/__workbench/api', async handler(request, response) {
    const abort = new AbortController(); response.on('close', () => abort.abort());
    const send = (code, data) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
    if (request.method !== 'POST') return send(405, { ok: false, error: 'post_required' });
    if (request.headers.host !== new URL(url()).host || (request.headers.origin && request.headers.origin !== url())
      || !request.headers['content-type']?.startsWith('application/json')) return send(403, { ok: false, error: 'local_json_required' });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('request_too_large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body.instanceId !== instance.instanceId) throw new Error('instance_mismatch');
      send(200, { ok: true, value: await action(body.action, body.payload, abort.signal) });
    } catch (error) {
      send(400, { ok: false, error: /^[a-z0-9_-]+$/i.test(error.message) ? error.message : 'request_failed' });
    }
  } });
}
