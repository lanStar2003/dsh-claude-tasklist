// dsh host half: the `update_plan` and `wrap_up` tools, the `tasklist` session
// projection the web client renders, and the system-prompt guidance.
//
// The tools write nothing of their own to the session log: the projection replays
// their successful calls from the durable tool events (see core/state.js), so the
// list survives reloads on every dsh 0.2.x, including builds without plugin records.
// The one other thing logged is the occasional "keep the list moving" note
// (core/reminder.js), an ordinary context message the web client hides.

import { randomUUID } from 'node:crypto'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { PlanError, SCOPES, STATUSES } from '../core/plan.js'
import { initialState, foldEvent, parseState, updatePlanStep, wrapUpStep } from '../core/state.js'
import { SYSTEM_PROMPT_SECTION, UPDATE_PLAN_DESCRIPTION, WRAP_UP_DESCRIPTION } from '../core/prompt.js'
import { DEFAULT_REMIND_AFTER_STEPS, isReminderPoint, progressReminder } from '../core/reminder.js'

export const name = 'tasklist'
export const inject = ['tools', 'sessionProjections', 'systemPrompt']

const DEFAULTS = {
  /** Hide dsh's own `todo_write` tool from the model so it keeps one list, not two. */
  hideBuiltinTodo: true,
  /** Where the task-list guidance sits among system-prompt sections. */
  promptOrder: 2450,
  /** Remind the model to move the list on after this many steps without an update; 0 turns it off. */
  remindAfterSteps: DEFAULT_REMIND_AFTER_STEPS,
}

/** Source kind of the reminder notes; the web client hides rows with this producer. */
const REMINDER_KIND = 'tasklist'
const PLAN_TOOLS = new Set(['update_plan', 'wrap_up'])

const PROJECTION_KEY = 'tasklist'
const STATE_VERSION = 2
const stateSchema = { parse: parseState }
const textResult = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }

export function apply(ctx, rawConfig) {
  const config = readConfig(rawConfig)

  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema,
    init: () => initialState(),
    apply: (state, event) => foldEvent(state, event),
    wire: { viewSchema: stateSchema, view: (state) => state },
  })

  /** The projection state and turn this call runs in. */
  const contextOf = (exec, tool) => {
    const session = exec.agent?.session
    if (!session) throw new Error(`${tool} needs an agent session.`)
    const state = ctx.sessionProjections.stateOf(session, PROJECTION_KEY) ?? initialState()
    return { state, turn: state.currentTurn ?? 0 }
  }

  ctx.tools.register(defineTool({
    name: 'update_plan',
    description: UPDATE_PLAN_DESCRIPTION,
    parameters: {
      items: {
        type: 'array',
        description: 'The whole plan, in order (1–12 steps); replaces the previous list.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string', required: true, description: 'Short imperative phrase, at most ~7 words.' },
            status: { type: 'string', required: true, enum: [...STATUSES] },
          },
        },
      },
      scope: {
        type: 'string',
        enum: [...SCOPES],
        description: 'Required with items: "first_task", "new_task" or "continuation" (see the tool description).',
      },
      advance: { type: 'boolean', description: 'Complete the in_progress step and start the next pending one.' },
      done: { type: 'array', items: { type: 'integer' }, description: '1-based steps to mark completed.' },
      start: { type: 'integer', description: '1-based step to mark in_progress.' },
    },
    output: textResult,
    async execute(args, exec) {
      const { state, turn } = contextOf(exec, 'update_plan')
      return guard(() => updatePlanStep(state, args, turn).result)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'wrap_up',
    description: WRAP_UP_DESCRIPTION,
    parameters: {
      recap: { type: 'string', required: true, description: 'Two or three short sentences, at most 300 characters.' },
      ask: { type: 'string', description: 'One decision for the user, at most 100 characters; needs actions.' },
      actions: {
        type: 'array',
        description: '1–2 reply buttons answering ask, recommendation first.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', required: true, description: 'Button text, 1–3 words, at most 24 characters.' },
            message: { type: 'string', description: 'What the click sends, at most 300 characters; omit when the label says it all.' },
          },
        },
      },
      blocked: { type: 'boolean', description: 'True when your work stops here until the user answers.' },
    },
    output: textResult,
    async execute(args, exec) {
      const { state, turn } = contextOf(exec, 'wrap_up')
      const step = guard(() => wrapUpStep(state, args, turn))
      // A box that asks something ends the turn right after this result.
      if (step.ask) exec.concludeTurn()
      return step.result
    },
  }))

  ctx.systemPrompt.section({
    name: 'tool:tasklist',
    order: config.promptOrder,
    interpolate: false,
    text: ({ scope }) => (ctx.tools.get('update_plan', scope) === undefined ? '' : SYSTEM_PROMPT_SECTION),
  })

  // Per agent: the turn and model step it is in, and the step of its last plan update.
  const progress = new WeakMap()

  ctx.on('agent/pre-step', (payload, next) => {
    let track = progress.get(payload.agent)
    if (!track || track.turn !== payload.turn) {
      track = { turn: payload.turn, step: payload.step, planStep: undefined, remindedStep: undefined }
      progress.set(payload.agent, track)
    }
    track.step = payload.step
    return next()
  })

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const downstream = await next()
    const track = exec.agent ? progress.get(exec.agent) : undefined
    if (!track) return downstream
    if (PLAN_TOOLS.has(exec.name)) {
      if (!result.isError) track.planStep = track.step
      return downstream
    }
    // A run_code sub-dispatch: the outer run_code result carries any note.
    if (exec.parent !== undefined) return downstream
    if (track.planStep === undefined || track.remindedStep === track.step) return downstream
    const since = track.step - track.planStep
    if (!isReminderPoint(since, config.remindAfterSteps)) return downstream
    const state = exec.agent.session ? ctx.sessionProjections.stateOf(exec.agent.session, PROJECTION_KEY) : undefined
    const note = state ? progressReminder(state, track.turn, since) : undefined
    if (!note) return downstream
    track.remindedStep = track.step
    return { ...downstream, additionalContexts: [reminderMessage(note), ...(downstream.additionalContexts ?? [])] }
  })

  if (config.hideBuiltinTodo) {
    ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembly = await next()
      if (!assembly.tools.some((tool) => tool.name === 'update_plan')) return assembly
      return { ...assembly, tools: assembly.tools.filter((tool) => tool.name !== 'todo_write') }
    })
  }
}

function readConfig(raw) {
  const config = { ...DEFAULTS }
  if (raw && typeof raw === 'object') {
    if (typeof raw.hideBuiltinTodo === 'boolean') config.hideBuiltinTodo = raw.hideBuiltinTodo
    if (Number.isFinite(raw.promptOrder)) config.promptOrder = raw.promptOrder
    if (Number.isInteger(raw.remindAfterSteps) && raw.remindAfterSteps >= 0) config.remindAfterSteps = raw.remindAfterSteps
  }
  return config
}

/** A logged context message, shaped like dsh's own createUserMessage output. */
function reminderMessage({ text, summary }) {
  return deepFreeze({
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: REMINDER_KIND, form: 'notice', summary },
    id: randomUUID(),
  })
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** Turn rule violations into ordinary tool errors the model can correct. */
function guard(fn) {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PlanError) throw new Error(error.message)
    throw error
  }
}
