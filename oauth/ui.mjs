export function loginPage(nonce) {
  return `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codex 订阅 · Deep Literature for Codex</title>
<style nonce="${nonce}">
:root{--paper:#fffef9;--ink:#252822;--muted:#6e726a;--line:#d9d6ca;--accent:#405f54;--font-ui:"Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;--font-heading:Georgia,"Source Han Serif SC","Noto Serif CJK SC","Songti SC",serif;color-scheme:light}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#f3f1eb;color:var(--ink);font:14px/1.7 var(--font-ui)}main{max-width:900px;margin:40px auto;padding:0 24px}a{color:var(--accent);text-underline-offset:4px}h1{font:600 32px/1.4 var(--font-heading);margin:12px 0}h2{font:600 20px/1.5 var(--font-heading);margin:0 0 16px}.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:24px;margin:20px 0}.muted{color:var(--muted)}button,.button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;font:500 13px/1.5 var(--font-ui);border:1px solid var(--line);background:var(--paper);border-radius:8px;padding:7px 12px;cursor:pointer;color:var(--ink);text-decoration:none}button:hover:not(:disabled),.button:hover{border-color:var(--accent);background:#e9eee8}button.primary{background:var(--accent);border-color:var(--accent);color:white}button:disabled{opacity:.5;cursor:not-allowed}:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.badge{display:inline-block;border-radius:20px;padding:4px 12px;background:#e9eee8;color:var(--accent);font-size:12px}#feedback{min-height:1.7em;color:#93642c}li{margin:10px 0}small{font-size:12px}@media(max-width:600px){main{margin:24px auto;padding:0 16px}h1{font-size:27px}.card{padding:20px 16px}}
</style>
<main><a href="/">← 返回 Deep Literature for Codex</a><h1>Codex 订阅</h1>
<p class="muted">使用 ChatGPT 账号连接此工作台。</p>
<section class="card"><h2>登录状态</h2><span id="status" class="badge" role="status">正在读取状态…</span><p id="plan" class="muted"></p>
<div class="actions"><button id="login" class="primary" disabled>使用 ChatGPT 登录</button><button id="cancel" disabled>取消登录</button><button id="logout" disabled>退出登录</button><button id="refresh">刷新状态</button></div>
<p><a id="authorize" class="button" hidden target="_blank" rel="noopener noreferrer">打开 OpenAI 授权页</a></p><p id="feedback" role="status"></p>
<small class="muted">登录后，返回工作台选择 OpenAI Codex 模型。使用订阅额度，不按 API 计费。</small></section>
<section class="card"><h2>账号额度</h2><p class="muted">同一账号的 Codex 额度在各客户端共享。</p><div id="usage">登录后查看额度。</div></section>

</main><script nonce="${nonce}">
const byId = id => document.getElementById(id);
let pending = false;
let busy = false;
async function api(suffix = '', method = 'GET') {
  const response = await fetch('/api/codex-oauth' + suffix, {method, cache: 'no-store', credentials: 'same-origin'});
  if (!response.ok) throw new Error('操作未完成，请重试或重新启动工作台。');
  return response.json();
}
function clearLink() { byId('authorize').hidden = true; byId('authorize').removeAttribute('href'); }
function quotaWindow(label, value) {
  if (!value) return label + '：暂不可用';
  let text = label + '：剩余 ' + value.remainingPercent + '%';
  if (value.resetsAt !== null) text += '，重置于 ' + new Date(value.resetsAt * 1000).toLocaleString();
  return text;
}
async function refresh() {
  if (busy) return;
  try {
    const state = await api();
    pending = state.login && ['pending','starting'].includes(state.login.status);
    const labels = {authenticated:'已登录', unauthenticated:'未登录', unavailable:'状态暂不可用', unsupported_auth:'请使用 ChatGPT 账号登录'};
    byId('status').textContent = pending ? '等待您完成登录' : (labels[state.status] || '状态暂不可用');
    byId('plan').textContent = state.planType ? '订阅：' + state.planType : '';
    byId('login').disabled = pending || state.authenticated;
    byId('cancel').disabled = !pending;
    byId('logout').disabled = !state.authenticated;
    if (!pending) clearLink();
    if (state.login && state.login.status === 'failed') byId('feedback').textContent = '登录未完成，请重新发起登录。';
    if (!state.authenticated) { byId('usage').textContent = '登录后查看额度。'; return; }
    const usage = await api('/usage');
    byId('usage').replaceChildren();
    if (usage.status !== 'available') { byId('usage').textContent = '额度暂不可用，请稍后刷新。'; return; }
    const list = document.createElement('ul');
    for (const [index, bucket] of usage.buckets.entries()) {
      const item = document.createElement('li');
      item.textContent = (bucket.name || (usage.buckets.length === 1 ? 'Codex' : '额度 ' + (index + 1))) + '：' + [bucket.primary, bucket.secondary].filter(Boolean).map(value => quotaWindow(value.windowDurationMins ? (value.windowDurationMins >= 1440 ? value.windowDurationMins / 1440 + ' 天' : value.windowDurationMins / 60 + ' 小时') : '额度', value)).join('；');
      list.appendChild(item);
    }
    byId('usage').appendChild(list);
  } catch (error) { byId('status').textContent = '状态暂不可用'; byId('feedback').textContent = '状态读取失败，请刷新重试。'; }
}
async function action(suffix) {
  if (busy) return;
  busy = true;
  byId('feedback').textContent = '';
  try {
    const result = await api(suffix, 'POST');
    if (suffix === '/login') {
      byId('authorize').href = result.authUrl;
      byId('authorize').hidden = false;
      byId('feedback').textContent = '点击“打开 OpenAI 授权页”完成登录，然后返回本页。';
    } else { clearLink(); }
  } catch (error) { byId('feedback').textContent = '操作未完成，请重试。'; }
  finally { busy = false; await refresh(); }
}
byId('login').addEventListener('click', () => action('/login'));
byId('cancel').addEventListener('click', () => action('/cancel'));
byId('logout').addEventListener('click', () => action('/logout'));
byId('refresh').addEventListener('click', refresh);
setInterval(() => { if (pending) refresh(); }, 2000);
refresh();
</script></html>`
}
