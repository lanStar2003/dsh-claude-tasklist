// Session projection fold for the task list: per-turn plans and next-step boxes.
//
// Nothing custom is written to the session log. The state is rebuilt by replaying
// the durable `tool/call` + `tool/result` events of successful `update_plan` /
// `wrap_up` calls (and `tool/ptc-dispatch` for calls made inside run_code) through
// the same pure rules the tools use, so it survives reloads on every dsh 0.2.x.
// Pure and synchronous, as dsh projections require; events it does not care about
// return the same state reference.

import {
  PlanError,
  applyUpdatePlan,
  checkOffAll,
  describePlan,
  describeWrapUp,
  emptyPlan,
  normalizeWrapUp,
  STATUSES,
} from './plan.js'
import { isBookkeepingProgram } from './bookkeeping.js'

export const TOOL_NAMES = ['update_plan', 'wrap_up']

/** How many turns with a plan or box the projection keeps (oldest dropped first). */
export const MAX_TURNS = 100

/** How many quiet run_code call ids the projection keeps (oldest dropped first). */
export const MAX_QUIET = 200

/** The code-mode transport whose programs may be pure bookkeeping. */
const RUN_CODE = 'run_code'

/**
 * @typedef {import('./plan.js').Step} Step
 * @typedef {{ recap: string, ask?: string, actions: { label: string, message: string }[], blocked: boolean }} WrapUp
 * @typedef {{ turn: number, steps: Step[], scope?: string, wrapUp?: WrapUp, reply?: string }} TurnEntry
 * @typedef {{ name: string, args: string, turn: number }} PendingCall
 * @typedef {{ currentTurn: number | null, awaitingReplyTurn: number | null, pending: Record<string, PendingCall>, turns: TurnEntry[], quiet: string[] }} TasklistState
 * `quiet` lists run_code calls whose program only updates the list or the box; the
 * web client hides their rows like direct update_plan / wrap_up rows.
 */

/** @returns {TasklistState} */
export function initialState() {
  return { currentTurn: null, awaitingReplyTurn: null, pending: {}, turns: [], quiet: [] }
}

// ---------- the two tools' rules, shared by execute() and the fold ----------

/**
 * Apply one `update_plan` call. Throws PlanError when the call is invalid.
 * @returns {{ state: TasklistState, result: string }}
 */
export function updatePlanStep(/** @type {TasklistState} */ state, /** @type {any} */ args, /** @type {number} */ turn) {
  const own = entryForTurn(state, turn)
  // Ops without items in a fresh turn continue the last unfinished list.
  const base = own ?? (args?.items === undefined ? latestOpenPlan(state, turn) : undefined)
  const prev = base ? { steps: base.steps, scope: base.scope } : emptyPlan()
  const next = applyUpdatePlan(prev, args ?? {})
  return {
    state: upsertTurn(state, turn, (entry) => jsonRecord({ ...entry, steps: next.steps, scope: next.scope })),
    result: describePlan(next, args?.items !== undefined),
  }
}

/**
 * Apply one `wrap_up` call: store the box and check off the turn's list.
 * Throws PlanError when the call is invalid.
 * @returns {{ state: TasklistState, result: string, ask: boolean }}
 */
export function wrapUpStep(/** @type {TasklistState} */ state, /** @type {any} */ args, /** @type {number} */ turn) {
  const box = normalizeWrapUp(args ?? {})
  const own = entryForTurn(state, turn)
  const steps = own && own.steps.length > 0 ? checkOffAll(own).steps : own?.steps ?? []
  const next = upsertTurn(state, turn, ({ reply: _answered, ...entry }) => jsonRecord({ ...entry, steps, wrapUp: box }))
  const awaitingReplyTurn = box.ask ? turn : next.awaitingReplyTurn === turn ? null : next.awaitingReplyTurn
  return { state: { ...next, awaitingReplyTurn }, result: describeWrapUp(box), ask: box.ask !== undefined }
}

// ---------- fold ----------

/**
 * @param {TasklistState} state
 * @param {{ type: string, data?: any }} event a session event
 * @returns {TasklistState}
 */
export function foldEvent(state, event) {
  const data = event.data
  switch (event.type) {
    case 'turn/start': {
      if (!Number.isInteger(data?.turn)) return state
      return { ...state, currentTurn: data.turn, pending: {} }
    }
    case 'user/message': {
      // The first real user prompt after a box with a question answers it.
      const pending = state.awaitingReplyTurn
      if (pending === null || state.currentTurn === null || state.currentTurn <= pending) return state
      if (data?.source?.kind !== 'user') return state
      const text = textOf(data.content)
      return {
        ...state,
        awaitingReplyTurn: null,
        turns: state.turns.map((t) => (t.turn === pending ? { ...t, reply: text } : t)),
      }
    }
    case 'tool/call': {
      if (data?.name === RUN_CODE && typeof data.callId === 'string') return noteQuietCall(state, data)
      if (!TOOL_NAMES.includes(data?.name) || typeof data.callId !== 'string') return state
      const turn = Number.isInteger(data.turn) ? data.turn : state.currentTurn ?? 0
      const args = typeof data.arguments === 'string' ? data.arguments : JSON.stringify(data.arguments ?? {})
      return { ...state, pending: { ...state.pending, [data.callId]: { name: data.name, args, turn } } }
    }
    case 'tool/result': {
      const callId = data?.message?.toolCallId
      const call = typeof callId === 'string' ? state.pending[callId] : undefined
      if (call === undefined) return state
      const { [callId]: _done, ...rest } = state.pending
      const cleared = { ...state, pending: rest }
      if (data.message.isError === true) return cleared
      return replay(cleared, call.name, parseArgs(call.args), call.turn)
    }
    case 'tool/ptc-dispatch': {
      if (!TOOL_NAMES.includes(data?.name) || data.isError === true) return state
      const args = typeof data.arguments === 'string' ? parseArgs(data.arguments) : data.arguments
      return replay(state, data.name, args, state.currentTurn ?? 0)
    }
    default:
      return state
  }
}

function noteQuietCall(state, data) {
  const args = typeof data.arguments === 'string' ? parseArgs(data.arguments) : data.arguments
  if (!isBookkeepingProgram(args?.code)) return state
  const quiet = state.quiet ?? []
  if (quiet.includes(data.callId)) return state
  const next = [...quiet, data.callId]
  return { ...state, quiet: next.length > MAX_QUIET ? next.slice(next.length - MAX_QUIET) : next }
}

function replay(state, name, args, turn) {
  if (args === undefined) return state
  try {
    return name === 'update_plan' ? updatePlanStep(state, args, turn).state : wrapUpStep(state, args, turn).state
  } catch (error) {
    // The call succeeded when it ran, so this only happens for a log written by a
    // build with other rules; keep the state rather than failing the projection.
    if (error instanceof PlanError) return state
    throw error
  }
}

function parseArgs(text) {
  try {
    const value = JSON.parse(text)
    return value !== null && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}

/** Projection state must be plain JSON, so drop fields left undefined. */
export function jsonRecord(data) {
  return JSON.parse(JSON.stringify(data))
}

/** The list a new turn continues from when the model sends ops without items. */
export function latestOpenPlan(/** @type {TasklistState} */ state, /** @type {number} */ beforeTurn) {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const entry = state.turns[i]
    if (entry.turn >= beforeTurn || entry.steps.length === 0) continue
    if (entry.wrapUp || entry.steps.every((s) => s.status === 'completed')) return undefined
    return entry
  }
  return undefined
}

export function entryForTurn(/** @type {TasklistState} */ state, /** @type {number} */ turn) {
  return state.turns.find((t) => t.turn === turn)
}

function upsertTurn(state, turn, update) {
  const index = state.turns.findIndex((t) => t.turn === turn)
  const base = index >= 0 ? state.turns[index] : { turn, steps: [] }
  const entry = update(base)
  let turns
  if (index >= 0) {
    turns = state.turns.slice()
    turns[index] = entry
  } else {
    turns = [...state.turns, entry].sort((a, b) => a.turn - b.turn)
    if (turns.length > MAX_TURNS) turns = turns.slice(turns.length - MAX_TURNS)
  }
  return { ...state, turns }
}

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n')
}

// ---------- structural check used as the projection's state/view schema ----------

function validSteps(value) {
  return Array.isArray(value) && value.every((s) => typeof s?.content === 'string' && STATUSES.includes(s.status))
}

export function parseState(value) {
  if (value === null || typeof value !== 'object' || !Array.isArray(value.turns)) {
    throw new TypeError('tasklist projection: malformed state')
  }
  const turn = (v) => v === null || Number.isInteger(v)
  if (!turn(value.currentTurn) || !turn(value.awaitingReplyTurn)) {
    throw new TypeError('tasklist projection: malformed turn markers')
  }
  if (value.pending === null || typeof value.pending !== 'object' || Array.isArray(value.pending)) {
    throw new TypeError('tasklist projection: malformed pending calls')
  }
  if (value.quiet !== undefined && !(Array.isArray(value.quiet) && value.quiet.every((id) => typeof id === 'string'))) {
    throw new TypeError('tasklist projection: malformed quiet calls')
  }
  for (const entry of value.turns) {
    if (!Number.isInteger(entry?.turn) || !validSteps(entry.steps)) {
      throw new TypeError('tasklist projection: malformed turn entry')
    }
  }
  return value
}
