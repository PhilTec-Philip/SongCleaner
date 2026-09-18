(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const Bridge = root.Bridge;

  const state = {
    currentSong: null,
    currentSongKey: null,
    playing: false,
    pendingSong: null,
    timer: null
  };

  const handlers = {
    nowPlaying: new Set(),
    playing: new Set(),
    stopped: new Set()
  };

  Bridge.on('nowPlaying', (data) => {
    if (!data) return;
    for (const h of handlers.nowPlaying) {
      try { h(data); } catch (e) { /* */ }
    }
  });

  Bridge.on('playbackState', (data) => {
    const str = String(data || '');
    const isPlaying = str === 'playing';
    state.playing = isPlaying;
    if (isPlaying) {
      for (const h of handlers.playing) {
        try { h(); } catch (e) { /* */ }
      }
    }
  });

  function onNowPlaying(handler) {
    handlers.nowPlaying.add(handler);
    return () => handlers.nowPlaying.delete(handler);
  }

  function onPlaying(handler) {
    handlers.playing.add(handler);
    return () => handlers.playing.delete(handler);
  }

  async function ensurePlayer() {
    await Bridge.ensureReady();
    const ready = await Bridge.request('playerReady');
    if (!ready) throw new Error('NO_PLAYER');
  }

  async function playSong(song, previewSeconds) {
    clearAuto();
    const id = song && (song.catalogId || song.libraryId || song.id);
    if (!id) return;
    if (state.currentSongKey === id) {
      setAutoTimer(previewSeconds);
      return;
    }
    state.pendingSong = song;
    try {
      await Bridge.request('playSong', { id });
      state.currentSongKey = id;
      state.playing = true;
    } catch (err) {
      state.pendingSong = null;
      state.currentSongKey = null;
      throw err;
    }
    setAutoTimer(previewSeconds);
  }

  function setAutoTimer(previewSeconds) {
    clearAuto();
    if (previewSeconds && previewSeconds > 0) {
      state.timer = setTimeout(() => {
        stop();
      }, previewSeconds * 1000);
    }
  }

  async function stop() {
    clearAuto();
    state.pendingSong = null;
    state.playing = false;
    state.currentSongKey = null;
    try {
      await Bridge.request('stop');
    } catch (e) { /* */ }
    for (const h of handlers.stopped) {
      try { h(); } catch (e) { /* */ }
    }
  }

  async function pause() {
    clearAuto();
    try {
      await Bridge.request('pause');
    } catch (e) { /* */ }
  }

  async function next() {
    clearAuto();
    try {
      await Bridge.request('next');
    } catch (e) { /* */ }
  }

  function clearAuto() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function isPlaying() {
    return state.playing;
  }

  root.Player = {
    onNowPlaying,
    onPlaying,
    ensurePlayer,
    playSong,
    stop,
    pause,
    next,
    isPlaying
  };
})();