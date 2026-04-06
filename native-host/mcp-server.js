/**
 * MCP Server for Chrome Tab Group Controller
 *
 * Combined MCP (stdio) + WebSocket server in a single process.
 * Exposes chrome.tabGroups operations as MCP tools for Claude Code / Claude Chat Desktop.
 *
 * Usage:
 *   node mcp-server.js
 *
 * Configure in Claude Code (.claude/settings.json) or Claude Desktop (claude_desktop_config.json):
 *   { "mcpServers": { "chrome-tabs": { "command": "node", "args": ["path/to/mcp-server.js"] } } }
 */

// MCP owns stdout for JSON-RPC — redirect all console.log to stderr
const _origLog = console.log;
console.log = (...args) => console.error(...args);

// Start WebSocket server + get TabGroups API
const { TabGroups, shutdown } = require('./server');

// Ensure WebSocket server is closed when Claude Desktop quits.
// The MCP SDK's StdioServerTransport registers its own signal handlers which
// override Node's default SIGTERM exit, leaving port 9876 bound. These handlers
// run shutdown() first, then force exit.
process.on('SIGTERM', () => { shutdown(); process.exit(0); });
process.on('SIGINT',  () => { shutdown(); process.exit(0); });

async function main() {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { z } = await import('zod');

  const server = new McpServer({
    name: 'chrome-tab-groups',
    version: '1.0.0',
  });

  const COLOR_ENUM = z.enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']);

  // Helper: wrap a TabGroups call into an MCP tool handler
  function handler(fn) {
    return async (args) => {
      try {
        const result = await fn(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    };
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────

  server.registerTool('tab_snapshot', {
    description: 'Get a full snapshot of all tab groups and ungrouped tabs across all windows',
  }, handler(() => TabGroups.snapshot()));

  // ── Group operations ───────────────────────────────────────────────────────

  server.registerTool('tab_groups_list', {
    description: 'List tab groups, optionally filtered by window, color, title, or collapsed state',
    inputSchema: {
      windowId: z.number().int().optional().describe('Filter by window ID'),
      collapsed: z.boolean().optional().describe('Filter by collapsed state'),
      color: COLOR_ENUM.optional().describe('Filter by color'),
      title: z.string().optional().describe('Filter by title (exact match)'),
    },
  }, handler((args) => TabGroups.list(args)));

  server.registerTool('tab_group_get', {
    description: 'Get details of a single tab group by ID',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
    },
  }, handler((args) => TabGroups.get(args.groupId)));

  server.registerTool('tab_group_create', {
    description: 'Create a new tab group from URLs or existing tab IDs',
    inputSchema: {
      title: z.string().optional().describe('Group title'),
      color: COLOR_ENUM.optional().describe('Group color'),
      urls: z.array(z.string()).optional().describe('URLs to open as new tabs in the group'),
      tabIds: z.array(z.number().int()).optional().describe('Existing tab IDs to add to the group'),
      collapsed: z.boolean().optional().describe('Start collapsed'),
    },
  }, handler((args) => TabGroups.create(args)));

  server.registerTool('tab_group_update', {
    description: 'Update a tab group\'s title, color, or collapsed state',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
      title: z.string().optional().describe('New title'),
      color: COLOR_ENUM.optional().describe('New color'),
      collapsed: z.boolean().optional().describe('Collapsed state'),
    },
  }, handler((args) => {
    const { groupId, ...options } = args;
    return TabGroups.update(groupId, options);
  }));

  server.registerTool('tab_group_collapse', {
    description: 'Collapse a tab group',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
    },
  }, handler((args) => TabGroups.collapse(args.groupId)));

  server.registerTool('tab_group_expand', {
    description: 'Expand a tab group',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
    },
  }, handler((args) => TabGroups.expand(args.groupId)));

  server.registerTool('tab_group_dissolve', {
    description: 'Dissolve a tab group (ungroup all its tabs, but keep the tabs open)',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
    },
  }, handler((args) => TabGroups.dissolve(args.groupId)));

  server.registerTool('tab_group_move', {
    description: 'Move a tab group to a position on the tab bar',
    inputSchema: {
      groupId: z.number().int().describe('Tab group ID'),
      index: z.number().int().describe('Position on the tab bar (-1 for end)'),
      windowId: z.number().int().optional().describe('Target window ID'),
    },
  }, handler((args) => TabGroups.move(args.groupId, args.index, args.windowId)));

  // ── Tab operations ─────────────────────────────────────────────────────────

  server.registerTool('tabs_list', {
    description: 'List tabs, optionally filtered by group, URL, active state, or window',
    inputSchema: {
      groupId: z.number().int().optional().describe('Filter by group ID'),
      url: z.string().optional().describe('URL pattern to match'),
      active: z.boolean().optional().describe('Filter by active state'),
      windowId: z.number().int().optional().describe('Filter by window ID'),
    },
  }, handler((args) => TabGroups.tabs(args)));

  server.registerTool('tabs_add_to_group', {
    description: 'Add existing tabs to a tab group',
    inputSchema: {
      tabIds: z.array(z.number().int()).describe('Tab IDs to add'),
      groupId: z.number().int().describe('Target group ID'),
    },
  }, handler((args) => TabGroups.addTabsToGroup(args.tabIds, args.groupId)));

  server.registerTool('tabs_remove_from_group', {
    description: 'Remove tabs from their group (ungroup them)',
    inputSchema: {
      tabIds: z.array(z.number().int()).describe('Tab IDs to ungroup'),
    },
  }, handler((args) => TabGroups.ungroupTabs(args.tabIds)));

  server.registerTool('tab_open', {
    description: 'Open a new tab with a URL',
    inputSchema: {
      url: z.string().describe('URL to open'),
      active: z.boolean().optional().describe('Whether to focus the tab (default: true)'),
    },
  }, handler((args) => TabGroups.openTab(args.url, args.active)));

  server.registerTool('tabs_close', {
    description: 'Close one or more tabs by ID',
    inputSchema: {
      tabIds: z.array(z.number().int()).describe('Tab IDs to close'),
    },
  }, handler((args) => TabGroups.closeTabs(args.tabIds)));

  server.registerTool('tab_activate', {
    description: 'Focus/activate a tab by ID',
    inputSchema: {
      tabId: z.number().int().describe('Tab ID to activate'),
    },
  }, handler((args) => TabGroups.activateTab(args.tabId)));

  // ── Prompt templates ──────────────────────────────────────────────────────

  function userMsg(text) {
    return { messages: [{ role: 'user', content: { type: 'text', text } }] };
  }

  server.registerPrompt('group_by_intent', {
    description: 'Intent-based tab clustering — two-pass: infer user goals first, then name groups from content',
  }, () => userMsg(
    `Call the tab_snapshot tool to get all current tabs, then organise them into groups using intent-based clustering.\n\n` +
    `Pass 1 — Clustering: For each tab, infer what the user was trying to accomplish (not what the content is about). ` +
    `Look at the URL, title, and domain together. Assign each tab to a task cluster ` +
    `(e.g. "🗺️ Vietnam Trip", "🐛 RabbitMQ Debug", "💼 Backend Jobs").\n\n` +
    `Pass 2 — Naming: Review each cluster's actual content and write a concise group name that starts with a relevant emoji ` +
    `followed by 2–4 words capturing the user's goal, not the content type. Choose a fitting color from: grey, blue, red, yellow, green, pink, purple, cyan.\n\n` +
    `Execution: For each group call tab_group_create with title, color, and tabIds. ` +
    `Collect any remaining tabs that don't fit a clear intent cluster into an "Archive" group (grey color). ` +
    `Every tab must end up in a group — none left ungrouped.`
  ));

  server.registerPrompt('group_by_context', {
    description: 'Context-aware grouping — takes a user_context string describing role/project and maps tabs to actual work',
    argsSchema: {
      user_context: z.string().describe(
        'Brief description of who you are and what you\'re working on (e.g. "engineer working on a fintech app, sprint planning")'
      ),
    },
  }, ({ user_context }) => userMsg(
    `User context: ${user_context}\n\n` +
    `Call the tab_snapshot tool to get all current tabs. Using the context above, organise tabs into groups that reflect the user's actual work.\n\n` +
    `Map each tab to the user's real tasks, projects, or concerns described in the context. ` +
    `Avoid generic categories like "Social Media" or "Documentation" — group by what matters to this specific user right now. ` +
    `Use group names that match vocabulary from the user's own context description. Each group name must start with a relevant emoji.\n\n` +
    `For each group: call tab_group_create with title, color, and tabIds. ` +
    `Collect any tabs that don't map to the user's stated context into a "🗃️ Archive" group (grey). ` +
    `Every tab must end up in a group — none left ungrouped.`
  ));

  server.registerPrompt('group_with_priority', {
    description: 'Priority-aware grouping — assigns each group a priority (active/background/archive) and suggested action (keep/close/bookmark)',
  }, () => userMsg(
    `Call the tab_snapshot tool to get all current tabs, then organise them into groups with priority and suggested actions.\n\n` +
    `For each group determine:\n` +
    `  - group_name: concise label starting with a relevant emoji, then 2–4 words\n` +
    `  - color: fitting color from: grey, blue, red, yellow, green, pink, purple, cyan\n` +
    `  - tabs: list of tab IDs\n` +
    `  - priority: "active" (currently in use), "background" (reference / return later), or "archive" (stale / done)\n` +
    `  - suggested_action: "keep" (actively useful), "close" (done or duplicate), or "bookmark" (save for later, then close)\n\n` +
    `First output a structured summary of all groups with your reasoning for each priority and action. ` +
    `Then execute: call tab_group_create for all groups including "archive". ` +
    `Always create an "Archive" group (grey) for stale/done tabs. Every tab must end up in a group — none left ungrouped.`
  ));

  server.registerPrompt('group_by_domain_graph', {
    description: 'Graph-based clustering — builds a tab similarity graph from domain/URL signals and groups by community',
  }, () => userMsg(
    `Call the tab_snapshot tool to get all current tabs, then cluster them using a graph-based similarity approach.\n\n` +
    `Step 1 — Build similarity graph: each tab is a node. Draw edges between tabs that share two or more signals: ` +
    `same domain, same subdomain, overlapping URL path prefix, or related keywords in titles. ` +
    `Weight edges by number of shared signals.\n\n` +
    `Step 2 — Find communities: identify clusters of tabs that are densely connected (multiple shared signals). ` +
    `Isolated nodes with no strong similarity to others can remain ungrouped.\n\n` +
    `Step 3 — Name each community from its dominant signal ` +
    `(e.g. "🐙 myrepo — PR review", "💳 Stripe Integration"). Each group name must start with a relevant emoji. ` +
    `Choose a fitting color from: grey, blue, red, yellow, green, pink, purple, cyan.\n\n` +
    `Execution: call tab_group_create for each community with title, color, and tabIds. ` +
    `Collect any truly isolated tabs with no cluster fit into a "🗂️ Miscellaneous" group (grey). ` +
    `Every tab must end up in a group — none left ungrouped.`
  ));

  // ── Start MCP transport ────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server ready (chrome-tab-groups)');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
