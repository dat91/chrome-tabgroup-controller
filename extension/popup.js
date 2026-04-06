const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const tip = document.getElementById('tip');
const strategy = document.getElementById('strategy');
const contextInput = document.getElementById('contextInput');
const groupBtn = document.getElementById('groupBtn');
const result = document.getElementById('result');

// ── WS status ────────────────────────────────────────────────────────────────

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

// ── Gemini grouping ───────────────────────────────────────────────────────────

strategy.addEventListener('change', () => {
  contextInput.style.display = strategy.value === 'context' ? 'block' : 'none';
});

groupBtn.addEventListener('click', () => {
  const strat = strategy.value;
  const userContext = contextInput.value.trim();

  if (strat === 'context' && !userContext) {
    result.textContent = 'Enter a description of your current work.';
    result.className = 'err';
    return;
  }

  groupBtn.disabled = true;
  groupBtn.textContent = 'Thinking...';
  result.textContent = '';
  result.className = '';

  chrome.runtime.sendMessage(
    { type: 'gemini-group', strategy: strat, userContext },
    (resp) => {
      groupBtn.disabled = false;
      groupBtn.textContent = 'Group with Gemini';

      if (chrome.runtime.lastError) {
        result.textContent = chrome.runtime.lastError.message;
        result.className = 'err';
        return;
      }
      if (resp?.error) {
        result.textContent = resp.error;
        result.className = 'err';
        return;
      }
      result.textContent = resp.count === 0
        ? 'No groups to create.'
        : `Done — created ${resp.count} group${resp.count !== 1 ? 's' : ''}.`;
      result.className = 'ok';
    }
  );
});

// ── Settings ──────────────────────────────────────────────────────────────────

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
