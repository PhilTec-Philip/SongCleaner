async function findMusicTab() {
  const tabs = await chrome.tabs.query({
    url: ['https://music.apple.com/*']
  });
  return tabs.find((t) => t.active) || tabs[0] || null;
}

async function ensureMusicTab() {
  const existing = await findMusicTab();
  if (existing) return existing;
  return chrome.tabs.create({ url: 'https://music.apple.com/library/songs' });
}

async function openInTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    return { ok: false, error: 'NO_CONTENT' };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-swipe') return;
  const tab = await ensureMusicTab();
  if (!tab || !tab.id) return;
  await openInTab(tab.id, { type: 'ss:toggle' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'ss:mini-to-content') {
    (async () => {
      const tab = await findMusicTab();
      if (!tab || !tab.id) return { ok: false, handled: false };
      return openInTab(tab.id, { type: 'ss:mini-action', action: message.action || 'keep' });
    })().then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message.type === 'ss:open-tab') {
    (async () => {
      const tab = await ensureMusicTab();
      if (tab && tab.id) await chrome.tabs.update(tab.id, { active: true });
      return { ok: true };
    })().then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});