// The "keep the list moving" note: when the plan has not changed for a while during
// a turn, the model gets a short reminder after a tool result, so the pinned list
// keeps showing the step it is actually on. Pure: the host decides when to ask.

import { entryForTurn } from './state.js'

/** Remind after this many model steps without an `update_plan` / `wrap_up` call. */
export const DEFAULT_REMIND_AFTER_STEPS = 3

/**
 * Whether `since` model steps without a plan update is a reminder point: every
 * `every` steps (3, 6, 9, … by default). `every` ≤ 0 turns reminders off.
 */
export function isReminderPoint(/** @type {number} */ since, /** @type {number} */ every) {
  return every > 0 && since >= every && since % every === 0
}

const TAIL = ' The user follows your progress on this list, not in your messages. Do not mention this note.'

/**
 * The note for a turn that has started running tools without a plan, or undefined
 * when the turn already has a list or has wrapped up.
 * @param {import('./state.js').TasklistState} state
 * @param {number} turn
 * @returns {{ text: string, summary: string } | undefined}
 */
export function missingPlanReminder(state, turn) {
  const entry = entryForTurn(state, turn)
  if (entry && (entry.steps.length > 0 || entry.wrapUp)) return undefined
  return {
    text:
      'Task list check: this turn is running tools but has no task list yet. If the request needs more than ' +
      'this one tool call, send update_plan with the whole plan now, as a call of its own (in code mode: a ' +
      'run_code whose program only calls tools.update_plan), before any other tool. If you are ready to answer, ' +
      'ignore this.' + TAIL,
    summary: 'Task list: no plan yet',
  }
}

/**
 * The note for `turn`, or undefined when its list needs none (no plan this turn,
 * the turn already wrapped up, or every step is done).
 * @param {import('./state.js').TasklistState} state
 * @param {number} turn
 * @param {number} since model steps since the last plan update
 * @returns {{ text: string, summary: string } | undefined}
 */
export function progressReminder(state, turn, since) {
  const entry = entryForTurn(state, turn)
  if (!entry || entry.wrapUp || entry.steps.length === 0) return undefined
  const steps = entry.steps
  const n = steps.length
  if (steps.every((s) => s.status === 'completed')) return undefined
  const current = steps.findIndex((s) => s.status === 'in_progress')
  const tail = TAIL
  if (current < 0) {
    const done = steps.filter((s) => s.status === 'completed').length
    return {
      text:
        `Task list check: no step is marked in progress (${done} of ${n} done). ` +
        `Send update_plan {"start": k} for the step you are on, together with your next tool call.` + tail,
      summary: `Task list: no step in progress (${done} of ${n} done)`,
    }
  }
  return {
    text:
      `Task list check: step ${current + 1} of ${n}, "${steps[current].content}", has stayed in progress ` +
      `for the last ${since} model steps. If that step is finished, send update_plan {"advance": true} ` +
      `together with your next tool call; if the plan changed, send the whole list again. ` +
      `If the step is still underway, carry on.` + tail,
    summary: `Task list: step ${current + 1} of ${n} still in progress`,
  }
}
