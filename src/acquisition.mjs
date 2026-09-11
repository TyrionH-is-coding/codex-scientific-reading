import path from 'node:path';
import { createHash } from 'node:crypto';
import { browserPdf, inspectPdf } from './browser-pdf.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const fingerprint = request => hash(JSON.stringify(Object.fromEntries(Object.entries(request).sort(([a], [b]) => a.localeCompare(b)))));
const active = task => task.status === 'waiting_user' && task.job?.detail?.reason_code === 'pdf_required' && !task.cancelRequested;
const actions = {
  awaiting_institution_choice: { kind: 'ask_institution', message: '尚未取得 OA 正文。你是否有高校或机构的图书馆访问权限，并愿意通过它获取这篇论文？' },
  awaiting_library_url: { kind: 'ask_library_url', message: '请提供你平时使用的图书馆电子资源入口；登录请在浏览器中完成。' },
  ready: { kind: 'begin_browser', message: '记录 begin 后，用用户授权的浏览器打开图书馆入口，按 DOI 或准确题名定位论文。' },
  browsing: { kind: 'browse', message: '沿当前机构入口寻找匹配论文和正文 PDF；需要登录或验证时交给用户。' },
  login_required: { kind: 'user_login', message: '请在当前浏览器页面完成机构登录，完成后从同一页面继续。' },
  verification_required: { kind: 'user_verification', message: '请在当前页面完成验证，完成后继续原论文。' },
  manual_required: { kind: 'manual_pdf', message: '当前路径未取得正文 PDF；可补入本地 PDF，或在用户明确要求后重试。' },
  downloading: { kind: 'check_download_receipt', message: '下载正在执行或回执待核对；使用原请求键恢复，不重复启动。' },
  pdf_ready: { kind: 'attach', message: '将 pdf 路径以 sourceType=codex_authorized 交给原任务 attach，之后读回任务。' },
  attached: { kind: 'none', message: 'PDF 已交给原任务，继续读取解析和精读状态。' },
};

export function refreshAcquisition(task) {
  if (active(task) && !task.acquisition) task.acquisition = { status: 'awaiting_institution_choice', revision: 0, attempts: 0 };
  if (task.acquisition) task.acquisition.nextAction = active(task) ? actions[task.acquisition.status] : { kind: 'none' };
}

function checkRequest(request, extra) {
  const allowed = new Set(['taskId', 'idempotencyKey', 'expectedRevision', ...extra]);
  if (Object.keys(request).some(key => !allowed.has(key)) || typeof request.idempotencyKey !== 'string'
    || !request.idempotencyKey.trim() || request.idempotencyKey.length > 300 || !Number.isInteger(request.expectedRevision)) {
    throw new Error('invalid_acquisition_request');
  }
}

function libraryUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('public_library_url_required'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || value.length > 2000
    || /(?:token|ticket|password|cookie|secret|authorization|session|api[_-]?key|(?:[?&#])(?:code|state|key)=)/i.test(decodeURIComponent(url.search + url.hash))) {
    throw new Error('public_library_url_required');
  }
  return url.href;
}

function update(task, values) {
  Object.assign(task.acquisition, values, { revision: task.acquisition.revision + 1 });
  refreshAcquisition(task);
}

export function attachedAcquisition(task, sha256, sourceType) {
  if (task.acquisition) update(task, { status: 'attached', sha256, sourceType });
}

async function context(service, request) {
  const { task } = await service.checkedTask(request.taskId);
  await service._refresh(task);
  const key = hash(request.idempotencyKey), signature = fingerprint(request);
  const previous = task.acquisitionReceipts?.[key];
  if (previous && previous.fingerprint !== signature) throw new Error('idempotency_conflict');
  return { task, key, signature, previous };
}

function checkActive(task, request) {
  if (!active(task)) throw new Error('pdf_acquisition_not_active');
  if (task.acquisition.revision !== request.expectedRevision) throw new Error('acquisition_revision_conflict');
}

export async function acquire(service, request) {
  checkRequest(request, ['event', 'hasAccess', 'libraryUrl']);
  const { task, key, signature, previous } = await context(service, request);
  if (previous) return structuredClone(task);
  checkActive(task, request);
  const current = task.acquisition;
  if (['downloading', 'pdf_ready', 'attached'].includes(current.status)) throw new Error('acquisition_transition_invalid');
  let changes;
  if (request.event === 'institution') {
    if (typeof request.hasAccess !== 'boolean' || (request.hasAccess === false && request.libraryUrl !== undefined)) throw new Error('invalid_acquisition_request');
    changes = { hasAccess: request.hasAccess, reason: request.hasAccess ? null : 'no_institution_access',
      libraryUrl: request.libraryUrl === undefined ? null : libraryUrl(request.libraryUrl),
      status: request.hasAccess ? (request.libraryUrl ? 'ready' : 'awaiting_library_url') : 'manual_required' };
  } else if (request.event === 'manual') {
    changes = { status: 'manual_required', reason: 'user_declined' };
  } else if (request.event === 'library' && current.hasAccess === true) {
    changes = { libraryUrl: libraryUrl(request.libraryUrl), status: 'ready', reason: null };
  } else if (['begin', 'retry'].includes(request.event) && current.hasAccess === true && current.libraryUrl) {
    if (request.event === 'begin' && current.status !== 'ready') throw new Error('acquisition_transition_invalid');
    if (request.event === 'retry' && !['login_required', 'verification_required', 'manual_required'].includes(current.status)) throw new Error('acquisition_transition_invalid');
    changes = current.attempts >= 2 ? { status: 'manual_required', reason: 'attempt_limit' }
      : { status: 'browsing', attempts: current.attempts + 1, reason: null };
  } else if (['login_required', 'verification_required', 'no_entitlement', 'no_pdf', 'browser_unavailable', 'download_failed'].includes(request.event)
    && current.status === 'browsing') {
    changes = { status: ['login_required', 'verification_required'].includes(request.event) ? request.event : 'manual_required', reason: request.event };
  } else throw new Error('acquisition_transition_invalid');
  if ((request.event !== 'institution' && request.hasAccess !== undefined) || (!['institution', 'library'].includes(request.event) && request.libraryUrl !== undefined)) {
    throw new Error('invalid_acquisition_request');
  }
  update(task, changes);
  (task.acquisitionReceipts ??= {})[key] = { fingerprint: signature, status: 'completed' };
  await service.save();
  return structuredClone(task);
}

export async function acquireDownload(service, request) {
  checkRequest(request, ['proxy', 'target', 'url']);
  const { task, key, signature, previous } = await context(service, request);
  if (previous?.status === 'failed') return structuredClone(task);
  if (previous?.status === 'completed') {
    const actual = await inspectPdf(previous.pdf);
    if (actual.sha256 !== previous.sha256) throw new Error('downloaded_pdf_changed');
    return structuredClone(task);
  }
  if (!previous) {
    if (!active(task) || task.acquisition?.hasAccess !== true || task.acquisition.status !== 'browsing') throw new Error('institution_download_not_ready');
    checkActive(task, request);
  } else if (!active(task)) throw new Error('pdf_acquisition_not_active');
  const destination = path.join(service.root, 'workspace', 'downloads', hash(task.taskId), key + '.pdf');
  const receipt = (task.acquisitionReceipts ??= {})[key] ??= { fingerprint: signature, status: 'prepared' };
  if (!previous) { update(task, { status: 'downloading' }); await service.save(); }
  try {
    // A prior prepared receipt may already have a fully validated, atomically published file.
    // Never repeat a browser request after losing its receipt.
    if (!previous) await (service.downloadPdf ?? browserPdf)({ ...request, destination });
    const result = await inspectPdf(destination);
    const source = new URL(request.url); source.search = ''; source.hash = ''; source.username = ''; source.password = '';
    update(task, { status: 'pdf_ready', reason: null, pdf: destination, sha256: result.sha256, bytes: result.bytes, sourceUrl: source.href });
    Object.assign(receipt, { status: 'completed', pdf: destination, sha256: result.sha256 });
  } catch (error) {
    const reason = previous ? 'download_interrupted' : ['invalid_pdf', 'pdf_too_large', 'browser_unavailable', 'browser_page_changed', 'download_timeout', 'download_forbidden'].includes(error.message) ? error.message : 'download_failed';
    update(task, { status: 'manual_required', reason });
    receipt.status = 'failed';
  }
  await service.save();
  return structuredClone(task);
}
