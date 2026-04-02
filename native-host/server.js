/**
 * Tab Group Controller - WebSocket Server
 * Acts as a bridge between external scripts/Claude and the Chrome extension.
 *
 * Usage:
 *   node server.js
 *   node server.js --port 9876
 */

const { WebSocketServer } = require('ws');
const readline = require('readline');

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '9876');

const wss = new WebSocketServer({ port: PORT });
let extensionSocket = null;

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️  Port ${PORT} already in use. Kill the existing server.js process first.`);
    console.error('   MCP tools will still be registered but tool calls will fail until port is free.');
  } else {
    console.error('WebSocket server error:', err.message);
  }
});
let pendingRequests = new Map(); // id -> { resolve, reject, timeout }
let msgId = 0;

console.log(`\n🚀 Tab Group Controller WebSocket Server`);
console.log(`   Listening on ws://localhost:${PORT}`);
console.log(`   Waiting for Chrome extension to connect...\n`);

wss.on('connection', (socket) => {
  console.log('🔌 Client connected');
  extensionSocket = socket;

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.event === 'connected') {
      console.log(`✅ Chrome extension connected (v${msg.version ?? 'unknown'})\n`);
      return;
    }

    // Resolve pending request
    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      const { resolve, reject, timeout } = pendingRequests.get(msg.id);
      clearTimeout(timeout);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.data);
    }
  });

  socket.on('close', () => {
    if (extensionSocket !== socket) return; // stale socket — ignore
    console.log('🔴 Extension disconnected');
    extensionSocket = null;
    // Fail pending requests immediately rather than waiting for the 10s timeout
    for (const [id, { reject, timeout }] of pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('Extension disconnected'));
    }
    pendingRequests.clear();
  });
});

/**
 * Send a command to the Chrome extension and get a response.
 * @param {string} cmd  - Command name (e.g. 'groups.list', 'snapshot')
 * @param {object} params - Command parameters
 * @returns {Promise<any>}
 */
function send(cmd, params = {}) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket) return reject(new Error('Extension not connected'));
    const id = ++msgId;
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Timeout waiting for extension response'));
    }, 10000);
    pendingRequests.set(id, { resolve, reject, timeout });
    extensionSocket.send(JSON.stringify({ id, cmd, params }));
  });
}

// ── CONVENIENCE API ──────────────────────────────────────────────────────────

const TabGroups = {
  /** Get a full snapshot of all groups and ungrouped tabs */
  snapshot: () => send('snapshot'),

  /** List all tab groups (optionally filter by windowId, collapsed, etc.) */
  list: (filter = {}) => send('groups.list', filter),

  /** Get a single group by ID */
  get: (groupId) => send('groups.get', { groupId }),

  /** Update group properties (title, color, collapsed) */
  update: (groupId, options) => send('groups.update', { groupId, options }),

  /** Create a new named group from URLs or existing tab IDs */
  create: ({ title, color, urls, tabIds, collapsed } = {}) =>
    send('groups.create', { title, color, urls, tabIds, collapsed }),

  /** Collapse a group */
  collapse: (groupId) => send('groups.collapse', { groupId }),

  /** Expand a group */
  expand: (groupId) => send('groups.expand', { groupId }),

  /** Dissolve a group (ungroup all its tabs) */
  dissolve: (groupId) => send('groups.dissolve', { groupId }),

  /** Move a group to a position */
  move: (groupId, index, windowId) => send('groups.move', { groupId, moveProps: { index, windowId } }),

  // ── Tab helpers ────────────────────────────────────────────────────────────

  /** List all tabs (filter by url, groupId, active, etc.) */
  tabs: (filter = {}) => send('tabs.list', filter),

  /** Add tabs to an existing group */
  addTabsToGroup: (tabIds, groupId) => send('tabs.addToGroup', { tabIds, groupId }),

  /** Remove tabs from their group */
  ungroupTabs: (tabIds) => send('tabs.removeFromGroup', { tabIds }),

  /** Open a new tab */
  openTab: (url, active = true) => send('tabs.create', { url, active }),

  /** Close tabs by ID */
  closeTabs: (tabIds) => send('tabs.close', { tabIds: Array.isArray(tabIds) ? tabIds : [tabIds] }),

  /** Activate (focus) a tab */
  activateTab: (tabId) => send('tabs.activate', { tabId }),
};

// ── EXPORT for use as a module ───────────────────────────────────────────────
module.exports = { TabGroups, send };

// ── INTERACTIVE REPL (when run directly) ────────────────────────────────────
if (require.main === module) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Interactive REPL ready. Examples:');
  console.log('  await TabGroups.snapshot()');
  console.log('  await TabGroups.create({ title: "Work", color: "blue", urls: ["https://jira.example.com"] })');
  console.log('  await TabGroups.list()');
  console.log('  await TabGroups.collapse(groupId)\n');

  const { NodeVM } = (() => {
    try { return require('vm'); } catch { return require('vm'); }
  })();

  const vm = require('vm');
  const context = vm.createContext({ TabGroups, send, console, process });

  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) return;
    try {
      const result = await vm.runInContext(
        `(async () => { return ${line} })()`, context
      );
      console.log('→', JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('✗', e.message);
    }
  });
}
