# Installation Guide

This guide sets up **Chrome Tab Group Controller** — a local bridge that lets Claude control your Chrome tab groups via natural language.

## Prerequisites

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **Google Chrome** (or Chromium)
- **Claude Desktop** (primary) or Claude Code CLI (alternative)

---

## Step 1: Get the Repository

```bash
git clone https://github.com/dat/chrome-tabgroup-controller.git
cd chrome-tabgroup-controller
```

Or download and extract the ZIP from GitHub.

---

## Step 2: Install Dependencies

```bash
cd native-host
npm install
```

No build step required — this is pure JavaScript.

---

## Step 3: Load the Chrome Extension

The Chrome extension is the bridge between Claude and your tabs.

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repository

**What to expect:**
- A "Tab Group Controller" icon appears in your Chrome toolbar
- Click it — the popup shows either **Connected** (green dot) or **Connecting...** (red dot)
- The dot turns green once the MCP server is running and the extension has linked up

> The extension auto-connects to `ws://localhost:9876` at startup and retries every 3 seconds. It will show "Connected" as soon as the MCP server is started in the next step.

---

## Step 4: Configure Claude Desktop (chat app)

This is the primary integration. Claude Desktop (claude.ai chat app) communicates with the MCP server over stdio — no manual server startup needed.

### 4.1 Edit the Claude Desktop config

Open (or create) this file:

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Add the `mcpServers` block. If the file already has content, merge the `chrome-tabs` entry into the existing `mcpServers` object:

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

Replace `/absolute/path/to/chrome-tabgroup-controller` with the actual path. To get it:

```bash
cd chrome-tabgroup-controller && pwd
```

**Example** (if cloned to your home directory):

```json
{
  "mcpServers": {
    "chrome-tabs": {
      "command": "node",
      "args": ["/Users/yourname/chrome-tabgroup-controller/native-host/mcp-server.js"]
    }
  }
}
```

### 4.2 Restart Claude Desktop

Quit Claude Desktop fully (`Cmd+Q`) and reopen it. The MCP server starts automatically when Claude Desktop launches.

### 4.3 Verify it's working

1. Open a new conversation in Claude Desktop
2. Look for the **tool icon** (hammer/wrench) in the input area — this confirms MCP tools loaded
3. Try asking Claude: *"Take a snapshot of my current tab groups"*
4. Claude will call `tab_snapshot` and return your current tabs and groups

**Available MCP tools (15):**

| Tool | What it does |
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

## Step 5: Claude Code CLI (Alternative)

> **Claude Desktop vs Claude Code CLI:** Claude Desktop requires the manual `mcpServers` config in Step 4. Claude Code CLI users can skip Step 4 entirely — the plugin handles MCP configuration automatically.

This repo is a Claude Code plugin (`.claude-plugin/plugin.json`). Load it with:

```bash
claude --plugin-dir /path/to/chrome-tabgroup-controller
```

The plugin's `.mcp.json` auto-starts the MCP server when the session begins — **no edits to any config file needed**. All 15 MCP tools are available immediately.

You also get 4 tab grouping skills as namespaced slash commands:

| Slash command | Description |
|---------------|-------------|
| `/chrome-tabgroup-controller:tab-group-by-intent` | Groups by inferred user goal (two-pass clustering) |
| `/chrome-tabgroup-controller:tab-group-by-context` | Groups relative to your current work context |
| `/chrome-tabgroup-controller:tab-group-with-priority` | Groups with active/background/archive tiers |
| `/chrome-tabgroup-controller:tab-group-by-domain` | Graph-based domain similarity clustering |

> Skills (slash commands) are only available in Claude Code CLI — not in Claude Desktop (chat app).

---

## Step 6: Install Skills Manually (Claude Code Desktop / CLI)

An alternative to `--plugin-dir`: copy the skills to `~/.claude/skills/` and they become available as personal skills in **all** Claude Code sessions — no plugin flag needed each time.

```bash
# Run from the repo root
cp -r skills/* ~/.claude/skills/
```

Or install individually:

```bash
mkdir -p ~/.claude/skills
cp -r skills/tab-group-by-intent ~/.claude/skills/
cp -r skills/tab-group-by-context ~/.claude/skills/
cp -r skills/tab-group-by-domain ~/.claude/skills/
cp -r skills/tab-group-with-priority ~/.claude/skills/
```

Skills are available immediately in any Claude Code session as:

```
/tab-group-by-intent
/tab-group-by-context [your role and current work context]
/tab-group-by-domain
/tab-group-with-priority
```

**No namespace prefix** — unlike the plugin (`/chrome-tabgroup-controller:tab-group-by-intent`), personal skills use just the skill name.

> **Important:** Manual skill install does NOT auto-start the MCP server. The skills call `tab_snapshot`, `tab_group_create`, etc. — those tools must be available. You still need either:
> - The Claude Desktop `mcpServers` config from Step 4, or
> - A `mcpServers` entry in your Claude Code `~/.claude/settings.json`
>
> The `--plugin-dir` approach (Step 5) is the only option that handles MCP server config automatically via `.mcp.json`.

> Skills work in Claude Code (Desktop Code tab and CLI). They do **not** work in Claude Desktop (chat app).

---

## Troubleshooting

### Extension icon shows "Connecting..." / red dot

The extension cannot reach the MCP server on port 9876.

- **Claude Desktop**: Make sure you restarted Claude Desktop after editing the config. The MCP server starts with Claude Desktop, not separately.
- **Claude Code**: The MCP server starts automatically when the session begins.
- Check for a config typo: the path in `args` must be absolute and point to `mcp-server.js`.

### MCP tools missing from Claude Desktop

The tool icon doesn't appear or Claude says it has no tools.

1. Confirm the config file path is exactly: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Validate the JSON is well-formed (no trailing commas, correct brackets)
3. Check the `args` path is absolute — relative paths do not work
4. Quit Claude Desktop fully (`Cmd+Q`), then reopen
5. Check Claude Desktop logs: `~/Library/Logs/Claude/`

### Port 9876 already in use

If you see `EADDRINUSE` in logs, a stale server process is holding the port.

```bash
# Find the process
lsof -i :9876

# Kill it (replace PID with the actual number)
kill <PID>
```

Then restart Claude Desktop.

### "Extension not connected" when calling MCP tools

The MCP server is running but the Chrome extension hasn't linked up yet.

1. Click the extension icon in Chrome — check the connection status
2. If it shows "Connecting...", wait a few seconds for auto-reconnect (retries every 3s)
3. If still disconnected: go to `chrome://extensions`, find "Tab Group Controller", and click **Reload**
4. Do not run `node server.js` separately — the MCP server (`mcp-server.js`) starts the WebSocket server internally. Running both causes a port conflict.
