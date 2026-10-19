// Scripted Anthropic-Messages SSE server standing in for the session model, so the
// plugin can be exercised end to end without an API key.
//   node dev/mock-llm.mjs [port]      (default 8765)
// Point dsh at it with DEEPSEEK_BASE_URL=http://127.0.0.1:8765 and any DEEPSEEK_API_KEY.
// The scenario is picked from the latest user prompt; the step inside the scenario is
// the number of assistant messages already sent after that prompt.

import http from 'node:http'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.argv[2] ?? 8765)
const stepDelayMs = Number(process.env.MOCK_STEP_DELAY_MS ?? 1200)
const logFile = join(dirname(fileURLToPath(import.meta.url)), '.mock-log.jsonl')
mkdirSync(dirname(logFile), { recursive: true })

const plan = (items, scope = 'first_task') => ({ tool: 'update_plan', input: { items, scope } })
const advance = { tool: 'update_plan', input: { advance: true } }
const steps = (...rows) => rows.map(([status, content]) => ({ content, status }))

// Each scenario is a list of model responses: { text?, tool?, input? }.
const SCENARIOS = [
  {
    match: /演示|demo/i,
    script: [
      { text: '好的，我先列一下计划。', ...plan(steps(
        ['in_progress', '读取 README 现状'],
        ['pending', '改写安装步骤'],
        ['pending', '检查所有链接'],
        ['pending', '运行文档构建'],
      )) },
      advance,
      advance,
      advance,
      { tool: 'wrap_up', input: {
        recap: '安装步骤已改成中文，12 个链接都能打开，文档构建通过。改动还没有提交。',
        ask: '现在提交这些改动吗？',
        actions: [
          { label: '提交', message: '提交这些改动。' },
          { label: '先不提交', message: '先不提交，我自己看一遍。' },
        ],
        blocked: true,
      } },
      { text: '（不应出现：带问题的下一步框会结束本轮）' },
    ],
  },
  {
    match: /提交这些改动/,
    script: [
      plan(steps(['in_progress', '暂存改动'], ['pending', '写提交说明并提交']), 'continuation'),
      advance,
      { tool: 'wrap_up', input: { recap: '改动已提交到 main，提交号 3f9c2e1。还没有推送到远端。' } },
      { text: '已经提交好了。需要推送时告诉我。' },
    ],
  },
  {
    match: /先不提交/,
    script: [{ text: '好的，改动留在工作区，你看完再说。' }],
  },
  {
    match: /改计划|replan/i,
    script: [
      plan(steps(['in_progress', '查看配置'], ['pending', '修改端口'], ['pending', '重启服务'])),
      { text: '端口是从环境变量读的，计划要调整。', ...plan(steps(
        ['completed', '查看配置'],
        ['in_progress', '改环境变量文件'],
        ['pending', '重启服务'],
      ), 'continuation') },
      advance,
      { tool: 'wrap_up', input: { recap: '端口改成从 .env 读取并已重启，服务在 8080 上正常响应。' } },
      { text: '改好了，服务已经在新端口上跑起来。' },
    ],
  },
  {
    // Works through step 1 for three model steps without moving the list, so the
    // host's "keep the list moving" note arrives with the third tool result.
    match: /慢推进|slow/i,
    script: [
      { text: '先列计划。', ...plan(steps(
        ['in_progress', '找出所有文档'],
        ['pending', '整理目录结构'],
        ['pending', '汇总结果'],
      )) },
      { tool: 'glob', input: { pattern: '*.md' } },
      { tool: 'glob', input: { pattern: '*.json' } },
      { tool: 'glob', input: { pattern: 'docs/**' } },
      advance,
      advance,
      { tool: 'wrap_up', input: { recap: '找到 3 份文档，目录结构已整理。' } },
      { text: '整理完了。' },
    ],
  },
  {
    match: /乱序|out of order/i,
    script: [
      plan(steps(['in_progress', '第一步'], ['pending', '第二步'], ['pending', '第三步'], ['pending', '第四步'])),
      { tool: 'update_plan', input: { done: [1, 2], start: 4 } },
      { tool: 'update_plan', input: { done: [4], start: 3 } },
      { tool: 'wrap_up', input: { recap: '四步都做完了。' } },
      { text: '完成。' },
    ],
  },
  {
    match: /错误|invalid/i,
    script: [
      { tool: 'update_plan', input: { advance: true } },
      plan(steps(['in_progress', 'Read the config'], ['pending', '改端口'])),
      plan(steps(['in_progress', '纠正后的计划'])),
      { tool: 'wrap_up', input: { recap: '字'.repeat(301) } },
      { tool: 'wrap_up', input: { recap: '纠正后完成。' } },
      { text: '好了。' },
    ],
  },
]
const CHAT = { script: [{ text: '你好！有什么要我做的吗？' }] }

const sse = (res, payload) => res.write(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// dsh folds the previous turn's last tool_result and the next prompt into one user
// message, so a prompt is any user message carrying a text block that is not one of
// the plugin's reminder notes.
const REMINDER = 'Task list check:'
const isPromptText = (b) => b.type === 'text' && b.text.trim() && !b.text.includes(REMINDER)
const blocksOf = (m) => (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content)

function promptAndStep(messages) {
  let promptIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (blocksOf(m).some(isPromptText)) { promptIndex = i; break }
  }
  if (promptIndex < 0) return { prompt: '', step: 0 }
  const m = messages[promptIndex]
  const prompt = typeof m.content === 'string'
    ? m.content
    : m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
  const step = messages.slice(promptIndex + 1).filter((x) => x.role === 'assistant').length
  return { prompt, step }
}

let messageCounter = 0
async function respond(res, response) {
  const id = `mock-${++messageCounter}`
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
  res.flushHeaders()
  sse(res, { type: 'message_start', message: { id, type: 'message', role: 'assistant', model: 'mock-model', content: [], usage: { input_tokens: 3, output_tokens: 0 } } })
  let index = 0
  if (response.text) {
    sse(res, { type: 'content_block_start', index, content_block: { type: 'text', text: '' } })
    for (const chunk of Array.from(response.text)) {
      sse(res, { type: 'content_block_delta', index, delta: { type: 'text_delta', text: chunk } })
      await sleep(15)
    }
    sse(res, { type: 'content_block_stop', index })
    index++
  }
  if (response.tool) {
    const args = JSON.stringify(response.input ?? {})
    const mid = Math.max(1, Math.floor(args.length / 2))
    sse(res, { type: 'content_block_start', index, content_block: { type: 'tool_use', id: `toolu_${id}`, name: response.tool, input: {} } })
    sse(res, { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: args.slice(0, mid) } })
    sse(res, { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: args.slice(mid) } })
    sse(res, { type: 'content_block_stop', index })
  }
  sse(res, { type: 'message_delta', delta: { stop_reason: response.tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } })
  sse(res, { type: 'message_stop' })
  res.end()
}

http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.split('?')[0].endsWith('/messages')) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":{"message":"not found"}}')
    return
  }
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', async () => {
    let request
    try { request = JSON.parse(body) } catch { res.writeHead(400).end(); return }
    const tools = (request.tools ?? []).map((t) => t.name)
    const system = typeof request.system === 'string'
      ? request.system
      : (request.system ?? []).map((b) => b.text ?? '').join('\n')
    const { prompt, step } = promptAndStep(request.messages ?? [])
    const scenario = tools.length === 0 ? null : (SCENARIOS.find((s) => s.match.test(prompt)) ?? CHAT)
    const response = scenario === null
      ? { text: '模拟会话' }
      : (scenario.script[step] ?? { text: '（脚本已结束）' })
    appendFileSync(logFile, JSON.stringify({
      time: new Date().toISOString(),
      prompt: prompt.slice(0, 80),
      step,
      tools,
      hasTodoWrite: tools.includes('todo_write'),
      hasUpdatePlan: tools.includes('update_plan'),
      systemHasGuidance: system.includes('# Task list and wrap-up'),
      systemHasLanguage: system.includes('Simplified Chinese (简体中文)'),
      reminders: (request.messages ?? []).filter((m) => m.role === 'user')
        .flatMap(blocksOf).filter((b) => b.type === 'text' && b.text.includes(REMINDER)).length,
      lastToolResult: lastToolResultText(request.messages ?? []),
      shape: (request.messages ?? []).slice(-3).map((m) =>
        `${m.role}:${typeof m.content === 'string' ? 'text' : m.content.map((b) => b.type).join('+')}`),
      reply: response.tool ?? 'text',
    }) + '\n')
    if (scenario !== null) await sleep(stepDelayMs)
    await respond(res, response)
  })
}).listen(port, '127.0.0.1', () => {
  console.log(`mock-llm listening on http://127.0.0.1:${port}`)
})

function lastToolResultText(messages) {
  const last = messages.at(-1)
  if (!last || last.role !== 'user' || typeof last.content === 'string') return undefined
  const result = last.content.find((b) => b.type === 'tool_result')
  if (!result) return undefined
  const content = typeof result.content === 'string'
    ? result.content
    : (result.content ?? []).map((b) => b.text ?? '').join('')
  return content.slice(0, 200)
}
