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
  const sortUnavailable = $('sortUnavailable');
  const sortUnavailableLbl = $('sortUnavailableLbl');
  const sortUnavailableDesc = $('sortUnavailableDesc');
  const version = $('version');
  const issuesLink = $('issuesLink');

  function tt(key, fallback) {
    const msg = t(key);
    return msg === key ? fallback : msg;
  }

  function applyStaticI18n() {
    $('hGeneral').textContent = tt('lblLanguage', 'General');
    $('hLibrary').textContent = tt('librarySection', 'Library');
    $('hReset').textContent = tt('resetSection', 'Reset');
    $('sub').textContent = 'SongCleaner – Apple Music';
    resetLbl.textContent = tt('resetDecisions', 'Reset ratings');
    resetDesc.textContent = tt('resetDecisionsDesc', 'Delete all made decisions – every title becomes sortable again.');
    sortUnavailableLbl.textContent = tt('lblSortUnavailable', 'Sort out unavailable songs');
    sortUnavailableDesc.textContent = tt('sortUnavailableDesc', 'Songs that are no longer available on Apple Music are moved to a playlist automatically when a session starts.');
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
    sortUnavailable.checked = settings.sortUnavailable !== false;
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
  sortUnavailable.addEventListener('change', () => {
    debouncedSave('sortUnavailable', sortUnavailable.checked);
    notifyTabs('ss:refresh-settings');
  });

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

  if (version) {
    try { version.textContent = 'v' + chrome.runtime.getManifest().version; } catch (e) { /* */ }
  }

  if (issuesLink) issuesLink.textContent = tt('footerIssues', 'Issues');

  loadSettings();
})();
