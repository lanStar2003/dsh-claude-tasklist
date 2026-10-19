// Model-facing wording: tool descriptions and the system-prompt section.
// Adapted from Claude Code desktop's "Task list and wrap-up" guidance, minus the
// parts dsh has no equivalent for (side sessions, PR auto-fix, app action buttons).

export const UPDATE_PLAN_DESCRIPTION = `Keep the task list the user sees pinned under your latest message while you work. Every request that edits files or runs more than one command gets one; only a single-command answer or pure conversation does not.

Never spend a turn step on this tool alone: send it IN THE SAME MESSAGE as another tool call (in parallel), so it costs no extra round trip.
- First call: with the VERY FIRST tool call of the turn, even one that only reads or lists files: {"items": [...], "scope": ...}, the whole plan in order, short imperative phrases (at most ~7 words, no numbering), the step you are starting "in_progress", the rest "pending". If you must look around first, make "Look at how X is set up" step one and refine the list once you know.
- Next step: {"advance": true} alongside the call that begins it (completes the in_progress step, starts the next pending one); after the last step, call wrap_up instead (it checks off the list).
- Out of order: {"done": [2], "start": 4} (1-based).
- Plan changed, including right after the user interrupts or sends a new instruction mid-task: {"items": [...]} again, the new whole list, so the pinned list never shows an abandoned plan.
- Every {"items"} call says in "scope" what this request is to the session: "first_task" (nothing finished here yet); after that, "new_task" (unrelated work that builds on nothing done, found or decided here) or "continuation" (everything else, including the next iteration and acting on what you just investigated; when unsure, this one).
Keep exactly one step in_progress while working and none when everything is done. Do not also write the plan as a numbered list in your message: the pinned list is the plan.`

export const WRAP_UP_DESCRIPTION = `Fill the "next step" box shown at the end of your turn: a two-or-three-sentence recap and, when this turn leaves the user a decision to make or a step to take, one question and buttons that answer it; a turn with nothing pending ends with the recap alone.

Call it once in EVERY turn in which you kept a task list, changed files, ran commands, or completed multi-step work: when this turn's work is done, before any closing message (it also checks off the task list; no closing update_plan is needed). Skip it for short answers, pure conversation, or a brief read-and-explain turn.

The result says which case applies. When the box shows your question, it ends your turn: write no text after this call. Otherwise your closing message is ordinary text right after this call, the last thing you say this turn.

Fields — recap and ask are said to the user, in the second person; a button's label and message are the user's words back to you:
- recap: what is now true or changed, then where it stands, including what is not done or not verified. Two or three short sentences, at most 300 characters, in the user's language. No recommendation here.
- ask (with actions, only when the next move is the user's call — a choice of approach, a go-ahead, an approval): just that ONE decision in one short sentence, with no reason or recommendation and without listing the options the buttons give. At most 100 characters.
- actions: 1–2 buttons answering ask, your recommendation first (drawn as the primary button). label: 1–3 words, at most 24 characters. message: what the click sends as the user's next message, at most 300 characters; omit it when the label is the whole message.
- blocked: true when your work stops here until the user answers (the session shows it is waiting on them); omit when the answer can wait.`

export const SYSTEM_PROMPT_SECTION = `# Task list and wrap-up
The user follows your progress on a task list shown under your latest message, not by reading your messages, so keeping it is part of doing the task. \`update_plan\` is that list. For every request that involves editing files or running more than one command, the very first tool call of the turn — even one that only reads a file — MUST go out together with \`update_plan\` carrying the whole plan (never as a call of its own); as each step finishes, \`{"advance": true}\` rides along with the call that starts the next step; if the plan changes or the user redirects you, send the whole list again. Only a single-command answer or pure conversation goes without one. Do not restate the plan as a list in your text.
Every turn in which you kept a task list, changed files or ran commands closes with \`wrap_up\`, called when this turn's work is done, before any closing message: it fills the next-step box with a two-or-three-sentence recap of what is now true and where it stands, including what is not done or not verified. When the turn leaves the user a decision to make or a step to take, it also holds one short question plus one or two buttons of one to three words that answer it; a turn with nothing pending sends the recap alone. When the box shows your question, the box ends your turn and you write no text after the call; otherwise your closing message follows the call.`
