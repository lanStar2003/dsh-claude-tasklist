// Code mode (the PTC agent preset): the model reaches update_plan / wrap_up through a
// run_code program. A program that does nothing but call them is bookkeeping, like a
// direct update_plan call, so the web client hides its row. Anything else in the
// program (another tool, a string, an import, any expression) keeps the row visible.

const CALL = /tools\s*\.\s*(?:update_plan|wrap_up)\s*\(/y

/**
 * Whether a run_code program only calls tools.update_plan / tools.wrap_up.
 * @param {unknown} code the program text
 */
export function isBookkeepingProgram(code) {
  if (typeof code !== 'string') return false
  let rest = ''
  let calls = 0
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      i = end < 0 ? code.length : end
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) return false
      i = end + 2
      continue
    }
    CALL.lastIndex = i
    if (CALL.test(code)) {
      const close = matchingParen(code, CALL.lastIndex - 1)
      if (close < 0) return false
      calls++
      rest += ' '
      i = close + 1
      continue
    }
    rest += c
    i++
  }
  if (calls === 0) return false
  const leftover = rest
    .replace(/\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/g, ' ')
    .replace(/\b(?:await|return)\b/g, ' ')
    .replace(/[\s;]/g, '')
  return leftover === ''
}

/** Index of the `)` closing the `(` at `open`, skipping strings and comments; -1 if none. */
function matchingParen(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    const c = code[i]
    if (c === '"' || c === "'" || c === '`') {
      i = stringEnd(code, i)
      if (i < 0) return -1
      continue
    }
    if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      if (end < 0) return -1
      i = end
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) return -1
      i = end + 1
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return c === ')' ? i : -1
    }
  }
  return -1
}

/** Index of the quote closing the string opened at `start`; -1 if unterminated. */
function stringEnd(code, start) {
  const quote = code[start]
  for (let i = start + 1; i < code.length; i++) {
    if (code[i] === '\\') i++
    else if (code[i] === quote) return i
  }
  return -1
}
