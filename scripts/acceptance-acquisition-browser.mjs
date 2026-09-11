// Local synthetic acceptance only. Never connects to an existing browser or user profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { browserPdf } from '../src/browser-pdf.mjs';

const executable = process.argv[2];
if (!executable) throw new Error('pass_chromium_executable');
const output = path.resolve(process.argv[3] ?? 'outputs/acquisition-browser-acceptance.json');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'dlc-browser-acceptance-'));
const pdf = Buffer.from('%PDF-1.4\n' + ' '.repeat(600000) + '\n%%EOF\n');
let browser, socket, site, proxy;
let requestId = 0;
const pending = new Map();
const results = [];
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function command(method, params = {}) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('cdp_timeout')); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  site = http.createServer((request, response) => {
    if (request.url === '/paper.pdf') { response.writeHead(200, { 'Content-Type': 'application/pdf' }); response.end(pdf); }
    else { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<html><body>Synthetic article <a href="/paper.pdf">PDF</a></body></html>'); }
  });
  await listen(site);
  const origin = `http://127.0.0.1:${site.address().port}`;
  const profile = path.join(temporary, 'isolated-browser');
  browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'],
  { windowsHide: true, shell: false, stdio: 'ignore' });
  const closed = new Promise(resolve => browser.once('close', resolve));
  let port;
  for (let i = 0; i < 50; i++) {
    try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await pause(100); }
  }
  if (!port) throw new Error('isolated_browser_did_not_start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(value => value.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error('cdp_error')); else waiter.resolve(message.result);
  });
  await command('Page.navigate', { url: origin + '/article' });
  for (let i = 0; i < 40; i++) {
    const result = await command('Runtime.evaluate', { expression: 'location.origin + " " + document.readyState', returnByValue: true });
    if (result.result.value === origin + ' complete') break;
    await pause(100);
  }
  proxy = http.createServer(async (request, response) => {
    const address = new URL(request.url, 'http://local');
    if (address.pathname !== '/eval' || address.searchParams.get('target') !== target.id) { response.writeHead(404); response.end(); return; }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    try {
      const result = await command('Runtime.evaluate', { expression: Buffer.concat(chunks).toString('utf8'), awaitPromise: true, returnByValue: true });
      response.end(JSON.stringify({ value: result.result.value }));
    } catch { response.writeHead(500); response.end('{}'); }
  });
  await listen(proxy);
  const request = { proxy: `http://127.0.0.1:${proxy.address().port}`, target: target.id,
    url: origin + '/paper.pdf', destination: path.join(temporary, 'download.pdf') };
  const downloaded = await browserPdf(request);
  assert.deepEqual(await fs.readFile(downloaded.pdf), pdf);
  results.push({ check: 'real_chromium_multi_chunk_download_and_sha', passed: true, bytes: downloaded.bytes, sha256: downloaded.sha256 });
  await assert.rejects(browserPdf({ ...request, url: origin + '/login', destination: path.join(temporary, 'login.pdf') }), /invalid_pdf/);
  results.push({ check: 'real_chromium_rejects_html', passed: true });
  const cache = await command('Runtime.evaluate', { expression: 'Object.keys(window).filter(key=>key.startsWith("__dlcPdf_"))', returnByValue: true });
  assert.deepEqual(cache.result.value, []);
  results.push({ check: 'browser_buffers_cleared', passed: true });
  await command('Browser.close').catch(() => {});
  await Promise.race([closed, pause(3000)]);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ passed: true, checks: results, limitations: 'Synthetic local article and PDF transfer only; no real institution login, publisher entitlement, scientific identity or parsing acceptance.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: results.length, output }));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) browser.kill();
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  if (site) await new Promise(resolve => site.close(resolve));
  // Only the freshly created, checked temp directory is removed.
  if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('dlc-browser-acceptance-')) throw new Error('unsafe_cleanup_path');
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
