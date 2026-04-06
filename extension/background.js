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

// Handle commands forwarded from the offscreen WebSocket document,
// and direct Gemini-group requests from the popup.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ws-command') {
    const { msg } = message;
    handleCommand(msg).then(result => {
      chrome.runtime.sendMessage({ type: 'ws-send', payload: { id: msg.id, ...result } });
    });
    return;
  }

  if (message.type === 'gemini-group') {
    const { strategy, userContext } = message;
    (async () => {
      const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
      if (!geminiApiKey) {
        return { error: 'No Gemini API key set. Click ⚙ to add one.' };
      }
      const snapshotResult = await handleCommand({ cmd: 'snapshot' });
      if (snapshotResult.error) return { error: snapshotResult.error };

      const snapshot = snapshotResult.data;
      const totalTabs =
        snapshot.groups.reduce((n, g) => n + g.tabs.length, 0) +
        snapshot.ungrouped.length;
      if (totalTabs === 0) return { error: 'No open tabs found.' };

      const prompt = buildGeminiPrompt(strategy, snapshot, userContext);
      const { groups } = await callGemini(geminiApiKey, prompt);
      if (!groups?.length) return { success: true, count: 0 };

      for (const group of groups) {
        await handleCommand({
          cmd: 'groups.create',
          params: { title: group.title, color: group.color, tabIds: group.tabIds }
        });
      }
      return { success: true, count: groups.length };
    })().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // async sendResponse
  }
});

// ── GEMINI GROUPING ───────────────────────────────────────────────────────────

const VALID_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];

const GROUP_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short group name, 2–4 words' },
          color: { type: 'string', enum: VALID_COLORS },
          tabIds: { type: 'array', items: { type: 'integer' } }
        },
        required: ['title', 'color', 'tabIds']
      }
    }
  },
  required: ['groups']
};

function buildGeminiPrompt(strategy, snapshot, userContext) {
  const allTabs = [
    ...snapshot.groups.flatMap(g => g.tabs),
    ...snapshot.ungrouped
  ];
  const tabsJson = JSON.stringify(
    allTabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
    null, 2
  );
  const base = `Here are the user's open Chrome tabs:\n${tabsJson}\n\n`;

  switch (strategy) {
    case 'intent':
      return base + `Group these tabs by user intent using two passes.

Pass 1 — for each tab, infer what the user was trying to accomplish (not the content type). Think about goals like "Debugging Redis issue", "Planning Vietnam trip", "Job search — backend roles".

Pass 2 — review each cluster and write a concise 2–4 word group name that captures the user's goal. Choose a fitting color from: ${VALID_COLORS.join(', ')}.

Rules:
- Leave one-off tabs with no clear cluster ungrouped (omit them from output entirely)
- Don't force everything into a group
- Each group should have at least 2 tabs`;

    case 'context':
      return base + `The user describes their current work as: "${userContext}"

Group tabs by how they map to the user's actual work above. Use vocabulary from their description when naming groups. Omit tabs that are clearly unrelated to their stated context.`;

    case 'priority':
      return base + `Triage tabs into priority groups:
- "active" (green): currently in use, directly needed right now
- "background" (blue): reference material, needed soon but not immediately
- "archive" (grey): stale, finished, or duplicated

Assign all tabs to exactly one of these three groups. Use the colors specified above.`;

    case 'domain':
      return base + `Cluster tabs by structural similarity:
Step 1 — identify tabs that share domain, subdomain, URL path prefix, or closely related title keywords.
Step 2 — form groups of 2+ tabs from dense clusters. Isolated tabs stay ungrouped (omit them).
Step 3 — name each group from its dominant signal (e.g. "github.com/myrepo", "React docs").`;

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GROUP_SCHEMA
      }
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${resp.status}`);
  }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return JSON.parse(text);
}

// ── TAB COMMANDS ──────────────────────────────────────────────────────────────

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
        // Filter to tabs in normal windows only — popup/app windows don't support grouping
        if (tabIds.length > 0) {
          const tabDetails = await Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => null)));
          const windowIds = [...new Set(tabDetails.filter(Boolean).map(t => t.windowId))];
          const windows = await Promise.all(windowIds.map(id => chrome.windows.get(id).catch(() => null)));
          const normalWindowIds = new Set(windows.filter(w => w?.type === 'normal').map(w => w.id));
          tabIds = tabDetails.filter(t => t && normalWindowIds.has(t.windowId)).map(t => t.id);
        }
        if (tabIds.length === 0) return { error: 'No groupable tabs (all tabs are in popup or app windows)' };
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
          chrome.tabs.query({ windowType: 'normal' }),
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
