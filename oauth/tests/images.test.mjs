import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { SafeCodexAdapter } from '../adapter.mjs'

const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNQDnMGAAFcAL3Q8eU8AAAAAElFTkSuQmCC', 'base64')
const picture = { type: 'image', attachment: { attachmentId: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/png', bytes: bytes.length, width: 1, height: 1, name: '图 1.png' } }
const imageUrl = 'data:image/png;base64,' + bytes.toString('base64')
const text = text => ({ type: 'text', text })
const user = (...content) => ({ id: 'user', role: 'user', source: { kind: 'user' }, content })
const assistant = (chunks, content = [text('answer')], provider = 'openai-codex') => ({ id: 'assistant', role: 'assistant', content, source: { kind: 'model', provider, model: 'gpt-6-astra', replayState: chunks?.at(-1).replayState } })
const base = { provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'medium', sessionId: 'image-test' }
const attachments = { async readImage(ref, signal) { signal?.throwIfAborted(); assert.deepEqual(ref, picture.attachment); return { ref, data: bytes } } }
class Server {
  generation = 1; turns = []; events = []; responses = []; starts = 0
  async account() { return { type: 'chatgpt' } }
  async models() { return [{ model: 'gpt-6-astra', inputModalities: ['text', 'image'] }, { model: 'text-model', inputModalities: ['text'] }] }
  async startThread() { return 'thread-' + ++this.starts }
  async resumeThread(id) { return { id, turns: [] } }
  async interrupt() {}
  finish() { this.events.push({ method: 'turn/completed', params: { turn: { id: 'turn', status: 'completed' } } }) }
  async startTurn(threadId, input) {
    this.turns.push({ threadId, ...input })
    if (this.tool) { this.events.push({ method: 'item/tool/call', requestId: 7, params: { threadId, callId: 'call', tool: 'read_image', arguments: {} } }); this.tool = false }
    else this.finish()
    return 'turn'
  }
  respond(id, result) { this.responses.push({ id, result }); this.finish() }
  async nextEvent(_id, signal) {
    if (this.events.length) return this.events.shift()
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => {}, 100)
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
    })
  }
}
const collect = (adapter, messages, options = {}) => Array.fromAsync(adapter.stream({ ...base, messages, ...options }))

test('图片按顺序作为真实 image 输入发送，支持多图与纯图片消息', async () => {
  const server = new Server(), adapter = new SafeCodexAdapter(server, attachments)
  assert.deepEqual((await adapter.resolveModel('openai-codex', base.model)).inputModalities, ['text', 'image'])
  await collect(adapter, [user(text('对比'), picture, text('以及'), picture)])
  assert.deepEqual(server.turns[0].input, [text('对比'), { type: 'image', url: imageUrl }, text('以及'), { type: 'image', url: imageUrl }])
  assert.equal(server.turns[0].model, 'gpt-6-astra')
  assert.equal(server.turns[0].effort, 'medium')
  await collect(adapter, [user(picture)], { sessionId: 'image-only' })
  assert.deepEqual(server.turns[1].input, [{ type: 'image', url: imageUrl }])
})

test('原生会话继续或恢复只上传本轮新图，不重复旧图', async () => {
  const server = new Server(), adapter = new SafeCodexAdapter(server, attachments)
  const first = await collect(adapter, [user(picture)])
  await collect(adapter, [user(picture), assistant(first), user(text('继续'))])
  assert.deepEqual(server.turns[1].input, [text('继续')])
  const resumed = new SafeCodexAdapter(server, attachments)
  await collect(resumed, [user(picture), assistant(first), user(text('新图'), picture)])
  assert.deepEqual(server.turns[2].input, [text('新图'), { type: 'image', url: imageUrl }])
  assert.equal(server.starts, 1)
})

const call = { type: 'tool-call', id: 'call', name: 'read_image', arguments: '{}' }
const result = user({ type: 'tool-result', toolCallId: 'call', content: [text('图注'), picture] })
result.source = { kind: 'tool', callId: 'call' }
test('工具返回图片经 inputImage 传递，保留图注与成功状态', async () => {
  const server = new Server(); server.tool = true
  const adapter = new SafeCodexAdapter(server, attachments)
  const first = await collect(adapter, [user(text('读图'))])
  await collect(adapter, [user(text('读图')), assistant(first, [call]), result])
  assert.deepEqual(server.responses[0].result, { success: true, contentItems: [
    { type: 'inputText', text: '图注' }, { type: 'inputImage', imageUrl },
  ] })
  assert.equal(server.turns.length, 1)
})

for (const reason of ['missing-native-thread', 'foreign-provider']) test(`重建历史时重新附上图像及身份：${reason}`, async () => {
  const server = new Server(), adapter = new SafeCodexAdapter(server, attachments)
  const first = await collect(adapter, [user(text('原图'), picture)])
  server.resumeThread = async () => { throw new Error('missing') }
  const history = [user(text('原图'), picture), assistant(first, [text('旧讨论')], reason === 'foreign-provider' ? 'other' : 'openai-codex'), user(text('继续'), picture)]
  await collect(new SafeCodexAdapter(server, attachments), history)
  assert.equal(server.turns.at(-1).input.filter(x => x.type === 'image').length, 2)
  assert.ok(server.turns.at(-1).input.filter(x => x.type === 'text').some(x => x.text.includes(picture.attachment.attachmentId)))
  assert.ok(!server.turns.at(-1).input.filter(x => x.type === 'text').some(x => x.text.includes(bytes.toString('base64'))))
  assert.ok(!JSON.stringify(first.at(-1).replayState).includes(bytes.toString('base64')))
})

test('恢复的工具结果重发包含图片，不再执行工具', async () => {
  const server = new Server(); server.tool = true
  const first = await collect(new SafeCodexAdapter(server, attachments), [user(text('读图'))])
  server.tool = true
  const next = await collect(new SafeCodexAdapter(server, attachments), [user(text('读图')), assistant(first, [call]), result])
  assert.equal(next.at(-1).reason.kind, 'stop')
  assert.deepEqual(server.responses.at(-1).result.contentItems[1], { type: 'inputImage', imageUrl })
})

test('图片读取失败与取消不启动模型回合，也不接受路径或 URL 代替附件', async () => {
  for (const invalid of [picture, { type: 'image', url: 'file:///private.png' }]) {
    const server = new Server()
    const adapter = new SafeCodexAdapter(server, { async readImage() { throw new Error('private storage path') } })
    await assert.rejects(collect(adapter, [user(invalid)]), error => error.code === 'IMAGE_ATTACHMENT_UNAVAILABLE' && !error.message.includes('private'))
    assert.equal(server.turns.length, 0)
  }
  const server = new Server(), abort = new AbortController()
  abort.abort(new Error('cancelled'))
  await assert.rejects(collect(new SafeCodexAdapter(server, attachments), [user(picture)], { signal: abort.signal }), /cancelled/)
  assert.equal(server.turns.length, 0)
})

test('文本模型明确拒绝直接图片请求，包括嵌套的工具图片', async () => {
  const server = new Server(), adapter = new SafeCodexAdapter(server, attachments)
  assert.deepEqual((await adapter.listModels()).find(x => x.id === 'text-model').inputModalities, ['text'])
  for (const messages of [[user(picture)], [result]]) {
    await assert.rejects(collect(adapter, messages, { model: 'text-model' }), error => error.code === 'UNSUPPORTED_CONTENT' && error.message.includes('图片'))
  }
  assert.equal(server.turns.length, 0)
})

test('读取工具图片时取消会中断原生回合，重试通过持久结果恢复', async () => {
  const server = new Server(); server.tool = true
  let interrupted = 0
  server.interrupt = async () => { interrupted++ }
  const abort = new AbortController()
  const adapter = new SafeCodexAdapter(server, { async readImage() { abort.abort(new Error('cancel image read')); throw abort.signal.reason } })
  const first = await collect(adapter, [user(text('读图'))])
  const history = [user(text('读图')), assistant(first, [call]), result]
  await assert.rejects(collect(adapter, history, { signal: abort.signal }), /cancel image read/)
  assert.equal(interrupted, 1)
  assert.equal(server.responses.length, 0)
  adapter.attachments = attachments
  const next = await collect(adapter, history)
  assert.equal(next.at(-1).replayState.response.continuity, 'resumed')
  assert.ok(server.turns.at(-1).input.some(x => x.type === 'image'))
})
