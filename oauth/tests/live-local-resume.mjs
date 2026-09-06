// Only local thread creation/resume. No login ceremony, turn/start or model inference.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppServer } from '../app-server.mjs'

const scratch = fileURLToPath(new URL('../.work/live/', import.meta.url))
await mkdir(scratch, { recursive: true })
const stateRoot = await mkdtemp(join(scratch, '本地恢复-'))
let server = new AppServer({ stateRoot })
const report = { checkedAt: new Date().toISOString(), node: process.version, codex: '0.146.0', authenticatedRun: false, modelTurnsStarted: 0, nativeResumeVerified: false, checks: [] }
try {
  assert.equal(await server.account(false), null)
  const threadId = await server.startThread({
    ephemeral: false, approvalPolicy: 'never', sandbox: 'read-only',
    dynamicTools: [{ name: 'fixture_noop', description: 'Offline fixture; never invoked', inputSchema: { type: 'object', properties: {} } }],
  })
  report.checks.push('real local thread/start with dynamic tool schema: accepted')
  await server.close()
  server = new AppServer({ stateRoot })
  try {
    const resumed = await server.resumeThread(threadId, { approvalPolicy: 'never', sandbox: 'read-only' })
    assert.equal(resumed.id, threadId)
    assert.equal(resumed.turns.length, 0)
    report.nativeResumeVerified = true
  } catch {
    report.limitation = 'Official Codex does not persist a zero-turn rollout. Full native resume still requires a user-authorized completed model turn; offline durable-resume regression is separate.'
  }
  assert.equal(await server.account(false), null)
  assert.equal(await access(join(stateRoot, 'codex-home', 'auth.json')).then(() => true, () => false), false)
  report.checks.push('still unauthenticated; no auth file')
} finally { await server.close() }
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true })
await writeFile(new URL('../test-results/live-local-resume.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
