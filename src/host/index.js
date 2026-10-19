// dsh host half: the `update_plan` and `wrap_up` tools, the `tasklist` session
// projection the web client renders, and the system-prompt guidance.

import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { appendPluginRecord, pluginRecordOf } from '@deepseek-ai/dsh-session'
import {
  PlanError,
  SCOPES,
  STATUSES,
  applyUpdatePlan,
  checkOffAll,
  describePlan,
  describeWrapUp,
  emptyPlan,
  normalizeWrapUp,
} from '../core/plan.js'
import {
  PLAN_RECORD,
  WRAP_UP_RECORD,
  entryForTurn,
  foldEvent,
  initialState,
  jsonRecord,
  latestOpenPlan,
  parseState,
} from '../core/state.js'
import { SYSTEM_PROMPT_SECTION, UPDATE_PLAN_DESCRIPTION, WRAP_UP_DESCRIPTION } from '../core/prompt.js'

export const name = 'tasklist'
export const inject = ['tools', 'sessionProjections', 'systemPrompt']

export const Config = Schema.object({
  hideBuiltinTodo: Schema.boolean()
    .default(true)
    .description('Hide dsh\'s own `todo_write` tool from the model so it keeps one list, not two.'),
  promptOrder: Schema.number()
    .default(2450)
    .description('Where the task-list guidance sits among system-prompt sections.'),
})

const PROJECTION_KEY = 'tasklist'
const STATE_VERSION = 1
const stateSchema = { parse: parseState }

const textResult = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }

export function apply(ctx, config) {
  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema,
    init: () => initialState(),
    apply: (state, event) => foldEvent(state, event, pluginRecordOf),
    wire: { viewSchema: stateSchema, view: (state) => state },
  })

  const sessionOf = (exec, tool) => {
    const session = exec.agent?.session
    if (!session) throw new Error(`${tool} needs an agent session.`)
    return session
  }
  const currentTurn = (session) => ctx.sessionProjections.stateOf(session, 'turnBoundary')?.lastTurn ?? 0
  const stateOf = (session) => ctx.sessionProjections.stateOf(session, PROJECTION_KEY) ?? initialState()

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
      const session = sessionOf(exec, 'update_plan')
      const turn = currentTurn(session)
      const state = stateOf(session)
      // Ops without items in a fresh turn continue the last unfinished list.
      const base = entryForTurn(state, turn) ?? (args.items === undefined ? latestOpenPlan(state, turn) : undefined)
      const prev = base ? { steps: base.steps, scope: base.scope } : emptyPlan()
      const next = guard(() => applyUpdatePlan(prev, args))
      appendPluginRecord(session, PLAN_RECORD, jsonRecord({ turn, callId: exec.callId, scope: next.scope, steps: next.steps }))
      return describePlan(next, args.items !== undefined)
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
      const session = sessionOf(exec, 'wrap_up')
      const turn = currentTurn(session)
      const box = guard(() => normalizeWrapUp(args))
      const entry = entryForTurn(stateOf(session), turn)
      const steps = entry && entry.steps.length > 0 ? checkOffAll(entry).steps : undefined
      appendPluginRecord(session, WRAP_UP_RECORD, jsonRecord({ turn, callId: exec.callId, ...box, steps }))
      // A box that asks something ends the turn right after this result.
      if (box.ask) exec.concludeTurn()
      return describeWrapUp(box)
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

/** Turn rule violations into ordinary tool errors the model can correct. */
function guard(fn) {
  try {
    return fn()
  } catch (error) {
    if (error instanceof PlanError) throw new Error(error.message)
    throw error
  }
}
