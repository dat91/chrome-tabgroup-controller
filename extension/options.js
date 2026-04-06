const input = document.getElementById('apiKey');
const msg = document.getElementById('msg');

chrome.storage.local.get('geminiApiKey', ({ geminiApiKey }) => {
  if (geminiApiKey) input.value = geminiApiKey;
});

document.getElementById('save').addEventListener('click', () => {
  const key = input.value.trim();
  if (!key) {
    msg.textContent = 'Enter an API key.';
    msg.className = 'msg err';
    return;
  }
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    msg.textContent = 'Saved.';
    msg.className = 'msg ok';
    setTimeout(() => { msg.textContent = ''; }, 2000);
  });
});
