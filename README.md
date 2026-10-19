# dsh-tasklist：给 dsh 加上 Claude 风格的实时任务清单

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的插件，复刻 Claude Code 桌面版 Code 页的两个功能：

- **实时任务清单**：模型开始干活时列出计划，边做边推进。进行中的步骤是带三个点的圆，待办是虚线圆，做完的打勾。
- **下一步框**：一轮结束时，模型写两三句总结。需要你拿主意时，框里还有一个问题和一两个按钮，点按钮就等于你回复了这句话。模型必须等你回答时，这一轮末尾会显示「需要您的输入」。

插件不带模型，用的是 dsh 会话里已经选好的模型。

## 安装

要求：

- dsh 0.2.1-rc.2 或之后的 0.2.x 版本
- `pnpm` 在 PATH 上（`dsh plugin` 靠它安装插件）

把整个 `dsh-tasklist` 文件夹放到运行 dsh 的那台电脑上，然后执行（路径换成你放的位置）：

```bash
dsh plugin --profile web add D:/Code/dsh-tasklist
```

装好后重启 dsh。网页端代码 `lib/client.js` 已经构建好，目标电脑上不需要再构建。卸载：

```bash
dsh plugin --profile web remove dsh-tasklist
```

如果平时启动的不是 `web` 这个 profile，把 `--profile web` 换成你用的那个。

## 用起来是什么样

给模型一个要改文件或跑命令的任务。它的第一个动作会带上计划，你会在输入框正上方看到清单，随工作实时推进：

```
⊙ 读取 README 现状
◌ 改写安装步骤
◌ 检查所有链接
```

这一轮结束后，最终清单和下一步框留在这一轮的末尾，翻聊天记录时还在原处。刷新页面、重启 dsh 都会原样恢复。

`update_plan` 和 `wrap_up` 是记账用的工具调用，不出现在对话记录里，和原版一样。

## 和原版的差别

| 地方 | 原版 | 本插件 | 原因 |
|---|---|---|---|
| 进行中时清单的位置 | 最新一条消息正下方 | 输入框正上方（滚到底时就是最新消息正下方） | dsh 的对话流在本轮结束前没有「最新消息之后」的挂载点；输入框上方的停靠区是 dsh 自带 todo 清单用的位置 |
| 字体 | Claude 自己的字体 | 跟随 dsh 的字体 | Claude 的字体是 Anthropic 专有的，不能随插件分发 |
| 下一步框的应用按钮 | 有提交、开 PR、合并等按钮 | 只有回复按钮 | 那些是 Claude 桌面版自己的功能，dsh 没有对应能力 |
| 下一步框的外观 | — | 按清单卡片和同屏按钮的测量值设计 | 目前没有原版下一步框的截图，拿到后再对齐 |

尺寸、颜色、图标、行距都是从原版截图逐像素量出来的，详见 [docs/SPEC.md](docs/SPEC.md)。

## 设置

在 profile 的 `cordis.patch.yml` 里覆盖（整段 `config` 会被替换，所以要写全）：

```yaml
- id: dsh-tasklist
  name: dsh-tasklist
  config:
    hideBuiltinTodo: true   # 对模型隐藏 dsh 自带的 todo_write，避免两份清单
    promptOrder: 2450       # 使用说明在系统提示词里的位置
```

插件还给 dsh 自带的「连续重复调用提醒」加了排除项，让连续几次推进清单不会被当成重复调用。

## 开发

```bash
npm install          # 只为构建网页端代码（esbuild）
npm run build        # 生成 lib/client.js
npm test             # 状态推进与折叠逻辑的单元测试
```

| 路径 | 内容 |
|---|---|
| `src/core/plan.js` | 清单与下一步框的推进规则（纯函数） |
| `src/core/state.js` | 会话投影：按轮记录清单和下一步框，识别用户的回答 |
| `src/core/prompt.js` | 给模型看的工具说明和系统提示词 |
| `src/host/index.js` | dsh 后端：注册两个工具、投影、系统提示词 |
| `src/client/` | dsh 网页端：清单卡片、下一步框、状态标签、样式 |
| `dev/mock-llm.mjs` | 本地模拟模型，按脚本调用两个工具，不需要 API key |
| `docs/SPEC.md` | 从原版测量出的行为与外观规格 |
| `reference/` | 原版截图 |

不用 API key 的端到端测试：先运行 `node dev/mock-llm.mjs`，再把 `DEEPSEEK_BASE_URL=http://127.0.0.1:8765` 和任意 `DEEPSEEK_API_KEY` 设给 dsh。然后在对话里发「演示」「改计划」「乱序」「故意传错误参数」，可以分别看到对应的场景。
