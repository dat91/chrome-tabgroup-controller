// Tab Group Controller - Background Service Worker
// Connects to local WebSocket server and exposes chrome.tabGroups API

const WS_URL = 'ws://localhost:9876';
let ws = null;
let reconnectTimer = null;

function connect() {
  // Don't spawn a new socket if one is already open or connecting
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[TabGroupController] Connected to WebSocket server');
      sendResponse({ event: 'connected', version: chrome.runtime.getManifest().version });
    };

    ws.onmessage = async (event) => {
      // Capture socket ref now — ws may be reassigned by the time handleCommand resolves
      const socket = ws;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ id: null, error: 'Invalid JSON' }));
        }
        return;
      }
      const result = await handleCommand(msg);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ id: msg.id, ...result }));
      }
    };

    ws.onclose = () => {
      console.log('[TabGroupController] Disconnected. Reconnecting in 3s...');
      ws = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[TabGroupController] WebSocket error:', err);
      // onclose fires after onerror and handles reconnect
    };
  } catch (e) {
    console.error('[TabGroupController] Connection error:', e);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  }
}

function sendResponse(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

async function handleCommand({ cmd, params = {} }) {
  try {
    switch (cmd) {

      // ── TAB GROUPS ──────────────────────────────────────────────────────────

      case 'groups.list': {
        const groups = await chrome.tabGroups.query(params);
        return { data: groups };
      }

      case 'groups.get': {
        const group = await chrome.tabGroups.get(params.groupId);
        return { data: group };
      }

      case 'groups.update': {
        const group = await chrome.tabGroups.update(params.groupId, params.options);
        return { data: group };
      }

      case 'groups.move': {
        const group = await chrome.tabGroups.move(params.groupId, params.moveProps);
        return { data: group };
      }

      case 'groups.create': {
        // Create tabs if URLs provided, then group them
        let tabIds = params.tabIds || [];
        if (params.urls && params.urls.length > 0) {
          const createdTabs = await Promise.all(
            params.urls.map(url => chrome.tabs.create({ url, active: false }))
          );
          tabIds = [...tabIds, ...createdTabs.map(t => t.id)];
        }
        const groupId = await chrome.tabs.group({ tabIds });
        const group = await chrome.tabGroups.update(groupId, {
          title: params.title || '',
          color: params.color || 'grey',
          collapsed: params.collapsed || false
        });
        return { data: group };
      }

      case 'groups.collapse': {
        const group = await chrome.tabGroups.update(params.groupId, { collapsed: true });
        return { data: group };
      }

      case 'groups.expand': {
        const group = await chrome.tabGroups.update(params.groupId, { collapsed: false });
        return { data: group };
      }

      case 'groups.dissolve': {
        // Ungroup all tabs in a group
        const tabs = await chrome.tabs.query({ groupId: params.groupId });
        await chrome.tabs.ungroup(tabs.map(t => t.id));
        return { data: { dissolved: true, tabCount: tabs.length } };
      }

      // ── TABS ─────────────────────────────────────────────────────────────────

      case 'tabs.list': {
        const tabs = await chrome.tabs.query(params);
        return { data: tabs };
      }

      case 'tabs.addToGroup': {
        const groupId = await chrome.tabs.group({
          tabIds: params.tabIds,
          groupId: params.groupId
        });
        return { data: { groupId } };
      }

      case 'tabs.removeFromGroup': {
        await chrome.tabs.ungroup(params.tabIds);
        return { data: { ungrouped: true } };
      }

      case 'tabs.create': {
        const tab = await chrome.tabs.create(params);
        return { data: tab };
      }

      case 'tabs.close': {
        await chrome.tabs.remove(params.tabIds);
        return { data: { closed: true } };
      }

      case 'tabs.activate': {
        const tab = await chrome.tabs.update(params.tabId, { active: true });
        return { data: tab };
      }

      // ── SNAPSHOT ─────────────────────────────────────────────────────────────

      case 'snapshot': {
        const [tabs, groups] = await Promise.all([
          chrome.tabs.query({}),
          chrome.tabGroups.query({})
        ]);
        // Attach tabs to their groups
        const groupMap = {};
        for (const g of groups) {
          groupMap[g.id] = { ...g, tabs: [] };
        }
        const ungrouped = [];
        for (const t of tabs) {
          const entry = { id: t.id, title: t.title, url: t.url, active: t.active };
          if (t.groupId && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            if (groupMap[t.groupId]) groupMap[t.groupId].tabs.push(entry);
          } else {
            ungrouped.push(entry);
          }
        }
        return { data: { groups: Object.values(groupMap), ungrouped } };
      }

      default:
        return { error: `Unknown command: ${cmd}` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

// ── SERVICE WORKER KEEPALIVE (MV3) ───────────────────────────────────────────
// Chrome suspends idle MV3 service workers, clearing all setTimeout timers.
// chrome.alarms wakes the SW periodically so it can reconnect if needed.

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('ws-keepalive', { periodInMinutes: 1 });
  connect();
});

chrome.runtime.onStartup.addListener(() => {
  connect();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ws-keepalive') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect();
    }
  }
});

// Start connection
connect();
