# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Programmatically control Chrome tab groups via a local WebSocket bridge. Architecture:

```
Claude Code / Claude Chat Desktop
      ↓ (MCP stdio)
native-host/mcp-server.js  (MCP + WebSocket server, port 9876)
      ↓ (WebSocket)
extension/offscreen.js     (persistent WebSocket client, never suspended)
      ↓ (chrome.runtime.onMessage)
extension/background.js    (service worker, handles Chrome API calls)
      ↓
chrome.tabGroups / chrome.tabs APIs
```

**Why offscreen.js?** Manifest v3 service workers (background.js) can be suspended by Chrome. The offscreen document (`offscreen.js`) holds the WebSocket connection permanently; it never suspends. Background.js only handles brief chrome API calls forwarded from offscreen.

## Directory structure

```
chrome-tabgroup-controller/
├── extension/               # Chrome extension (Manifest v3)
│   ├── manifest.json
│   ├── background.js        # Service worker — handles 14 Chrome API commands
│   ├── offscreen.html       # Container for offscreen.js
│   ├── offscreen.js         # Persistent WebSocket client, auto-reconnects every 3s
│   ├── popup.html           # Status indicator UI
│   └── popup.js             # Connection state display + snapshot button
├── native-host/             # Node.js backend
│   ├── server.js            # WebSocket server + TabGroups API + interactive REPL
│   ├── mcp-server.js        # MCP stdio wrapper (15 tools + 4 prompts)
│   ├── bridge.js            # Alternative implementation (not primary, port 9999)
│   ├── example.js           # Demo script for TabGroups API
│   └── package.json         # ws + @modelcontextprotocol/sdk
├── skills/                  # Claude Code slash commands (4 grouping strategies)
│   ├── tab-group-by-intent/SKILL.md
│   ├── tab-group-by-context/SKILL.md
│   ├── tab-group-by-domain/SKILL.md
│   └── tab-group-with-priority/SKILL.md
├── hooks/                   # Claude Code session automation
│   ├── hooks.json           # SessionStart hook registration
│   ├── check_mcp_bridge.js  # Validates port 9876 at session start
│   └── session_start_team_docs.py  # Injects team workflow docs (tmux-based)
├── docs/
│   ├── INSTALL.md           # Setup & configuration guide
│   ├── testing-guide-p0-001.md  # WebSocket stability test suite
│   └── tmux/                # Team collaboration documentation
│       └── chrome-tabgroup-controller/
│           ├── workflow.md
│           ├── WHITEBOARD.md
│           ├── BACKLOG.md
│           └── prompts/     # PO_PROMPT.md + WORKER_PROMPT.md
├── commands/
│   └── init-role.md         # Team role initialization command
├── .claude-plugin/
│   └── plugin.json          # Claude Code plugin metadata
├── .mcp.json                # Auto-starts MCP server when loaded as plugin
└── README.md
```

## Setup & Running

```bash
# Install dependencies
cd native-host && npm install

# Start the WebSocket server (standalone, interactive REPL)
npm start                    # default port 9876
node server.js --port=9999   # custom port

# Start as MCP server (Claude Code / Claude Desktop)
npm run mcp                  # runs mcp-server.js
```

The Chrome extension must be loaded separately via `chrome://extensions` in Developer mode (load unpacked from `extension/`).

**Important:** When using the MCP server, do not run `server.js` separately. If port 9876 is already occupied by a standalone `server.js` process, `mcp-server.js` will fail to bind the port and all MCP tool calls will return "Extension not connected". Kill any pre-existing `node server.js` process before starting a Claude Code session.

## Using the API from Node.js

All 15 operations exposed by `TabGroups`:

```js
const { TabGroups } = require('./native-host/server');

// Read
await TabGroups.snapshot();                                  // all groups + ungrouped tabs
await TabGroups.list({ windowId?, color?, title?, collapsed? });  // filtered group list
await TabGroups.get(groupId);                                // single group
await TabGroups.tabs({ groupId?, url?, active?, windowId? }); // filtered tab list

// Create / Modify Groups
await TabGroups.create({ title, color, urls?, tabIds?, collapsed? });
await TabGroups.update(groupId, { title?, color?, collapsed? });
await TabGroups.collapse(groupId);
await TabGroups.expand(groupId);
await TabGroups.dissolve(groupId);                           // ungroup tabs, keep tabs open
await TabGroups.move(groupId, index, windowId?);

// Tab Operations
await TabGroups.addTabsToGroup([tabId1, tabId2], groupId);
await TabGroups.ungroupTabs([tabId1, tabId2]);               // remove from group
await TabGroups.openTab(url, active?);
await TabGroups.closeTabs([tabId]);
await TabGroups.activateTab(tabId);
```

**Valid colors:** `grey | blue | red | yellow | green | pink | purple | cyan`

## Architecture notes

- **`extension/offscreen.js`** — Persistent WebSocket client. Runs in an offscreen document (never suspended by Chrome). Connects to `ws://localhost:9876`, auto-reconnects every 3s. Relays commands from server to background.js and responses back.
- **`extension/background.js`** — Service worker (Manifest v3). Handles 14 chrome API commands forwarded from offscreen.js via `chrome.runtime.onMessage`. Only processes brief messages so suspension is not an issue.
- **`native-host/server.js`** — WebSocket server on port 9876. Tracks request/response pairs by message ID with 10s timeout. Exports the `TabGroups` convenience API. When run directly, starts an interactive REPL for manual testing.
- **`native-host/mcp-server.js`** — MCP server (stdio) that imports `server.js` to start the WebSocket server and wraps the `TabGroups` API as 15 MCP tools. Redirects `console.log` to stderr since MCP owns stdout. Registers SIGTERM/SIGINT handlers that call `shutdown()` to release port 9876 cleanly.
- **`native-host/bridge.js`** — Alternative implementation where extension connects to `/extension` path and clients to `/`. Runs on port 9999. Not the primary entrypoint — kept for reference.
- **`extension/popup.html/js`** — Status indicator UI (connection state + snapshot button).

## Sending raw commands

Commands sent over WebSocket: `{ id, cmd, params }`. The extension replies: `{ id, data }` or `{ id, error }`. All 14 supported commands are in `extension/background.js` in the `handlers` object.

## MCP Server (for Claude Code / Claude Chat Desktop)

`native-host/mcp-server.js` exposes all tab group operations as MCP tools. It combines the MCP server (stdio) and WebSocket server (port 9876) in a single process.

**15 MCP tools:** `tab_snapshot`, `tab_groups_list`, `tab_group_get`, `tab_group_create`, `tab_group_update`, `tab_group_collapse`, `tab_group_expand`, `tab_group_dissolve`, `tab_group_move`, `tabs_list`, `tabs_add_to_group`, `tabs_remove_from_group`, `tab_open`, `tabs_close`, `tab_activate`

**4 MCP prompt templates** (tab grouping strategies): available as slash commands in **Claude Code CLI only** — Claude Desktop does not support MCP prompts.

```
/mcp__chrome-tabs__group_by_intent        — intent-based clustering (two-pass)
/mcp__chrome-tabs__group_by_context       — context-aware (requires user_context arg)
/mcp__chrome-tabs__group_with_priority    — priority + suggested action per group
/mcp__chrome-tabs__group_by_domain_graph  — graph-based similarity clustering
```

**Configuration** for Claude Code is via `.mcp.json` (plugin mode) or `.claude/settings.json` (project-level, git-ignored). For Claude Desktop, add the same `mcpServers` entry to `~/Library/Application Support/Claude/claude_desktop_config.json`.

## Skills (Claude Code slash commands)

Four reusable grouping strategies in `skills/`, callable as `/tab-group-*`:

| Command | Description |
|---|---|
| `/tab-group-by-intent` | Two-pass: infer user goals, then name groups from content |
| `/tab-group-by-context [context]` | Context-aware grouping (e.g., "backend engineer on fintech sprint") |
| `/tab-group-with-priority` | Triage into active/background/archive tiers; prompts before closing |
| `/tab-group-by-domain` | Graph-based clustering from domain/URL similarity signals |

All skills use `tab_snapshot` to read current state and `tab_group_create` to apply grouping.

## Verifying MCP is live

A `SessionStart` hook (`hooks/check_mcp_bridge.js`) automatically checks port 9876 at session start and injects the result into context.

**Manual check:**
```bash
node hooks/check_mcp_bridge.js
# ✅ MCP STATUS: BRIDGE UP  →  tools are available
# ⚠️  MCP STATUS: BRIDGE OFFLINE  →  restart Claude Code session
```

**If tools are missing from the session:**
1. Check for a stale server: `lsof -i :9876`
2. Kill it if found: `kill <PID>`
3. Restart the Claude Code session (MCP server auto-starts via `.mcp.json`)

## SessionStart hooks

Two hooks run automatically at session start (`hooks/hooks.json`):

1. **`check_mcp_bridge.js`** (5s timeout) — Validates port 9876 reachability; reports BRIDGE UP or OFFLINE in session context.
2. **`session_start_team_docs.py`** (10s timeout) — Reads `$TMUX` environment for role assignment (via `@role_name` tmux option), then injects `docs/tmux/chrome-tabgroup-controller/workflow.md` + the corresponding role prompt (`PO_PROMPT.md` or `WORKER_PROMPT.md`) into session context. Only active in tmux sessions.

## No build step

Pure JavaScript — no transpilation, bundling, or compilation. Dependencies: `ws` (WebSocket) and `@modelcontextprotocol/sdk` (MCP). Run `npm install` in `native-host/` before first use.
