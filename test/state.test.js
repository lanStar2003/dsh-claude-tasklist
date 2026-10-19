import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_TURNS,
  entryForTurn,
  foldEvent,
  initialState,
  jsonRecord,
  latestOpenPlan,
  parseState,
  updatePlanStep,
  wrapUpStep,
} from '../src/core/state.js'

const fold = (events, state = initialState()) => events.reduce((s, e) => foldEvent(s, e), state)

let seq = 0
const turnStart = (turn) => ({ type: 'turn/start', data: { turn } })
const userMessage = (text, kind = 'user') => ({ type: 'user/message', data: { role: 'user', content: [{ type: 'text', text }], source: { kind } } })
/** A tool call and its result, as dsh logs them. */
const call = (turn, name, args, { isError = false } = {}) => {
  const callId = `call-${++seq}`
  return [
    { type: 'tool/call', data: { turn, step: 1, callId, name, arguments: JSON.stringify(args) } },
    { type: 'tool/result', data: { turn, step: 1, message: { role: 'tool', toolCallId: callId, isError, content: [] } } },
  ]
}
const items = (...statuses) => statuses.map((status, i) => ({ content: `s${i + 1}`, status }))
const plan = (turn, ...statuses) => call(turn, 'update_plan', { items: items(...statuses), scope: 'first_task' })
const statusesOf = (s, turn) => entryForTurn(s, turn).steps.map((x) => x.status)

test('unrelated events keep the same state reference', () => {
  const s = initialState()
  assert.equal(foldEvent(s, { type: 'tool/call', data: { name: 'read', callId: 'x' } }), s)
  assert.equal(foldEvent(s, { type: 'tool/result', data: { message: { toolCallId: 'unknown' } } }), s)
  assert.equal(foldEvent(s, { type: 'assistant/message', data: {} }), s)
})

test('successful update_plan calls replay into the turn they ran in', () => {
  const s = fold([turnStart(1), ...plan(1, 'in_progress', 'pending'), ...call(1, 'update_plan', { advance: true })])
  assert.equal(s.currentTurn, 1)
  assert.deepEqual(statusesOf(s, 1), ['completed', 'in_progress'])
  assert.deepEqual(s.pending, {})
  assert.equal(parseState(s), s)
})

test('failed calls are ignored', () => {
  const s = fold([turnStart(1), ...plan(1, 'in_progress', 'pending'), ...call(1, 'update_plan', { advance: true }, { isError: true })])
  assert.deepEqual(statusesOf(s, 1), ['in_progress', 'pending'])
})

test('calls made inside run_code (PTC) replay too', () => {
  const s = fold([
    turnStart(3),
    { type: 'tool/ptc-dispatch', data: { name: 'update_plan', arguments: { items: items('in_progress'), scope: 'first_task' }, isError: false, content: [] } },
    { type: 'tool/ptc-dispatch', data: { name: 'update_plan', arguments: { advance: true }, isError: true, content: [] } },
  ])
  assert.deepEqual(statusesOf(s, 3), ['in_progress'])
})

test('execute and replay agree', () => {
  let s = fold([turnStart(1), ...plan(1, 'in_progress', 'pending', 'pending')])
  const live = updatePlanStep(s, { done: [2], start: 3 }, 1)
  assert.equal(live.result, 'Plan updated: step 3 of 3 is in progress.')
  s = fold(call(1, 'update_plan', { done: [2], start: 3 }), s)
  assert.deepEqual(s.turns, live.state.turns)
})

test('wrap_up stores the box and checks off the list', () => {
  const s = fold([turnStart(1), ...plan(1, 'in_progress', 'pending'), ...call(1, 'wrap_up', { recap: 'done' })])
  const entry = entryForTurn(s, 1)
  assert.equal(entry.wrapUp.recap, 'done')
  assert.equal('ask' in entry.wrapUp, false, 'no undefined fields in state')
  assert.deepEqual(statusesOf(s, 1), ['completed', 'completed'])
  assert.equal(s.awaitingReplyTurn, null)
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
})

test('wrap_up without a plan still shows the box', () => {
  const s = fold([turnStart(4), ...call(4, 'wrap_up', { recap: 'Explained the error.' })])
  assert.deepEqual(entryForTurn(s, 4).steps, [])
  assert.equal(entryForTurn(s, 4).wrapUp.recap, 'Explained the error.')
})

test('the next real prompt answers a box with a question', () => {
  const ask = { recap: 'Ready.', ask: 'Commit?', actions: [{ label: 'Commit', message: 'Commit it.' }], blocked: true }
  assert.equal(wrapUpStep(initialState(), ask, 1).ask, true)
  let s = fold([turnStart(1), ...call(1, 'wrap_up', ask)])
  assert.equal(s.awaitingReplyTurn, 1)
  // A reminder injected inside turn 1 is not an answer.
  s = fold([userMessage('reminder', 'repeat-tool-reminder')], s)
  assert.equal(s.awaitingReplyTurn, 1)
  s = fold([turnStart(2), userMessage('Commit it.')], s)
  assert.equal(s.awaitingReplyTurn, null)
  assert.equal(entryForTurn(s, 1).reply, 'Commit it.')
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
})

test('ops in a fresh turn continue only an unfinished, un-wrapped list', () => {
  const open = fold([turnStart(1), ...plan(1, 'completed', 'in_progress')])
  assert.equal(latestOpenPlan(open, 2)?.turn, 1)
  const continued = fold([turnStart(2), ...call(2, 'update_plan', { advance: true })], open)
  assert.deepEqual(statusesOf(continued, 2), ['completed', 'completed'])
  assert.deepEqual(statusesOf(continued, 1), ['completed', 'in_progress'], 'the old turn keeps its own state')
  const wrapped = fold(call(1, 'wrap_up', { recap: 'ok' }), open)
  assert.equal(latestOpenPlan(wrapped, 2), undefined)
  assert.throws(() => updatePlanStep(fold([turnStart(2)], wrapped), { advance: true }, 2), /no plan yet/)
})

test('a new turn clears dangling pending calls', () => {
  const s = fold([turnStart(1), { type: 'tool/call', data: { turn: 1, callId: 'c', name: 'update_plan', arguments: '{}' } }, turnStart(2)])
  assert.deepEqual(s.pending, {})
})

test('unparseable arguments are ignored', () => {
  const s = fold([
    turnStart(1),
    { type: 'tool/call', data: { turn: 1, callId: 'bad', name: 'update_plan', arguments: '{not json' } },
    { type: 'tool/result', data: { message: { toolCallId: 'bad', isError: false } } },
  ])
  assert.equal(s.turns.length, 0)
})

test('only the latest MAX_TURNS turns are kept', () => {
  const events = []
  for (let t = 1; t <= MAX_TURNS + 5; t++) events.push(turnStart(t), ...plan(t, 'completed'))
  const s = fold(events)
  assert.equal(s.turns.length, MAX_TURNS)
  assert.equal(s.turns[0].turn, 6)
})

test('jsonRecord drops undefined fields', () => {
  assert.deepEqual(Object.keys(jsonRecord({ a: 1, b: undefined })), ['a'])
})

test('parseState rejects malformed state', () => {
  assert.throws(() => parseState(null))
  assert.throws(() => parseState({ turns: [], pending: {}, currentTurn: 'a', awaitingReplyTurn: null }))
  assert.throws(() => parseState({ turns: [], pending: [], currentTurn: null, awaitingReplyTurn: null }))
  assert.throws(() => parseState({ turns: [{ turn: 1, steps: 'x' }], pending: {}, currentTurn: null, awaitingReplyTurn: null }))
})
