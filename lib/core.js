(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const Utils = root.Utils;
  const Store = root.Store;

  const DAY = 86400000;
  const YEAR = 365 * DAY;

  function keyOf(song) {
    return Utils.songKey(song);
  }

  function hasPlayed(song) {
    return Boolean(song.playCount && song.playCount > 0) || Boolean(song.lastPlayed);
  }

  function isOldEnough(song, now) {
    if (!song.dateAdded) return true;
    return (now - song.dateAdded) > 30 * DAY;
  }

  function matchSmartFilter(song, smart, bookmarkKeys, now) {
    switch (smart) {
      case 'random':
        return true;
      case 'neverPlayed':
        return !hasPlayed(song) && isOldEnough(song, now);
      case 'forgotten': {
        if (!hasPlayed(song)) return isOldEnough(song, now);
        if (song.lastPlayed) return (now - song.lastPlayed) > YEAR;
        return false;
      }
      case 'bookmarked':
        return bookmarkKeys.has(keyOf(song));
      default:
        return true;
    }
  }

  function matchListFilters(song, filters, now) {
    if (!filters) return true;
    if (filters.genre) {
      const wanted = filters.genre.toLowerCase();
      const has = (song.genres || []).some((g) => String(g).toLowerCase() === wanted) ||
        (song.genre && String(song.genre).toLowerCase() === wanted);
      if (!has) return false;
    }
    if (filters.decade && song.year) {
      const bucket = String(Math.floor(song.year / 10) * 10);
      if (bucket !== filters.decade) return false;
    }
    if (filters.minPlayCount !== undefined && filters.minPlayCount !== null &&
        (song.playCount || 0) < Number(filters.minPlayCount)) {
      return false;
    }
    if (filters.lastPlayed) {
      if (filters.lastPlayed === 'never') {
        if (hasPlayed(song)) return false;
      } else if (filters.lastPlayed === 'year') {
        if (song.lastPlayed && (now - song.lastPlayed) <= YEAR) return false;
        if (!song.lastPlayed && hasPlayed(song)) return false;
      }
    }
    return true;
  }

  class SortSession {
    constructor(queue, meta) {
      this.queue = queue;
      this.currentIndex = 0;
      this.decisions = new Map();
      this.love = new Map();
      this.order = [];
      this.meta = meta || {};
      this.committed = false;
    }

    current() {
      return this.queue[this.currentIndex] || null;
    }

    isDecided(song) {
      return this.decisions.has(keyOf(song));
    }

    decide(song, action) {
      const key = keyOf(song);
      this.decisions.set(key, action);
      if (!this.order.includes(key)) this.order.push(key);
      this.advance();
      return this.isSwipeAction(action);
    }

    isSwipeAction(action) {
      return action === 'keep' || action === 'sortout';
    }

    setLove(song, value) {
      const key = keyOf(song);
      if (value) this.love.set(key, true);
      else this.love.delete(key);
    }

    isLoved(song) {
      return this.love.has(keyOf(song));
    }

    undoLast() {
      if (!this.order.length) return null;
      const key = this.order.pop();
      const action = this.decisions.get(key);
      const love = this.love.has(key);
      this.decisions.delete(key);
      this.love.delete(key);
      const idx = this.queue.findIndex((s) => keyOf(s) === key);
      if (idx !== -1) this.currentIndex = idx;
      return { song: this.queue[idx] || null, action, love };
    }

    count() {
      return this.order.length;
    }

    swipeCount() {
      let n = 0;
      for (const k of this.order) {
        const action = this.decisions.get(k);
        if (action === 'keep' || action === 'sortout') n += 1;
      }
      return n;
    }

    advance() {
      while (this.currentIndex < this.queue.length &&
             this.isDecided(this.queue[this.currentIndex])) {
        this.currentIndex += 1;
      }
    }

    summary() {
      const out = { keep: 0, sortout: 0, bookmark: 0, love: 0, total: 0 };
      for (const key of this.order) {
        const action = this.decisions.get(key);
        if (!out[action]) out[action] = 0;
        out[action] += 1;
        out.total += 1;
      }
      out.love = this.love.size;
      return out;
    }

    sortedOutSongs() {
      const out = [];
      for (const [key, action] of this.decisions) {
        if (action === 'sortout') {
          const song = this.queue.find((s) => keyOf(s) === key);
          if (song) out.push(song);
        }
      }
      return out;
    }

    bookmarkedSongs() {
      const out = [];
      for (const [key, action] of this.decisions) {
        if (action === 'bookmark') {
          const song = this.queue.find((s) => keyOf(s) === key);
          if (song) out.push(song);
        }
      }
      return out;
    }

    lovedSongs() {
      const out = [];
      for (const key of this.love.keys()) {
        const song = this.queue.find((s) => keyOf(s) === key);
        if (song) out.push(song);
      }
      return out;
    }
  }

  function applyFilters(songs, source, bookmarkKeys) {
    const now = Date.now();
    let result = songs.slice();

    if (source.type === 'month') {
      const mk = source.month;
      result = result.filter((s) => s.dateAdded && Utils.monthKey(s.dateAdded) === mk);
    }

    if (source.type === 'smart') {
      result = result.filter((s) => matchSmartFilter(s, source.smart, bookmarkKeys, now));
    }

    if (source.filters) {
      result = result.filter((s) => matchListFilters(s, source.filters, now));
    }

    if (source.type === 'smart' && source.smart === 'random') {
      result = Utils.shuffle(result);
    }

    if (source.order === 'title') {
      result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    } else if (source.order === 'artist') {
      result.sort((a, b) => String(a.artist).localeCompare(String(b.artist)));
    } else if (source.order === 'oldest') {
      result.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
    } else if (source.order === 'newest') {
      result.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    }

    return result;
  }

  async function buildSession(source, dataSource, opts) {
    const optsSafe = opts || {};
    const bookmarkKeys = new Set();
    let songs;

    const settings = await Store.get(Store.key.settings);
    const blacklist = (settings && settings.playlistBlacklist) || [];
    let blockedIds = new Set();
    if (blacklist.length && dataSource.listPlaylists) {
      try {
        const playlists = await dataSource.listPlaylists();
        blockedIds = new Set(
          (playlists || [])
            .filter((p) => filterBlacklistedPlaylists([p], blacklist).length === 0)
            .map((p) => p.id)
        );
      } catch (e) { blockedIds = new Set(); }
    }

    if (source.type === 'playlist') {
      let ids = (source.playlistIds && source.playlistIds.length)
        ? source.playlistIds.slice()
        : (source.playlistId ? [source.playlistId] : []);
      if (blockedIds.size) ids = ids.filter((id) => !blockedIds.has(id));
      songs = [];
      const seen = new Set();
      for (const id of ids) {
        const list = await dataSource.getPlaylistSongs(id);
        for (const s of list) {
          if (!seen.has(keyOf(s))) {
            seen.add(keyOf(s));
            songs.push(s);
          }
        }
      }
    } else {
      const allSongs = await dataSource.getAllSongs(optsSafe.onProgress);
      if (source.smart === 'bookmarked') {
        const bookmarked = await dataSource.getPlaylistSongsByBookmark();
        for (const s of bookmarked) bookmarkKeys.add(keyOf(s));
        const local = await Store.get(Store.key.bookmarks);
        for (const k of Object.keys(local || {})) bookmarkKeys.add(k);
      }
      songs = allSongs;
    }

    if (source.smart === 'bookmarked' && source.type !== 'playlist') {
      songs = allSongsFilter(songs, (s) => bookmarkKeys.has(keyOf(s)));
    }

    if (blockedIds.size && source.type !== 'playlist') {
      const exclude = new Set();
      for (const id of blockedIds) {
        try {
          const tracks = await dataSource.getPlaylistSongs(id);
          for (const s of tracks) exclude.add(keyOf(s));
        } catch (e) { /* */ }
      }
      if (exclude.size) songs = songs.filter((s) => !exclude.has(keyOf(s)));
    }

    let filtered = applyFilters(songs, source, bookmarkKeys);

    if (!optsSafe.includeDecided) {
      const decided = await Store.get(Store.key.decisions);
      const decidedKeys = new Set(Object.keys(decided || {}));
      if (decidedKeys.size) {
        filtered = filtered.filter((s) => !decidedKeys.has(keyOf(s)));
      }
    }

    return new SortSession(filtered, {
      sourceType: source.type,
      smart: source.smart || null,
      filters: source.filters || null,
      month: source.month || null,
      playlistId: source.playlistId || null,
      playlistIds: Array.isArray(source.playlistIds) ? source.playlistIds.slice() : null
    });
  }

  function allSongsFilter(songs, fn) {
    return songs.filter(fn);
  }

  async function recordDecisions(decisions) {
    const existing = await Store.get(Store.key.decisions);
    const next = Object.assign({}, existing || {});
    for (const item of decisions) {
      next[item.key] = {
        action: item.action,
        love: Boolean(item.love),
        at: item.at || Date.now()
      };
    }
    await Store.set(Store.key.decisions, next);
  }

  async function commitSession(session, dataSource, onProgress) {
    const settings = await Store.get(Store.key.settings);
    const sortedOut = session.sortedOutSongs();
    const bookmarked = session.bookmarkedSongs();
    const loved = session.lovedSongs();

    const write = dataSource && dataSource.commitDecisions
      ? await dataSource.commitDecisions({ sortedOut, bookmarked, loved, settings, onProgress })
      : { sorted: sortedOut.length, bookmarked: bookmarked.length, loved: loved.length, freedBytes: 0 };

    if (bookmarked.length) {
      const bookmarkStore = await Store.get(Store.key.bookmarks);
      for (const song of bookmarked) {
        bookmarkStore[keyOf(song)] = true;
      }
      await Store.set(Store.key.bookmarks, bookmarkStore);
    }

    const decisions = [];
    for (const [key, action] of session.decisions) {
      decisions.push({ key, action, love: session.love.has(key), at: Date.now() });
    }
    if (decisions.length) await recordDecisions(decisions);

    const summaryObj = session.summary();
    const freedBytes = write.freedBytes || sortedOut.reduce((sum, song) => sum + (Utils.estimateBytes(song.artworkTemplate) || 0), 0);

    await clearSavedSession();

    return {
      sorted: write.sorted !== undefined ? write.sorted : sortedOut.length,
      kept: summaryObj.keep,
      bookmarked: bookmarked.length,
      loved: loved.length,
      freedBytes
    };
  }

  const SESSION_VERSION = 1;
  const SONG_FIELDS = ['id', 'libraryId', 'catalogId', 'title', 'artist', 'album', 'genre', 'genres',
    'durationMs', 'year', 'dateAdded', 'lastPlayed', 'playCount', 'artworkTemplate', 'url', 'isrc', 'previewUrl', 'source'];
  let saveTimer = null;

  function serializeSong(song) {
    const out = {};
    for (const field of SONG_FIELDS) {
      if (song[field] !== undefined) out[field] = song[field];
    }
    return out;
  }

  function serializeSession(session) {
    return {
      version: SESSION_VERSION,
      createdAt: session.createdAt || Date.now(),
      updatedAt: Date.now(),
      meta: session.meta || {},
      queue: session.queue.map(serializeSong),
      order: (session.order || []).slice(),
      currentIndex: session.currentIndex || 0,
      decisions: Object.fromEntries(session.decisions || []),
      love: Array.from((session.love && session.love.keys()) || [])
    };
  }

  async function writeSession(data) {
    try { await Store.set(Store.key.session, data); } catch (e) { /* */ }
  }

  function saveSession(session, opts) {
    if (!session) return;
    const data = serializeSession(session);
    if (!data.queue.length) {
      clearSavedSession();
      return;
    }
    clearTimeout(saveTimer);
    if (opts && opts.immediate) {
      writeSession(data);
      return;
    }
    saveTimer = setTimeout(() => writeSession(data), 300);
  }

  async function hasSavedSession() {
    try {
      const data = await Store.get(Store.key.session);
      return Boolean(data && data.version === SESSION_VERSION &&
        Array.isArray(data.queue) && data.queue.length > 0 &&
        typeof data.currentIndex === 'number');
    } catch (e) {
      return false;
    }
  }

  async function restoreSession() {
    const data = await Store.get(Store.key.session);
    if (!data || data.version !== SESSION_VERSION || !Array.isArray(data.queue) || !data.queue.length) return null;
    const session = new SortSession(data.queue, data.meta || {});
    session.createdAt = data.createdAt || Date.now();
    session.currentIndex = Math.min(Math.max(0, Number(data.currentIndex) || 0), data.queue.length - 1);
    session.order = Array.isArray(data.order) ? data.order.slice() : [];
    session.decisions = new Map(Object.entries(data.decisions || {}));
    const love = new Map();
    const loveArr = data.love || [];
    if (Array.isArray(loveArr)) {
      for (const key of loveArr) love.set(key, true);
    }
    session.love = love;
    session.advance();
    return session;
  }

  async function clearSavedSession() {
    clearTimeout(saveTimer);
    try { await Store.remove(Store.key.session); } catch (e) { /* */ }
  }

  function filterBlacklistedPlaylists(playlists, blacklist) {
    const blocked = (blacklist || []).map((entry) => String(entry).trim().toLowerCase());
    if (!blocked.length) return playlists;
    return playlists.filter((p) => {
      const raw = (p.attributes && p.attributes.name) || p.name || '';
      const name = String(raw).trim().toLowerCase();
      const id = String(p.id || '').trim().toLowerCase();
      return !blocked.includes(name) && !blocked.includes(id);
    });
  }

  root.Core = {
    SortSession,
    buildSession,
    applyFilters,
    matchSmartFilter,
    matchListFilters,
    keyOf,
    recordDecisions,
    commitSession,
    saveSession,
    hasSavedSession,
    restoreSession,
    clearSavedSession,
    serializeSession,
    filterBlacklistedPlaylists
  };
})();