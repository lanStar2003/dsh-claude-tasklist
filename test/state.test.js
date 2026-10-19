import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_TURNS,
  PLAN_RECORD,
  WRAP_UP_RECORD,
  entryForTurn,
  foldEvent,
  initialState,
  jsonRecord,
  latestOpenPlan,
  parseState,
} from '../src/core/state.js'

// Stand-in for dsh-session's pluginRecordOf: plugin records arrive as events whose
// type is the record name and whose data is the payload.
const recordOf = (event) => (event.type.startsWith('plugin:') ? { type: event.type, data: event.data } : undefined)
const fold = (events, state = initialState()) => events.reduce((s, e) => foldEvent(s, e, recordOf), state)

const turnStart = (turn) => ({ type: 'turn/start', data: { turn } })
const userMessage = (text, kind = 'user') => ({ type: 'user/message', data: { role: 'user', content: [{ type: 'text', text }], source: { kind } } })
const planRecord = (turn, ...statuses) => ({
  type: PLAN_RECORD,
  data: { turn, scope: 'first_task', steps: statuses.map((status, i) => ({ content: `s${i + 1}`, status })) },
})
const wrapUp = (turn, extra = {}) => ({ type: WRAP_UP_RECORD, data: { turn, recap: 'done', actions: [], ...extra } })

test('unrelated events keep the same state reference', () => {
  const s = initialState()
  assert.equal(foldEvent(s, { type: 'tool/call', data: {} }, recordOf), s)
  assert.equal(foldEvent(s, { type: 'plugin:other/thing', data: {} }, recordOf), s)
})

test('plans are stored per turn and the latest record wins', () => {
  const s = fold([turnStart(1), planRecord(1, 'in_progress', 'pending'), planRecord(1, 'completed', 'in_progress')])
  assert.equal(s.currentTurn, 1)
  assert.deepEqual(entryForTurn(s, 1).steps.map((x) => x.status), ['completed', 'in_progress'])
  assert.equal(parseState(s), s)
})

test('a wrap-up stores the box and its checked-off steps', () => {
  const s = fold([turnStart(1), planRecord(1, 'in_progress'), wrapUp(1, { steps: [{ content: 's1', status: 'completed' }] })])
  const entry = entryForTurn(s, 1)
  assert.equal(entry.wrapUp.recap, 'done')
  assert.equal(entry.steps[0].status, 'completed')
  assert.equal(s.awaitingReplyTurn, null)
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
})

test('the next real prompt answers a box with a question', () => {
  let s = fold([
    turnStart(1),
    wrapUp(1, { ask: 'Commit?', actions: [{ label: 'Commit', message: 'Commit it.' }], blocked: true }),
  ])
  assert.equal(s.awaitingReplyTurn, 1)
  // A reminder injected inside turn 1 is not an answer.
  s = fold([userMessage('reminder', 'repeat-tool-reminder')], s)
  assert.equal(s.awaitingReplyTurn, 1)
  s = fold([turnStart(2), userMessage('Commit it.')], s)
  assert.equal(s.awaitingReplyTurn, null)
  assert.equal(entryForTurn(s, 1).reply, 'Commit it.')
  // Projection state must survive a JSON round trip unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
})

test('ops in a fresh turn continue only an unfinished, un-wrapped list', () => {
  const open = fold([turnStart(1), planRecord(1, 'completed', 'in_progress')])
  assert.equal(latestOpenPlan(open, 2)?.turn, 1)
  const wrapped = fold([wrapUp(1)], open)
  assert.equal(latestOpenPlan(wrapped, 2), undefined)
  const finished = fold([turnStart(1), planRecord(1, 'completed')])
  assert.equal(latestOpenPlan(finished, 2), undefined)
})

test('malformed records from an older build are ignored', () => {
  const s = initialState()
  assert.equal(foldEvent(s, { type: PLAN_RECORD, data: { turn: 'x', steps: [] } }, recordOf), s)
  assert.equal(foldEvent(s, { type: PLAN_RECORD, data: { turn: 1, steps: [{ content: 'a', status: 'doing' }] } }, recordOf), s)
  assert.equal(foldEvent(s, { type: WRAP_UP_RECORD, data: { turn: 1 } }, recordOf), s)
})

test('only the latest MAX_TURNS turns are kept', () => {
  const events = []
  for (let t = 1; t <= MAX_TURNS + 5; t++) events.push(turnStart(t), planRecord(t, 'completed'))
  const s = fold(events)
  assert.equal(s.turns.length, MAX_TURNS)
  assert.equal(s.turns[0].turn, 6)
})

test('jsonRecord drops undefined optional fields', () => {
  const data = jsonRecord({ turn: 2, recap: 'ok', ask: undefined, actions: [], blocked: false, steps: undefined })
  assert.deepEqual(Object.keys(data), ['turn', 'recap', 'actions', 'blocked'])
  assert.equal(foldEvent(initialState(), { type: WRAP_UP_RECORD, data }, recordOf).turns[0].wrapUp.recap, 'ok')
})

test('parseState rejects malformed state', () => {
  assert.throws(() => parseState(null))
  assert.throws(() => parseState({ turns: [], currentTurn: 'a', awaitingReplyTurn: null }))
  assert.throws(() => parseState({ turns: [{ turn: 1, steps: 'x' }], currentTurn: null, awaitingReplyTurn: null }))
})
