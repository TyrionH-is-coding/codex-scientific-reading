import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const archive = new URL('../inputs/scientific-reading.tgz', import.meta.url);
const script = new URL('../scripts/fetch-engine.mjs', import.meta.url);

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-fetch-engine-'));
  t.after(async () => {
    const resolved = await fs.realpath(root);
    const temporary = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(), temporary.toLowerCase());
    assert.ok(path.basename(resolved).startsWith('dl-fetch-engine-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const target = path.join(root, 'inputs', 'scientific-reading.tgz');
  await fs.mkdir(path.dirname(target));
  const run = (download = false) => spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import fs from 'node:fs/promises';
    globalThis.fetch = async () => {
      if (!${download}) throw new Error('unexpected_engine_download');
      return new Response(await fs.readFile(new URL(${JSON.stringify(archive.href)})));
    };
    await import(${JSON.stringify(script.href)});
  `], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  return { target, run };
}

test('源码自带的固定引擎包通过校验后无需访问 Release', async t => {
  const f = await fixture(t);
  const bytes = await fs.readFile(archive);
  await fs.writeFile(f.target, bytes);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readFile(f.target), bytes);
});

test('本地引擎包 SHA 不匹配时拒绝使用并保留文件', async t => {
  const f = await fixture(t);
  await fs.writeFile(f.target, 'damaged engine fixture');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum_mismatch/);
  assert.equal(await fs.readFile(f.target, 'utf8'), 'damaged engine fixture');
});

test('缺少本地引擎包时仍下载并校验固定版本', async t => {
  const f = await fixture(t);
  const result = f.run(true);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readFile(f.target), await fs.readFile(archive));
});
