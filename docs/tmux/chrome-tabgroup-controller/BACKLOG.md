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

- **[P1-008] Add skill-creator + product-selfknowledge to .claude/skills/** — local only (gitignored, no commit). skill-creator from official marketplace, product-selfknowledge created fresh.
- **[P1-007] Add manual skill install guide** — commit 3d72733. Step 6 in INSTALL.md: cp skills to ~/.claude/skills/, no-namespace slash commands, MCP still needed separately, Claude Code only.
- **[P1-006] Fix 4 skills to follow best practices** — commit 329b1f7. All 4 skills: disable-model-invocation:true, descriptions <250 chars, allowed-tools. tab-group-by-context: $ARGUMENTS + argument-hint.
- **[P1-005] Fix docs: client terminology and hierarchy** — commit 5235c1d. Two clients only: Claude Desktop (primary, chat app) + Claude Code CLI (secondary). Removed Claude Code Desktop GUI section. Skills correctly scoped to CLI only.
- **[P1-004] Fix port 9876 not released on quit** — commit c773ab4. Added shutdown() to server.js (wss.close() + socket terminate), registered SIGTERM/SIGINT handlers in mcp-server.js. Verified port released after SIGTERM.
- **[P1-003] Write installation guide** — commit 58b85be. docs/INSTALL.md (191 lines): Chrome extension setup, Claude Desktop MCP config (primary), Claude Code CLI plugin (secondary), troubleshooting.
- **[P1-002] Convert project to Claude Code plugin** — commit f83f881. Created .claude-plugin/plugin.json, .mcp.json, commands/, hooks/hooks.json + hook scripts. Skills already at root. Load with: claude --plugin-dir .
- **[P1-001] Repository cleanup** — commits 59c5eaf, a73d55e, c84b87a. Deleted client_example.py, skills/, skills.zip. Committed popup UI, offscreen page, bridge alternative, package files, README, team docs, .claude commands. Repo is clean.
- **[P0-001] Fix unstable WebSocket connection** — commit 1d27054. Fixed 5 root causes: concurrent reconnect timers, no CONNECTING guard, stale socket ref post-await, MV3 SW suspension (chrome.alarms keepalive), pending requests not cleared on disconnect.

---

**Notes**:
- PO owns this file — update directly when Boss provides feedback
- Auto-add Boss feedback to appropriate priority level
- Move items to "Done" after Boss accepts work

**Last Updated**: N/A by PO
