# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Programmatically control Chrome tab groups via a local WebSocket bridge. Architecture:

```
Claude Code / Claude Chat Desktop
      ↓ (MCP stdio)
native-host/mcp-server.js  (MCP + WebSocket server)
      ↓ (WebSocket, port 9876)
Chrome Extension (extension/background.js)
      ↓
chrome.tabGroups API
```

## Setup & Running

```bash
# Install dependencies
cd native-host && npm install

# Start the WebSocket server
npm start                    # default port 9876
node server.js --port=9999   # custom port
```

The Chrome extension must be loaded separately via `chrome://extensions` in Developer mode (load unpacked from `extension/`).

## Using the API from Node.js

```js
const { TabGroups } = require('./native-host/server');

await TabGroups.snapshot();                                  // all groups + tabs
await TabGroups.create({ title: 'Work', color: 'blue', urls: ['https://...'] });
await TabGroups.list();
await TabGroups.collapse(groupId);
await TabGroups.update(groupId, { title: 'New Name', color: 'red' });
await TabGroups.dissolve(groupId);                          // ungroup tabs
await TabGroups.addTabsToGroup([tabId1, tabId2], groupId);
await TabGroups.closeTabs([tabId]);
await TabGroups.activateTab(tabId);
```

## Architecture notes

- **`extension/background.js`** — Service worker (Manifest v3). Connects to the local WebSocket server at startup, auto-reconnects every 3s. Handles 14 commands by calling `chrome.tabGroups`/`chrome.tabs` APIs and returning results as JSON.
- **`native-host/server.js`** — WebSocket server on port 9876. Bridges external clients to the Chrome extension. Tracks request/response pairs by message ID with 10s timeout. Also exports the `TabGroups` convenience API. Can be required as a module or run as interactive REPL.
- **`native-host/mcp-server.js`** — MCP server (stdio) that imports `server.js` to start the WebSocket server and wraps the `TabGroups` API as 15 MCP tools. Redirects console.log to stderr since MCP owns stdout.
- **`native-host/bridge.js`** — Alternative implementation where extension connects to `/extension` path and clients to `/`. Not the primary entrypoint.
- **`extension/popup.html/js`** — Status indicator UI (connection state + snapshot button).

## Sending raw commands

Commands sent over WebSocket follow the pattern `{ id, cmd, params }`. The extension sends back `{ id, data }` or `{ id, error }`. All 14 supported commands are listed in `extension/background.js` in the `handlers` object.

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

**Configuration** is in `.claude/settings.json` (project-level) for Claude Code. For Claude Chat Desktop, add the same `mcpServers` entry to `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Important:** The MCP server starts the WebSocket server internally — do not run `server.js` separately when using the MCP server. If port 9876 is already occupied by a standalone `server.js` process, `mcp-server.js` will fail to bind the port and MCP tool calls will return "Extension not connected". Kill any pre-existing `node server.js` process before starting a Claude Code session.

## Verifying MCP is live

A `SessionStart` hook (`.claude/hooks/check_mcp_bridge.js`) automatically checks port 9876 at session start and injects the result into context.

**Manual check:**
```bash
node .claude/hooks/check_mcp_bridge.js
# ✅ MCP STATUS: BRIDGE UP  →  tools are available
# ⚠️  MCP STATUS: BRIDGE OFFLINE  →  restart Claude Code session
```

**If tools are missing from the session:**
1. Check for a stale server: `lsof -i :9876`
2. Kill it if found: `kill <PID>`
3. Restart the Claude Code session (MCP server auto-starts via settings.json)

## No build step

Pure JavaScript — no transpilation, bundling, or compilation. Dependencies: `ws` (WebSocket) and `@modelcontextprotocol/sdk` (MCP).
