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
    const source = path.join(slot, 'app', 'skills', 'deep-literature-for-codex');
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
  return { root, skills, candidate, lifecycle, target: path.join(skills, 'deep-literature-for-codex'),
    receipt: path.join(root, 'state', 'installed-skill.json') };
}

async function legacySkill(f, managed = true) {
  const target = path.join(f.skills, 'codex-scientific-reading');
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, 'SKILL.md'), 'old managed skill');
  await writeJson(path.join(target, 'installation.json'), { product: 'codex-scientific-reading', root: f.root });
  const files = {};
  for (const name of await fs.readdir(target)) files[name] = createHash('sha256').update(await fs.readFile(path.join(target, name))).digest('hex');
  if (managed) await writeJson(f.receipt, { target, files });
  return target;
}

test('改名后迁移未修改的旧 Skill，保留同一实例与安装根', async t => {
  const f = await skillFixture(t);
  const previous = await legacySkill(f);
  const marker = await fs.readFile(path.join(f.root, '.workbench.json'));
  const candidate = await f.candidate('a');
  const result = await installSkill(candidate.source, f.skills, f.root);
  assert.equal(result.path, f.target);
  assert.equal(result.legacySkill.status, 'removed');
  await assert.rejects(fs.access(previous), { code: 'ENOENT' });
  assert.equal((await readJson(path.join(f.target, 'installation.json'))).root, f.root);
  assert.deepEqual(await fs.readFile(path.join(f.root, '.workbench.json')), marker);
  assert.equal((await readJson(f.receipt)).target, f.target);
});

test('改名保留定制或非本实例所有的旧 Skill', async t => {
  for (const managed of [true, false]) {
    const f = await skillFixture(t);
    const previous = await legacySkill(f, managed);
    await fs.writeFile(path.join(previous, 'SKILL.md'), '用户定制内容');
    const result = await installSkill((await f.candidate('a')).source, f.skills, f.root);
    assert.equal(result.path, f.target);
    if (managed) assert.equal(result.legacySkill.status, 'retained_custom_changes');
    assert.equal(await fs.readFile(path.join(previous, 'SKILL.md'), 'utf8'), '用户定制内容');
    assert.equal((await readJson(f.receipt)).target, f.target);
  }
});

test('新名称被定制 Skill 占用时，不删除旧入口或改写其收据', async t => {
  const f = await skillFixture(t);
  const previous = await legacySkill(f);
  const before = await fs.readFile(f.receipt);
  await fs.mkdir(f.target);
  await fs.writeFile(path.join(f.target, 'SKILL.md'), 'another custom skill');
  const result = await installSkill((await f.candidate('a')).source, f.skills, f.root);
  assert.equal(result.status, 'retained_custom_changes');
  assert.equal(await fs.readFile(path.join(previous, 'SKILL.md'), 'utf8'), 'old managed skill');
  assert.deepEqual(await fs.readFile(f.receipt), before);
});

test('新版源码的 install-skill 可为旧安装单独更新入口', async t => {
  const f = await skillFixture(t);
  const previous = await legacySkill(f);
  await writeJson(path.join(f.root, 'installation.json'), { app: path.join(f.root, 'legacy-app') });
  const result = spawnSync(process.execPath, ['src/cli.mjs', 'install-skill', f.root, f.skills], {
    encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).path, f.target);
  assert.match(await fs.readFile(path.join(f.target, 'SKILL.md'), 'utf8'), /^name: deep-literature-for-codex$/m);
  await assert.rejects(fs.access(previous), { code: 'ENOENT' });
});

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
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-File', 'install.ps1', '-Root', root, '-PluginArchive', bad], { encoding: 'utf8', windowsHide: true })
    : spawnSync(process.execPath, ['src/bootstrap-posix.mjs', '--root', root, '--plugin-archive', bad,
      '--bootstrap-node', path.dirname(process.execPath)], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /(?:plugin_)?checksum_mismatch/);
  await assert.rejects(fs.access(root), { code: 'ENOENT' });
});

test('发行源文件被破坏时在引导安装前拒绝，安装根保持不存在', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-source-check-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.mkdir(path.join(temporary, 'runtime'));
  await fs.copyFile('install.ps1', path.join(temporary, 'install.ps1'));
  await fs.copyFile('runtime/pins.json', path.join(temporary, 'runtime/pins.json'));
  if (process.platform !== 'win32') await fs.cp('src', path.join(temporary, 'src'), { recursive: true });
  const source = path.join(temporary, 'verified.txt');
  await fs.writeFile(source, Buffer.alloc(5));
  await fs.writeFile(path.join(temporary, 'BUILD-MANIFEST.json'), JSON.stringify({ files: {
    'verified.txt': createHash('sha256').update('valid').digest('hex'),
  } }));
  const root = path.join(temporary, 'new-install');
  // Use a matching archive pin so both installers reach source verification.
  const pins = await readJson(path.join(temporary, 'runtime/pins.json'));
  pins.plugin.sha256 = createHash('sha256').update(await fs.readFile(source)).digest('hex');
  await writeJson(path.join(temporary, 'runtime/pins.json'), pins);
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(temporary, 'install.ps1'),
      '-Root', root, '-PluginArchive', source], { encoding: 'utf8', windowsHide: true })
    : spawnSync(process.execPath, [path.join(temporary, 'src/bootstrap-posix.mjs'), '--root', root,
      '--plugin-archive', source, '--bootstrap-node', path.dirname(process.execPath)], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /source_checksum_mismatch/);
  await assert.rejects(fs.access(root), { code: 'ENOENT' });
});

test('Windows 卸载处理超长路径且不遍历文库 junction', { skip: process.platform !== 'win32' }, async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-uninstall-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const { root } = await initializeRoot(path.join(temporary, '文献 workbench'));
  const releases = path.join(root, 'releases'), runtime = path.join(root, 'runtime');
  const library = path.join(root, 'library');
  await fs.mkdir(library, { recursive: true });
  await fs.writeFile(path.join(library, 'preserved.txt'), 'personal notes');
  const deep = path.join(releases, 'dependency'.repeat(10), 'module'.repeat(15));
  await fs.mkdir(deep, { recursive: true });
  const longFile = path.join(deep, 'long-dependency-file.d.ts');
  assert.ok(longFile.length > 260);
  await fs.writeFile(longFile, 'installed dependency');
  await fs.chmod(longFile, 0o444);
  await fs.symlink(library, path.join(releases, 'library-link'), 'junction');
  await writeJson(path.join(root, 'state', 'uninstalled.json'), {
    status: 'uninstalled', root, removePaths: [releases, runtime], skill: { status: 'removed' },
  });
  const result = spawnSync('powershell.exe', ['-NoProfile', '-File', 'uninstall.ps1', '-Root', root], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(fs.access(releases), { code: 'ENOENT' });
  await assert.rejects(fs.access(runtime), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(library, 'preserved.txt'), 'utf8'), 'personal notes');
});
