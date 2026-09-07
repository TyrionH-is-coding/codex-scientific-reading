import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { selectPlatformPins, runtimePaths, venvPython, npmCli, SUPPORTED_PLATFORMS } from '../src/platform.mjs';
import { readJson, isolatedEnvironment } from '../src/core.mjs';
import { pipeName } from '../src/control.mjs';
import { prepareLocalSocket } from '../src/local-socket.mjs';

test('every supported architecture selects pinned runtime assets and executable paths', async () => {
  const source = await readJson('runtime/pins.json');
  for (const key of SUPPORTED_PLATFORMS) {
    const [platform, arch] = key.split('-');
    const pins = selectPlatformPins(source, platform, arch);
    for (const runtime of [pins.node, pins.python]) {
      assert.match(runtime.url, /^https:\/\//);
      assert.match(runtime.sha256, /^[a-f0-9]{64}$/);
    }
    const paths = runtimePaths('/workbench', pins);
    assert.equal(path.basename(paths.node), platform === 'win32' ? 'node.exe' : 'node');
    assert.equal(path.basename(paths.pythonBase), platform === 'win32' ? 'python.exe' : 'python3');
    assert.equal(path.basename(venvPython('/venv', platform)), platform === 'win32' ? 'python.exe' : 'python3');
    assert.ok(npmCli(paths.node, platform).endsWith(path.join('npm', 'bin', 'npm-cli.js')));
  }
  assert.throws(() => selectPlatformPins(source, 'linux', 'ia32'), /unsupported_platform/);
});

test('Unix host retains desktop keyring access and system commands without inheriting model settings', () => {
  const parent = { HOME: '/home/reader', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
    XDG_RUNTIME_DIR: '/run/user/1000', DISPLAY: ':0', PATH: '/foreign/bin',
    OPENAI_API_KEY: 'synthetic-do-not-inherit', NODE_OPTIONS: '--import=foreign' };
  const env = isolatedEnvironment('/library', parent, {}, 'linux');
  assert.equal(env.HOME, parent.HOME);
  assert.equal(env.DBUS_SESSION_BUS_ADDRESS, parent.DBUS_SESSION_BUS_ADDRESS);
  assert.ok(env.PATH.includes('/usr/bin'));
  assert.ok(!env.PATH.includes('/foreign/bin'));
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
});

test('POSIX socket survives long install paths and recovers a crashed owner without deleting live sockets',
  { skip: process.platform === 'win32' }, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-socket-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const name = pipeName(path.join(root, '很长的路径'.repeat(30)));
    assert.ok(Buffer.byteLength(name + '-maintenance') < 104);
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      "import net from 'node:net'; net.createServer(s=>s.end()).listen(process.argv[1],()=>console.log('ready'));", name],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    await once(child.stdout, 'data');
    await prepareLocalSocket(name);
    assert.ok((await fs.lstat(name)).isSocket());
    child.kill('SIGKILL');
    await once(child, 'exit');
    await prepareLocalSocket(name);
    await assert.rejects(fs.lstat(name), { code: 'ENOENT' });
    const server = net.createServer(s => s.end());
    await new Promise(resolve => server.listen(name, resolve));
    await prepareLocalSocket(name);
    assert.ok(server.listening);
    await new Promise(resolve => server.close(resolve));
    await fs.writeFile(name, 'user file');
    t.after(() => fs.unlink(name).catch(() => {}));
    await assert.rejects(prepareLocalSocket(name), /invalid_control_socket/);
    assert.equal(await fs.readFile(name, 'utf8'), 'user file');
  });
