import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { initializeRoot, isolatedEnvironment, verifyFile, installSkill, removeManagedSkill } from '../src/core.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'csr-core-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('重复初始化复用身份，状态与文献目录独立', async t => {
  const root = await fixture(t);
  const first = await initializeRoot(root);
  assert.equal((await initializeRoot(root)).instanceId, first.instanceId);
  assert.equal(first.root, await fs.realpath(root));
  await fs.access(path.join(root, 'library'));
  await fs.access(path.join(root, 'state', 'dsh-home'));
});

test('拒绝将未知非空目录当成安装根', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'existing.txt'), 'user content');
  await assert.rejects(initializeRoot(root), /not_empty/);
  assert.equal(await fs.readFile(path.join(root, 'existing.txt'), 'utf8'), 'user content');
});

test('排除外部宿主、模型凭据和解释器注入，保留系统与代理', async t => {
  const root = await fixture(t);
  const parent = { SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\test',
    HTTPS_PROXY: 'http://127.0.0.1:7890', DSH_HOME: 'foreign', NODE_PATH: 'foreign',
    NODE_OPTIONS: '--import=foreign', PYTHONPATH: 'foreign', PYTHONHOME: 'foreign',
    VIRTUAL_ENV: 'foreign', OPENAI_API_KEY: 'synthetic-secret', CODEX_HOME: 'foreign',
    DSH_MODEL: 'foreign', Path: 'foreign' };
  const env = isolatedEnvironment(root, parent);
  assert.equal(env.DSH_HOME, path.join(root, 'state', 'dsh-home'));
  assert.equal(env.HTTPS_PROXY, parent.HTTPS_PROXY);
  assert.equal(env.SYSTEMROOT, parent.SystemRoot);
  assert.equal(env.USERPROFILE, parent.USERPROFILE);
  for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'PYTHONPATH', 'PYTHONHOME', 'OPENAI_API_KEY', 'DSH_MODEL']) {
    assert.equal(env[key], undefined, key);
  }
  assert.equal(env.CODEX_HOME, path.join(root, 'state', 'codex-home'));
  assert.ok(env.PATH.startsWith(path.join(root, 'runtime', 'node')));
  assert.equal(parent.DSH_HOME, 'foreign');
});

test('文件校验拒绝被替换的发行包', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'package.tgz');
  await fs.writeFile(file, 'valid fixture');
  const sha = createHash('sha256').update('valid fixture').digest('hex');
  await verifyFile(file, sha);
  await fs.writeFile(file, 'changed');
  await assert.rejects(verifyFile(file, sha), /checksum/);
});

test('安装 Skill 可重复执行，但不能覆盖用户已有的同名内容', async t => {
  const root = await fixture(t);
  const source = path.join(root, 'source');
  const target = path.join(root, 'skills');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'SKILL.md'), 'fixture skill');
  await installSkill(source, target, root);
  await installSkill(source, target, root);
  const installed = path.join(target, 'deep-literature-for-codex', 'SKILL.md');
  await fs.writeFile(installed, 'user customized');
  assert.deepEqual(await installSkill(source, target, root), {
    status: 'retained_custom_changes', reason: 'skill_conflict', path: path.dirname(installed),
  });
  assert.equal(await fs.readFile(installed, 'utf8'), 'user customized');
  assert.equal((await removeManagedSkill(root)).status, 'retained_custom_changes');
});

test('自有且未修改的 Skill 可升级和卸载', async t => {
  const root = await fixture(t);
  const source = path.join(root, 'source'), skills = path.join(root, 'skills');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'SKILL.md'), 'v1');
  await installSkill(source, skills, root);
  await fs.writeFile(path.join(source, 'SKILL.md'), 'v2');
  assert.equal((await installSkill(source, skills, root)).updated, true);
  assert.equal(await fs.readFile(path.join(skills, 'deep-literature-for-codex', 'SKILL.md'), 'utf8'), 'v2');
  assert.equal((await removeManagedSkill(root)).status, 'removed');
});
