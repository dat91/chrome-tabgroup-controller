# Chrome Tab Group Controller

Let Claude control your Chrome tab groups. Organize, rename, collapse, and manage tabs through natural language via a local MCP bridge.

## Architecture

```
Claude Desktop / Claude Code CLI
          ↓  (MCP stdio)
native-host/mcp-server.js   ← MCP server + WebSocket server
          ↓  (WebSocket, port 9876)
Chrome Extension (background.js)
          ↓
chrome.tabGroups API
```

The MCP server starts automatically when Claude Desktop or Claude Code launches — no manual server management needed.

---

## Quick Start

See **[docs/INSTALL.md](docs/INSTALL.md)** for the full step-by-step guide. The short version:

1. Load the Chrome extension (unpacked) from `extension/` via `chrome://extensions`
2. Connect your Claude client (pick one below)

---

## Claude Desktop (chat app)

The primary integration. Add the MCP server to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chrome-tabs": {
      "command": "node",
      "args": ["/absolute/path/to/chrome-tabgroup-controller/native-host/mcp-server.js"]
    }
  }
}
```

Restart Claude Desktop — all 15 MCP tools are available immediately.

---

## Claude Code CLI

This repo is a Claude Code plugin (`.claude-plugin/plugin.json`). Load it with:

```bash
claude --plugin-dir /path/to/chrome-tabgroup-controller
```

The plugin's `.mcp.json` auto-starts the MCP server — **no manual config needed**. All 15 MCP tools are available immediately, plus 4 tab grouping skills as slash commands.

---

## MCP Tools

15 tools available in Claude Desktop and Claude Code:

| Tool | Description |
|------|-------------|
| `tab_snapshot` | Full snapshot of all groups and ungrouped tabs |
| `tab_groups_list` | List groups with optional filters |
| `tab_group_get` | Get a single group by ID |
| `tab_group_create` | Create a new group with tabs |
| `tab_group_update` | Rename or recolor a group |
| `tab_group_collapse` | Collapse a group |
| `tab_group_expand` | Expand a group |
| `tab_group_dissolve` | Ungroup all tabs in a group |
| `tab_group_move` | Move a group to a different position |
| `tabs_list` | List tabs with optional filters |
| `tabs_add_to_group` | Move tabs into an existing group |
| `tabs_remove_from_group` | Remove tabs from their group |
| `tab_open` | Open a new tab |
| `tabs_close` | Close one or more tabs |
| `tab_activate` | Focus a specific tab |

---

## Skills (Claude Code CLI only)

4 tab grouping strategies available as slash commands when loaded as a plugin:

| Skill | Command | Description |
|-------|---------|-------------|
| By Intent | `/chrome-tabgroup-controller:tab-group-by-intent` | Groups by inferred user goal (two-pass clustering) |
| By Context | `/chrome-tabgroup-controller:tab-group-by-context` | Groups relative to your current work context |
| With Priority | `/chrome-tabgroup-controller:tab-group-with-priority` | Groups with active/background/archive tiers |
| By Domain | `/chrome-tabgroup-controller:tab-group-by-domain` | Graph-based domain similarity clustering |

> Skills are only available in Claude Code CLI — not in Claude Desktop (chat app).

---

## Advanced: Node.js API

You can also use `server.js` directly as a module in your own scripts:

```javascript
const { TabGroups } = require('./native-host/server');

// Create a group from URLs
const group = await TabGroups.create({
  title: 'Research',
  color: 'blue',
  urls: [
    'https://github.com',
    'https://stackoverflow.com',
  ]
});

// Collapse everything else
const groups = await TabGroups.list();
for (const g of groups) {
  if (g.title !== 'Research') await TabGroups.collapse(g.id);
}
```

### API Reference

```js
await TabGroups.snapshot()                                    // all groups + tabs
await TabGroups.list(filter?)                                 // filter by windowId, color, title, collapsed
await TabGroups.create({ title, color, urls?, tabIds?, collapsed? })
await TabGroups.update(groupId, { title?, color?, collapsed? })
await TabGroups.collapse(groupId)
await TabGroups.expand(groupId)
await TabGroups.dissolve(groupId)                            // ungroup tabs
await TabGroups.move(groupId, index, windowId?)
await TabGroups.tabs(filter?)                                // filter by groupId, url, active, windowId
await TabGroups.addTabsToGroup(tabIds, groupId)
await TabGroups.ungroupTabs(tabIds)
await TabGroups.openTab(url, active?)
await TabGroups.closeTabs(tabIds)
await TabGroups.activateTab(tabId)
```

Colors: `grey | blue | red | yellow | green | pink | purple | cyan`

> **Note:** When using the Node.js API directly, start `server.js` separately. Do not run it alongside the MCP server — both bind port 9876 and will conflict.
