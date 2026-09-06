import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { BlockAssembler } from '@deepseek-ai/dsh-llm'
import { createAcceptanceAdapter, apply, COMPLETION_TEXT } from '../../scripts/fixtures/local-model.mjs'

const config = { dshEntry: fileURLToPath(new URL('../package.json', import.meta.url)) }
const source = { kind: 'model', provider: 'acceptance-local', model: 'scope-smoke' }
const initial = { provider: source.provider, model: source.model, sessionId: 'fixture-scope', tools: [{ name: 'sr_library_list', parameters: { type: 'object' } }], messages: [{ id: 'fixture-user-1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'run isolated acceptance' }] }] }
function assemble(chunks) { const assembler = new BlockAssembler(); for (const chunk of chunks) assembler.push(chunk); return assembler }

test('local fixture emits valid rc.7 tool chunks and waits for matching DSH result before completion', async () => {
  const adapter = await createAcceptanceAdapter(config)
  const first = assemble(await Array.fromAsync(adapter.stream(initial)))
  assert.equal(first.finish.kind, 'tool-calls')
  const call = first.blocks()[0]
  assert.equal(call.name, 'sr_library_list')
  assert.equal(JSON.parse(call.arguments).query, '__codex_b_acceptance_fixture_only__')
  const assistant = { id: 'a1', role: 'assistant', source, content: first.blocks() }
  const tool = { id: 't1', role: 'user', source: { kind: 'tool', callId: call.id }, content: [{ type: 'tool-result', toolCallId: call.id, content: [{ type: 'text', text: '文献库为空' }] }] }
  const second = assemble(await Array.fromAsync(adapter.stream({ ...initial, messages: [...initial.messages, assistant, tool] })))
  assert.equal(second.finish.kind, 'stop')
  assert.equal(second.blocks()[0].text, COMPLETION_TEXT)
  const third = assemble(await Array.fromAsync(adapter.stream({ ...initial, messages: [...initial.messages, assistant, tool, { id: 'a2', role: 'assistant', source, content: second.blocks() }, { ...initial.messages[0], id: 'fixture-user-2' }] })))
  assert.equal(third.finish.kind, 'tool-calls')
  assert.notEqual(third.blocks()[0].id, call.id)
})

test('local fixture cannot claim completion when tool is absent or result failed', async () => {
  const adapter = await createAcceptanceAdapter(config)
  await assert.rejects(Array.fromAsync(adapter.stream({ ...initial, tools: [] })), error => error.code === 'ACCEPTANCE_TOOL_NOT_AVAILABLE')
  const call = assemble(await Array.fromAsync(adapter.stream(initial))).blocks()[0]
  const messages = [...initial.messages, { id: 'a1', role: 'assistant', source, content: [call] }]
  await assert.rejects(Array.fromAsync(adapter.stream({ ...initial, messages })), error => error.code === 'ACCEPTANCE_TOOL_RESULT_MISSING')
  messages.push({ id: 't1', role: 'user', source: { kind: 'tool', callId: call.id }, content: [{ type: 'tool-result', toolCallId: call.id, isError: true, content: [{ type: 'text', text: 'fixture failure' }] }] })
  await assert.rejects(Array.fromAsync(adapter.stream({ ...initial, messages })), error => error.code === 'ACCEPTANCE_TOOL_FAILED')
})

test('local fixture uses injected host resolution and only registers acceptance-local', async () => {
  const registrations = []
  await apply({ llm: { registerAdapter(providers, adapter) { registrations.push({ providers, adapter }) } } }, config)
  assert.deepEqual(registrations[0].providers, ['acceptance-local'])
  assert.equal((await registrations[0].adapter.listModels())[0].id, 'scope-smoke')
  await assert.rejects(createAcceptanceAdapter({}), /dshEntry/)
})
