// Which language the user-visible text (task-list steps, next-step box) must be in.
// The check runs only when a tool executes, never in replay: a call it rejects is a
// failed call, and replay skips failed calls, so older sessions keep their lists.

import { PlanError } from './plan.js'

/** Default: Simplified Chinese. `auto` (or an empty string) follows the user's language. */
export const DEFAULT_LANGUAGE = 'zh-CN'

const NAMES = {
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
}

const CHINESE = /[㐀-䶿一-鿿豈-﫿]/

/**
 * The language rule for a configured value, or undefined for "follow the user".
 * @param {string} language e.g. "zh-CN", "zh-TW", "English", "auto"
 * @returns {{ name: string, chinese: boolean } | undefined}
 */
export function languageRule(language) {
  const value = typeof language === 'string' ? language.trim() : ''
  if (!value || value.toLowerCase() === 'auto') return undefined
  const chinese = value.toLowerCase().startsWith('zh') || value.includes('中文')
  return { name: NAMES[value] ?? value, chinese }
}

export function hasChinese(/** @type {string} */ text) {
  return CHINESE.test(text)
}

/**
 * Reject user-visible text that is not in the required language. Only Chinese can
 * be checked mechanically: each text must contain at least one Chinese character
 * (code names, paths and numbers may sit beside it).
 * @param {{ name: string, chinese: boolean } | undefined} rule
 * @param {Array<[string, unknown]>} fields [label, text] pairs; non-strings are skipped
 */
export function checkLanguage(rule, fields) {
  if (!rule?.chinese) return
  const wrong = fields.filter(([, text]) => typeof text === 'string' && text.trim() && !hasChinese(text))
  if (wrong.length === 0) return
  const list = wrong.map(([label, text]) => `${label} "${String(text).trim()}"`).join(', ')
  throw new PlanError(
    `Write every user-visible text in ${rule.name}, whatever language the request or the code is in. ` +
      `Not in ${rule.name}: ${list}. Send the call again with them rewritten.`,
  )
}

/** The [label, text] pairs of an update_plan call that the user sees. */
export function planTexts(args) {
  return (Array.isArray(args?.items) ? args.items : []).map((item, i) => [`step ${i + 1}`, item?.content])
}

/** The [label, text] pairs of a wrap_up call that the user sees. */
export function wrapUpTexts(args) {
  const actions = Array.isArray(args?.actions) ? args.actions : []
  return [
    ['recap', args?.recap],
    ['ask', args?.ask],
    ...actions.flatMap((a, i) => [[`button ${i + 1} label`, a?.label], [`button ${i + 1} message`, a?.message]]),
  ]
}

/** The line added to the tool descriptions and the system-prompt section. */
export function languageInstruction(rule) {
  if (!rule) return ''
  return `Write the task-list steps and everything in the next-step box (recap, ask, button labels and messages) in ${rule.name}, whatever language the request, the code or your own reasoning is in.`
}
