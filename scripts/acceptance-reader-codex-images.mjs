// Installed A + real DSH + current B OAuth package, synthetic paper and JSONL
// app-server fixture. The real native protocol is tested separately.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const a = process.env.CSR_A_WORKTREE || fileURLToPath(new URL('../../dsh-scientific-reading/', import.meta.url))
const b = fileURLToPath(new URL('../', import.meta.url))
const { resolveDshRuntime, installPlugin, prepareEngine, materializeFixture, startReaderWithRetry, sanitizedDshEnvironment, stopOwned } = await import(pathToFileURL(path.join(a, 'scripts/acceptance-dsh.mjs')).href)
const root = await fs.mkdtemp(path.join(tmpdir(), 'sr-reader-codex-images-'))
const home = path.join(root, 'home'), dataRoot = path.join(root, 'library'), trace = path.join(root, 'images.jsonl')
const evidence = { root, steps: [], checks: [] }
const out = path.join(b, 'outputs/v0.2/image-bridge')
let host
try {
  await fs.mkdir(dataRoot)
  const runtime = await resolveDshRuntime(), requireRuntime = createRequire(runtime.source)
  const engine = await prepareEngine(dataRoot, evidence), nonce = String(Date.now())
  const basic = await materializeFixture(dataRoot, nonce, evidence)
  const env = { ...sanitizedDshEnvironment(), DSH_HOME: home, PYTHONPATH: engine.pythonPath, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }
  const { stdout } = await promisify(execFile)(engine.python, [path.join(a, 'scripts/figure_acceptance_fixture.py'), dataRoot], { env, windowsHide: true })
  const figure = JSON.parse(stdout.trim().split('\n').at(-1))
  const tarball = path.join(root, 'scientific-reading.tgz')
  await fs.copyFile(path.join(b, 'inputs/scientific-reading.tgz'), tarball)
  await installPlugin(runtime, home, tarball, dataRoot, engine.python, evidence)
  const profile = path.join(home, 'profiles/reader-review-acceptance'), manifestPath = path.join(profile, 'package.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  manifest.dsh.profile.bundles.push('codex-scientific-reading-oauth')
  await fs.writeFile(manifestPath, JSON.stringify(manifest))
  const oauthDir = path.join(root, 'oauth')
  await fs.cp(path.join(b, 'oauth'), oauthDir, { recursive: true, filter: src => !['node_modules', 'tests', 'test-results', '.work'].some(part => src.split(path.sep).includes(part)) })
  const runtimeModules = path.resolve(path.dirname(requireRuntime.resolve('@deepseek-ai/dsh/package.json')), '../..')
  await fs.symlink(runtimeModules, path.join(oauthDir, 'node_modules'), 'junction')
  await fs.symlink(oauthDir, path.join(profile, 'node_modules/codex-scientific-reading-oauth'), 'junction')
  const rpcPath = path.join(root, 'rpc.mjs')
  await fs.writeFile(rpcPath, `import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
export const inject=['typertGateway','webServer'];
export async function apply(ctx){const req=createRequire(${JSON.stringify(manifestPath)});const {createNativeRpc}=await import(pathToFileURL(req.resolve('@dsh-external/dsh-scientific-reading')).href);const rpc=createNativeRpc(ctx);
ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/image-test/rpc',async handler(request,response){const buffers=[];for await(const part of request)buffers.push(part);try{const {method,payload}=JSON.parse(Buffer.concat(buffers));if(!['session.selectModel','session.history','session.attachment'].includes(method))throw new Error('denied');const value=await rpc(method,payload);response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify(value));}catch(error){response.writeHead(400,{'Content-Type':'application/json'});response.end(JSON.stringify({error:error.message}));}}}));}
`)
  const command = [process.execPath, path.join(b, 'scripts/fixtures/image-app-server.mjs'), trace]
  await fs.appendFile(path.join(profile, 'cordis.patch.yml'), '\n- id: scientific-reading-codex\n  config: ' + JSON.stringify({ stateRoot: path.join(root, 'state'), command }) +
    '\n- insert:\n    - id: image-test-rpc\n      name: ' + JSON.stringify(pathToFileURL(rpcPath).href) + '\n')
  const running = await startReaderWithRetry({ runtime, env, paperId: basic.paperId, nonce, evidence }); host = running.host
  const url = `http://127.0.0.1:${running.port}`
  async function post(route, payload) {
    const response = await fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sr-csrf': '1', Origin: url }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) })
    const value = await response.json()
    assert.equal(response.status, 200, JSON.stringify(value)); return value
  }
  const rpc = (method, payload) => post('/image-test/rpc', { method, payload })
  const binding = await post('/sr/api/chats/open', { paper_id: figure.paper_id })
  const policy = await (await fetch(url + '/sr/api/settings/models')).json()
  await post('/sr/api/settings/models', { revision: policy.revision, steps: { paper_chat: { provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'medium' }, figure_chat: { provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'medium' } } })
  await rpc('session.selectModel', { sessionId: binding.session_id, provider: 'openai-codex', model: 'gpt-6-astra', reasoningEffort: 'medium' })
  const reader = await (await fetch(url + `/sr/api/paper/${figure.paper_id}/reader`)).text()
  assert.ok(reader.includes('figure-discuss-trigger'))
  const sent = await post('/sr/api/chats/figure', { ...figure, question: '解释此图' })
  assert.equal(sent.context.image_status, 'supplied_to_native_chat')
  let records, wire
  for (let attempt = 0; attempt < 60; attempt++) {
    records = (await rpc('session.history', { sessionId: binding.session_id, maxMessages: 30 })).events
    wire = await fs.readFile(trace, 'utf8').then(s => s.trim().split('\n').filter(Boolean).map(x => JSON.parse(x)), () => [])
    if (wire.length && JSON.stringify(records).includes('IMAGE_HOST_ACCEPTED')) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(JSON.stringify(records).includes('IMAGE_HOST_ACCEPTED'), 'DSH completed the image answer')
  const message = records.map(x => x.event).find(x => x.type === 'user/message' && x.data?.content?.some(p => p.type === 'image'))
  const ref = message.data.content.find(x => x.type === 'image').attachment
  const stored = await rpc('session.attachment', { sessionId: binding.session_id, attachmentId: ref.attachmentId })
  const expected = createHash('sha256').update(Buffer.from(stored.data, 'base64')).digest('hex')
  assert.deepEqual(wire[0].images, [{ sha256: expected }])
  assert.equal(wire[0].model, 'gpt-6-astra'); assert.equal(wire[0].effort, 'medium')
  assert.ok(wire[0].text.includes(figure.source_pdf_sha256) && wire[0].text.includes(figure.asset_id))
  await rpc('session.selectModel', { sessionId: binding.session_id, provider: 'openai-codex', model: 'text-model' })
  const rejected = await fetch(url + '/sr/api/chats/figure', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sr-csrf': '1', Origin: url }, body: JSON.stringify(figure) })
  assert.equal(rejected.status, 400)
  assert.match((await rejected.json()).error, /image input/)
  assert.equal((await fs.readFile(trace, 'utf8')).trim().split('\n').length, wire.length)
  evidence.checks = ['Reader includes existing Figure entry', 'Figure source identity checked by engine', 'DSH admitted and persisted actual image', 'Codex adapter transmitted identical attachment SHA', 'Astra and medium route preserved', 'DSH assistant answer persisted', 'text-only model rejects new image before generation']
  evidence.ok = true
  console.log(JSON.stringify({ ok: true, checks: evidence.checks, imageSha256: expected }))
} finally {
  if (host) await stopOwned(host)
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'reader-image-result.json'), JSON.stringify(evidence, null, 2))
}
