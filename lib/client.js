window.__ModuleLoader__.load({ id: "dsh-claude-tasklist", factory: (require) => {
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
var tasklist_default = `/*\r
 * Task list + next-step box, measured from Claude Code desktop (light theme, DPR 1.5).\r
 * See docs/SPEC.md \xA72 for the measurements behind each value.\r
 */\r
.dtl-root {\r
  --dtl-fg: #0b0b0b;\r
  --dtl-fg-muted: #898781;\r
  --dtl-border: #e3e3e2;\r
  /* Claude's card is see-through on its page; here it matches dsh's page so the\r
     docked copy can float over the transcript without showing text through. */\r
  --dtl-surface: var(--dsw-alias-bg-base, #fcfcfb);\r
  --dtl-btn-bg: #0b0b0b;\r
  --dtl-btn-fg: #ffffff;\r
  --dtl-btn2-bg: #fcfcfb;\r
  --dtl-btn2-shadow: 0 1px 2px rgb(0 0 0 / 0.04);\r
  --dtl-wait-ring: #f0ac55;\r
  --dtl-wait-bg: #f9dca4;\r
  --dtl-wait-fg: #734500;\r
  --dtl-radius: 9px;\r
  --dtl-btn-radius: 5px;\r
  --dtl-font-size: 14px;\r
  --dtl-row-height: 26px;\r
  --dtl-icon: 14px;\r
\r
  color: var(--dtl-fg);\r
  font-size: var(--dtl-font-size);\r
  -webkit-font-smoothing: antialiased;\r
}\r
\r
body[data-ds-dark-theme] .dtl-root,\r
.dtl-root.dtl-dark {\r
  --dtl-fg: #ececea;\r
  --dtl-fg-muted: #8f8d87;\r
  --dtl-border: #3a3a38;\r
  --dtl-btn-bg: #ececea;\r
  --dtl-btn-fg: #121212;\r
  --dtl-btn2-bg: transparent;\r
  --dtl-btn2-shadow: none;\r
  --dtl-wait-ring: #e39b45;\r
  --dtl-wait-bg: #4a3517;\r
  --dtl-wait-fg: #f5c77e;\r
}\r
\r
/* ---------- hidden bookkeeping calls ---------- */\r
\r
/* The flow item that holds an update_plan / wrap_up row (see HiddenToolRow). A\r
   run_code item (code mode) holds its calls under [data-subcalls]: it stays, since\r
   its program may do real work, and only the bookkeeping call rows inside go. */\r
[data-chat-flow-kind]:has([data-dtl-hidden-call]):not(:has([data-subcalls])) {\r
  display: none !important;\r
}\r
\r
[data-subcalls] [data-chat-call-id]:has([data-dtl-hidden-call]) {\r
  display: none !important;\r
}\r
\r
/* A run_code item whose program only calls update_plan / wrap_up (see index.jsx). */\r
[data-chat-flow-kind][data-dtl-hidden-item] {\r
  display: none !important;\r
}\r
\r
/* A "tools called" group whose every item is such a row (marked by index.jsx). */\r
[data-step-process][data-dtl-hidden-group] {\r
  display: none !important;\r
}\r
\r
/* ---------- placement ---------- */\r
\r
/* Same width as dsh's own dock strips (see ui-conversation TodoPanel). */\r
.dtl-dock {\r
  box-sizing: border-box;\r
  flex: none;\r
  margin: 0 auto;\r
  width: calc(100% - 2 * var(--dsh-composer-side-clearance, 0px) - 4 * var(--dsh-composer-dock-inset, 0px));\r
  max-width: calc(var(--dsh-composer-card-max-width, 100%) - 4 * var(--dsh-composer-dock-inset, 0px));\r
}\r
\r
.dtl-dock .dtl-card {\r
  margin: 0;\r
}\r
\r
.dtl-tail > :first-child {\r
  margin-top: 0;\r
}\r
\r
.dtl-sr {\r
  position: absolute;\r
  width: 1px;\r
  height: 1px;\r
  overflow: hidden;\r
  clip: rect(0 0 0 0);\r
  white-space: nowrap;\r
}\r
\r
/* ---------- task list card ---------- */\r
\r
.dtl-card {\r
  box-sizing: border-box;\r
  width: 100%;\r
  margin: 12px 0 0;\r
  padding: 12px 16px;\r
  border: 1px solid var(--dtl-border);\r
  border-radius: var(--dtl-radius);\r
  background: var(--dtl-surface);\r
}\r
\r
.dtl-steps {\r
  margin: 0;\r
  padding: 0;\r
  list-style: none;\r
}\r
\r
.dtl-step {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  min-height: var(--dtl-row-height);\r
  line-height: var(--dtl-row-height);\r
}\r
\r
.dtl-step-text {\r
  min-width: 0;\r
  overflow-wrap: anywhere;\r
}\r
\r
.dtl-icon {\r
  flex: none;\r
  width: var(--dtl-icon);\r
  height: var(--dtl-icon);\r
  fill: none;\r
  stroke: currentColor;\r
  stroke-width: 2;\r
  stroke-linecap: round;\r
  stroke-linejoin: round;\r
}\r
\r
.dtl-step[data-status='pending'] .dtl-icon {\r
  color: var(--dtl-fg-muted);\r
}\r
\r
/* The step being worked on while the agent runs. */\r
.dtl-spin {\r
  transform-origin: 50% 50%;\r
  animation: dtl-spin 0.8s linear infinite;\r
}\r
\r
@media (prefers-reduced-motion: reduce) {\r
  .dtl-spin {\r
    animation-duration: 2.4s;\r
  }\r
}\r
\r
@keyframes dtl-spin {\r
  to {\r
    transform: rotate(360deg);\r
  }\r
}\r
\r
/* ---------- waiting-for-input chip ---------- */\r
\r
.dtl-wait {\r
  display: flex;\r
  align-items: center;\r
  gap: 14px;\r
  margin: 12px 0 0 6px;\r
}\r
\r
.dtl-wait-ring {\r
  flex: none;\r
  width: 16px;\r
  height: 16px;\r
  color: var(--dtl-wait-ring);\r
}\r
\r
.dtl-wait-label {\r
  display: inline-flex;\r
  align-items: center;\r
  height: 18px;\r
  padding: 0 4px;\r
  border-radius: 4px;\r
  background: var(--dtl-wait-bg);\r
  color: var(--dtl-wait-fg);\r
  font-size: 12px;\r
  line-height: 18px;\r
}\r
\r
/* ---------- next-step box ---------- */\r
\r
.dtl-box {\r
  box-sizing: border-box;\r
  width: 100%;\r
  margin: 12px 0 0;\r
  padding: 12px 16px;\r
  border: 1px solid var(--dtl-border);\r
  border-radius: var(--dtl-radius);\r
  background: var(--dtl-surface);\r
  line-height: 22px;\r
}\r
\r
.dtl-recap {\r
  margin: 0;\r
  overflow-wrap: anywhere;\r
}\r
\r
.dtl-ask-row {\r
  display: flex;\r
  flex-wrap: wrap;\r
  align-items: center;\r
  justify-content: space-between;\r
  gap: 8px 12px;\r
  margin-top: 10px;\r
  padding-top: 10px;\r
  border-top: 1px solid var(--dtl-border);\r
}\r
\r
.dtl-ask {\r
  margin: 0;\r
  font-weight: 600;\r
  overflow-wrap: anywhere;\r
}\r
\r
.dtl-actions {\r
  display: flex;\r
  flex: none;\r
  gap: 8px;\r
  margin-left: auto;\r
}\r
\r
.dtl-btn {\r
  display: inline-flex;\r
  align-items: center;\r
  height: 23px;\r
  padding: 0 8px;\r
  border: 1px solid transparent;\r
  border-radius: var(--dtl-btn-radius);\r
  font: inherit;\r
  font-size: 13px;\r
  line-height: 21px;\r
  cursor: pointer;\r
  white-space: nowrap;\r
}\r
\r
.dtl-btn-primary {\r
  background: var(--dtl-btn-bg);\r
  color: var(--dtl-btn-fg);\r
}\r
\r
.dtl-btn-secondary {\r
  border-color: var(--dtl-border);\r
  background: var(--dtl-btn2-bg);\r
  box-shadow: var(--dtl-btn2-shadow);\r
  color: var(--dtl-fg);\r
}\r
\r
.dtl-btn:hover:not(:disabled) {\r
  filter: brightness(0.92);\r
}\r
\r
body[data-ds-dark-theme] .dtl-btn:hover:not(:disabled),\r
.dtl-dark .dtl-btn:hover:not(:disabled) {\r
  filter: brightness(1.12);\r
}\r
\r
.dtl-btn:focus-visible {\r
  outline: 2px solid var(--dtl-wait-ring);\r
  outline-offset: 1px;\r
}\r
\r
.dtl-btn:disabled {\r
  cursor: default;\r
  opacity: 0.45;\r
}\r
\r
.dtl-btn[data-chosen='true'] {\r
  opacity: 1;\r
}\r
\r
.dtl-error {\r
  margin: 8px 0 0;\r
  color: #b3261e;\r
  font-size: 12px;\r
}\r
\r
@media (prefers-reduced-motion: no-preference) {\r
  .dtl-card,\r
  .dtl-box {\r
    animation: dtl-in 160ms ease-out;\r
  }\r
}\r
\r
@keyframes dtl-in {\r
  from {\r
    opacity: 0;\r
    transform: translateY(2px);\r
  }\r
}\r
`;

// src/client/components.jsx
var import_react = require("react");

// src/client/icons.js
var ICON_PATHS = {
  in_progress: '<circle cx="12" cy="12" r="10"/><path d="M17 12h.01"/><path d="M12 12h.01"/><path d="M7 12h.01"/>',
  pending: '<path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/>',
  completed: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
};
var SPINNER = '<circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>';
var WAIT_RING = '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="4.5" fill="currentColor"/>';

// src/client/components.jsx
var import_jsx_runtime = require("react/jsx-runtime");
function Svg({ markup, className, box = 24 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className, viewBox: `0 0 ${box} ${box}`, "aria-hidden": "true", dangerouslySetInnerHTML: { __html: markup } });
}
function TaskListCard({ steps, live = false, t }) {
  if (steps.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", { className: "dtl-card", "aria-label": t("list.label"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dtl-steps", children: steps.map((step, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { className: "dtl-step", "data-status": step.status, children: [
    live && step.status === "in_progress" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { markup: SPINNER, className: "dtl-icon dtl-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Svg, { markup: ICON_PATHS[step.status], className: "dtl-icon" }),
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
var PLUGIN_ID = "dsh-claude-tasklist";
var PROJECTION_KEY = "tasklist";
var HIDDEN_TOOLS = ["update_plan", "wrap_up"];
var REMINDER_KIND = "tasklist";
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
  ctx.effect(() => watchTranscript(), `${PLUGIN_ID}: hide reminder notes and bookkeeping run_code rows`);
}
function LiveListDock({ useProjection, useSession, t }) {
  const state = useProjection(PROJECTION_KEY);
  const running = useSession((s) => s.running);
  (0, import_react2.useEffect)(() => noteQuietCalls(state?.quiet), [state?.quiet]);
  if (!state || !running || state.currentTurn === null) return null;
  const entry = state.turns.find((e) => e.turn === state.currentTurn);
  if (!entry || entry.steps.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dtl-root dtl-dock", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TaskListCard, { steps: entry.steps, live: true, t }) });
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
var CALL_ROW = "[data-chat-call-id]";
var REMINDER_LABEL = "[data-context-source]";
var HIDDEN_GROUP_ATTR = "data-dtl-hidden-group";
var HIDDEN_ITEM_ATTR = "data-dtl-hidden-item";
var watchedGroups = /* @__PURE__ */ new WeakMap();
var quietCalls = /* @__PURE__ */ new Set();
function watchTranscript() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return void 0;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) mutation.addedNodes.forEach(scanNode);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scanNode(document.body);
  return () => observer.disconnect();
}
function scanNode(node) {
  if (node.nodeType !== 1) return;
  for (const label of matching(node, REMINDER_LABEL)) {
    if (label.textContent === REMINDER_KIND) label.setAttribute("data-dtl-hidden-call", "");
  }
  if (quietCalls.size === 0) return;
  for (const row of matching(node, CALL_ROW)) {
    if (quietCalls.has(row.getAttribute("data-chat-call-id"))) hideItemOf(row);
  }
}
function matching(node, selector) {
  if (node.matches(selector)) return [node];
  return node.firstElementChild ? node.querySelectorAll(selector) : [];
}
function noteQuietCalls(ids) {
  if (!Array.isArray(ids) || typeof document === "undefined") return;
  for (const id of ids) {
    if (quietCalls.has(id)) continue;
    quietCalls.add(id);
    document.querySelectorAll(`[data-chat-call-id="${CSS.escape(id)}"]`).forEach(hideItemOf);
  }
}
function hideItemOf(row) {
  const item = row.closest(ITEM);
  if (!item || item.hasAttribute(HIDDEN_ITEM_ATTR)) return;
  item.setAttribute(HIDDEN_ITEM_ATTR, "");
  const group = item.closest(GROUP);
  if (group) refreshGroup(group);
}
var isHiddenItem = (item) => item.hasAttribute(HIDDEN_ITEM_ATTR) || item.querySelector("[data-dtl-hidden-call]") !== null && item.querySelector("[data-subcalls]") === null;
function refreshGroup(group) {
  const items = group.querySelectorAll(ITEM);
  const onlyHidden = items.length > 0 && Array.from(items).every(isHiddenItem);
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
