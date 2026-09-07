import assert from 'node:assert/strict'
import test from 'node:test'
import { join, resolve } from 'node:path'
import { codexExecutable } from '../app-server.mjs'

test('native OAuth executable resolves the official package on every supported platform', () => {
  const targets = [
    ['win32', 'x64', 'x86_64-pc-windows-msvc', 'codex.exe'],
    ['darwin', 'arm64', 'aarch64-apple-darwin', 'codex'],
    ['darwin', 'x64', 'x86_64-apple-darwin', 'codex'],
    ['linux', 'arm64', 'aarch64-unknown-linux-musl', 'codex'],
    ['linux', 'x64', 'x86_64-unknown-linux-musl', 'codex'],
  ]
  for (const [platform, arch, triple, binary] of targets) {
    const packageRoot = resolve('fixture', platform, arch)
    const executable = codexExecutable({ platform, arch, resolvePackage: name => {
      assert.equal(name, `@openai/codex-${platform}-${arch}/package.json`)
      return join(packageRoot, 'package.json')
    } })
    assert.equal(executable, join(packageRoot, 'vendor', triple, 'bin', binary))
  }
  assert.throws(() => codexExecutable({ platform: 'linux', arch: 'ia32' }), /Unsupported/)
})
