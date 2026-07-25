# Tasker

A kanban board for AI agents. Create tasks, dispatch agents, and track progress — all without leaving your editor.

![Tasker board](https://raw.githubusercontent.com/Emberstone-Studio/Tasker/main/img/tasker-screen1.png)

## Requirements

- [Node.js](https://nodejs.org/en)
- [VS Code](https://code.visualstudio.com/download)
- [Claude Code](https://claude.com/product/claude-code)

## Getting Started

### 1. Install globally

Download the [latest release](https://github.com/Emberstone-Studio/Tasker/releases) (Tasker.zip) and extract it anywhere. Inside you'll find `tasker-X.X.X.vsix` and `INSTALL.txt`.

Open VS Code and drag the `.vsix` file into the Extensions panel. Alternatively, open the Extensions panel, click **`···`** at the top, choose **Install from VSIX…**, and select the file.

This installs Tasker to `~/.vscode/extensions/emberstone-studio.tasker-X.X.X/` and registers Claude Code skills in `~/.claude/commands/`.

### 2. Reload VS Code

Open the command palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux) and run **Reload Window** so the new skills are available.

### 3. Use in any project

Open a project in VS Code and click the **Tasker status bar icon** (bottom-right) to start the server and open the board. On the first run in a new project, it creates a `.tasker/` directory with an empty task store. Dispatch is manual: open the **Run Queue** (the ⚡ bolt button) to check tasks into a queue and run them, or use **Run Now** on an individual task.

You can also run `/tasker` in Claude Code to start the server and open the board.

---

## Board

Tasks move through five columns:

| Column | Meaning |
|---|---|
| **Backlog** | Not ready yet |
| **Ready** | Queued for execution — dispatched via the **Run Queue** / **Run Now** |
| **In Progress** | Being worked on by an agent |
| **In Review** | Done — review the output, then move to Done or send back with new comments |
| **Done** | Complete |

The board has three tabs: **Tasks** (the kanban view), **Agents** (roles, drivers, and models), and **Performance** (the analytics dashboard).

Drag cards between columns at any time. Click the **+** in any column header to add a task directly into that column. The project name appears in the top bar when connected. The browser tab shows a robot favicon that adapts to your light or dark theme.

### Trash

A collapsible **Trash** column appears at the right edge of the board. Drag any card onto it to remove the task from the active board. Trashed tasks are permanently deleted based on the **Auto-clean trash** setting (configurable in Settings; default 30 days). Drag a trashed card back to a board column to restore it, or click **Empty Trash** to delete all trashed tasks immediately. The column collapses to a small icon when not in use; click the icon to expand it.

## Tasks

Each task has:

- **Title** and **Description** — the description becomes the agent's instructions
- **Epic** — an optional grouping for related tasks; set manually or assigned automatically by Auto-group
- **Agent** — which agent runs the task; leave it as **Auto** to let the team lead choose the best agent based on task content
- **Model** — when Agent is Auto, optionally pin a specific model for this task
- **Pipeline** — an optional sequence of agents to run in order
- **Priority** — Low / Medium / High (shown as a colored dot on the card)
- **Label** — an optional category tag: Bug, Feature, Maintenance, Release, or Research

### Workflow

1. Create a task in **Backlog** or **Ready**
2. Click the **Tasker status bar icon** to start the server and open the board
3. Open the **Run Queue** (⚡) and press **▶ Run** to dispatch, or **Run Now** on an individual task
4. Tasks move to **In Review** when done, with output in the activity log
5. Review the output, then move the card to Done — or add a comment and move it back to Ready

### Progress tracking

While a task is in progress, its card shows a progress bar and the current step label. These reflect the agent's self-reported plan — steps are written to the board state as the agent works and are visible in real time.

### Run Now

The task detail modal includes a **Run Now** button when the task is in Ready status. Clicking it saves any pending edits and immediately dispatches just that task.

### Comments and agent clarification

Each task has an activity log and comment box. Comments you add are included in the agent's prompt when the task is next picked up.

If an agent needs information it cannot determine on its own, it posts a question to the task's activity log and the card shows a **Waiting for input** badge. The chat panel opens automatically. Reply there and the task is re-dispatched with your answer included.

## Agents

Built-in agents: **Researcher**, **Coder**, **Reviewer**, **Writer**, plus the **Tasker** orchestrator role. Each has a role (system prompt) and a color used on cards.

Add or edit agents from the **Roles** section of the Agents tab (click **+ Add role**). The role field is the system prompt sent to the sub-agent — be specific.

On **Free**, every Role keeps its own persona and effort setting but inherits the one first-party CLI driver/model selected on Tasker; work runs sequentially. **Pro** unlocks a different provider/model per Role or task.

If a task's agent is set to **Auto**, the team lead picks the most appropriate agent based on task content: writing/docs tasks go to Writer, review/audit to Reviewer, research to Researcher, and everything else to Coder.

Each role is a durable identity stored under `.tasker/roles/<slug>/` — its definition, role-scoped memory, and a run-state log that records the current task, start time, a timeline of activity entries, and a history of completed work.

## Agents Tab

The Agents tab has three collapsible sections: **Roles**, **Drivers**, and **Models**.

- **Roles** — the agents you dispatch (Researcher, Coder, Reviewer, Writer, and any custom roles), each with a live activity badge while working.
- **Drivers** — the CLIs that run your agents; each driver brings its own model(s). Free selects one eligible first-party CLI driver here. Pro can orchestrate across connected drivers and models.
- **Models** — the model catalog (see [Models](#models)).

### Agent cards

Each agent has a card showing its name, color, role preview, and assigned model (if any). Clicking a card opens the agent edit modal.

When an agent is actively working on a task, a live badge appears on its card showing the task title and an elapsed timer. The last activity entry is shown beneath the badge. Clicking the live badge opens the **Agent Activity** modal, which shows a timeline of all activity entries for the current task.

When an agent has a task waiting for user input, a clarification block appears inline on the card — showing the agent's question and a reply input. Sending a reply re-queues the task immediately.

### Agents tab badge

The **Agents** tab shows a badge count when one or more tasks have a pending question (most recent activity entry has type `pending_question`). The badge does not appear for tasks that are merely in review.

### Models

The **Models** section shows the connected catalog. Free can choose one manifest-classified first-party CLI driver/model for Tasker (for example Claude Code, Codex, Bob, or Antigravity); every Tasker-managed execution inherits it.

**Pro is Tasker's cross-provider control plane.** It unlocks API and local/OpenCode models, different models by Role or task, automatic routing and cross-provider fallback, peer chat, parallel tasks, and the broader managed fan-out budget. Use `/tasker-add-model` or **+ Add model** to onboard additional models.

Models can be connected at the model level (individual API key per model) or at the provider level (one API key shared across all models from that provider). Model connection credentials are stored in the extension's `settings.json` (`~/.vscode/extensions/emberstone-studio.tasker-X.X.X/settings.json`).

## Performance

The **Performance** tab is a real-time analytics dashboard, scoped to current tasks.

### Charts

Six live charts arranged in two rows:

**Row 1** (three columns):
- *Column 1 (stacked):* **Work Status** — a segmented bar showing the current split of tasks across Ready, In Progress, In Review, and Needs Attention states. The tile highlights when agents are active or tasks need attention. **Quality** — two ring charts: Pass Rate (tasks that moved to Done) and Re-do Rate (tasks sent back from review). The Re-do Rate ring shifts from green to amber to red as the rate rises.
- *Column 2:* **Labels** — a radar/pentagon chart showing task counts across the five label categories (Bug, Feature, Maintenance, Release, Research).
- *Column 3:* **Throughput** — a line chart of tasks completed over time. Use the period selector to switch between day, week, and month views.

**Row 2:**
- **Usage** — average task duration per agent plus a total token count across all tasks.
- **Task Flow** — a Sankey diagram showing how tasks flow from the team lead through each agent and pipeline stage.

### Tasks table

A collapsible table lists every task in the project. Columns: Task, Status, Agent(s), Label, Epic, Date, Tokens, and Last Output. Tasks waiting for user input float to the top, marked with a `?` flag. Click any task title to open the task detail modal. The table is filterable by title and status, and sortable by any column.

## Pipelines

A pipeline is a sequence of agents applied to a single task in order. Add pipeline steps in the task form — each step is an agent selected from your roster. When the task runs:

1. The first agent executes and produces output
2. That output is handed to the second agent as its input, and so on
3. The task moves to **In Review** after the final step completes

The card shows a **Step N/M** badge while a pipeline task is in progress.

## Claude Code skills

Installing the extension registers skills in `~/.claude/commands/`:

| Skill | Purpose |
|---|---|
| `/tasker` | Starts (or restarts) the server and opens the board |
| `/tasker-queue` | Analyzes the ready queue and dispatches ready tasks via sub-agents |
| `/tasker-run` | Dispatches a single task directly (one-off Run Now) |
| `/tasker-stop` | Shuts down the server (the VS Code status bar icon is the preferred way to stop) |
| `/tasker-add-model` | Onboards a new external model into the registry |
| `/tasker-watchdog` | Checks in-progress tasks and re-dispatches any whose agents have died (triggered automatically) |

Tasker launches the selected provider connector. Free stays on Tasker's one selected CLI driver; Pro may route Tasker-managed work across CLI, API, and local providers.

### Ports

Each project gets a stable port derived from its directory path (range 7843–9842), so multiple projects can run simultaneously without conflict.

### How dispatch works

There is **no background scan loop**. Dispatch is triggered explicitly — by running the **Run Queue** (the ⚡ bolt button or `/tasker-queue`), by **Run Now** on a single task (`/tasker-run`), or automatically as a **run plan** advances. When you run the queue, the server hands a trigger to the **team lead**, which:

1. Calls `/claim-ready` to atomically move ready tasks to `in_progress` (sorted by priority: High → Medium → Low)
2. Builds a **run plan** — a dependency- and conflict-aware sequence over the ready queue
3. Resolves execution policy: Tasker's single inherited driver on Free, or Role/task routing and fallback on Pro
4. Dispatches supervised workers sequentially on Free or according to the approved sequential/parallel plan on Pro
5. Workers report results and the task moves to `in_review`

Once a run plan is active, advancement is **event-driven**: as each task reaches In Review, the next planned task is dispatched automatically — no timer, no polling. The board updates in real time over SSE.

### Pause and Resume

When a worker hits a rate limit, usage cap, or transient provider error, the team lead halts dispatch and displays a **Usage Cap** banner on the board. During this halt, no new tasks are dispatched. Click **Resume** on the banner to clear the halt and continue with the next queued task. This is a safety mechanism to prevent hammering a rate-limited API; it does not pause individual running tasks.

### Team lead and agent pattern

The team lead runs inside the chat panel and claims and delegates task work. Workers receive a self-contained prompt with the selected Role persona, task details, user comments, working directory, and reporting contract. Provider-native delegation flags are best-effort containment controls; Tasker's durable entitlement boundary is its own execution routing and concurrency policy.

All agentic task dispatch goes through `/execute-agent`. The selected model determines the connector that launches the supervised background agent.

### Watchdog

The watchdog is the **run-plan executor**. It runs automatically and has two jobs: (1) **liveness** — a real OS PID check on in-progress agents (uses `process.kill(pid, 0)`); a dead/stalled agent is re-dispatched once, and if that also fails the task is reset to Ready with a board notification; (2) **run-plan execution** — if nothing is in progress but the active run plan still has a next planned task (for example, an advance was missed, or a dead agent was just reset), it dispatches that task. Its cadence is adaptive: ~10 minutes while an agent is actively working (liveness only), ~30 seconds while a run plan is mid-flight with nothing running. A single-flight guard keeps it from racing the team lead into a duplicate dispatch.

### Usage limits

If a Claude agent (or any sub-agent) hits a rate limit or usage cap, the team lead resets the affected task to **Ready** and the server **halts dispatch** — a safety brake so a run plan can't keep hammering a rate-limited API. A warning banner appears on the board; click **Resume** to clear the halt and continue.

For BYOM connectors, retryable errors (rate limits, timeouts, provider errors) trigger the same halt with a similar banner. Non-retryable errors (auth failures, bad config) also halt and require fixing the configuration before resuming.

### Label-based dispatch

When running `/tasker-queue`, you can filter which tasks are dispatched by label. For example: "run bug fixes only" dispatches only tasks labelled **Bug**. Without a label filter, all ready tasks are claimed.

## Status bar

The VS Code status bar shows the Tasker icon at all times. Click it to open the board in a VS Code panel, open the board in a browser tab, or stop the server. The icon dims when the server is stopped and shows a spinner while starting.

## Run Queue

The top bar shows a **⚡** bolt button (visible whenever the server is connected). Click it to open the **Run Queue** — a queue editor showing all ready tasks. Check tasks into the queue, reorder them (in Sequential mode), choose dispatch mode (**Sequential** or **Parallel**), then click **▶ Run** to dispatch.

While tasks are running, the same menu shows the active run queue with the current state. View task progress inline, and click **Stop** to cancel the run plan and clear the queue entirely.

Individual tasks can also be dispatched from the task modal's **Run Now** button. Stop the server from the VS Code status bar icon.

## Chat panel

Click the **chat bubble icon** in the top-right corner to open the chat panel. It slides in from the right and can be resized by dragging its left edge. It stays open as you work.

The chat panel connects through Tasker's selected driver and has awareness of the current board state — tasks, statuses, Roles, and connected models. You can ask it to explain what's happening, create or update tasks, or make changes to the board. Task state lives as a thin index (`.tasker/tasks/tasks.json`) plus one folder per task under `.tasker/tasks/active/<id>/`; the assistant uses the server API, which persists changes and pushes live updates.

The chat panel also serves as the **team lead** — when you run the queue (or a run plan advances), the server sends silent trigger messages to claim and dispatch tasks. These messages are invisible to the user; only dispatch results and agent completions surface as visible feed entries.

### Chat toolbar

The panel header contains:

- **Session title** — shown at top-left; double-click or click the pencil icon to rename
- **History** (clock icon) — opens a dropdown of past sessions; switch sessions or delete them
- **New Chat** (compose icon) — starts a fresh session

The input area contains:

- **Role/tuning pill** — Free shows Tasker using the single selected driver; Pro also exposes peer Role switching and per-Role model configuration
- **Attach** (paperclip icon) — attach a file or image to the next message. Accepts images and common text/code file types. You can also paste images from the clipboard.
- **Detach** (panel icon) — pops the chat panel out into a floating, draggable window. Drag it near the right edge to snap it back.
- **Opacity** (half-circle icon, detached mode only) — adjust the panel's background transparency
- **Compact** (pie chart icon) — summarize the current session via Haiku and start a fresh context window. The pie chart fills as the context window fills.
- **Token count** — shown next to the compact button when enabled in Settings
- **Session cost** — shown in the toolbar when enabled in Settings
- **Stop** — cancels an in-flight response

Slash commands (`/model haiku`, `/model sonnet`, `/model opus`) and `@agent-name` mentions let you switch models or address specific agents from the input field.

### Elicitation (commit and PR approvals)

When an agent needs approval before committing, opening a PR, or publishing a release, it outputs an interactive approval card in the chat panel. The card shows the proposed commit message or PR body and offers **Approve**, **Deny**, and an alternate-instruction input. Approved actions proceed immediately; denied actions stop the agent; an alternate instruction redirects the agent with new guidance.

### Chat as activity feed

When tasks are dispatched, a message appears listing each task and its assigned agent. When an agent completes a task, a summary appears in the feed. Task events (created, deleted, moved between columns) appear as system messages.

### Chat history and persistence

Conversations are stored as JSONL files in `~/.claude/projects/<encoded-project-path>/`. Sessions persist across server restarts. The history dropdown shows up to 50 recent sessions with titles and timestamps. Claude's auto-compaction (when a session exceeds its context window) is detected and shown as a compaction marker in the feed.

## Notifications and Narrations

Board events trigger real-time notifications (narrations) when:
- A task is created, moved between columns, or completed
- An agent picks up a task
- An agent fails or completes a task
- The watchdog re-dispatches a stalled agent
- Dispatch halts on a usage cap

Narrations appear as toast notifications on the board and persist in the feed. Each narration can have action buttons (e.g., **Re-dispatch** for a failed task). High-priority narrations are always shown on board load if unacknowledged.

### Narration settings

Configure narration behavior in **Settings**:
- **Mode** — "all" (show all events), "important" (high-priority only), or "silent" (quiet hours or never)
- **Quiet Hours** — optional time range to suppress notifications (e.g., "22:00–08:00")

Settings are stored in the global Tasker settings file.

## Voice and Audio

Tasker includes on-device voice capabilities for a hands-free experience:

### Voice Dictation (Whisper)

Dictate tasks and comments using your microphone. Tasker uses Whisper (OpenAI's local speech recognition) bundled with the extension. Voices are downloaded on demand to `~/.tasker/whisper/` and **never leave your machine**.

### Text-to-Speech (Piper)

Chat panel responses and task narrations can be read aloud using Piper (local TTS engine). Voices are downloaded on demand to `~/.tasker/piper/voices/`. Audio synthesis happens locally and **never leaves your machine**.

### Hardware Acceleration

When available, GPU-accelerated voice recognition via Vulkan can be enabled in Settings. This speeds up transcription on systems with compatible graphics hardware.

All voice processing (input and output) is privacy-by-default — everything runs locally, no cloud connectivity required.

## Settings

Open the **Settings** panel (⚙) to configure:

- **About** — current version and license tier. Free uses one selected first-party CLI driver with sequential execution. Pro unlocks Tasker's cross-provider control plane: per-Role/task models, API/local models, automatic routing and fallback, peer chat, parallel tasks, and broader fan-out.
- **Appearance** — dark/light mode toggle; preference saved in `localStorage`
- **Chat** — toggles for session cost display and token count display; **Auto-clean chats** (permanently delete `.tasker/chats/` entries after a configurable age: never / 1 / 14 / 30 / 60 days); **Conversation** (on-device voice input via Whisper + text-to-speech via Piper — audio never leaves your machine; downloads ~240 MB on first use); **Hardware acceleration** (GPU-accelerated voice recognition via Vulkan — shown only when available; downloads ~44 MB)
- **Tasks** — **Auto-group tasks into epics** (uses AI to group uncategorized tasks that share a theme; never touches tasks you've assigned an epic manually; includes a **Run on existing tasks** button to apply immediately); **Auto-clean done tasks** (moves tasks older than a configurable threshold to Trash: never / 1 / 14 / 30 / 60 days); **Auto-clean trash** (permanently deletes trashed tasks after: never / 1 / 14 / 30 / 60 days, default 30); Pro automatic routing objective: **Cheapest**, **Balanced** (default), or **Best quality**
- **Permissions** — which tool categories sub-agents can use without a permission prompt; written to `.claude/settings.json`
- **Narrations** — notification mode and quiet hours (see [Notifications and Narrations](#notifications-and-narrations))

| Permission | Tools / Effect |
|---|---|
| Read files | `Read` |
| Edit / Write files | `Edit`, `Write` |
| Bash / PowerShell commands | `Bash(*)`, `PowerShell(*)` |
| Web access | `WebFetch(*)`, `WebSearch(*)` |
| Commit .tasker to git | Removes `.tasker/` from `.gitignore` so board state, chats, and role memory are versioned |

## Development

Run the complete repository suite with `npm test`. The test entry point runs every
`test/*.js` file plus adapter conformance and native fan-out coverage under a
disposable configuration home, and removes that home and any child-process trees
when the suite exits.

## Data

State is persisted in `.tasker/tasks/tasks.json` (thin index) plus one file per task under `.tasker/tasks/active/<id>/`, and synced to the browser in real time over SSE. The server watches for external edits so changes picked up from agents or tools are broadcast without a restart. To export, copy the `.tasker/tasks/` directory.

## Files

| Location | Purpose |
|---|---|
| `~/.vscode/extensions/emberstone-studio.tasker-X.X.X/` | Extension files installed by the VSIX |
| `~/.vscode/extensions/emberstone-studio.tasker-X.X.X/settings.json` | Global settings: connected models, credentials, license |
| `~/.vscode/extensions/emberstone-studio.tasker-X.X.X/models/` | Seed model dossiers (bundled with the extension) |
| `~/.claude/commands/tasker*.md` | Global skills, registered on first server start |
| `.tasker/tasks/tasks.json` | Per-project task state (canonical source of truth) |
| `.tasker/tasks/trash.json` | Trashed tasks (auto-purged per Auto-clean trash setting; default 30 days) |
| `.tasker/tasks/attachments/` | Task file/image attachments |
| `.tasker/tasks/active/<id>/` | Per-task working documents and state |
| `.tasker/roles/<slug>/` | Per-role definition, memory, run-state, and task docs |
| `.tasker/chats/<id>/` | Tasker-native chat persistence (one JSON file per thread) |
| `.tasker/attachments/chats/` | Chat file/image attachments (auto-cleaned after 30 days) |
| `.tasker/models/` | Per-project user-onboarded model dossiers (takes priority over seed) |
| `.tasker/runtime/` | Runtime state: agent PIDs, context cache, peer session map |
| `.tasker/logs/` | Server error logs |
| `.claude/settings.json` | Per-project Claude Code tool permissions (written by Tasker) |
| `~/.tasker/whisper/` | Whisper voice models and binaries (downloaded on demand) |
| `~/.tasker/piper/` | Piper voice models (downloaded on demand) |

The project-local `.tasker/` directory remains plaintext and commit-friendly so board, Role, and chat state can move with the repository across devices. Manually applying an external CLI to copied task text is outside Tasker's managed entitlement boundary.

---

> Patent Pending — US Application 64/076,775 · © 2026 [Emberstone Studio](https://emberstone-studio.com/)
