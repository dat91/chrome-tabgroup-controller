const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const tip = document.getElementById('tip');

function checkConnection() {
  // Ask offscreen.js for its current WebSocket readyState.
  // This avoids opening a raw WebSocket from the popup, which would hijack
  // extensionSocket on the server and trigger a false disconnect.
  chrome.runtime.sendMessage({ type: 'ws-status' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      dot.classList.remove('connected');
      statusText.textContent = 'Offscreen unavailable';
      tip.textContent = 'Reload the extension to restore the WebSocket connection.';
      return;
    }
    if (response.connected) {
      dot.classList.add('connected');
      statusText.textContent = 'Connected';
      tip.textContent = 'Ready! Send commands to ws://localhost:9876';
    } else {
      dot.classList.remove('connected');
      statusText.textContent = 'Server not running';
      tip.textContent = 'Run: node server.js in the native-host folder.';
    }
  });
}

document.getElementById('snapshotBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ cmd: 'snapshot' });
});

checkConnection();
