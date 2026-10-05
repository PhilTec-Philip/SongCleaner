(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const API = root.API;
  const Player = root.Player;
  const Core = root.Core;
  const Store = root.Store;

  function t(key, sub) {
    return root.i18n.t(key, sub);
  }

  function friendlyMessage(err) {
    const name = err && err.name;
    const message = err && err.message;
    if (name === 'NO_TOKENS' || message === 'NO_TOKENS') return t('popupNoToken');
    if (name === 'NO_PLAYER' || message === 'NO_PLAYER') return t('stateError') + ': ' + t('popupOpenApple');
    if (message === 'EMPTY') return t('noSongs');
    if (name === 'BRIDGE_UNAVAILABLE' || message === 'BRIDGE_UNAVAILABLE') return t('pageReloadHint');
    return message || String(err || t('stateError'));
  }

  function trackRef(song) {
    if (!song) return null;
    return song.catalogId || song.libraryId || song.id || null;
  }

  async function forEachLimit(items, limit, worker) {
    let index = 0;
    const runners = [];
    const count = Math.min(limit, items.length);
    for (let i = 0; i < count; i += 1) {
      runners.push((async () => {
        while (index < items.length) {
          const current = items[index];
          index += 1;
          await worker(current);
        }
      })());
    }
    await Promise.all(runners);
  }

  function appleDataSource() {
    return {
      isLive: true,
      pendingUnavailable: [],
      async getAllSongs(onProgress) {
        const scan = await API.scanLibrarySongs(onProgress);
        this.pendingUnavailable = scan.unavailable;
        return scan.playable;
      },
      async moveUnavailableToPlaylist(songs, onProgress) {
        if (!songs || !songs.length) return { moved: 0, failed: 0 };
        const refs = songs.filter((s) => s.libraryId);
        if (!refs.length) return { moved: 0, failed: songs.length };
        try {
          await this.ensurePlaylist(t('playlistUnavailable'), refs, onProgress);
          return { moved: refs.length, failed: songs.length - refs.length };
        } catch (e) {
          console.error('[SongCleaner] Nicht verfügbare Songs konnten nicht verschoben werden', e);
          return { moved: 0, failed: songs.length, error: String(e) };
        }
      },
      async listPlaylists() {
        const playlists = await API.listPlaylists();
        return playlists.map((p) => {
          const name = (p.attributes && p.attributes.name) || p.name || '';
          return {
            id: p.id,
            name,
            attributes: { name }
          };
        });
      },
      async getPlaylistSongs(playlistId) {
        const raw = await API.getPlaylistTracks(playlistId);
        return raw.map(API.normalizeSong);
      },
      async getPlaylistSongsByBookmark() {
        try {
          const playlist = await API.findPlaylistByName(t('playlistBookmarked'));
          if (!playlist) return [];
          const raw = await API.getPlaylistTracks(playlist.id);
          return raw.map(API.normalizeSong);
        } catch (e) {
          return [];
        }
      },
      async addTracksDedup(playlistId, songs, onProgress) {
        const existing = new Set();
        try {
          const raw = await API.getPlaylistTracks(playlistId);
          raw.forEach((item) => {
            if (item.id) existing.add(item.id);
            const a = item.attributes || {};
            const pp = a.playParams || {};
            if (pp.id) existing.add(pp.id);
          });
        } catch (e) { /* */ }
        const chunkSize = 25;
        for (let i = 0; i < songs.length; i += chunkSize) {
          const chunk = songs.slice(i, i + chunkSize).filter((s) => {
            const ref = trackRef(s);
            return ref && !existing.has(ref) && !(s.libraryId && existing.has(s.libraryId)) && !(s.catalogId && existing.has(s.catalogId));
          });
          if (chunk.length) await this.addTracksChunk(playlistId, chunk);
          if (typeof onProgress === 'function') {
            onProgress(Math.min(chunkSize, songs.length - i));
          }
        }
      },
      async addTracksChunk(playlistId, songs) {
        const catalog = songs.map((s) => s.catalogId).filter(Boolean);
        const library = songs.map((s) => s.libraryId).filter(Boolean);
        const attempts = [
          { type: 'songs', refs: catalog },
          { type: 'library-songs', refs: library }
        ];
        let lastErr = null;
        for (const attempt of attempts) {
          if (!attempt.refs.length) continue;
          try {
            await API.addTracksToPlaylist(playlistId, attempt.refs, attempt.type);
            return;
          } catch (e) {
            lastErr = e;
          }
        }
        if (lastErr) throw lastErr;
      },
      async ensurePlaylist(name, songs, onProgress) {
        let playlist = await API.findPlaylistByName(name);
        let created = false;
        if (!playlist) {
          playlist = await API.createPlaylist(name);
          created = true;
        }
        if (playlist && songs && songs.length) {
          await this.addTracksDedup(playlist.id, songs, onProgress);
        }
        return { playlist, created };
      },
      async commitDecisions({ sortedOut, bookmarked, loved, settings, onProgress }) {
        const dislikeTargets = settings.suggestLess ? sortedOut.filter((s) => s.libraryId) : [];
        const total = sortedOut.length + dislikeTargets.length + bookmarked.length + loved.length;
        let done = 0;
        const notify = () => {
          if (typeof onProgress !== 'function') return;
          try { onProgress({ done: Math.min(done, total), total }); } catch (e) { /* */ }
        };
        const tick = (n) => { done += (n || 1); notify(); };
        notify();
        if (sortedOut.length) {
          await this.ensurePlaylist(t('playlistSorted'), sortedOut, tick);
          if (dislikeTargets.length) {
            await forEachLimit(dislikeTargets, 5, async (song) => {
              try { await API.dislikeSong(song.libraryId); } catch (e) { /* */ }
              tick(1);
            });
          }
        }
        if (bookmarked.length) {
          await this.ensurePlaylist(t('playlistBookmarked'), bookmarked, tick);
        }
        if (loved.length) {
          await forEachLimit(loved, 5, async (song) => {
            if (song.libraryId) {
              try { await API.loveSong(song.libraryId); } catch (e) { /* */ }
            }
            tick(1);
          });
        }
        const freedBytes = sortedOut.reduce((sum, song) => sum + (root.Utils.estimateBytes(song.artworkTemplate) || 0), 0);
        return { sorted: sortedOut.length, bookmarked: bookmarked.length, loved: loved.length, freedBytes };
      }
    };
  }

  function buildController() {
    return {
      canPreview: () => true,

      async getPref(key) {
        const settings = await Store.get(Store.key.settings);
        return settings[key];
      },

      async open(source, onProgress) {
        try {
          await Store.ready();
          const ds = appleDataSource();
          let session;
          if (source && source.type === 'resume') {
            session = await Core.restoreSession();
            if (!session) session = await Core.buildSession({ type: 'all' }, ds, { onProgress });
          } else {
            await Core.clearSavedSession();
            session = await Core.buildSession(source, ds, {
              onProgress,
              onUnavailable: (count) => {
                if (typeof onProgress === 'function') onProgress(t('scanMovingUnavailable', { count }));
              }
            });
            Core.saveSession(session, { immediate: true });
          }
          if (!session.queue.length) {
            const err = new Error('EMPTY');
            throw err;
          }
          return { session };
        } catch (err) {
          throw new Error(friendlyMessage(err));
        }
      },

      async hasSavedSession() {
        try {
          return await Core.hasSavedSession();
        } catch (e) {
          return false;
        }
      },

      async decide(session, song, action) {
        session.decide(song, action);
        Core.saveSession(session);
        return { ok: true };
      },

      async setLove(session, song, value) {
        session.setLove(song, value);
        Core.saveSession(session);
      },

      isLoved(session, song) {
        return session.isLoved(song);
      },

      async undo(session) {
        const undone = session.undoLast();
        void undone;
        Core.saveSession(session);
      },

      async revertDecision(session, key) {
        const action = session.decisions.get(key);
        session.decisions.delete(key);
        session.love.delete(key);
        session.order = session.order.filter((k) => k !== key);
        const idx = session.queue.findIndex((s) => Core.keyOf(s) === key);
        if (idx !== -1) session.currentIndex = idx;
        void action;
        Core.saveSession(session);
      },

      async playPreview(song) {
        try {
          await Player.playSong(song);
        } catch (e) { /* */ }
      },

      stopPreview() {
        Player.stop();
      },

      async commit(session, onProgress) {
        return Core.commitSession(session, appleDataSource(), onProgress);
      }
    };
  }

  const overlay = root.UI.createOverlay(buildController());
  root.overlay = overlay;

  async function loadUserLocale() {
    try {
      const settings = await Store.get(Store.key.settings);
      await root.i18n.loadLocale((settings && settings.language) || 'en');
    } catch (e) { /* */ }
  }
  loadUserLocale();

  function availablePlaylists() {
    return appleDataSource().listPlaylists().then((playlists) =>
      Store.get(Store.key.settings).then((settings) =>
        Core.filterBlacklistedPlaylists(playlists, settings.playlistBlacklist)
      )
    );
  }

  function isOpen() {
    return overlay.isOpen;
  }

  function libraryMeta() {
    return (async () => {
      try {
        const cached = await Store.get(Store.key.meta);
        const now = Date.now();
        if (cached && Array.isArray(cached.genres) && cached.genres.length &&
            cached.updatedAt && (now - cached.updatedAt) < 10 * 60 * 1000) {
          return cached;
        }
        const songs = await API.getAllLibrarySongs();
        const genres = new Set();
        const decades = new Set();
        for (const s of songs) {
          if (s.genre) genres.add(String(s.genre).trim());
          const gens = s.genres || [];
          for (const g of gens) if (g) genres.add(String(g).trim());
          if (s.year && String(s.year).length === 4 && Number(s.year) >= 1900) {
            decades.add(String(Math.floor(Number(s.year) / 10) * 10));
          }
        }
        const meta = {
          genres: [...genres].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de')),
          decades: [...decades].filter(Boolean).sort((a, b) => Number(a) - Number(b)),
          updatedAt: now
        };
        await Store.set(Store.key.meta, meta);
        return meta;
      } catch (e) {
        return { genres: [], decades: [], updatedAt: 0 };
      }
    })();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string' || message.type.indexOf('ss:') !== 0) return;
    (async () => {
      switch (message.type) {
        case 'ss:ping':
          return { ok: true, open: overlay.isOpen, hasSession: await Core.hasSavedSession() };
        case 'ss:get-status':
          return { ok: true, open: overlay.isOpen, hasSession: await Core.hasSavedSession() };
        case 'ss:list-playlists':
          return { ok: true, playlists: await availablePlaylists() };
        case 'ss:all-playlists':
          return { ok: true, playlists: await appleDataSource().listPlaylists() };
        case 'ss:library-meta':
          return { ok: true, meta: await libraryMeta() };
        case 'ss:open':
          overlay.open(message.source || { type: 'all' });
          return { ok: true };
        case 'ss:start-session':
          overlay.open(message.source);
          return { ok: true };
        case 'ss:close':
          overlay.close();
          return { ok: true };
        case 'ss:toggle':
          await overlay.toggle();
          return { ok: true, open: overlay.isOpen };
        case 'ss:reset-library':
          await Store.refresh();
          if (overlay.isOpen) overlay.close();
          return { ok: true };
        case 'ss:refresh-settings':
          await Store.refresh();
          await loadUserLocale();
          return { ok: true };
        case 'ss:mini-action': {
          const action = message.action;
          let handled = false;
          if (action === 'toggle') {
            if (overlay.isOpen) {
              overlay.close();
            } else {
              overlay.open((await Core.hasSavedSession()) ? { type: 'resume' } : { type: 'all' });
            }
            handled = true;
          } else if (overlay.isOpen && overlay.session) {
            const song = overlay.session.current();
            if (song) {
              handled = true;
              if (action === 'love') {
                const next = !overlay.controller.isLoved(overlay.session, song);
                await overlay.controller.setLove(overlay.session, song, next);
              } else {
                await overlay.controller.decide(overlay.session, song, action);
              }
            }
          }
          return { ok: true, handled };
        }
        default:
          return { ok: false };
      }
    })().then(
      (result) => sendResponse(result),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  });

  root.contentBridge = {
    isOpen,
    close: () => overlay.close()
  };

  window.addEventListener('pagehide', () => {
    if (overlay.session) Core.saveSession(overlay.session, { immediate: true });
  });
})();
