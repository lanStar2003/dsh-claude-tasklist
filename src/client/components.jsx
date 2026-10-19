import { useState } from 'react'
import { ICON_PATHS, WAIT_RING } from './icons.js'

function Svg({ markup, className, box = 24 }) {
  return (
    <svg className={className} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
  )
}

/** The task list card: one row per step, icon + text. */
export function TaskListCard({ steps, t }) {
  if (steps.length === 0) return null
  return (
    <section className="dtl-card" aria-label={t('list.label')}>
      <ul className="dtl-steps">
        {steps.map((step, index) => (
          <li key={index} className="dtl-step" data-status={step.status}>
            <Svg markup={ICON_PATHS[step.status]} className="dtl-icon" />
            <span className="dtl-sr">{t(`status.${step.status}`)}: </span>
            <span className="dtl-step-text">{step.content}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Needs your input" status chip. */
export function WaitChip({ t }) {
  return (
    <div className="dtl-wait" role="status">
      <Svg markup={WAIT_RING} className="dtl-wait-ring" box={16} />
      <span className="dtl-wait-label">{t('wait.label')}</span>
    </div>
  )
}

/**
 * The next-step box. `reply` is the user's answer once given; `canReply` is false
 * while the agent runs or after a later turn has started.
 */
export function NextStepBox({ wrapUp, reply, canReply, onReply, t }) {
  const [sending, setSending] = useState(null)
  const [failed, setFailed] = useState(false)
  const answered = reply !== undefined
  const chosen = answered ? wrapUp.actions.findIndex((a) => a.message === reply || a.label === reply) : sending
  const disabled = answered || sending !== null || !canReply

  const click = async (index) => {
    setSending(index)
    setFailed(false)
    const ok = await onReply(wrapUp.actions[index].message)
    if (!ok) {
      setSending(null)
      setFailed(true)
    }
  }

  return (
    <section className="dtl-box" aria-label={t('box.label')}>
      <p className="dtl-recap">{wrapUp.recap}</p>
      {wrapUp.ask && (
        <div className="dtl-ask-row">
          <p className="dtl-ask">{wrapUp.ask}</p>
          <div className="dtl-actions">
            {wrapUp.actions.map((action, index) => (
              <button
                key={index}
                type="button"
                className={`dtl-btn ${index === 0 ? 'dtl-btn-primary' : 'dtl-btn-secondary'}`}
                disabled={disabled}
                data-chosen={chosen === index ? 'true' : undefined}
                onClick={() => click(index)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {failed && <p className="dtl-error" role="alert">{t('reply.failed')}</p>}
    </section>
  )
}
