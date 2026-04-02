// Tab Group Controller - Background Service Worker
// Creates and maintains the offscreen document that holds the WebSocket connection.
// Handles chrome.tabGroups/tabs API calls on behalf of the offscreen document.

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  if (creatingOffscreen) return creatingOffscreen;
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (existing.length > 0) return;

  creatingOffscreen = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['BLOBS'],
    justification: 'Maintain persistent WebSocket connection to local bridge server',
  }).finally(() => { creatingOffscreen = null; });

  return creatingOffscreen;
}

chrome.runtime.onInstalled.addListener(() => ensureOffscreenDocument());
chrome.runtime.onStartup.addListener(() => ensureOffscreenDocument());

// Also ensure it exists when the service worker first loads (e.g. after reload/update)
ensureOffscreenDocument();

// Handle commands forwarded from the offscreen WebSocket document
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'ws-command') return;
  const { msg } = message;
  handleCommand(msg).then(result => {
    chrome.runtime.sendMessage({ type: 'ws-send', payload: { id: msg.id, ...result } });
  });
});

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
        const groupMap = {};
        for (const g of groups) {
          groupMap[g.id] = { ...g, tabs: [] };
        }
        const ungrouped = [];
        for (const t of tabs) {
          const entry = { id: t.id, title: t.title, url: t.url, active: t.active, lastAccessed: t.lastAccessed };
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
