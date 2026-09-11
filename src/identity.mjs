import { DISPLAY_NAME } from './core.mjs';
export const name = 'codex-scientific-reading-identity';
export const inject = ['webServer', 'connection'];

export function apply(ctx) {
  const identity = { ...JSON.parse(process.env.CSR_IDENTITY), pid: process.pid, displayName: DISPLAY_NAME };
  const dispose = ctx.webServer.register({ kind: 'exact', path: '/__workbench/identity',
    handler(request, response) {
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(identity));
    },
  });
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const disposePage = ctx.webServer.register({ kind: 'exact', path: '/__workbench',
    handler(request, response) {
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Deep Literature for Codex</title><style>*{box-sizing:border-box}html{background:#f3f1eb;color-scheme:light}body{font:14px/1.7 "Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;margin:40px auto;padding:28px 32px;max-width:850px;background:#fffef9;color:#252822;border:1px solid #d9d6ca;border-radius:12px}h1,h2{font-family:Georgia,"Source Han Serif SC","Noto Serif CJK SC","Songti SC",serif;font-weight:600}h1{font-size:30px;line-height:1.4;margin:0 0 12px}h2{font-size:20px;margin:28px 0 12px;padding-top:20px;border-top:1px solid #d9d6ca}dt{color:#6e726a;margin-top:16px;font-size:12px}dd{margin:4px 0;overflow-wrap:anywhere}a{display:inline-block;padding:6px 0;color:#405f54;text-underline-offset:4px}:focus-visible{outline:2px solid #405f54;outline-offset:3px}@media(max-width:900px){body{margin:16px;padding:24px 20px}h1{font-size:25px}}</style>
        <h1>${escape(DISPLAY_NAME)} 已启动</h1><p>${identity.candidate ? '发布候选版本' : '版本'} ${escape(identity.version)}</p>
        <h2>连接模型</h2>
        <p>此工作台需单独连接模型。已配置可直接进入。</p>
        <p><a href="/api/codex-oauth/ui">连接 Codex 订阅</a>　<a href="/">配置模型 API</a></p>
        <h2>解析 PDF</h2><p>需要解析 PDF 时，在右上角“文献设置”填写 MinerU API Key。</p>
        <p>编辑 Excel 后，保存并关闭，再对 Codex 说“同步文献表”。</p>
        <p><a href="/">进入文献库</a></p></html>`);
    },
  });
  const onMessage = message => {
    if (message?.type === 'workbench-stop' && message.launchId === identity.launchId) {
      // Invoke DSH's own shutdown handler in-process; Windows kill() skips signal handlers.
      process.emit('SIGTERM');
    }
  };
  const onDisconnect = () => process.emit('SIGTERM');
  process.on('message', onMessage);
  process.on('disconnect', onDisconnect);
  ctx.on('dispose', () => { dispose(); disposePage(); process.off('message', onMessage); process.off('disconnect', onDisconnect); });
  let announced = false;
  const announce = () => {
    const port = ctx.webServer.port;
    if (announced || !port) return false;
    announced = true;
    const url = `http://127.0.0.1:${port}`;
    process.send?.({ type: 'workbench-ready', ...identity, url, browserUrl: ctx.connection.authenticatedUrl(url) });
    return true;
  };
  const timer = setInterval(() => { if (announce()) clearInterval(timer); }, 100);
  timer.unref?.();
  ctx.get('loader').await().then(() => { announce(); clearInterval(timer); }).catch(() => clearInterval(timer));
}
