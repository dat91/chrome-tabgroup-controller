# Product Backlog

**Owner**: PO
**Purpose**: Prioritized list of all work items for chrome-tabgroup-controller

---

## P0 - Critical (System Broken, Unusable)

(None)

---

## P1 - Major (Next Tasks)

- **[P1-001] Repository cleanup** — Audit all untracked files (git status), remove truly unused ones, add appropriate files to .gitignore, commit remaining needed files. See git status for full list of untracked items.

---

## P2 - Nice to Have (When Time Allows)

(None)

---

## P3 - Future Ideas (Low Priority)

(None)

---

## Done

- **[P0-001] Fix unstable WebSocket connection** — commit 1d27054. Fixed 5 root causes: concurrent reconnect timers, no CONNECTING guard, stale socket ref post-await, MV3 SW suspension (chrome.alarms keepalive), pending requests not cleared on disconnect.

---

**Notes**:
- PO owns this file — update directly when Boss provides feedback
- Auto-add Boss feedback to appropriate priority level
- Move items to "Done" after Boss accepts work

**Last Updated**: N/A by PO
