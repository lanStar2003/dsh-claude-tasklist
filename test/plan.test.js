import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PlanError,
  applyUpdatePlan,
  checkOffAll,
  describePlan,
  describeWrapUp,
  emptyPlan,
  normalizeWrapUp,
} from '../src/core/plan.js'

const items = (...statuses) =>
  statuses.map((status, i) => ({ content: `Step ${i + 1}`, status }))
const statuses = (state) => state.steps.map((s) => s.status)

test('items replace the whole list and record scope', () => {
  const first = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'pending'), scope: 'first_task' })
  assert.deepEqual(statuses(first), ['in_progress', 'pending'])
  assert.equal(first.scope, 'first_task')
  const second = applyUpdatePlan(first, { items: items('completed', 'in_progress', 'pending'), scope: 'continuation' })
  assert.equal(second.steps.length, 3)
  assert.equal(second.scope, 'continuation')
  assert.deepEqual(statuses(first), ['in_progress', 'pending'], 'previous state is not mutated')
})

test('advance completes the current step and starts the next pending one', () => {
  let s = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'pending', 'pending'), scope: 'first_task' })
  s = applyUpdatePlan(s, { advance: true })
  assert.deepEqual(statuses(s), ['completed', 'in_progress', 'pending'])
  assert.equal(describePlan(s, false), 'Plan updated: step 2 of 3 is in progress.')
  s = applyUpdatePlan(s, { advance: true })
  s = applyUpdatePlan(s, { advance: true })
  assert.deepEqual(statuses(s), ['completed', 'completed', 'completed'])
  assert.equal(describePlan(s, false), 'Plan updated: all 3 steps completed.')
})

test('advance skips steps already completed out of order', () => {
  let s = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'completed', 'pending'), scope: 'first_task' })
  s = applyUpdatePlan(s, { advance: true })
  assert.deepEqual(statuses(s), ['completed', 'completed', 'in_progress'])
})

test('advance with nothing in progress starts the first pending step', () => {
  let s = applyUpdatePlan(emptyPlan(), { items: items('pending', 'pending'), scope: 'first_task' })
  s = applyUpdatePlan(s, { advance: true })
  assert.deepEqual(statuses(s), ['in_progress', 'pending'])
})

test('done and start work out of order, 1-based', () => {
  let s = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'pending', 'pending', 'pending'), scope: 'first_task' })
  s = applyUpdatePlan(s, { done: [2], start: 4 })
  assert.deepEqual(statuses(s), ['pending', 'completed', 'pending', 'in_progress'])
  s = applyUpdatePlan(s, { done: [1, 4], start: 3 })
  assert.deepEqual(statuses(s), ['completed', 'completed', 'in_progress', 'completed'])
})

test('first call needs items; ops without a plan are rejected', () => {
  assert.throws(() => applyUpdatePlan(emptyPlan(), { advance: true }), PlanError)
  assert.throws(() => applyUpdatePlan(emptyPlan(), {}), PlanError)
})

test('invalid input is rejected and leaves state alone', () => {
  const s = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'pending'), scope: 'first_task' })
  assert.throws(() => applyUpdatePlan(s, { items: items('pending') }), /scope/)
  assert.throws(() => applyUpdatePlan(s, { items: [], scope: 'continuation' }), /1–12/)
  assert.throws(() => applyUpdatePlan(s, { items: items(...Array(13).fill('pending')), scope: 'continuation' }), /1–12/)
  assert.throws(() => applyUpdatePlan(s, { items: [{ content: ' ', status: 'pending' }], scope: 'continuation' }), /empty/)
  assert.throws(() => applyUpdatePlan(s, { items: [{ content: 'x', status: 'doing' }], scope: 'continuation' }), /status/)
  assert.throws(() => applyUpdatePlan(s, { done: [3] }), /steps 1–2/)
  assert.throws(() => applyUpdatePlan(s, { start: 0 }), /steps 1–2/)
  assert.deepEqual(statuses(s), ['in_progress', 'pending'])
})

test('describePlan wording for a replaced list', () => {
  const s = applyUpdatePlan(emptyPlan(), { items: items('in_progress', 'pending', 'pending', 'pending', 'pending'), scope: 'first_task' })
  assert.equal(describePlan(s, true), 'Plan shown (5 steps).')
})

test('wrap_up checks off every open step', () => {
  const s = applyUpdatePlan(emptyPlan(), { items: items('completed', 'in_progress', 'pending'), scope: 'first_task' })
  assert.deepEqual(statuses(checkOffAll(s)), ['completed', 'completed', 'completed'])
})

test('wrap_up validation and defaults', () => {
  const box = normalizeWrapUp({ recap: ' Done. ', ask: 'Commit it?', actions: [{ label: 'Commit' }, { label: 'Not now', message: 'Leave it uncommitted.' }] })
  assert.equal(box.recap, 'Done.')
  assert.deepEqual(box.actions, [
    { label: 'Commit', message: 'Commit' },
    { label: 'Not now', message: 'Leave it uncommitted.' },
  ])
  assert.equal(box.blocked, false)
  assert.match(describeWrapUp(box), /write no text after/)
  assert.match(describeWrapUp(normalizeWrapUp({ recap: 'ok' })), /closing message follows/)

  assert.throws(() => normalizeWrapUp({ recap: '' }), /required/)
  assert.throws(() => normalizeWrapUp({ recap: 'x'.repeat(301) }), /300/)
  assert.throws(() => normalizeWrapUp({ recap: 'x', ask: 'q'.repeat(101), actions: [{ label: 'a' }] }), /100/)
  assert.throws(() => normalizeWrapUp({ recap: 'x', ask: 'q?' }), /needs 1–2/)
  assert.throws(() => normalizeWrapUp({ recap: 'x', actions: [{ label: 'a' }] }), /answer `ask`/)
  assert.throws(() => normalizeWrapUp({ recap: 'x', ask: 'q?', actions: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }), /At most 2/)
  assert.throws(() => normalizeWrapUp({ recap: 'x', ask: 'q?', actions: [{ label: 'y'.repeat(25) }] }), /24/)
})
