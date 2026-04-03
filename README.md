# Chrome Tab Group Controller

Programmatically control Chrome tab groups via a WebSocket bridge.

## Architecture

```
Your Script / Claude
      │
      ▼
WebSocket (ws://localhost:9876)
      │
      ▼
Chrome Extension (background.js)
      │
      ▼
chrome.tabGroups API
```

## Setup

### 1. Install the Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### 2. Start the WebSocket Server

```bash
cd native-host
npm install
node server.js
```

### 3. Verify

Click the extension icon — it should show **Connected**.

---

## API Reference

### `TabGroups.snapshot()`
Returns all groups with their tabs, plus ungrouped tabs.

### `TabGroups.list(filter?)`
List groups. Filter by `{ windowId, collapsed, color, title }`.

### `TabGroups.create({ title, color, urls?, tabIds?, collapsed? })`
Create a new group. Colors: `grey | blue | red | yellow | green | pink | purple | cyan`.

### `TabGroups.update(groupId, { title?, color?, collapsed? })`
Update a group's properties.

### `TabGroups.collapse(groupId)` / `TabGroups.expand(groupId)`
Collapse or expand a group.

### `TabGroups.dissolve(groupId)`
Ungroup all tabs in a group.

### `TabGroups.move(groupId, index, windowId?)`
Move a group to a tab bar position.

### `TabGroups.tabs(filter?)`
List tabs. Filter by `{ groupId, url, active, windowId }`.

### `TabGroups.addTabsToGroup(tabIds, groupId)`
Move tabs into an existing group.

### `TabGroups.ungroupTabs(tabIds)`
Remove tabs from their group.

### `TabGroups.openTab(url, active?)`
Open a new tab.

### `TabGroups.closeTabs(tabIds)`
Close one or more tabs.

### `TabGroups.activateTab(tabId)`
Focus a tab.

---

## Use as a Module

```javascript
const { TabGroups } = require('./server');

// Group your Jira boards by team
await TabGroups.create({
  title: 'P2P Team',
  color: 'blue',
  urls: [
    'https://jira.mservice.com.vn/board/p2p',
    'https://jira.mservice.com.vn/board/p2pfund',
  ]
});

// Collapse everything except active team
const groups = await TabGroups.list();
for (const g of groups) {
  if (g.title !== 'P2P Team') await TabGroups.collapse(g.id);
}
```
