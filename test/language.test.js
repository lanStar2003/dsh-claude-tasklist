import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlanError } from '../src/core/plan.js'
import {
  DEFAULT_LANGUAGE,
  checkLanguage,
  hasChinese,
  languageInstruction,
  languageRule,
  planTexts,
  wrapUpTexts,
} from '../src/core/language.js'

test('the default asks for Simplified Chinese; auto and empty follow the user', () => {
  assert.deepEqual(languageRule(DEFAULT_LANGUAGE), { name: 'Simplified Chinese (简体中文)', chinese: true })
  assert.equal(languageRule('zh-TW').chinese, true)
  assert.deepEqual(languageRule('English'), { name: 'English', chinese: false })
  assert.equal(languageRule('auto'), undefined)
  assert.equal(languageRule(''), undefined)
  assert.equal(languageInstruction(undefined), '')
  assert.match(languageInstruction(languageRule('zh-CN')), /in Simplified Chinese \(简体中文\)/)
})

test('a text passes when it holds at least one Chinese character', () => {
  assert.equal(hasChinese('运行 npm test'), true)
  assert.equal(hasChinese('Run npm test'), false)
})

test('English steps are rejected with the offending ones named', () => {
  const rule = languageRule('zh-CN')
  const args = { items: [{ content: '读取 README', status: 'in_progress' }, { content: 'Fix typos', status: 'pending' }] }
  assert.throws(() => checkLanguage(rule, planTexts(args)), (error) => {
    assert.ok(error instanceof PlanError)
    assert.match(error.message, /step 2 "Fix typos"/)
    assert.doesNotMatch(error.message, /step 1/)
    return true
  })
  assert.doesNotThrow(() => checkLanguage(rule, planTexts({ items: [{ content: '修正错别字', status: 'pending' }] })))
  // advance / done / start carry no text
  assert.doesNotThrow(() => checkLanguage(rule, planTexts({ advance: true })))
})

test('the whole next-step box is checked, omitted fields are skipped', () => {
  const rule = languageRule('zh-CN')
  assert.throws(
    () => checkLanguage(rule, wrapUpTexts({ recap: '已完成。', ask: '提交吗？', actions: [{ label: 'Commit' }] })),
    /button 1 label "Commit"/,
  )
  assert.doesNotThrow(() => checkLanguage(rule, wrapUpTexts({ recap: '改好了。' })))
})

test('non-Chinese languages and auto are not checked mechanically', () => {
  const args = { items: [{ content: 'Fix typos', status: 'pending' }] }
  assert.doesNotThrow(() => checkLanguage(languageRule('English'), planTexts(args)))
  assert.doesNotThrow(() => checkLanguage(undefined, planTexts(args)))
})
