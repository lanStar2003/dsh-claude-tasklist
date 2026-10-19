import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foldEvent, initialState } from '../src/core/state.js'
import { isReminderPoint, missingPlanReminder, progressReminder } from '../src/core/reminder.js'

const fold = (events, state = initialState()) => events.reduce((s, e) => foldEvent(s, e), state)

let seq = 0
const turnStart = (turn) => ({ type: 'turn/start', data: { turn } })
const call = (turn, name, args) => {
  const callId = `call-${++seq}`
  return [
    { type: 'tool/call', data: { turn, step: 1, callId, name, arguments: JSON.stringify(args) } },
    { type: 'tool/result', data: { turn, step: 1, message: { role: 'tool', toolCallId: callId, isError: false, content: [] } } },
  ]
}
const plan = (turn, ...statuses) =>
  call(turn, 'update_plan', { items: statuses.map((status, i) => ({ content: `s${i + 1}`, status })), scope: 'first_task' })

test('reminder points fall every N steps, and N = 0 turns them off', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].filter((n) => isReminderPoint(n, 3)), [3, 6])
  assert.equal(isReminderPoint(3, 0), false)
})

test('names the step that is still in progress', () => {
  const s = fold([turnStart(1), ...plan(1, 'completed', 'in_progress', 'pending')])
  const note = progressReminder(s, 1, 3)
  assert.match(note.text, /step 2 of 3, "s2", has stayed in progress for the last 3 model steps/)
  assert.match(note.text, /\{"advance": true\}/)
  assert.equal(note.summary, 'Task list: step 2 of 3 still in progress')
})

test('asks for a current step when none is in progress', () => {
  const s = fold([turnStart(1), ...plan(1, 'completed', 'pending')])
  assert.match(progressReminder(s, 1, 3).text, /no step is marked in progress \(1 of 2 done\)/)
})

test('stays quiet without a plan this turn, once wrapped up, or when all is done', () => {
  const planned = fold([turnStart(1), ...plan(1, 'in_progress', 'pending')])
  assert.equal(progressReminder(planned, 2, 3), undefined)
  assert.equal(progressReminder(fold(call(1, 'wrap_up', { recap: 'ok' }), planned), 1, 3), undefined)
  assert.equal(progressReminder(fold([turnStart(1), ...plan(1, 'completed', 'completed')]), 1, 3), undefined)
})

test('a logged reminder note is not taken as the user answering the box', () => {
  const asked = fold([
    turnStart(1),
    ...plan(1, 'in_progress'),
    ...call(1, 'wrap_up', { recap: 'r', ask: 'Go?', actions: [{ label: 'Yes' }], blocked: true }),
  ])
  const note = { type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: 'Task list check: …' }], source: { kind: 'tasklist', form: 'notice', summary: 'x' } } }
  assert.equal(foldEvent(asked, note), asked)
})

test('a turn running tools without a plan is asked for one', () => {
  const s = fold([turnStart(1)])
  const note = missingPlanReminder(s, 1)
  assert.match(note.text, /no task list yet/)
  assert.match(note.text, /tools\.update_plan/)
  assert.equal(note.summary, 'Task list: no plan yet')
})

test('no plan request once the turn has a list or has wrapped up', () => {
  assert.equal(missingPlanReminder(fold([turnStart(1), ...plan(1, 'in_progress')]), 1), undefined)
  assert.equal(missingPlanReminder(fold([turnStart(1), ...call(1, 'wrap_up', { recap: '好了。' })]), 1), undefined)
  // a plan from an earlier turn does not count for this one
  assert.notEqual(missingPlanReminder(fold([turnStart(1), ...plan(1, 'in_progress'), turnStart(2)]), 2), undefined)
})
