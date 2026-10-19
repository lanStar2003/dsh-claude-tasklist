// dsh web half: draws the task list and the next-step box.
// - While a turn runs, the list sits in the dock right above the composer, i.e.
//   directly under the latest message.
// - Once the turn ends, its final list, next-step box and waiting chip are drawn
//   at the end of that turn (conversation.chat.turnTail), and stay there.
// - The update_plan / wrap_up tool-call rows are hidden from the transcript.

import { useLayoutEffect, useRef } from 'react'
import css from './tasklist.css'
import { NextStepBox, TaskListCard, WaitChip } from './components.jsx'
import { NS, en, zh } from './locales.js'

const PLUGIN_ID = 'dsh-tasklist'
const PROJECTION_KEY = 'tasklist'
const HIDDEN_TOOLS = ['update_plan', 'wrap_up']

// Appended while the factory runs, so the host owns it and removes it on unload.
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.dataset.pluginCss = `${PLUGIN_ID}/tasklist.css`
  style.textContent = css
  document.head.appendChild(style)
}

export const inject = ['slots', 'locale', 'sessions']

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${PLUGIN_ID}: dictionaries`)

  const replyFace = (sessionId) => ({
    sendReply: async (text) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (!session) return false
      try {
        const submission = session.beginSubmission({ mode: 'queue', text, attachments: [] })
        const result = await session.prompt([{ type: 'text', text }], 'queue', undefined, submission.requestId)
        if (!result?.ok) submission.abandon?.()
        return result?.ok === true
      } catch {
        return false
      }
    },
  })

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: PLUGIN_ID, order: -10, locale: NS },
    LiveListDock,
  ))

  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
    { name: 'conversation.chat.turnTail', id: PLUGIN_ID, order: -10, locale: NS, inject: replyFace },
    TurnTail,
  ))

  ctx.slots.inject('tool.call.toolview', function* () {
    for (const key of HIDDEN_TOOLS) {
      yield ctx.slots.register({ name: 'tool.call.toolview', key }, HiddenToolRow)
    }
  })
}

/** The running turn's list, pinned above the composer. */
function LiveListDock({ useProjection, useSession, t }) {
  const state = useProjection(PROJECTION_KEY)
  const running = useSession((s) => s.running)
  if (!state || !running || state.currentTurn === null) return null
  const entry = state.turns.find((e) => e.turn === state.currentTurn)
  if (!entry || entry.steps.length === 0) return null
  return (
    <div className="dtl-root dtl-dock">
      <TaskListCard steps={entry.steps} t={t} />
    </div>
  )
}

/** A finished turn's final list, next-step box and waiting chip. */
function TurnTail({ turn, useProjection, useSession, sendReply, t }) {
  const state = useProjection(PROJECTION_KEY)
  const running = useSession((s) => s.running)
  if (!state) return null
  const entry = state.turns.find((e) => e.turn === turn.turn)
  if (!entry || (entry.steps.length === 0 && !entry.wrapUp)) return null
  const isLatest = state.currentTurn === turn.turn
  const waiting = entry.wrapUp?.blocked === true && entry.reply === undefined && isLatest && !running
  return (
    <div className="dtl-root dtl-tail">
      <TaskListCard steps={entry.steps} t={t} />
      {entry.wrapUp && (
        <NextStepBox
          wrapUp={entry.wrapUp}
          reply={entry.reply}
          canReply={isLatest && !running}
          onReply={sendReply}
          t={t}
        />
      )}
      {waiting && <WaitChip t={t} />}
    </div>
  )
}

/**
 * update_plan / wrap_up are bookkeeping: no row in the transcript. The marker lets
 * tasklist.css drop the row's flow item; watchGroup hides a "tools called" group
 * whose every item is such a row (CSS alone cannot: :has() does not nest).
 */
function HiddenToolRow() {
  const ref = useRef(null)
  useLayoutEffect(() => watchGroup(ref.current), [])
  return <span ref={ref} data-dtl-hidden-call="" hidden />
}

const GROUP = '[data-step-process]'
const ITEM = '[data-chat-flow-kind]'
const HIDDEN_GROUP_ATTR = 'data-dtl-hidden-group'
const watchedGroups = new WeakMap()

function refreshGroup(group) {
  const items = group.querySelectorAll(ITEM)
  const onlyHidden = items.length > 0 && Array.from(items).every((item) => item.querySelector('[data-dtl-hidden-call]'))
  group.toggleAttribute(HIDDEN_GROUP_ATTR, onlyHidden)
}

function watchGroup(node) {
  const group = node?.closest(GROUP)
  if (!group) return undefined
  let watch = watchedGroups.get(group)
  if (!watch) {
    const observer = new MutationObserver(() => refreshGroup(group))
    observer.observe(group, { childList: true, subtree: true })
    watch = { count: 0, observer }
    watchedGroups.set(group, watch)
  }
  watch.count++
  refreshGroup(group)
  return () => {
    watch.count--
    if (watch.count > 0) return
    watch.observer.disconnect()
    watchedGroups.delete(group)
    group.removeAttribute(HIDDEN_GROUP_ATTR)
  }
}
