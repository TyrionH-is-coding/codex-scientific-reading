import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import vm from 'node:vm';
import { browserPdf, inspectPdf } from '../src/browser-pdf.mjs';

async function fixture(t, bytes, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dlc-browser-pdf-'));
  const seen = [];
  const window = {};
  const context = vm.createContext({ window, location: { origin: 'https://publisher.example' }, Uint8Array, AbortSignal,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    fetch: async (url, init) => { seen.push({ url, init }); return new Response(bytes, { status: options.status ?? 200, headers: options.headers }); } });
  const proxy = http.createServer(async (request, response) => {
    assert.equal(new URL(request.url, 'http://local').searchParams.get('target'), 'chosen-visible-tab');
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    try { response.end(JSON.stringify({ value: await vm.runInContext(Buffer.concat(chunks).toString(), context) })); }
    catch { response.writeHead(500); response.end('{}'); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => proxy.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const request = { proxy: `http://127.0.0.1:${proxy.address().port}`, target: 'chosen-visible-tab',
    url: 'https://publisher.example/article.pdf', destination: path.join(root, 'paper.pdf') };
  return { root, window, seen, request };
}

test('浏览器协议传输跨多个块，字节和 SHA 读回一致，释放页内缓存且不覆盖文件', async t => {
  const bytes = Buffer.from('%PDF-1.4\n' + ' '.repeat(600000) + '\n%%EOF\n');
  const { window, request, seen } = await fixture(t, bytes);
  const result = await browserPdf(request);
  assert.deepEqual(await fs.readFile(result.pdf), bytes);
  assert.equal((await inspectPdf(result.pdf)).sha256, result.sha256);
  assert.equal(seen[0].init.credentials, 'include');
  assert.deepEqual(Object.keys(window), []);
  await assert.rejects(browserPdf(request), /EEXIST/);
  assert.deepEqual(await fs.readFile(result.pdf), bytes);
});

for (const [name, bytes, options, error] of [
  ['登录 HTML', '<html>login</html>', {}, 'invalid_pdf'],
  ['截断 PDF', '%PDF-1.4\n' + ' '.repeat(1200), {}, 'invalid_pdf'],
  ['无权限响应', 'denied', { status: 403 }, 'download_forbidden'],
  ['过大响应', '%PDF-', { headers: { 'content-length': '200000000' } }, 'pdf_too_large'],
]) test(`${name}不发布文件并清理暂存`, async t => {
  const { root, window, request } = await fixture(t, bytes, options);
  await assert.rejects(browserPdf(request), new RegExp(error));
  assert.deepEqual(await fs.readdir(root), []);
  assert.deepEqual(Object.keys(window), []);
});

test('拒绝远程浏览器代理和不匹配标签页，不读取登录信息', async t => {
  const { request, seen } = await fixture(t, '%PDF-');
  await assert.rejects(browserPdf({ ...request, proxy: 'https://remote.example/' }), /invalid_download_request/);
  await assert.rejects(browserPdf({ ...request, url: 'https://publisher.example/pdf?token=synthetic-secret' }), /invalid_download_request/);
  await assert.rejects(browserPdf({ ...request, url: 'https://user:synthetic-secret@publisher.example/pdf' }), /invalid_download_request/);
  await assert.rejects(browserPdf({ ...request, url: 'https://another.example/article.pdf' }), /browser_page_changed/);
  assert.equal(seen.length, 0);
});
