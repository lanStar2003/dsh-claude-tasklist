window.__ModuleLoader__.load({ id: "dsh-tasklist", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");

// src/client/tasklist.css
var tasklist_default = `/*
 * Task list + next-step box, measured from Claude Code desktop (light theme, DPR 1.5).
 * See docs/SPEC.md \xA72 for the measurements behind each value.
 */
.dtl-root {
  --dtl-fg: #0b0b0b;
  --dtl-fg-muted: #898781;
  --dtl-border: #e3e3e2;
  /* Claude's card is see-through on its page; here it matches dsh's page so the
     docked copy can float over the transcript without showing text through. */
  --dtl-surface: var(--dsw-alias-bg-base, #fcfcfb);
  --dtl-btn-bg: #0b0b0b;
  --dtl-btn-fg: #ffffff;
  --dtl-btn2-bg: #fcfcfb;
  --dtl-btn2-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
  --dtl-wait-ring: #f0ac55;
  --dtl-wait-bg: #f9dca4;
  --dtl-wait-fg: #734500;
  --dtl-radius: 9px;
  --dtl-btn-radius: 5px;
  --dtl-font-size: 14px;
  --dtl-row-height: 26px;
  --dtl-icon: 14px;

  color: var(--dtl-fg);
  font-size: var(--dtl-font-size);
  -webkit-font-smoothing: antialiased;
}

body[data-ds-dark-theme] .dtl-root,
.dtl-root.dtl-dark {
  --dtl-fg: #ececea;
  --dtl-fg-muted: #8f8d87;
  --dtl-border: #3a3a38;
  --dtl-btn-bg: #ececea;
  --dtl-btn-fg: #121212;
  --dtl-btn2-bg: transparent;
  --dtl-btn2-shadow: none;
  --dtl-wait-ring: #e39b45;
  --dtl-wait-bg: #4a3517;
  --dtl-wait-fg: #f5c77e;
}

/* ---------- hidden bookkeeping calls ---------- */

/* The flow item that holds an update_plan / wrap_up row (see HiddenToolRow). */
[data-chat-flow-kind]:has([data-dtl-hidden-call]) {
  display: none !important;
}

/* A "tools called" group whose every item is such a row (marked by index.jsx). */
[data-step-process][data-dtl-hidden-group] {
  display: none !important;
}

/* ---------- placement ---------- */

/* Same width as dsh's own dock strips (see ui-conversation TodoPanel). */
.dtl-dock {
  box-sizing: border-box;
  flex: none;
  margin: 0 auto;
  width: calc(100% - 2 * var(--dsh-composer-side-clearance, 0px) - 4 * var(--dsh-composer-dock-inset, 0px));
  max-width: calc(var(--dsh-composer-card-max-width, 100%) - 4 * var(--dsh-composer-dock-inset, 0px));
}

.dtl-dock .dtl-card {
  margin: 0;
}

.dtl-tail > :first-child {
  margin-top: 0;
}

.dtl-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---------- task list card ---------- */

.dtl-card {
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 0;
  padding: 12px 16px;
  border: 1px solid var(--dtl-border);
  border-radius: var(--dtl-radius);
  background: var(--dtl-surface);
}

.dtl-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dtl-step {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: var(--dtl-row-height);
  line-height: var(--dtl-row-height);
}

.dtl-step-text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.dtl-icon {
  flex: none;
  width: var(--dtl-icon);
  height: var(--dtl-icon);
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dtl-step[data-status='pending'] .dtl-icon {
  color: var(--dtl-fg-muted);
}

/* ---------- waiting-for-input chip ---------- */

.dtl-wait {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 12px 0 0 6px;
}

.dtl-wait-ring {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--dtl-wait-ring);
}

.dtl-wait-label {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--dtl-wait-bg);
  color: var(--dtl-wait-fg);
  font-size: 12px;
  line-height: 18px;
}

/* ---------- next-step box ---------- */

.dtl-box {
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 0;
  padding: 12px 16px;
  border: 1px solid var(--dtl-border);
  border-radius: var(--dtl-radius);
  background: var(--dtl-surface);
  line-height: 22px;
}

.dtl-recap {
  margin: 0;
  overflow-wrap: anywhere;
}

.dtl-ask-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--dtl-border);
}

.dtl-ask {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dtl-actions {
  display: flex;
  flex: none;
  gap: 8px;
  margin-left: auto;
}

.dtl-btn {
  display: inline-flex;
  align-items: center;
  height: 23px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: var(--dtl-btn-radius);
  font: inherit;
  font-size: 13px;
  line-height: 21px;
  cursor: pointer;
  white-space: nowrap;
}

.dtl-btn-primary {
  background: var(--dtl-btn-bg);
  color: var(--dtl-btn-fg);
}

.dtl-btn-secondary {
  border-color: var(--dtl-border);
  background: var(--dtl-btn2-bg);
  box-shadow: var(--dtl-btn2-shadow);
  color: var(--dtl-fg);
}

.dtl-btn:hover:not(:disabled) {
  filter: brightness(0.92);
}

body[data-ds-dark-theme] .dtl-btn:hover:not(:disabled),
.dtl-dark .dtl-btn:hover:not(:disabled) {
  filter: brightness(1.12);
}

.dtl-btn:focus-visible {
  outline: 2px solid var(--dtl-wait-ring);
  outline-offset: 1px;
}

.dtl-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.dtl-btn[data-chosen='true'] {
  opacity: 1;
}

.dtl-error {
  margin: 8px 0 0;
  color: #b3261e;
  font-size: 12px;
}

@media (prefers-reduced-motion: no-preference) {
  .dtl-card,
  .dtl-box {
    animation: dtl-in 160ms ease-out;
  }
}

@keyframes dtl-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
}
`;

// src/client/components.jsx
var import_react = require("react");

// src/client/icons.js
var ICON_PATHS = {
  in_progress: '<circle cx="12" cy="12" r="10"/><path d="M17 12h.01"/><path d="M12 12h.01"/><path d="M7 12h.01"/>',
  pending: '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  completed: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
};
var WAIT_RING = '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="4.5" fill="currentColor"/>';

// src/client/components.jsx
var import_jsx_runtime = require("react/jsx-runtime");
function Svg({ markup, className, box = 24 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className, viewBox: `0 0 ${box} ${box}`, "aria-hidden": "true", dangerouslySetInnerHTML: { __html: markup } });
}
function TaskListCard({ steps, t }) {
  if (steps.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "dtl-card", "aria-label": t("list.label"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dtl-steps", children: steps.map((step, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dtl-step", "data-status": step.status, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { markup: ICON_PATHS[step.status], className: "dtl-icon" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dtl-sr", children: [
      t(`status.${step.status}`),
      ": "
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtl-step-text", children: step.content })
  ] }, index)) }) });
}
function WaitChip({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtl-wait", role: "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { markup: WAIT_RING, className: "dtl-wait-ring", box: 16 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dtl-wait-label", children: t("wait.label") })
  ] });
}
function NextStepBox({ wrapUp, reply, canReply, onReply, t }) {
  const [sending, setSending] = (0, import_react.useState)(null);
  const [failed, setFailed] = (0, import_react.useState)(false);
  const answered = reply !== void 0;
  const chosen = answered ? wrapUp.actions.findIndex((a) => a.message === reply || a.label === reply) : sending;
  const disabled = answered || sending !== null || !canReply;
  const click = async (index) => {
    setSending(index);
    setFailed(false);
    const ok = await onReply(wrapUp.actions[index].message);
    if (!ok) {
      setSending(null);
      setFailed(true);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dtl-box", "aria-label": t("box.label"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtl-recap", children: wrapUp.recap }),
    wrapUp.ask && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dtl-ask-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtl-ask", children: wrapUp.ask }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dtl-actions", children: wrapUp.actions.map((action, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: `dtl-btn ${index === 0 ? "dtl-btn-primary" : "dtl-btn-secondary"}`,
          disabled,
          "data-chosen": chosen === index ? "true" : void 0,
          title: action.message !== action.label ? action.message : void 0,
          onClick: () => click(index),
          children: action.label
        },
        index
      )) })
    ] }),
    failed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dtl-error", role: "alert", children: t("reply.failed") })
  ] });
}

// src/client/locales.js
var NS = "tasklist";
var zh = {
  "list.label": "\u4EFB\u52A1\u6E05\u5355",
  "status.completed": "\u5DF2\u5B8C\u6210",
  "status.in_progress": "\u8FDB\u884C\u4E2D",
  "status.pending": "\u5F85\u529E",
  "box.label": "\u4E0B\u4E00\u6B65",
  "wait.label": "\u9700\u8981\u60A8\u7684\u8F93\u5165",
  "reply.failed": "\u6CA1\u80FD\u53D1\u51FA\uFF0C\u8BF7\u518D\u70B9\u4E00\u6B21"
};
var en = {
  "list.label": "Task list",
  "status.completed": "Completed",
  "status.in_progress": "In progress",
  "status.pending": "Pending",
  "box.label": "Next step",
  "wait.label": "Needs your input",
  "reply.failed": "Could not send; click again"
};

// src/client/index.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PLUGIN_ID = "dsh-tasklist";
var PROJECTION_KEY = "tasklist";
var HIDDEN_TOOLS = ["update_plan", "wrap_up"];
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.dataset.plugin = PLUGIN_ID;
  style.dataset.pluginCss = `${PLUGIN_ID}/tasklist.css`;
  style.textContent = tasklist_default;
  document.head.appendChild(style);
}
var inject = ["slots", "locale", "sessions"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${PLUGIN_ID}: dictionaries`);
  const replyFace = (sessionId) => ({
    sendReply: async (text) => {
      const session = ctx.sessions.binding(sessionId)?.session;
      if (!session) return false;
      try {
        const submission = session.beginSubmission({ mode: "queue", text, attachments: [] });
        const result = await session.prompt([{ type: "text", text }], "queue", void 0, submission.requestId);
        if (!result?.ok) submission.abandon?.();
        return result?.ok === true;
      } catch {
        return false;
      }
    }
  });
  ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
    { name: "conversation.input.dock", id: PLUGIN_ID, order: -10, locale: NS },
    LiveListDock
  ));
  ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register(
    { name: "conversation.chat.turnTail", id: PLUGIN_ID, order: -10, locale: NS, inject: replyFace },
    TurnTail
  ));
  ctx.slots.inject("tool.call.toolview", function* () {
    for (const key of HIDDEN_TOOLS) {
      yield ctx.slots.register({ name: "tool.call.toolview", key }, HiddenToolRow);
    }
  });
}
function LiveListDock({ useProjection, useSession, t }) {
  const state = useProjection(PROJECTION_KEY);
  const running = useSession((s) => s.running);
  if (!state || !running || state.currentTurn === null) return null;
  const entry = state.turns.find((e) => e.turn === state.currentTurn);
  if (!entry || entry.steps.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dtl-root dtl-dock", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TaskListCard, { steps: entry.steps, t }) });
}
function TurnTail({ turn, useProjection, useSession, sendReply, t }) {
  const state = useProjection(PROJECTION_KEY);
  const running = useSession((s) => s.running);
  if (!state) return null;
  const entry = state.turns.find((e) => e.turn === turn.turn);
  if (!entry || entry.steps.length === 0 && !entry.wrapUp) return null;
  const isLatest = state.currentTurn === turn.turn;
  const waiting = entry.wrapUp?.blocked === true && entry.reply === void 0 && isLatest && !running;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dtl-root dtl-tail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TaskListCard, { steps: entry.steps, t }),
    entry.wrapUp && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      NextStepBox,
      {
        wrapUp: entry.wrapUp,
        reply: entry.reply,
        canReply: isLatest && !running,
        onReply: sendReply,
        t
      }
    ),
    waiting && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(WaitChip, { t })
  ] });
}
function HiddenToolRow() {
  const ref = (0, import_react2.useRef)(null);
  (0, import_react2.useLayoutEffect)(() => watchGroup(ref.current), []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { ref, "data-dtl-hidden-call": "", hidden: true });
}
var GROUP = "[data-step-process]";
var ITEM = "[data-chat-flow-kind]";
var HIDDEN_GROUP_ATTR = "data-dtl-hidden-group";
var watchedGroups = /* @__PURE__ */ new WeakMap();
function refreshGroup(group) {
  const items = group.querySelectorAll(ITEM);
  const onlyHidden = items.length > 0 && Array.from(items).every((item) => item.querySelector("[data-dtl-hidden-call]"));
  group.toggleAttribute(HIDDEN_GROUP_ATTR, onlyHidden);
}
function watchGroup(node) {
  const group = node?.closest(GROUP);
  if (!group) return void 0;
  let watch = watchedGroups.get(group);
  if (!watch) {
    const observer = new MutationObserver(() => refreshGroup(group));
    observer.observe(group, { childList: true, subtree: true });
    watch = { count: 0, observer };
    watchedGroups.set(group, watch);
  }
  watch.count++;
  refreshGroup(group);
  return () => {
    watch.count--;
    if (watch.count > 0) return;
    watch.observer.disconnect();
    watchedGroups.delete(group);
    group.removeAttribute(HIDDEN_GROUP_ATTR);
  };
}
return module.exports; } });
