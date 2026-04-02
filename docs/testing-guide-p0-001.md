# Manual Testing Guide — WebSocket Stability Fix (P0-001)

**Prerequisites**
- Chrome open with the Tab Group Controller extension loaded (chrome://extensions → Developer mode → Load unpacked → select the `extension/` folder)
- Terminal open in the project folder

---

## Test 1: Basic Connection Verification

**What it checks:** Extension connects to the server on startup.

1. In the terminal, run: `cd native-host && npm start`
   You should see: _Waiting for Chrome extension to connect..._
2. Open any webpage in Chrome (or open a new tab).
3. Watch the terminal — within a few seconds you should see:
   _Chrome extension connected (v1.0.0)_
4. Click the extension icon in the Chrome toolbar — the popup should show a green connected indicator.

**Pass:** Terminal shows the connected message. Extension popup shows green.

---

## Test 2: Reconnection After Server Restart

**What it checks:** Extension automatically reconnects after the server drops and comes back.

1. With the server running and connected (Test 1 passing), stop the server: press **Ctrl+C** in the terminal.
   Terminal shows: _Extension disconnected_
2. Wait 5 seconds. The extension is now trying to reconnect every 3 seconds.
3. Restart the server: run `cd native-host && npm start` again.
4. Watch the terminal — within 3 seconds you should see:
   _Chrome extension connected (v1.0.0)_

**Pass:** Connection restores automatically within ~3 seconds of server restart, no manual action needed.

---

## Test 3: MV3 Service Worker Suspension Recovery (Alarms Fix)

**What it checks:** The extension reconnects even after Chrome has suspended it in the background — this was the primary bug causing persistent drops.

**Quick version (seconds):**
1. With the server running and connected, go to `chrome://extensions`
2. Find _Tab Group Controller_ and click the reload icon (↺)
3. Watch the server terminal — within a few seconds you should see:
   _Chrome extension connected (v1.0.0)_

**Full version (simulates real suspension):**
1. With the server running and connected, go to `chrome://extensions`
2. Click the **Service worker** link on the Tab Group Controller card — DevTools opens
3. In the DevTools Console tab, type `chrome.runtime.reload()` and press Enter
4. The service worker restarts — watch the server terminal reconnect within 5 seconds

**Pass:** Connection restores after service worker restart without any manual action.

---

## Quick Smoke Test (All Three at Once)

1. Start server: `cd native-host && npm start`
2. Confirm _Chrome extension connected_ appears in terminal
3. Press Ctrl+C to stop server, then restart it — confirm reconnects within 3 seconds
4. Reload the extension via `chrome://extensions` (↺ icon) — confirm reconnects within 5 seconds

All three passing = fix is working correctly.
