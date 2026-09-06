// Real official binary, fresh home; never starts login or a model turn.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppServer } from '../app-server.mjs'
import { OAuthControl } from '../control.mjs'

const scratch = fileURLToPath(new URL('../.work/live/', import.meta.url))
await mkdir(scratch, { recursive: true })
const stateRoot = await mkdtemp(join(scratch, '未登录-'))
const server = new AppServer({ stateRoot })
const control = new OAuthControl(server)
const report = { checkedAt: new Date().toISOString(), node: process.version, codex: '0.146.0', authenticatedRun: false, checks: [] }
try {
  assert.equal((await control.status()).status, 'unauthenticated')
  report.checks.push('real account/read: unauthenticated')
  assert.equal((await control.usage()).status, 'unavailable')
  report.checks.push('unauthed quota: unavailable')
  const cancel = await server.request('account/login/cancel', { loginId: '00000000-0000-4000-8000-000000000000' })
  assert.equal(cancel.status, 'notFound')
  report.checks.push('real cancel missing login: notFound')
  await control.logout()
  assert.equal((await control.status()).authenticated, false)
  report.checks.push('real logout and account/read: unauthenticated')
  const authExists = await access(join(stateRoot, 'codex-home', 'auth.json')).then(() => true, () => false)
  assert.equal(authExists, false)
  report.checks.push('no auth file created; no credentials read')
} finally { await control.close() }
report.checks.push('native child stopped')
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true })
await writeFile(new URL('../test-results/live-unauthed.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
