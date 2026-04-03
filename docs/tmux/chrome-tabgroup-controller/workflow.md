# Lite Team - Minimal 2-Role Team

<context>
A minimal tmux team with just 2 roles: PO (Product Owner) for management and Worker for execution.
Project: chrome-tabgroup-controller — Programmatic Chrome tab group control via WebSocket bridge.
</context>

**Terminology:** "Role" and "agent" are used interchangeably. Each role is a Claude Code AI agent instance.

---

## Team Philosophy

**Separation of Concerns**: PO manages WHAT to do and WHEN. Worker focuses on HOW to do it.

This structure prevents confusion between:
- Managing tasks/priorities vs. doing actual work
- Defining requirements vs. implementing solutions
- Coordinating workflow vs. executing tasks

---

## Agent Roles

| Role | Pane | Purpose | Never Does |
|------|------|---------|------------|
| PO | 0 | Backlog management, priorities, task assignment, acceptance | Code, debug, test, research |
| Worker | 1 | Coding, research, writing, debugging, testing | Prioritize, manage backlog, decide what to work on |
| Boss | Outside | Provides goals, feedback, final acceptance | Direct Worker communication |

---

## Project Context

**Architecture:**
```
Claude Code / Claude Chat Desktop
      ↓ (MCP stdio)
native-host/mcp-server.js  (MCP + WebSocket server)
      ↓ (WebSocket, port 9876)
Chrome Extension (extension/background.js)
      ↓
chrome.tabGroups API
```

**Key files:**
- `extension/background.js` — Service worker (Manifest v3)
- `native-host/server.js` — WebSocket server (port 9876)
- `native-host/mcp-server.js` — MCP server (stdio)
- `native-host/bridge.js` — Alternative implementation

**No build step** — Pure JavaScript, no transpilation. Dependencies: `ws`, `@modelcontextprotocol/sdk`.

---

## Core Principles

### 1. Strict Role Boundaries

**PO's job**: Coordinate, not execute.
**Worker's job**: Execute, not prioritize.

**Rule**: Better to wait for delegation or escalate than to break role boundaries.

### 2. Mandatory Report-Back Protocol

Worker MUST report after ANY task completion:
```
tm-send PO "WORKER -> PO: [Task] DONE. [Summary with artifacts]."
```

**Never assume PO knows you're done.**

### 3. Active PO (Not Passive)

- DEMANDS progress reports (30-60 min cadence)
- MAKES autonomous decisions about priorities
- ESCALATES proactively (>15 min silence = demand update)
- ENFORCES quality standards

### 4. Execution-Based (Not Time-Based)

**START NOW. Report when done.**

---

## Communication Protocol

### Use tm-send for ALL Messages

```bash
# PO assigns work
tm-send WORKER "PO -> WORKER: Implement feature X. Report back with commit hash and test results."

# Worker reports completion
tm-send PO "WORKER -> PO: Feature X DONE. Commit abc123. Tests passing (12/12)."
```

### Communication Rules

1. **PO ↔ Worker**: All work assignment and reporting
2. **PO ↔ Boss**: Goals, acceptance, escalations
3. **Worker NEVER communicates with Boss** - always through PO

### Message Format

`[FROM_ROLE] -> [TO_ROLE]: [Brief message]. [Artifacts/Next steps].`

---

## Workflow

### Standard Task Flow

1. **Boss → PO**: Provides goal or requirement
2. **PO → Worker**: Assigns task with acceptance criteria
3. **Worker**: Executes immediately
4. **Worker → PO**: Reports completion with artifacts
5. **PO**: Reviews, accepts/rejects
6. **PO → Boss**: Reports at milestones

---

## ⚠️ CRITICAL: Pane Detection

**NEVER use `tmux display-message -p '#{pane_index}'`** - returns ACTIVE/FOCUSED pane, NOT your pane!

**Always use `$TMUX_PANE` environment variable:**

```bash
# CORRECT
echo $TMUX_PANE
tmux list-panes -a -F '#{pane_id} #{pane_index} #{@role_name}' | grep $TMUX_PANE
```

---

## Getting Started

1. **Run setup script**: `bash docs/tmux/chrome-tabgroup-controller/setup-team.sh`
2. **Attach**: `tmux attach -t ctc`
3. **Send initial goal**: `tm-send PO "BOSS: Your goal here"`
