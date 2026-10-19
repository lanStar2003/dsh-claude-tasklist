import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBookkeepingProgram } from '../src/core/bookkeeping.js'
import { MAX_QUIET, foldEvent, initialState, parseState } from '../src/core/state.js'

// The plan program DeepSeek wrote in a real PTC session.
const PLAN_ONLY = `await tools.update_plan({
  items: [
    { content: "在工作区查找 zl 相关项目", status: "in_progress" },
    { content: "定位质量标准比对模块与文档", status: "pending" },
  ],
  scope: "first_task",
});`

test('a program that only updates the list or the box is bookkeeping', () => {
  assert.equal(isBookkeepingProgram(PLAN_ONLY), true)
  assert.equal(isBookkeepingProgram('await tools.update_plan({ advance: true })'), true)
  assert.equal(isBookkeepingProgram("const r = await tools.wrap_up({ recap: '改好了（含 \\'引号\\' 和 ) 括号）。' });\n"), true)
  assert.equal(isBookkeepingProgram('// 列计划\nawait tools.update_plan({ items: [] }); /* 再推进 */ await tools.update_plan({ advance: true });'), true)
})

test('any other work keeps the row', () => {
  assert.equal(isBookkeepingProgram("await tools.update_plan({ advance: true });\nconst r = await tools.glob({ pattern: 'docs/**' });"), false)
  assert.equal(isBookkeepingProgram("await tools.update_plan({ advance: true });\nconsole.log('done');"), false)
  assert.equal(isBookkeepingProgram("const fs = await import('node:fs');\nawait tools.update_plan({ advance: true });"), false)
  assert.equal(isBookkeepingProgram('const x = 1 + 2; await tools.update_plan({ advance: true })'), false)
  assert.equal(isBookkeepingProgram("const r = await tools.glob({ pattern: '*' })"), false)
  assert.equal(isBookkeepingProgram(''), false)
  assert.equal(isBookkeepingProgram(undefined), false)
  assert.equal(isBookkeepingProgram('await tools.update_plan({ items: ['), false)
})

const runCode = (callId, code) => ({
  type: 'tool/call',
  data: { turn: 1, step: 1, callId, name: 'run_code', arguments: JSON.stringify({ code, description: 'x' }) },
})

test('the projection lists bookkeeping run_code calls only', () => {
  let s = foldEvent(initialState(), runCode('a', PLAN_ONLY))
  s = foldEvent(s, runCode('b', "await tools.glob({ pattern: '*' })"))
  s = foldEvent(s, runCode('a', PLAN_ONLY))
  assert.deepEqual(s.quiet, ['a'])
  assert.doesNotThrow(() => parseState(s))
})

test('the quiet list keeps only the latest calls', () => {
  let s = initialState()
  for (let i = 0; i < MAX_QUIET + 5; i++) s = foldEvent(s, runCode(`c${i}`, PLAN_ONLY))
  assert.equal(s.quiet.length, MAX_QUIET)
  assert.equal(s.quiet[0], 'c5')
})

test('state cached before quiet existed still parses', () => {
  const { quiet: _gone, ...old } = initialState()
  assert.doesNotThrow(() => parseState(old))
  assert.throws(() => parseState({ ...initialState(), quiet: [1] }), /quiet/)
})
