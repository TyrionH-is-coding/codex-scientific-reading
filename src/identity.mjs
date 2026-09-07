import { DISPLAY_NAME } from './core.mjs';
export const name = 'codex-scientific-reading-identity';
export const inject = ['webServer'];

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
        <title>Deep Literature for Codex · 实例</title><style>body{font:16px/1.6 system-ui;margin:4rem auto;padding:0 1.5rem;max-width:46rem;color:#24303a}dt{color:#64707a;margin-top:1rem}dd{margin:0;overflow-wrap:anywhere}a{display:inline-block;margin-top:2rem;color:#245ecc}</style>
        <h1>${escape(DISPLAY_NAME)} 已启动</h1><p>${identity.candidate ? '发布候选版本' : '版本'} ${escape(identity.version)}</p>
        <h2>先连接本工作台使用的模型</h2>
        <p>外层 Codex 的登录不会自动传入这个独立实例。选择已有的模型 API，或连接 Codex 订阅；已有配置可直接继续。</p>
        <p><a href="/api/codex-oauth/ui">连接 / 查看 Codex 订阅</a>　<a href="/">使用 DSH 原生模型配置</a></p>
        <p>订阅页会显示本人登录状态与可用模型。完成授权后返回 DSH，选择 OpenAI Codex、模型与推理强度。</p>
        <h2>准备全文解析</h2><p>在 DSH 的“设置与状态”保存 MinerU API Token。已保存与真实调用验证是两个状态；需要解析时再配置，也可以先浏览文献库。</p>
        <p>Excel 编辑后先保存并关闭，再对 Codex 说“同步文献表”；同步结果会显示行数、时间或具体冲突。</p>
        <dl><dt>产品</dt><dd>${escape(DISPLAY_NAME)}</dd><dt>实例 ID</dt><dd>${escape(identity.instanceId)}</dd>
        <dt>本次启动 ID</dt><dd>${escape(identity.launchId)}</dd></dl><p><a href="/">进入 Deep Literature for Codex</a></p>
        <p><a href="/api/codex-oauth/ui">Codex 订阅登录与额度</a></p></html>`);
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
    process.send?.({ type: 'workbench-ready', ...identity, url: `http://127.0.0.1:${port}` });
    return true;
  };
  const timer = setInterval(() => { if (announce()) clearInterval(timer); }, 100);
  timer.unref?.();
  ctx.get('loader').await().then(() => { announce(); clearInterval(timer); }).catch(() => clearInterval(timer));
}
