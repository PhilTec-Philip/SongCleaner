(() => {
  const root = window.SongCleaner = window.SongCleaner || {};

  const KEYS = {
    decisions: 'ss.decisions',
    settings: 'ss.settings',
    bookmarks: 'ss.bookmarks',
    session: 'ss.session',
    meta: 'ss.meta'
  };

  const DEFAULTS = {
    [KEYS.decisions]: {},
    [KEYS.settings]: {
      autoPreview: true,
      suggestLess: true,
      language: 'en',
      playlistBlacklist: []
    },
    [KEYS.bookmarks]: {},
    [KEYS.meta]: {}
  };

  const memoryCache = {};
  let loaded = false;
  const waiters = [];

  async function ensureLoaded() {
    if (loaded) return;
    const allKeys = Object.values(KEYS);
    const raw = await chrome.storage.local.get(allKeys);
    for (const key of allKeys) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        const def = DEFAULTS[key];
        if (def && typeof def === 'object' && !Array.isArray(def)) {
          memoryCache[key] = Object.assign({}, def, raw[key] || {});
        } else {
          memoryCache[key] = raw[key] !== undefined ? raw[key] : def;
        }
      } else {
        memoryCache[key] = raw[key];
      }
    }
    loaded = true;
    waiters.splice(0).forEach((fn) => fn());
  }

  function ready() {
    return ensureLoaded();
  }

  async function get(key) {
    await ensureLoaded();
    return memoryCache[key];
  }

  async function set(key, value) {
    await ensureLoaded();
    memoryCache[key] = value;
    await chrome.storage.local.set({ [key]: value });
  }

  async function update(key, mutate) {
    const next = await get(key);
    const result = mutate(next);
    await set(key, next);
    return result;
  }

  async function remove(key) {
    delete memoryCache[key];
    await chrome.storage.local.remove(key);
  }

  async function refresh() {
    loaded = false;
    for (const key of Object.keys(memoryCache)) delete memoryCache[key];
    await ensureLoaded();
  }

  root.Store = {
    key: KEYS,
    ready,
    get,
    set,
    update,
    remove,
    refresh
  };
})();