// Real pinned Codex + real DSH attachment storage, with a loopback-only model
// fixture. No account credentials, external model requests, or recognition claim.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { AppServer, codexExecutable } from '../oauth/app-server.mjs'
import { SafeCodexAdapter } from '../oauth/adapter.mjs'

const runtime = process.env.CSR_IMAGE_RUNTIME
if (!runtime) throw new Error('Set CSR_IMAGE_RUNTIME to the isolated DSH runtime package.json')
const requireHost = createRequire(resolve(runtime))
const { Context } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/cordis')).href)
const { LocalAttachmentStore } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-attachment-local')).href)
const scratch = await mkdtemp(join(tmpdir(), 'sr-codex-image-wire-'))
const ctx = new Context(), store = new LocalAttachmentStore(ctx, { dshHome: join(scratch, 'dsh') })
const bytes = await requireHost('sharp')({ create: { width: 32, height: 24, channels: 3, background: '#235643' } }).png().toBuffer()
const attachment = await store.saveImage({ data: bytes, mediaType: 'image/png', name: '图像传输验收.png' })
const admitted = await store.readImage(attachment)
const sha = createHash('sha256').update(admitted.data).digest('hex')
const requests = [], failures = []
const backend = createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const payload = JSON.parse(Buffer.concat(chunks).toString())
    requests.push(payload)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    const emit = event => res.write(`data: ${JSON.stringify(event)}\n\n`)
    const id = 'fixture-' + requests.length
    const item = requests.length === 1
      ? { type: 'function_call', id: 'fc-1', call_id: 'image-call', name: 'read_fixture_image', arguments: '{}' }
      : { type: 'message', id: 'message-' + id, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'IMAGE_WIRE_ACCEPTED', annotations: [] }] }
    emit({ type: 'response.created', response: { id, status: 'in_progress', output: [] } })
    emit({ type: 'response.output_item.added', output_index: 0, item })
    if (item.type === 'message') emit({ type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: 'IMAGE_WIRE_ACCEPTED' })
    emit({ type: 'response.output_item.done', output_index: 0, item })
    emit({ type: 'response.completed', response: { id, status: 'completed', output: [item], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } })
    res.end()
  } catch (error) { failures.push(error.message); res.writeHead(500); res.end() }
})
await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${backend.address().port}/v1`
// Only this test wrapper replaces the production OpenAI provider with an
// uncredentialed loopback Responses fixture in the real native process.
const wrapper = join(scratch, 'native-wrapper.mjs')
await writeFile(wrapper, `import {spawn} from 'node:child_process';
const args=process.argv.slice(2).map(x=>x==='model_provider="openai"'?'model_provider="image-fixture"':x);
args.unshift('-c',${JSON.stringify('model_providers.image-fixture={name="Local image fixture",base_url="' + baseUrl + '",wire_api="responses",requires_openai_auth=false}')});
const child=spawn(${JSON.stringify(codexExecutable())},args,{stdio:'inherit',windowsHide:true});
child.on('exit',code=>process.exit(code??1));
`)
const makeServer = () => {
  const server = new AppServer({ stateRoot: join(scratch, 'state'), command: [process.execPath, wrapper] })
  // Provider metadata comes from the fixture, never a real account.
  server.account = async () => ({ type: 'chatgpt' })
  server.models = async () => [{ model: 'gpt-6-astra', inputModalities: ['text', 'image'] }]
  return server
}
let server = makeServer()
const opts = { provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'medium', sessionId: 'native-image-wire',
  signal: AbortSignal.timeout(45000), tools: [{ name: 'read_fixture_image', description: 'Return the local synthetic test image.', parameters: { type: 'object', properties: {} } }] }
const user = { id: 'u1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Compare the supplied image with the tool image.' }, { type: 'image', attachment }] }
const assistant = (chunks, id) => ({ id, role: 'assistant', source: { kind: 'model', provider: opts.provider, model: opts.model, replayState: chunks.at(-1).replayState }, content: chunks.filter(x => x.type === 'block-end').map(x => x.block) })
const imageHashes = value => {
  const hashes = []
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'input_image') {
      const url = typeof node.image_url === 'string' ? node.image_url : node.image_url?.url
      assert.match(url, /^data:image\/(png|jpeg|webp|gif);base64,/)
      hashes.push(createHash('sha256').update(Buffer.from(url.split(',')[1], 'base64')).digest('hex'))
    }
    for (const child of Object.values(node)) if (typeof child === 'object') walk(child)
  }
  walk(value); return hashes
}
try {
  let adapter = new SafeCodexAdapter(server, store)
  const first = await Array.fromAsync(adapter.stream({ ...opts, messages: [user] }))
  assert.equal(first.at(-1).reason.kind, 'tool-calls')
  assert.deepEqual(imageHashes(requests[0].input), [sha])
  const toolCall = first.find(x => x.type === 'block-end' && x.block.type === 'tool-call').block
  const tool = { id: 't1', role: 'user', source: { kind: 'tool', callId: toolCall.id }, content: [{ type: 'tool-result', toolCallId: toolCall.id, content: [{ type: 'text', text: 'Synthetic tool image' }, { type: 'image', attachment }] }] }
  const history = [user, assistant(first, 'a1'), tool]
  const second = await Array.fromAsync(adapter.stream({ ...opts, messages: history }))
  assert.equal(second.at(-1).reason.kind, 'stop')
  const toolOutput = requests[1].input.find(x => x.type === 'function_call_output')
  assert.deepEqual(imageHashes(toolOutput), [sha])
  await server.close()
  server = makeServer(); adapter = new SafeCodexAdapter(server, store)
  const third = await Array.fromAsync(adapter.stream({ ...opts, messages: [...history, assistant(second, 'a2'), { ...user, id: 'u2' }] }))
  assert.equal(third.at(-1).replayState.response.continuity, 'resumed')
  assert.equal(third.at(-1).reason.kind, 'stop')
  assert.deepEqual(imageHashes(requests.at(-1).input), [sha, sha, sha])
  assert.deepEqual(failures, [])
  assert.equal(await access(join(scratch, 'state/codex-home/auth.json')).then(() => true, () => false), false)
  const report = { ok: true, codex: '0.146.0', authenticated: false, backend: 'loopback fixture', requests: requests.length,
    checks: ['real DSH attachment admission and verified bytes', 'real Codex user input_image SHA matches', 'real Codex function_call_output image SHA matches', 'real native thread resume preserves old and new images', 'no account credentials'], imageSha256: sha }
  const output = resolve('outputs/v0.2/image-bridge')
  await mkdir(output, { recursive: true }); await writeFile(join(output, 'native-image-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally {
  await server.close()
  await new Promise(resolve => backend.close(resolve))
}
