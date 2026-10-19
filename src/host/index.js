// dsh host half: the `update_plan` and `wrap_up` tools, the `tasklist` session
// projection the web client renders, and the system-prompt guidance.
//
// The tools write nothing of their own to the session log: the projection replays
// their successful calls from the durable tool events (see core/state.js), so the
// list survives reloads on every dsh 0.2.x, including builds without plugin records.

import { defineTool } from '@deepseek-ai/dsh-tools'
import { PlanError, SCOPES, STATUSES } from '../core/plan.js'
import { initialState, foldEvent, parseState, updatePlanStep, wrapUpStep } from '../core/state.js'
import { SYSTEM_PROMPT_SECTION, UPDATE_PLAN_DESCRIPTION, WRAP_UP_DESCRIPTION } from '../core/prompt.js'

export const name = 'tasklist'
export const inject = ['tools', 'sessionProjections', 'systemPrompt']

const DEFAULTS = {
  /** Hide dsh's own `todo_write` tool from the model so it keeps one list, not two. */
  hideBuiltinTodo: true,
  /** Where the task-list guidance sits among system-prompt sections. */
  promptOrder: 2450,
}

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
  }
  return config
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
