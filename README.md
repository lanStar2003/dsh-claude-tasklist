# dsh-claude-tasklist：给 dsh 加上 Claude 风格的实时任务清单

这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）的插件，复刻 Claude Code 桌面版 Code 页的两个功能：

- **实时任务清单**：模型先列出完整计划，再开始干活，边做边推进。正在做的那一步在转圈，待办是虚线圆，做完的打勾；一轮停在半路时，没做完的那一步是带三个点的圆。
- **下一步框**：一轮结束时，模型写两三句总结。需要你拿主意时，框里还有一个问题和一两个按钮，点按钮就等于你回复了这句话。模型必须等你回答时，这一轮末尾会显示「需要您的输入」。

插件不带模型，用的是 dsh 会话里已经选好的模型。清单和下一步框一律用简体中文，不管你用什么语言提问、代码是什么语言；可以在设置里改。

## 安装

要求 dsh 0.2.0-rc.2 或之后的 0.2.x 版本（DSH Desktop 0.12.0 内置的就是 0.2.0-rc.2）。

插件以 tarball（tgz）的形式安装。每个版本的 tgz 都挂在 [Releases](https://github.com/lanStar2003/dsh-claude-tasklist/releases) 页上，直接填它的网址就能装，哪台电脑都一样，不用复制文件。当前版本的网址：

```text
https://github.com/lanStar2003/dsh-claude-tasklist/releases/download/v0.4.0/dsh-claude-tasklist-0.4.0.tgz
```

下载到本地的 tgz，或自己打包的 `dist/dsh-claude-tasklist-<版本>.tgz`，也能装：下面填网址的地方改填它的绝对路径。

**只装 tgz，不要装源码文件夹。** 填文件夹路径会走 `link:` 方式：DSH Desktop 自带的 pnpm 借 Electron 运行，跨盘建立的目录链接会损坏，而且坏链接在部分安全软件下删不掉，之后这个 profile 里的所有 pnpm 操作都会失败。tgz（网址或文件）是复制安装，没有这个问题。本地的 tgz 放在和 dsh 主目录同一个盘上最稳妥。

### 在 DSH Desktop 的界面里装

1. 打开「插件」页，点「添加插件」。
2. 粘贴上面的网址（或本地 tgz 的绝对路径，例如 `C:\Users\<你>\Downloads\dsh-claude-tasklist-0.4.0.tgz`），点「安装」，再点「立即启用」。
3. 完全退出 Desktop 再打开。

### 用命令行装（npm 安装的 dsh）

需要 `pnpm` 在 PATH 上（`dsh plugin` 靠它安装插件）。

```bash
dsh plugin --profile web add https://github.com/lanStar2003/dsh-claude-tasklist/releases/download/v0.4.0/dsh-claude-tasklist-0.4.0.tgz
```

装好后重启 dsh。

### 用 DSH Desktop 自带的 dsh 命令行装

DSH Desktop 的 dsh 主目录是 `%APPDATA%\dsh-desktop\harness`，profile 是 `web`，自带的 pnpm 在主目录的 `.desktop-bin` 里。在 PowerShell 里运行（`$app` 换成 Desktop 的安装目录）：

```powershell
$app = "D:\software\DSH Desktop"
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_HOME = "$env:APPDATA\dsh-desktop\harness"
$env:PATH = "$env:DSH_HOME\.desktop-bin;$env:PATH"
& "$app\DSH Desktop.exe" "$app\resources\app.asar\node_modules\@deepseek-ai\dsh\lib\bin.js" plugin --profile web add https://github.com/lanStar2003/dsh-claude-tasklist/releases/download/v0.4.0/dsh-claude-tasklist-0.4.0.tgz
```

一定要先设好 `DSH_HOME`，否则 dsh 会在 `~/.dsh` 另建一个空的主目录，插件装到那里去。装好后完全退出 Desktop 再打开。

### 升级和卸载

没有自动更新。升级时先卸载旧版，再按上面的方法装新版：在 Releases 页复制新版 tgz 的网址（网址里的两处版本号都是新版的）。卸载可以在「插件」页里点，也可以用命令行：

```bash
dsh plugin --profile web remove dsh-claude-tasklist
```

### 发布新版本

改完代码后，先把 `package.json` 里的 `version` 加一，运行 `npm run build`，连同构建出来的 `lib/client.js` 一起提交到 main，再推一个同版本号、带 `v` 的标签，例如：

```bash
git push origin main && git tag v0.4.1 && git push origin v0.4.1
```

GitHub Actions 的 Release 工作流（`.github/workflows/release.yml`）会运行 `npm ci`、`npm test`、`npm run build`、`npm pack`，把 `dsh-claude-tasklist-<版本>.tgz` 挂到这个标签的 Release 上，网址就是上面那种格式。标签和 `version` 对不上，或者提交的 `lib/client.js` 不是最新的构建结果，工作流会失败、不发布。

只在本地打包、不发布时，在本目录运行：

```bash
npm install && npm run build && npm test && mkdir -p dist && npm pack --pack-destination dist
```

`npm pack` 不会自动构建，所以 `npm run build` 不能省：网页端代码 `lib/client.js` 是构建出来的，而且随源码一起提交，因为 `dsh plugin add` 装插件时从不构建。

## 用起来是什么样

给模型一个要改文件或跑命令的任务。它的第一个动作是单独发出完整计划，你会先在输入框正上方看到清单，然后它才开始执行。清单随工作实时推进，正在做的那一步在转圈：

```
◠ 读取 README 现状
◌ 改写安装步骤
◌ 检查所有链接
```

模型有时埋头干活、忘了推进清单。某一步连续 3 个模型步骤都没更新时，插件会在工具结果后面给模型一条简短提醒，让它把做完的步骤勾掉。提醒只有模型看得到，对话记录里不显示。

清单的每一步、下一步框的总结、问题和按钮都必须是简体中文。模型交上来的文字里一个汉字都没有时（比如 `Fix typos`），这次调用会被退回，模型改成中文重发，所以界面上不会出现英文清单。代码名、路径可以夹在中文里，例如「运行 npm test」。新开的会话里，模型从一开始就会被告知用中文；更新插件前就开着的会话，靠这个退回机制保证。

这一轮结束后，最终清单和下一步框留在这一轮的末尾，翻聊天记录时还在原处。刷新页面、重启 dsh 都会原样恢复。

`update_plan` 和 `wrap_up` 是记账用的工具调用，不出现在对话记录里，和原版一样。

## 和原版的差别

| 地方 | 原版 | 本插件 | 原因 |
|---|---|---|---|
| 进行中时清单的位置 | 最新一条消息正下方 | 输入框正上方（滚到底时就是最新消息正下方） | dsh 的对话流在本轮结束前没有「最新消息之后」的挂载点；输入框上方的停靠区是 dsh 自带 todo 清单用的位置 |
| 字体 | Claude 自己的字体 | 跟随 dsh 的字体 | Claude 的字体是 Anthropic 专有的，不能随插件分发 |
| 下一步框的应用按钮 | 有提交、开 PR、合并等按钮 | 只有回复按钮 | 那些是 Claude 桌面版自己的功能，dsh 没有对应能力 |
| 下一步框的外观 | — | 按清单卡片和同屏按钮的测量值设计 | 目前没有原版下一步框的截图，拿到后再对齐 |
| 发出计划的时机 | 计划和第一个工具调用一起发出 | 计划单独先发，下一条消息才开始执行 | 让清单先于任何执行出现；dsh 会先显示正在生成的工具调用，一起发出时看起来像边执行边列清单 |
| 推进提醒 | 没有 | 某一步连续 3 个模型步骤没推进时提醒模型 | DeepSeek 模型常常做完了才一次性勾掉，清单就一直停在第一步 |
| 清单的语言 | 跟随用户的语言 | 默认一律简体中文，不是中文的会被退回 | 按使用者要求；可用 `language` 设置改 |

和 [dsh-claude-style](https://github.com/Nwflower/dsh-claude-style) 主题一起用时，页面底色、字体（Inter）都跟随主题，清单与原版更接近。

## 状态怎么保存

插件不往会话日志里写自定义事件。清单和下一步框由会话里已经持久化的 `update_plan` / `wrap_up` 调用回放得出（包括 PTC 模式下在 `run_code` 里发起的调用），回放和工具执行共用同一套纯函数，所以刷新、重启、换版本都能原样恢复。这也让插件能跑在还没有“插件记录”接口的 dsh 0.2.0 上。

唯一额外写进日志的是推进提醒：一条普通的上下文消息，来源标为 `tasklist`。dsh 0.2.0 不在对话里显示这类消息；以后的版本如果显示，网页端会把它藏起来。

尺寸、颜色、图标、行距都是从原版截图逐像素量出来的，详见 [docs/SPEC.md](docs/SPEC.md)。

## 设置

在 profile 的 `cordis.patch.yml` 里覆盖（整段 `config` 会被替换，所以要写全）：

```yaml
- id: dsh-claude-tasklist
  name: dsh-claude-tasklist
  config:
    hideBuiltinTodo: true   # 对模型隐藏 dsh 自带的 todo_write，避免两份清单
    promptOrder: 2450       # 使用说明在系统提示词里的位置
    remindAfterSteps: 3     # 某一步连续这么多个模型步骤没推进时提醒模型；0 表示不提醒
    language: zh-CN         # 清单和下一步框的语言：zh-CN、zh-TW、其他语言名（如 English），或 auto 跟随用户
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
| `src/core/reminder.js` | 推进提醒：什么时候提醒、提醒说什么 |
| `src/core/language.js` | 清单语言：给模型的要求，以及退回非中文内容的检查 |
| `src/host/index.js` | dsh 后端：注册两个工具、投影、系统提示词、推进提醒 |
| `src/client/` | dsh 网页端：清单卡片、下一步框、状态标签、样式 |
| `dev/mock-llm.mjs` | 本地模拟模型，按脚本调用两个工具，不需要 API key |
| `docs/SPEC.md` | 从原版测量出的行为与外观规格 |
| `reference/` | 原版截图 |

不用 API key 的端到端测试：先运行 `node dev/mock-llm.mjs`，再把 `DEEPSEEK_BASE_URL=http://127.0.0.1:8765` 和任意 `DEEPSEEK_API_KEY` 设给 dsh。然后在对话里发「演示」「慢推进」「改计划」「乱序」「故意传错误参数」，可以分别看到对应的场景；「慢推进」会在第 3 次工具调用后触发推进提醒，「故意传错误参数」里有一份英文计划会被退回。
