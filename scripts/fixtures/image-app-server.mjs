// JSONL fixture for the real DSH-host test. No account or remote model is used.
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const trace = process.argv[2]
const send = value => process.stdout.write(JSON.stringify(value) + '\n')
let threads = 0, turns = 0
for await (const line of createInterface({ input: process.stdin })) {
  const { id, method, params } = JSON.parse(line)
  if (method === 'initialized') continue
  if (method === 'initialize') send({ id, result: {} })
  else if (method === 'account/read') send({ id, result: { account: { type: 'chatgpt' } } })
  else if (method === 'model/list') send({ id, result: { data: [
    ...['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-luna'].map(model => ({ model, displayName: model, inputModalities: ['text', 'image'], defaultReasoningEffort: 'medium', supportedReasoningEfforts: [{ reasoningEffort: 'medium' }] })),
    { model: 'text-model', displayName: 'Text only', inputModalities: ['text'], supportedReasoningEfforts: [{ reasoningEffort: 'medium' }], defaultReasoningEffort: 'medium' },
  ], nextCursor: null } })
  else if (method === 'thread/start') send({ id, result: { thread: { id: 'image-thread-' + ++threads } } })
  else if (method === 'thread/resume') send({ id, result: { thread: { id: params.threadId, turns: [] } } })
  else if (method === 'turn/start') {
    const turnId = 'image-turn-' + ++turns
    const images = params.input.filter(x => x.type === 'image').map(x => ({ sha256: createHash('sha256').update(Buffer.from(x.url.split(',')[1], 'base64')).digest('hex') }))
    appendFileSync(trace, JSON.stringify({ model: params.model, effort: params.effort, images, text: params.input.filter(x => x.type === 'text').map(x => x.text).join('\n') }) + '\n')
    send({ id, result: { turn: { id: turnId } } })
    send({ method: 'item/agentMessage/delta', params: { threadId: params.threadId, turnId, itemId: 'answer-' + turnId, delta: 'IMAGE_HOST_ACCEPTED' } })
    send({ method: 'item/completed', params: { threadId: params.threadId, turnId, item: { type: 'agentMessage', id: 'answer-' + turnId } } })
    send({ method: 'turn/completed', params: { threadId: params.threadId, turn: { id: turnId, status: 'completed' } } })
  } else send({ id, result: {} })
}
