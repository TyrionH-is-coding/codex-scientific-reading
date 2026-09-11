import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { AppServer, isolatedEnvironment } from '../app-server.mjs'

const scratch = fileURLToPath(new URL('../.work/transport/', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/app-server.mjs', import.meta.url))
async function serverFor(t) {
  await mkdir(scratch, { recursive: true })
  const stateRoot = await mkdtemp(join(scratch, '隔离-'))
  const server = new AppServer({ stateRoot, command: [process.execPath, fixture], requestTimeoutMs: 500 })
  t.after(() => server.close())
  return { server, stateRoot }
}

test('PB-08 explicit instance state is mandatory and ambient credentials are excluded', () => {
  assert.throws(() => new AppServer(), /stateRoot/)
  assert.throws(() => new AppServer({ stateRoot: 'relative' }), /absolute/)
  const env = isolatedEnvironment(resolve('fixture-state'), { OPENAI_API_KEY: 'fixture', CODEX_HOME: 'outer', CODEX_CONFIG: 'outer', Path: 'fixture-path', HTTPS_PROXY: 'http://127.0.0.1:1234' })
  assert.equal(env.OPENAI_API_KEY, undefined)
  assert.equal(env.CODEX_CONFIG, undefined)
  assert.equal(env.CODEX_HOME, resolve('fixture-state'))
  assert.equal(env.Path, 'fixture-path')
  assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:1234')
})

test('PB-08 real child JSONL handshake uses isolated cwd and delivers account events', async t => {
  const { server, stateRoot } = await serverFor(t)
  const notifications = []
  server.onNotification(event => notifications.push(event))
  assert.equal(await server.account(false), null)
  const result = await server.request('fixture/environment', {})
  assert.equal(result.codexHome, join(stateRoot, 'codex-home'))
  assert.equal(result.cwd, join(stateRoot, 'codex-home'))
  assert.equal(result.hasApiKey, false)
  await server.request('fixture/notification', {})
  assert.equal(notifications[0].method, 'account/login/completed')
  await server.request('fixture/noise', {})
  await assert.rejects(server.request('fixture/error', {}), error => !error.message.includes('SECRET') && error.message.includes('123'))
  await server.close()
  await assert.rejects(server.request('account/read', {}), /closed/)
})

test('PB-08 pending RPC fails promptly after child exit', async t => {
  const { server } = await serverFor(t)
  await assert.rejects(server.request('fixture/crash', {}), /exited/)
})

test('PB-08 hung and malformed responses close the transport with safe errors', async t => {
  const first = await serverFor(t)
  await assert.rejects(first.server.request('fixture/hang', {}), /timed out/)
  const second = await serverFor(t)
  await assert.rejects(second.server.request('fixture/malformed', {}), /protocol/)
})

test('进程故障后下一请求只重建一次，旧进程事件不污染新连接', async t => {
  const { server } = await serverFor(t)
  await server.start()
  const previous = server.child
  const previousGeneration = server.generation
  const pendingEvent = server.nextEvent('old-thread').catch(error => error)
  await assert.rejects(server.request('fixture/crash'), /exited/)
  assert.ok(await pendingEvent instanceof Error)
  assert.deepEqual(await Promise.all([server.account(), server.account()]), [null, null])
  assert.equal(server.generation, previousGeneration + 1)
  assert.notEqual(server.child, previous)
  previous.emit('close', 7)
  assert.equal(await server.account(), null)
  await server.close()
  await assert.rejects(server.account(), /closed/)
})

test('超时与协议错误可恢复，但失败的请求不会自动重放', async t => {
  for (const method of ['fixture/hang', 'fixture/malformed', 'fixture/write-and-crash']) {
    const { server } = await serverFor(t)
    await assert.rejects(server.request(method))
    assert.equal(await server.account(), null)
    if (method === 'fixture/write-and-crash') {
      assert.equal(await readFile(join(server.home, 'calls.txt'), 'utf8'), 'once\n')
    }
  }
})

test('启动失败可在下一请求重试，主动关闭在初始化期间仍有效', async t => {
  const { server } = await serverFor(t)
  server.command = [join(server.stateRoot, 'missing-fixture-executable')]
  await assert.rejects(server.start())
  server.command = [process.execPath, fixture]
  assert.equal(await server.account(), null)
  const second = await serverFor(t)
  const starting = assert.rejects(second.server.start(), /closed/)
  await second.server.close()
  await starting
  assert.equal(second.server.child, null)
})

test('生命周期日志轮转且不写入 RPC、标准错误或凭据内容', async t => {
  const { server, stateRoot } = await serverFor(t)
  await writeFile(join(stateRoot, 'app-server-events.jsonl'), 'x'.repeat(65536))
  await server.request('fixture/noise')
  await assert.rejects(server.request('fixture/malformed'))
  await server.account()
  await server.close()
  const log = await readFile(join(stateRoot, 'app-server-events.jsonl'), 'utf8')
  const rows = log.trim().split('\n').map(JSON.parse)
  assert.deepEqual(rows.map(row => row.event), ['ready', 'failed', 'ready', 'stopped'])
  assert.equal(rows[1].reason, 'protocol_error')
  assert.ok(rows.every(row => Object.keys(row).every(key => ['at', 'event', 'generation', 'reason'].includes(key))))
  assert.ok(!log.includes('SECRET') && !log.includes('fixture/noise'))
  assert.equal((await readFile(join(stateRoot, 'app-server-events.jsonl.1'))).length, 65536)
})


test('模型发现读取全部分页，保留后续页的 Astra', async () => {
  const requests = []
  const models = await AppServer.prototype.models.call({request:async (method,params) => {
    requests.push({method,params})
    return params.cursor ? {data:[{model:'gpt-6-astra'}],nextCursor:null} : {data:[{model:'gpt-5.6-sol'}],nextCursor:'page-2'}
  }})
  assert.deepEqual(models.map(model=>model.model),['gpt-5.6-sol','gpt-6-astra'])
  assert.equal(requests[1].params.cursor,'page-2')
})
