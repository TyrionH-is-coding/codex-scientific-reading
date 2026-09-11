import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const archive = new URL('../inputs/scientific-reading.tgz', import.meta.url);
const script = new URL('../scripts/fetch-engine.mjs', import.meta.url);

async function fixture(t, { published = true } = {}) {
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
  for (const directory of ['scripts', 'src', 'runtime']) await fs.mkdir(path.join(root, directory));
  const isolatedScript = path.join(root, 'scripts', 'fetch-engine.mjs');
  await fs.copyFile(script, isolatedScript);
  for (const file of ['core.mjs', 'platform.mjs']) await fs.copyFile(new URL('../src/' + file, import.meta.url), path.join(root, 'src', file));
  const pins = JSON.parse(await fs.readFile(new URL('../runtime/pins.json', import.meta.url), 'utf8'));
  pins.plugin.url = published ? 'https://github.com/TyrionH-is-coding/deep-literature-for-dsh/releases/download/fixture/engine.tgz' : null;
  await fs.writeFile(path.join(root, 'runtime', 'pins.json'), JSON.stringify(pins));
  const run = (download = false) => spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import fs from 'node:fs/promises';
    globalThis.fetch = async url => {
      if (!${download}) throw new Error('unexpected_engine_download');
      if (url !== ${JSON.stringify(pins.plugin.url)}) throw new Error('unexpected_engine_url');
      return new Response(await fs.readFile(new URL(${JSON.stringify(archive.href)})));
    };
    await import(${JSON.stringify(pathToFileURL(isolatedScript).href)});
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

test('未发布候选缺少随包引擎时明确失败，不猜测 Release 地址', async t => {
  const f = await fixture(t, { published: false });
  const result = f.run(true);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /engine_unpublished_candidate_requires_bundled_archive/);
  await assert.rejects(fs.access(f.target), { code: 'ENOENT' });
});

test('已发布引擎缺少本地包时从固定地址下载并校验', async t => {
  const f = await fixture(t);
  const result = f.run(true);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readFile(f.target), await fs.readFile(archive));
});
