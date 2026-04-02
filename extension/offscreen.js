// Tab Group Controller - Offscreen Document
// Holds the persistent WebSocket connection. Unlike the service worker, offscreen
// documents are not suspended by Chrome, so the connection stays alive indefinitely.

const WS_URL = 'ws://localhost:9876';
let ws = null;
let reconnectTimer = null;

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[Offscreen] Connected to WebSocket server');
    ws.send(JSON.stringify({ event: 'connected', version: chrome.runtime?.getManifest?.()?.version ?? 'unknown' }));
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    // Forward to background.js — only it has access to chrome.tabGroups/tabs APIs
    chrome.runtime.sendMessage({ type: 'ws-command', msg });
  };

  ws.onclose = () => {
    console.log('[Offscreen] Disconnected. Reconnecting in 3s...');
    ws = null;
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    // onclose fires after onerror and handles reconnect
  };
}

// Relay responses from background.js back over WebSocket, and answer status queries from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ws-send' && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message.payload));
  } else if (message.type === 'ws-status') {
    sendResponse({ connected: ws !== null && ws.readyState === WebSocket.OPEN });
  }
});

connect();
