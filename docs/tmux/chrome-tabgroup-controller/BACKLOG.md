# Product Backlog

**Owner**: PO
**Purpose**: Prioritized list of all work items for chrome-tabgroup-controller

---

## P0 - Critical (System Broken, Unusable)

(None)

---

## P1 - Major (Next Tasks)

(None)

---

## P2 - Nice to Have (When Time Allows)

(None)

---

## P3 - Future Ideas (Low Priority)

(None)

---

## Done

- **[P1-002] Convert project to Claude Code plugin** — commit f83f881. Created .claude-plugin/plugin.json, .mcp.json, commands/, hooks/hooks.json + hook scripts. Skills already at root. Load with: claude --plugin-dir .
- **[P1-001] Repository cleanup** — commits 59c5eaf, a73d55e, c84b87a. Deleted client_example.py, skills/, skills.zip. Committed popup UI, offscreen page, bridge alternative, package files, README, team docs, .claude commands. Repo is clean.
- **[P0-001] Fix unstable WebSocket connection** — commit 1d27054. Fixed 5 root causes: concurrent reconnect timers, no CONNECTING guard, stale socket ref post-await, MV3 SW suspension (chrome.alarms keepalive), pending requests not cleared on disconnect.

---

**Notes**:
- PO owns this file — update directly when Boss provides feedback
- Auto-add Boss feedback to appropriate priority level
- Move items to "Done" after Boss accepts work

**Last Updated**: N/A by PO
