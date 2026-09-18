(() => {
  const root = window.SongCleaner = window.SongCleaner || {};

  function t(key, sub) {
    return root.i18n.t(key, sub);
  }

  const $ = (id) => document.getElementById(id);

  const sourceRadios = [...document.querySelectorAll('input[name=source]')];
  const monthRow = $('monthRow');
  const monthSelect = $('monthSelect');
  const playlistRow = $('playlistRow');
  const playlistList = $('playlistList');
  const smartRow = $('smartRow');
  const smartSelect = $('smartSelect');
  const filterGenre = $('filterGenre');
  const filterGenreCustom = $('filterGenreCustom');
  const filterDecade = $('filterDecade');
  const filterPlayCount = $('filterPlayCount');
  const filterLastPlayed = $('filterLastPlayed');
  const orderSelect = $('orderSelect');
  const startBtn = $('startBtn');
  const optionsBtn = $('optionsBtn');
  const statusDot = $('statusDot');
  const hint = $('hint');
  const resumeRow = $('resumeRow');
  const resumeText = $('resumeText');
  const freshSession = $('freshSession');
  const blacklistBox = $('blacklistBox');
  const blacklistList = $('blacklistList');
  const blacklistHint = $('blacklistHint');

  const Store = root.Store;

  let activeTab = null;
  let contentOk = false;
  let hasSession = false;
  let allPlaylists = [];
  let blacklist = [];

  function updateStartLabel() {
    startBtn.textContent = hasSession
      ? t('popupResume')
      : t('popupStart');
    if (resumeText) resumeText.textContent = t('popupSessionFound');
    if (resumeRow) resumeRow.classList.toggle('hidden', !hasSession);
  }

  function setStatus(kind) {
    statusDot.className = 'dot' + (kind === 'ok' ? '' : kind === 'mid' ? ' mid' : ' off');
  }

  function showHint(message) {
    hint.textContent = message;
    hint.style.display = 'block';
  }

  function hideHint() {
    hint.style.display = 'none';
  }

  function fillMonths() {
    buildMonthSelect();
  }

  function buildMonthSelect() {
    monthSelect.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = root.Utils.monthKey(d);
      const label = root.Utils.monthLabel(mk);
      const option = document.createElement('option');
      option.value = mk;
      option.textContent = label;
      monthSelect.appendChild(option);
    }
  }

  function refreshRows() {
    const value = (sourceRadios.find((r) => r.checked) || {}).value;
    monthRow.classList.toggle('hidden', value !== 'month');
    playlistRow.classList.toggle('hidden', value !== 'playlist');
    smartRow.classList.toggle('hidden', value !== 'smart');
  }

  const selectedPlaylistIds = new Set();

  function opt(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  async function loadPlaylists() {
    if (!contentOk) return;
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'ss:list-playlists' });
      if (!resp || !resp.ok || !Array.isArray(resp.playlists)) return;
      playlistList.innerHTML = '';
      if (!resp.playlists.length) {
        const empty = document.createElement('div');
        empty.className = 'pitem pempty';
        empty.textContent = '–';
        playlistList.appendChild(empty);
      }
      for (const playlist of resp.playlists) {
        const label = document.createElement('label');
        label.className = 'pitem';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = playlist.id;
        cb.checked = selectedPlaylistIds.has(playlist.id);
        const name = document.createElement('span');
        name.textContent = playlist.name || (playlist.attributes && playlist.attributes.name) || playlist.id;
        label.appendChild(cb);
        label.appendChild(name);
        playlistList.appendChild(label);
      }
      playlistList.querySelectorAll('.pempty').forEach((node) => node.remove());
    } catch (e) { /* */ }
  }

  async function fillLibraryMeta() {
    if (!contentOk) return;
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'ss:library-meta' });
      if (!resp || !resp.ok || !resp.meta) return;
      const meta = resp.meta;
      const currentGenre = filterGenre.value;
      filterGenre.innerHTML = '';
      filterGenre.appendChild(opt('', 'Alle Genres'));
      for (const g of (meta.genres || [])) {
        filterGenre.appendChild(opt(g, g));
      }
      filterGenre.appendChild(opt('__custom__', '… eigenes Genre'));
      if (currentGenre && [...filterGenre.options].some((o) => o.value === currentGenre)) {
        filterGenre.value = currentGenre;
      } else if (currentGenre === '__custom__') {
        filterGenre.value = '__custom__';
      }
      const currentDecade = filterDecade.value;
      filterDecade.innerHTML = '';
      filterDecade.appendChild(opt('', 'Jahrzehnt'));
      for (const d of (meta.decades || [])) {
        filterDecade.appendChild(opt(d, d + 'er'));
      }
      if (currentDecade && [...filterDecade.options].some((o) => o.value === currentDecade)) {
        filterDecade.value = currentDecade;
      }
    } catch (e) { /* */ }
  }

  function norm(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function isBlacklisted(playlist) {
    const id = norm(playlist.id);
    const name = norm(playlist.name);
    return blacklist.some((entry) => {
      const value = norm(entry);
      return value && (value === id || (name && value === name));
    });
  }

  function renderBlacklist() {
    blacklistList.innerHTML = '';
    if (!allPlaylists.length) {
      const empty = document.createElement('div');
      empty.className = 'pitem pempty';
      empty.textContent = '–';
      blacklistList.appendChild(empty);
      return;
    }
    for (const playlist of allPlaylists) {
      const label = document.createElement('label');
      label.className = 'pitem';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = playlist.id;
      cb.checked = isBlacklisted(playlist);
      const name = document.createElement('span');
      name.textContent = playlist.name || playlist.id;
      label.appendChild(cb);
      label.appendChild(name);
      blacklistList.appendChild(label);
    }
  }

  async function saveBlacklist() {
    const checked = [...blacklistList.querySelectorAll('input[type=checkbox]:checked')].map((cb) => cb.value);
    const knownIds = new Set(allPlaylists.map((p) => norm(p.id)));
    const knownNames = new Set(allPlaylists.map((p) => norm(p.name)).filter(Boolean));
    const legacy = blacklist.filter((entry) => {
      const value = norm(entry);
      return value && !knownIds.has(value) && !knownNames.has(value);
    });
    blacklist = [...new Set([...legacy, ...checked])];
    await Store.ready();
    await Store.update(Store.key.settings, (settings) => {
      settings.playlistBlacklist = blacklist;
      return settings;
    });
    if (contentOk && activeTab) {
      try { await chrome.tabs.sendMessage(activeTab.id, { type: 'ss:refresh-settings' }); } catch (e) { /* */ }
    }
    await loadPlaylists();
  }

  async function loadBlacklist() {
    if (!contentOk) return;
    try {
      await Store.ready();
      const settings = await Store.get(Store.key.settings);
      blacklist = Array.isArray(settings.playlistBlacklist) ? settings.playlistBlacklist.slice() : [];
      const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'ss:all-playlists' });
      if (resp && resp.ok && Array.isArray(resp.playlists)) {
        allPlaylists = resp.playlists;
      }
      blacklistHint.textContent = t('lblBlacklistHint');
      renderBlacklist();
    } catch (e) { /* */ }
  }

  async function detect() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
    const url = tab && tab.url || '';
    if (!url.startsWith('https://music.apple.com')) {
      setStatus('off');
      showHint(t('popupNotOnApple'));
      contentOk = false;
      return;
    }
    setStatus('mid');
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'ss:ping' });
      if (resp && resp.ok) {
        contentOk = true;
        hasSession = Boolean(resp.hasSession);
        setStatus('ok');
        hideHint();
        await loadPlaylists();
        fillLibraryMeta();
        loadBlacklist();
        updateStartLabel();
      } else {
        contentOk = false;
        setStatus('mid');
        showHint(t('pageReloadHint'));
      }
    } catch (e) {
      contentOk = false;
      setStatus('mid');
      showHint(t('pageReloadHint'));
    }
  }

  function buildSource() {
    const value = (sourceRadios.find((r) => r.checked) || {}).value;
    const source = { type: value, filters: {}, order: orderSelect.value || null };
    if (value === 'month') source.month = monthSelect.value;
    if (value === 'playlist') {
      const ids = [...document.querySelectorAll('#playlistList input[type=checkbox]:checked')]
        .map((cb) => cb.value)
        .filter(Boolean);
      if (!ids.length) throw new Error('NEED_PLAYLIST');
      source.playlistIds = ids;
    }
    if (value === 'smart') source.smart = smartSelect.value;
    let genre = filterGenre.value;
    if (genre === '__custom__') genre = filterGenreCustom.value.trim();
    if (genre) source.filters.genre = genre;
    if (filterDecade.value) source.filters.decade = filterDecade.value;
    const pc = parseInt(filterPlayCount.value, 10);
    if (!isNaN(pc) && pc > 0) source.filters.minPlayCount = pc;
    if (filterLastPlayed.value) source.filters.lastPlayed = filterLastPlayed.value;
    return source;
  }

  startBtn.addEventListener('click', async () => {
    hideHint();
    let source = null;
    if (hasSession) {
      source = { type: 'resume' };
    } else {
      try {
        source = buildSource();
      } catch (e) {
        showHint(t('sourceNeedChoice'));
        return;
      }
    }
    if (!contentOk || !activeTab) {
      await chrome.runtime.sendMessage({ type: 'ss:open-tab' });
      showHint(t('popupNotOnApple'));
      return;
    }
    try {
      await chrome.tabs.update(activeTab.id, { active: true });
      const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'ss:start-session', source });
      if (resp && resp.ok) {
        window.close();
      } else {
        showHint(t('pageReloadHint'));
      }
    } catch (e) {
      showHint(t('pageReloadHint'));
    }
  });

  if (freshSession) freshSession.addEventListener('click', (e) => {
    e.preventDefault();
    hasSession = false;
    updateStartLabel();
  });

  if (playlistList) playlistList.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb || cb.type !== 'checkbox') return;
    if (cb.checked) selectedPlaylistIds.add(cb.value);
    else selectedPlaylistIds.delete(cb.value);
  });

  if (blacklistList) blacklistList.addEventListener('change', (e) => {
    const cb = e.target;
    if (!cb || cb.type !== 'checkbox') return;
    saveBlacklist();
  });

  if (optionsBtn) optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  if (optionsBtn) {
    optionsBtn.innerHTML = root.Icon.svg('cog', 16);
  }

  for (const radio of sourceRadios) radio.addEventListener('change', refreshRows);
  sourceRadios.forEach((r, i) => {
    if (i > 0) r.addEventListener('change', () => { if (r.checked && r.value === 'playlist') loadPlaylists(); });
  });

  function applyI18n() {
    updateStartLabel();
    optionsBtn.title = t('openOptions');
    if (freshSession) freshSession.textContent = t('popupNewSession');
    if (blacklistBox) {
      const summary = blacklistBox.querySelector('summary');
      if (summary) summary.textContent = t('lblPlaylistBlacklist');
    }
    if (blacklistHint && !blacklistHint.textContent) blacklistHint.textContent = t('lblBlacklistHint');
    const titles = document.querySelectorAll('.sec-title');
    if (titles.length) titles[0].textContent = t('popupSource');
    if (titles.length > 1) titles[1].textContent = t('filterGenre');
    const labels = [
      ['sourceAll', 'sourceAll'], ['sourceMonth', 'sourceMonth'], ['sourcePlaylist', 'sourcePlaylist'], ['sourceSmart', 'sourceSmart']
    ];
    document.querySelectorAll('span[data-i18n]').forEach((span) => {
      const key = span.getAttribute('data-i18n');
      const msg = t(key);
      if (msg !== key) span.textContent = msg;
    });
    const smartMap = { random: 'smartRandom', neverPlayed: 'smartNeverPlayed', forgotten: 'smartForgotten' };
    [...smartSelect.options].forEach((opt) => {
      const key = smartMap[opt.value];
      if (key) opt.textContent = t(key);
    });
    filterGenreCustom.placeholder = t('filterGenre');
    filterPlayCount.placeholder = t('filterPlayCount');
    void labels;
  }

  filterGenre.addEventListener('change', () => {
    filterGenreCustom.classList.toggle('hidden', filterGenre.value !== '__custom__');
  });

  async function boot() {
    try {
      await Store.ready();
      const settings = await Store.get(Store.key.settings);
      await root.i18n.loadLocale(settings.language || 'en');
    } catch (e) { /* */ }
    applyI18n();
    fillMonths();
    refreshRows();
    detect();
  }

  boot();
})();