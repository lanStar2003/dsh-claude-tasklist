// Pure state machine for the task list and the next-step box.
// Mirrors the semantics of Claude Code desktop's `update_plan` / `wrap_up` tools.
// No dsh imports here so the rules can be unit-tested in isolation.

/** @typedef {'pending' | 'in_progress' | 'completed'} StepStatus */
/** @typedef {{ content: string, status: StepStatus }} Step */
/** @typedef {'first_task' | 'new_task' | 'continuation'} Scope */
/**
 * @typedef {object} PlanState
 * @property {Step[]} steps
 * @property {Scope | undefined} scope
 */
/**
 * @typedef {object} UpdatePlanArgs
 * @property {Step[]} [items]
 * @property {Scope} [scope]
 * @property {boolean} [advance]
 * @property {number[]} [done]
 * @property {number} [start]
 */
/** @typedef {{ label: string, message?: string }} WrapUpAction */
/**
 * @typedef {object} WrapUpArgs
 * @property {string} recap
 * @property {string} [ask]
 * @property {WrapUpAction[]} [actions]
 * @property {boolean} [blocked]
 */

export const STATUSES = /** @type {const} */ (['pending', 'in_progress', 'completed'])
export const SCOPES = /** @type {const} */ (['first_task', 'new_task', 'continuation'])
export const LIMITS = {
  minSteps: 1,
  maxSteps: 12,
  recap: 300,
  ask: 100,
  label: 24,
  message: 300,
  maxActions: 2,
}

export class PlanError extends Error {
  name = 'PlanError'
}

/** @returns {PlanState} */
export function emptyPlan() {
  return { steps: [], scope: undefined }
}

/**
 * Apply one `update_plan` call. Order inside a call: items → done → start → advance.
 * Throws PlanError on invalid input; the previous state is never mutated.
 * @param {PlanState} prev
 * @param {UpdatePlanArgs} args
 * @returns {PlanState}
 */
export function applyUpdatePlan(prev, args) {
  const hasItems = args.items !== undefined
  const hasOps = args.advance === true || (args.done?.length ?? 0) > 0 || args.start !== undefined
  if (!hasItems && !hasOps) {
    throw new PlanError('Pass `items` (the whole plan), or one of `advance`, `done`, `start`.')
  }

  let steps = prev.steps.map((s) => ({ ...s }))
  let scope = prev.scope

  if (hasItems) {
    const items = args.items ?? []
    if (items.length < LIMITS.minSteps || items.length > LIMITS.maxSteps) {
      throw new PlanError(`\`items\` must hold ${LIMITS.minSteps}–${LIMITS.maxSteps} steps; got ${items.length}.`)
    }
    if (args.scope === undefined) {
      throw new PlanError('`scope` is required with `items`: "first_task", "new_task" or "continuation".')
    }
    if (!SCOPES.includes(args.scope)) {
      throw new PlanError(`Unknown scope "${args.scope}".`)
    }
    steps = items.map((item, i) => {
      const content = typeof item?.content === 'string' ? item.content.trim() : ''
      if (!content) throw new PlanError(`Step ${i + 1} has empty \`content\`.`)
      if (!STATUSES.includes(item.status)) {
        throw new PlanError(`Step ${i + 1} has unknown status "${item.status}".`)
      }
      return { content, status: item.status }
    })
    scope = args.scope
  } else if (steps.length === 0) {
    throw new PlanError('There is no plan yet: send the whole plan with `items` first.')
  }

  const checkIndex = (/** @type {number} */ n, /** @type {string} */ field) => {
    if (!Number.isInteger(n) || n < 1 || n > steps.length) {
      throw new PlanError(`\`${field}\` refers to step ${n}, but the plan has steps 1–${steps.length}.`)
    }
    return n - 1
  }

  for (const n of args.done ?? []) {
    steps[checkIndex(n, 'done')].status = 'completed'
  }

  if (args.start !== undefined) {
    const target = checkIndex(args.start, 'start')
    for (const step of steps) {
      if (step.status === 'in_progress') step.status = 'pending'
    }
    steps[target].status = 'in_progress'
  }

  if (args.advance === true) {
    const current = steps.findIndex((s) => s.status === 'in_progress')
    if (current >= 0) steps[current].status = 'completed'
    // The next pending step after the current one; fall back to the first pending anywhere.
    let next = steps.findIndex((s, i) => i > current && s.status === 'pending')
    if (next < 0) next = steps.findIndex((s) => s.status === 'pending')
    if (next >= 0) steps[next].status = 'in_progress'
  }

  return { steps, scope }
}

/**
 * The short tool result the model sees, worded like the original.
 * @param {PlanState} state
 * @param {boolean} replaced whether this call sent `items`
 */
export function describePlan(state, replaced) {
  const n = state.steps.length
  const unit = n === 1 ? 'step' : 'steps'
  if (replaced) return `Plan shown (${n} ${unit}).`
  const current = state.steps.findIndex((s) => s.status === 'in_progress')
  if (current >= 0) return `Plan updated: step ${current + 1} of ${n} is in progress.`
  if (state.steps.every((s) => s.status === 'completed')) return `Plan updated: all ${n} ${unit} completed.`
  return `Plan updated: no step is in progress (${countDone(state)} of ${n} completed).`
}

/** @param {PlanState} state */
export function countDone(state) {
  return state.steps.filter((s) => s.status === 'completed').length
}

/**
 * `wrap_up` checks off every step that is still open.
 * @param {PlanState} state
 * @returns {PlanState}
 */
export function checkOffAll(state) {
  return { ...state, steps: state.steps.map((s) => ({ ...s, status: 'completed' })) }
}

/**
 * Validate and normalize `wrap_up` arguments. Throws PlanError on invalid input.
 * @param {WrapUpArgs} args
 * @returns {Required<Pick<WrapUpArgs, 'recap' | 'blocked'>> & { ask?: string, actions: Required<WrapUpAction>[] }}
 */
export function normalizeWrapUp(args) {
  const recap = typeof args.recap === 'string' ? args.recap.trim() : ''
  if (!recap) throw new PlanError('`recap` is required.')
  if (recap.length > LIMITS.recap) {
    throw new PlanError(`\`recap\` is ${recap.length} characters; keep it within ${LIMITS.recap}.`)
  }
  const ask = typeof args.ask === 'string' && args.ask.trim() ? args.ask.trim() : undefined
  if (ask && ask.length > LIMITS.ask) {
    throw new PlanError(`\`ask\` is ${ask.length} characters; keep it within ${LIMITS.ask}.`)
  }
  const rawActions = args.actions ?? []
  if (rawActions.length > LIMITS.maxActions) {
    throw new PlanError(`At most ${LIMITS.maxActions} buttons; got ${rawActions.length}.`)
  }
  if (ask && rawActions.length === 0) {
    throw new PlanError('`ask` needs 1–2 `actions` that answer it.')
  }
  if (!ask && rawActions.length > 0) {
    throw new PlanError('`actions` answer `ask`; pass the question too, or drop the buttons.')
  }
  const actions = rawActions.map((a, i) => {
    const label = typeof a?.label === 'string' ? a.label.trim() : ''
    if (!label) throw new PlanError(`Button ${i + 1} has no \`label\`.`)
    if (label.length > LIMITS.label) {
      throw new PlanError(`Button ${i + 1} label is ${label.length} characters; keep it within ${LIMITS.label}.`)
    }
    const message = typeof a.message === 'string' && a.message.trim() ? a.message.trim() : label
    if (message.length > LIMITS.message) {
      throw new PlanError(`Button ${i + 1} message is ${message.length} characters; keep it within ${LIMITS.message}.`)
    }
    return { label, message }
  })
  return { recap, ask, actions, blocked: args.blocked === true }
}

/** The tool result for `wrap_up`, telling the model what is due next. */
export function describeWrapUp(/** @type {{ ask?: string }} */ box) {
  return box.ask
    ? 'Next-step box shown with your question. It ends your turn: write no text after this call.'
    : 'Recap shown. Your closing message follows this call: answer the user in full.'
}
