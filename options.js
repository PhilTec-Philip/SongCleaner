(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const Store = root.Store;

  const $ = (id) => document.getElementById(id);

  function t(key, sub) {
    return root.i18n.t(key, sub);
  }

  const language = $('language');
  const autoPreview = $('autoPreview');
  const suggestLess = $('suggestLess');
  const resetDecisionsBtn = $('resetDecisions');
  const resetLbl = $('resetLbl');
  const resetDesc = $('resetDesc');

  function tt(key, fallback) {
    const msg = t(key);
    return msg === key ? fallback : msg;
  }

  function applyStaticI18n() {
    $('hGeneral').textContent = tt('lblLanguage', 'General');
    $('hReset').textContent = tt('resetSection', 'Reset');
    $('sub').textContent = 'SongCleaner – Apple Music';
    resetLbl.textContent = tt('resetDecisions', 'Reset ratings');
    resetDesc.textContent = tt('resetDecisionsDesc', 'Delete all made decisions – every title becomes sortable again.');
    document.querySelectorAll('[data-i18nl]').forEach((node) => {
      const msg = t(node.getAttribute('data-i18nl'));
      if (msg !== node.getAttribute('data-i18nl')) node.textContent = msg;
    });
  }

  async function loadSettings() {
    await Store.ready();
    const settings = await Store.get(Store.key.settings);
    await root.i18n.loadLocale(settings.language || 'en');
    language.value = settings.language || 'en';
    autoPreview.checked = settings.autoPreview;
    suggestLess.checked = settings.suggestLess;
    applyStaticI18n();
  }

  function debouncedSave(key, value) {
    Store.update(Store.key.settings, (settings) => {
      settings[key] = value;
      return settings;
    });
  }

  language.addEventListener('change', async () => {
    debouncedSave('language', language.value);
    await root.i18n.loadLocale(language.value);
    applyStaticI18n();
    notifyTabs('ss:refresh-settings');
  });

  autoPreview.addEventListener('change', () => debouncedSave('autoPreview', autoPreview.checked));
  suggestLess.addEventListener('change', () => debouncedSave('suggestLess', suggestLess.checked));

  async function notifyTabs(type) {
    const tabs = await chrome.tabs.query({ url: ['https://music.apple.com/*'] });
    for (const tab of tabs) {
      try { await chrome.tabs.sendMessage(tab.id, { type }); } catch (e) { /* */ }
    }
  }

  async function notifyReset() {
    await notifyTabs('ss:reset-library');
  }

  resetDecisionsBtn.addEventListener('click', async () => {
    if (!window.confirm(tt('resetDecisionsConfirm', 'Alle Entscheidungen wirklich löschen?'))) return;
    await chrome.storage.local.remove(Store.key.decisions);
    await notifyReset();
    applyStaticI18n();
  });

  loadSettings();
})();
