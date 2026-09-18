(() => {
  const MARKER = { __ss: 1 };
  const TOKEN_HOSTS = ['amp-api.music.apple.com', 'amp-api-edge.music.apple.com'];
  const state = {
    authorization: null,
    mediaUserToken: null,
    listeners: new Set()
  };

  function emit(name, data) {
    for (const dispatch of state.listeners) {
      try { dispatch({ name, data }); } catch (e) { /* */ }
    }
    try {
      window.postMessage(Object.assign({}, MARKER, { type: 'ss:event', name, data }), '*');
    } catch (e) { /* */ }
  }

  function isAmpUrl(url) {
    return typeof url === 'string' && TOKEN_HOSTS.some((h) => url.indexOf(h) !== -1);
  }

  function readHeaders(headers) {
    const out = {};
    if (!headers) return out;
    if (typeof headers.forEach === 'function') {
      headers.forEach((v, k) => { out[String(k).toLowerCase()] = v; });
    } else if (typeof headers.get === 'function') {
      const keys = ['authorization', 'media-user-token'];
      for (const k of keys) {
        const v = headers.get(k);
        if (v) out[k] = v;
      }
    } else if (typeof headers === 'object') {
      for (const k of Object.keys(headers)) {
        out[String(k).toLowerCase()] = headers[k];
      }
    }
    return out;
  }

  function captureFromHeaders(headers) {
    if (!headers) return false;
    let changed = false;
    const auth = headers['authorization'] || headers['Authorization'];
    const mut = headers['media-user-token'] || headers['Media-User-Token'];
    if (auth) {
      const token = String(auth).replace(/^Bearer\s+/i, '');
      if (token && token !== state.authorization) {
        state.authorization = token;
        changed = true;
      }
    }
    if (mut) {
      const token = String(mut).trim();
      if (token && token !== state.mediaUserToken) {
        state.mediaUserToken = token;
        changed = true;
      }
    }
    if (changed) emit('tokens', getTokens());
    return changed;
  }

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (isAmpUrl(url)) {
      if (input && input.headers) captureFromHeaders(readHeaders(input.headers));
      if (init && init.headers) captureFromHeaders(readHeaders(init.headers));
    }
    return originalFetch.apply(this, arguments);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function proxyOpen(method, url) {
    this.__ssUrl = url;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function proxyHeader(k, v) {
    if (this.__ssUrl && isAmpUrl(this.__ssUrl)) {
      const h = {};
      h[String(k).toLowerCase()] = v;
      captureFromHeaders(h);
    }
    return originalSetHeader.apply(this, arguments);
  };

  function tokenFromMusicKit() {
    const mk = getMk();
    if (!mk) return false;
    let changed = false;
    if (mk.developerToken && !state.authorization) {
      state.authorization = mk.developerToken;
      changed = true;
    }
    if (mk.musicUserToken && !state.mediaUserToken) {
      state.mediaUserToken = mk.musicUserToken;
      changed = true;
    }
    if (changed) emit('tokens', getTokens());
    return changed;
  }

  function tokenFromCookie() {
    const found = document.cookie.split(';').map((c) => c.trim()).find((c) => c.indexOf('media-user-token=') === 0);
    if (found && !state.mediaUserToken) {
      state.mediaUserToken = decodeURIComponent(found.split('=').slice(1).join('='));
      emit('tokens', getTokens());
      return true;
    }
    return false;
  }

  function getTokens() {
    return {
      authorization: state.authorization || null,
      mediaUserToken: state.mediaUserToken || null
    };
  }

  function getMk() {
    if (!window.MusicKit) return null;
    try {
      const instance = typeof window.MusicKit.getInstance === 'function' ? window.MusicKit.getInstance() : null;
      return instance || window.MusicKit;
    } catch (e) {
      return null;
    }
  }

  function waitForPlayer() {
    if (window.MusicKit && getMk()) {
      tokenFromMusicKit();
      emit('player:ready', true);
      return;
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (window.MusicKit && getMk()) {
        window.clearInterval(timer);
        tokenFromMusicKit();
        emit('player:ready', true);
        return;
      }
      attempts += 1;
      if (attempts > 200) window.clearInterval(timer);
    }, 3000);
  }

  function normalizeNowPlaying(item) {
    if (!item) return null;
    const a = item.attributes || item;
    const playParams = a.playParams || {};
    return {
      title: a.name || a.title || null,
      artist: a.artistName || a.artist || null,
      album: a.albumName || a.album || null,
      artworkTemplate: (a.artwork && a.artwork.url) || (item.artwork && item.artwork.url) || null,
      durationMs: a.durationInMillis || a.duration || null,
      catalogId: playParams.id || a.id || item.id || null
    };
  }

  async function fetchJson(path, options) {
    const url = 'https://amp-api.music.apple.com' + path;
    const reqOptions = Object.assign({
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      }
    }, options || {});
    const headers = {};
    if (state.authorization) headers.authorization = 'Bearer ' + state.authorization;
    if (state.mediaUserToken) headers['media-user-token'] = state.mediaUserToken;
    reqOptions.headers = Object.assign({}, reqOptions.headers, headers);
    const res = await originalFetch.call(window, url, reqOptions);
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = text; }
    }
    return { status: res.status, ok: res.ok, data };
  }

  async function playSong(id) {
    const mk = getMk();
    if (!mk) throw new Error('NO_PLAYER');
    const attempts = [
      { items: [{ id: String(id), type: 'songs' }] },
      { songs: [String(id)] },
      { song: String(id) }
    ];
    let lastError = null;
    for (const queueOptions of attempts) {
      try {
        await mk.setQueue(Object.assign({}, queueOptions, { startPlaying: true }));
        return;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('PLAYBACK_FAILED');
  }

  function hoverItem(item) {
    if (!item || !item.attributes) return;
    const mk = getMk();
    if (mk) {
      mk.nowPlayingItem = item;
    }
  }

  const musicKitActions = {
    playerReady: () => Boolean(getMk()),
    playSong: (args) => playSong(args && args.id),
    pause: () => getMk() && getMk().pause(),
    next: () => getMk() && getMk().next(),
    stop: async () => {
      const mk = getMk();
      if (!mk) return;
      try { mk.pause(); await mk.seekToTime(0); } catch (e) { /* */ }
    },
    seekTo: (args) => getMk() && getMk().seekToTime(args && args.seconds),
    getNowPlaying: () => normalizeNowPlaying(getMk() && getMk().nowPlayingItem),
    getTokens: () => getTokens()
  };

  const actions = Object.assign({
    hello: () => ({
      bridgeVersion: 1,
      playerReady: Boolean(getMk()),
      tokens: getTokens()
    }),
    getTokens: () => getTokens(),
    fetchJson: async (args) => fetchJson(args && args.path, args && args.options)
  }, musicKitActions);

  function handleMessage(event) {
    if (!event || event.source !== window) return;
    const data = event.data;
    if (!data || data.__ss !== 1 || data.type !== 'ss:req') return;
    const { id, method, args } = data;
    const responder = (ok, payload) => {
      const msg = Object.assign({}, MARKER, { type: 'ss:res', id, ok });
      if (ok) msg.result = payload;
      else msg.error = payload;
      window.postMessage(msg, '*');
    };
    const fn = actions[method];
    if (!fn) {
      responder(false, { name: 'NO_METHOD', message: 'Unknown method: ' + method });
      return;
    }
    Promise.resolve()
      .then(() => fn(args))
      .then((result) => responder(true, result === undefined ? null : result))
      .catch((err) => responder(false, { name: err && err.name, message: err && err.message }));
  }

  window.addEventListener('message', handleMessage);
  window.addEventListener('load', () => {
    tokenFromCookie();
    waitForPlayer();
  });
  waitForPlayer();
  tokenFromCookie();
})();