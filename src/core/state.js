// Session projection fold for the task list: per-turn plans and next-step boxes.
// Pure and synchronous, as dsh projections require; it returns the same state
// reference for every event it does not care about.

import { STATUSES, SCOPES } from './plan.js'

export const PLAN_RECORD = 'plugin:tasklist/plan'
export const WRAP_UP_RECORD = 'plugin:tasklist/wrap-up'

/** How many turns with a plan or box the projection keeps (oldest dropped first). */
export const MAX_TURNS = 100

/**
 * @typedef {import('./plan.js').Step} Step
 * @typedef {{ recap: string, ask?: string, actions: { label: string, message: string }[], blocked: boolean }} WrapUp
 * @typedef {{ turn: number, steps: Step[], scope?: string, wrapUp?: WrapUp, reply?: string }} TurnEntry
 * @typedef {{ currentTurn: number | null, awaitingReplyTurn: number | null, turns: TurnEntry[] }} TasklistState
 */

/** @returns {TasklistState} */
export function initialState() {
  return { currentTurn: null, awaitingReplyTurn: null, turns: [] }
}

/**
 * @param {TasklistState} state
 * @param {{ type: string, data?: any }} event a session event
 * @param {(event: any) => { type: string, data: unknown } | undefined} recordOf pluginRecordOf from dsh-session
 * @returns {TasklistState}
 */
export function foldEvent(state, event, recordOf) {
  if (event.type === 'turn/start') {
    const turn = event.data?.turn
    return Number.isInteger(turn) ? { ...state, currentTurn: turn } : state
  }
  if (event.type === 'user/message') {
    // The first real user prompt after a box with a question answers it.
    const pending = state.awaitingReplyTurn
    if (pending === null || state.currentTurn === null || state.currentTurn <= pending) return state
    if (event.data?.source?.kind !== 'user') return state
    const text = textOf(event.data.content)
    return {
      ...state,
      awaitingReplyTurn: null,
      turns: state.turns.map((t) => (t.turn === pending ? { ...t, reply: text } : t)),
    }
  }
  if (!event.type.startsWith('plugin:tasklist/')) return state
  const record = recordOf(event)
  if (record === undefined) return state
  if (record.type === PLAN_RECORD) {
    const plan = readPlanRecord(record.data)
    if (plan === undefined) return state
    return upsertTurn(state, plan.turn, (entry) => jsonRecord({ ...entry, steps: plan.steps, scope: plan.scope }))
  }
  if (record.type === WRAP_UP_RECORD) {
    const box = readWrapUpRecord(record.data)
    if (box === undefined) return state
    const next = upsertTurn(state, box.turn, ({ reply: _answered, ...entry }) => jsonRecord({
      ...entry,
      steps: box.steps ?? entry.steps,
      wrapUp: box.wrapUp,
    }))
    return { ...next, awaitingReplyTurn: box.wrapUp.ask ? box.turn : next.awaitingReplyTurn === box.turn ? null : next.awaitingReplyTurn }
  }
  return state
}

/** dsh rejects plugin records that are not plain JSON, so drop fields left undefined. */
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

// ---------- record validation (records may come from an older build) ----------

function readSteps(value) {
  if (!Array.isArray(value)) return undefined
  const steps = []
  for (const s of value) {
    if (typeof s?.content !== 'string' || !STATUSES.includes(s.status)) return undefined
    steps.push({ content: s.content, status: s.status })
  }
  return steps
}

export function readPlanRecord(data) {
  if (!Number.isInteger(data?.turn)) return undefined
  const steps = readSteps(data.steps)
  if (steps === undefined) return undefined
  const scope = SCOPES.includes(data.scope) ? data.scope : undefined
  return { turn: data.turn, steps, scope }
}

export function readWrapUpRecord(data) {
  if (!Number.isInteger(data?.turn) || typeof data.recap !== 'string') return undefined
  const actions = Array.isArray(data.actions)
    ? data.actions
      .filter((a) => typeof a?.label === 'string')
      .map((a) => ({ label: a.label, message: typeof a.message === 'string' ? a.message : a.label }))
    : []
  const steps = data.steps === undefined ? undefined : readSteps(data.steps)
  return {
    turn: data.turn,
    steps,
    wrapUp: {
      recap: data.recap,
      ask: typeof data.ask === 'string' && data.ask ? data.ask : undefined,
      actions,
      blocked: data.blocked === true,
    },
  }
}

// ---------- structural check used as the projection's state/view schema ----------

export function parseState(value) {
  if (value === null || typeof value !== 'object' || !Array.isArray(value.turns)) {
    throw new TypeError('tasklist projection: malformed state')
  }
  const turn = (v) => v === null || Number.isInteger(v)
  if (!turn(value.currentTurn) || !turn(value.awaitingReplyTurn)) {
    throw new TypeError('tasklist projection: malformed turn markers')
  }
  for (const entry of value.turns) {
    if (!Number.isInteger(entry?.turn) || readSteps(entry.steps) === undefined) {
      throw new TypeError('tasklist projection: malformed turn entry')
    }
  }
  return value
}
