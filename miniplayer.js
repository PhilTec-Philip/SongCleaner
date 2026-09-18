(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const statusEl = document.getElementById('status');
  const Store = root.Store;

  function t(key) {
    return root.i18n.t(key);
  }

  const buttons = [
    { id: 'sortout', key: 'actionSortOut', icon: 'thumb-down' },
    { id: 'love', key: 'actionLove', icon: 'heart' },
    { id: 'keep', key: 'actionKeep', icon: 'thumb-up' },
    { id: 'open', key: 'miniToggle', icon: 'open-in-new' }
  ];

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  async function send(action) {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'ss:mini-to-content', action });
      if (resp && resp.handled) {
        setStatus(t('miniDone'));
      } else if (resp && resp.appleOnly) {
        setStatus(t('miniOpenApple'));
      } else {
        setStatus(t('miniNoSession'));
      }
    } catch (e) {
      setStatus(t('miniNoConnection'));
    }
  }

  function decorate() {
    for (const item of buttons) {
      const btn = document.getElementById(item.id);
      if (!btn) continue;
      const icon = root.Icon ? root.Icon.svg(item.icon, 14) + ' ' : '';
      btn.innerHTML = icon + t(item.key);
    }
  }

  document.getElementById('sortout').addEventListener('click', () => send('sortout'));
  document.getElementById('love').addEventListener('click', () => send('love'));
  document.getElementById('keep').addEventListener('click', () => send('keep'));
  document.getElementById('open').addEventListener('click', () => send('toggle'));

  async function boot() {
    try {
      await Store.ready();
      const settings = await Store.get(Store.key.settings);
      await root.i18n.loadLocale(settings.language || 'en');
    } catch (e) { /* */ }
    decorate();
    setStatus(t('miniReady'));
  }

  boot();
})();
