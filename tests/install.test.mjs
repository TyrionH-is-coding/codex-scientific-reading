import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { initializeRoot, installSkill, readJson, writeJson } from '../src/core.mjs';
import { activateRelease } from '../src/releases.mjs';

async function skillFixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-install-skill-'));
  t.after(async () => {
    const resolved = await fs.realpath(temporary);
    const temp = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(), temp.toLowerCase());
    assert.ok(path.basename(resolved).toLowerCase().startsWith('csr-install-skill-'));
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const { root } = await initializeRoot(path.join(temporary, 'instance'));
  const skills = path.join(temporary, 'skills');
  const candidate = async id => {
    const slot = path.join(root, 'releases', id.repeat(16));
    const source = path.join(slot, 'app', 'skills', 'codex-scientific-reading');
    await fs.mkdir(source, { recursive: true });
    await fs.mkdir(path.join(slot, 'profile-modules'));
    await fs.writeFile(path.join(source, 'SKILL.md'), `packaged skill ${id}`);
    const release = { product: 'codex-scientific-reading', version: id, appSha256: id.repeat(64),
      slot, app: path.join(slot, 'app'), profileModules: path.join(slot, 'profile-modules'), dataFormat: 4 };
    await writeJson(path.join(slot, 'release.json'), release);
    return { source, release };
  };
  const lifecycle = {
    status: async () => ({ status: 'stopped' }),
    stop: async () => ({ status: 'stopped' }),
    start: async () => ({ status: 'running' }),
  };
  return { root, skills, candidate, lifecycle, target: path.join(skills, 'codex-scientific-reading'),
    receipt: path.join(root, 'state', 'installed-skill.json') };
}

test('发布已升级后，定制 Skill 冲突作为保留结果返回，不误报安装失败', async t => {
  const f = await skillFixture(t);
  const previous = await f.candidate('a'), next = await f.candidate('b');
  await activateRelease(f.root, previous.release, { lifecycle: f.lifecycle });
  await installSkill(previous.source, f.skills, f.root);
  const receiptBefore = await fs.readFile(f.receipt);
  const custom = '用户合成修改：安装升级后应保留';
  await fs.writeFile(path.join(f.target, 'SKILL.md'), custom);

  const selected = await activateRelease(f.root, next.release, { lifecycle: f.lifecycle });
  assert.equal(selected.status, 'upgraded');
  await assert.rejects(fs.access(path.join(f.root, 'state', 'release-transition.json')), { code: 'ENOENT' });
  const skill = await installSkill(next.source, f.skills, f.root);

  assert.deepEqual(skill, { status: 'retained_custom_changes', reason: 'skill_conflict', path: f.target });
  assert.equal((await readJson(path.join(f.root, 'installation.json'))).appSha256, next.release.appSha256);
  assert.equal(await fs.readFile(path.join(f.target, 'SKILL.md'), 'utf8'), custom);
  assert.deepEqual(await fs.readFile(f.receipt), receiptBefore);
});

test('未被本实例管理的同名 Skill 保留且不创建所有权收据', async t => {
  const f = await skillFixture(t);
  const candidate = await f.candidate('a');
  await fs.mkdir(f.target, { recursive: true });
  await fs.writeFile(path.join(f.target, 'SKILL.md'), 'existing custom skill');
  const result = await installSkill(candidate.source, f.skills, f.root);
  assert.equal(result.status, 'retained_custom_changes');
  assert.equal(result.reason, 'skill_conflict');
  assert.equal(await fs.readFile(path.join(f.target, 'SKILL.md'), 'utf8'), 'existing custom skill');
  await assert.rejects(fs.access(f.receipt), { code: 'ENOENT' });
});

test('Skill 收据损坏等真实错误仍拒绝，不当成可忽略冲突', async t => {
  const f = await skillFixture(t);
  const candidate = await f.candidate('a');
  await installSkill(candidate.source, f.skills, f.root);
  await fs.writeFile(path.join(f.target, 'SKILL.md'), 'custom content');
  await fs.writeFile(f.receipt, '{invalid receipt');
  await assert.rejects(installSkill(candidate.source, f.skills, f.root), SyntaxError);
  assert.equal(await fs.readFile(path.join(f.target, 'SKILL.md'), 'utf8'), 'custom content');
  assert.equal(await fs.readFile(f.receipt, 'utf8'), '{invalid receipt');
  await assert.rejects(installSkill(path.join(f.root, 'missing-source'), f.skills, f.root), { code: 'ENOENT' });
});

test('错误插件校验在创建安装根或发起下载前失败', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-install-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const bad = path.join(temporary, 'bad.tgz');
  const root = path.join(temporary, 'new-install');
  await fs.writeFile(bad, 'not a release');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-File', 'install.ps1',
    '-Root', root, '-PluginArchive', bad], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /plugin_checksum_mismatch/);
  await assert.rejects(fs.access(root), { code: 'ENOENT' });
});

test('发行源文件被破坏时在引导安装前拒绝，安装根保持不存在', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-source-check-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.mkdir(path.join(temporary, 'runtime'));
  await fs.copyFile('install.ps1', path.join(temporary, 'install.ps1'));
  await fs.copyFile('runtime/pins.json', path.join(temporary, 'runtime/pins.json'));
  const source = path.join(temporary, 'verified.txt');
  await fs.writeFile(source, Buffer.alloc(5));
  await fs.writeFile(path.join(temporary, 'BUILD-MANIFEST.json'), JSON.stringify({ files: {
    'verified.txt': createHash('sha256').update('valid').digest('hex'),
  } }));
  const root = path.join(temporary, 'new-install');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(temporary, 'install.ps1'),
    '-Root', root, '-PluginArchive', source], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /source_checksum_mismatch/);
  await assert.rejects(fs.access(root), { code: 'ENOENT' });
});
