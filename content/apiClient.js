(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const Bridge = root.Bridge;

  const BASE = '';
  const PAGE_SIZE = 100;
  const MAX_PAGES = 1000;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function api(path, options, retries) {
    const result = await Bridge.request('fetchJson', { path: BASE + path, options }, 30000);
    if (result.status === 401 || result.status === 403) {
      const tokens = await Bridge.getTokens().catch(() => null);
      if (tokens && !(tokens.authorization && tokens.mediaUserToken)) {
        const err = new Error('NO_TOKENS');
        err.name = 'NO_TOKENS';
        throw err;
      }
    }
    return result;
  }

  async function paginate(pathBuilder, afterPage) {
    const out = [];
    let next = pathBuilder(0);
    let page = 0;
    while (next && page < MAX_PAGES) {
      const result = await api(next);
      if (result.status >= 400) {
        const err = new Error('HTTP_' + result.status);
        err.name = 'HTTP_' + result.status;
        err.status = result.status;
        throw err;
      }
      out.push(...((result.data && result.data.data) || []));
      page += 1;
      if (afterPage) afterPage(out.length);
      next = (result.data && result.data.next) || null;
      if (page % 5 === 0) await sleep(80);
    }
    return out;
  }

  function normalizeSong(raw) {
    const a = raw.attributes || {};
    const playCountRel = raw.relationships && raw.relationships.playCountData &&
      raw.relationships.playCountData.data && raw.relationships.playCountData.data[0];
    const playCount = (playCountRel && playCountRel.attributes && playCountRel.attributes.playCount) || a.playCount || 0;
    const release = a.releaseDate ? new Date(a.releaseDate) : null;
    const added = a.addedAt ? new Date(a.addedAt) : null;
    const played = a.lastPlayedDate ? new Date(a.lastPlayedDate) : null;
    return {
      id: raw.id,
      libraryId: raw.id,
      catalogId: (a.playParams && a.playParams.id) || null,
      title: a.name || 'Unbekannter Titel',
      artist: a.artistName || 'Unbekannter Künstler',
      album: a.albumName || null,
      genre: (a.genreNames && a.genreNames[0]) || null,
      genres: a.genreNames || [],
      durationMs: a.durationInMillis || null,
      year: release ? release.getFullYear() : null,
      dateAdded: added ? added.getTime() : null,
      lastPlayed: played ? played.getTime() : null,
      playCount,
      artworkTemplate: (a.artwork && a.artwork.url) || null,
      url: a.url || null,
      isrc: a.isrc || null,
      previewUrl: (a.previews && a.previews[0] && a.previews[0].url) || null,
      source: 'apple'
    };
  }

  async function getAllLibrarySongs(onProgress) {
    await Bridge.waitForTokens();
    return paginate(
      (offset) => `/v1/me/library/songs?limit=${PAGE_SIZE}&offset=${offset}&include=playCountData`,
      onProgress
    ).then((items) => items.map(normalizeSong));
  }

  async function listPlaylists() {
    await Bridge.waitForTokens();
    return paginate(
      (offset) => `/v1/me/library/playlists?limit=${PAGE_SIZE}&offset=${offset}`
    );
  }

  async function getPlaylistTracks(playlistId) {
    await Bridge.waitForTokens();
    return paginate(
      (offset) => `/v1/me/library/playlists/${playlistId}/tracks?limit=${PAGE_SIZE}&offset=${offset}`
    );
  }

  async function findPlaylistByName(name) {
    const playlists = await listPlaylists();
    return playlists.find((p) => (p.attributes && p.attributes.name) === name) || null;
  }

  async function createPlaylist(name) {
    await Bridge.waitForTokens();
    const body = {
      attributes: { name }
    };
    const result = await api('/v1/me/library/playlists', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (result.status >= 400) {
      const err = new Error('CREATE_PLAYLIST_FAILED:' + result.status);
      err.name = 'CREATE_PLAYLIST_FAILED';
      err.status = result.status;
      err.detail = result.data;
      throw err;
    }
    return (result.data && result.data.data && result.data.data[0]) || null;
  }

  async function addTracksToPlaylist(playlistId, songIds, type) {
    await Bridge.waitForTokens();
    const kind = type || 'songs';
    const body = { data: songIds.map((id) => ({ id, type: kind })) };
    const result = await api(`/v1/me/library/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (result.status >= 400) {
      const err = new Error('ADD_TRACKS_FAILED:' + result.status);
      err.name = 'ADD_TRACKS_FAILED';
      err.status = result.status;
      err.detail = result.data;
      throw err;
    }
    return result;
  }

  async function ensurePlaylistFor(name, songIds) {
    let playlist = await findPlaylistByName(name);
    let created = false;
    if (!playlist) {
      playlist = await createPlaylist(name);
      created = true;
    }
    if (playlist && songIds && songIds.length) {
      await addTracksToPlaylist(playlist.id, songIds);
    }
    return { playlist, created };
  }

  async function setRating(librarySongId, value) {
    await Bridge.waitForTokens();
    const body = {
      type: 'rating',
      attributes: { value }
    };
    const result = await api(`/v1/me/ratings/library-songs/${librarySongId}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    return result.status < 400;
  }

  async function loveSong(librarySongId) {
    return setRating(librarySongId, 1);
  }

  async function dislikeSong(librarySongId) {
    return setRating(librarySongId, -1);
  }

  root.API = {
    api,
    normalizeSong,
    getAllLibrarySongs,
    listPlaylists,
    getPlaylistTracks,
    findPlaylistByName,
    createPlaylist,
    addTracksToPlaylist,
    ensurePlaylistFor,
    setRating,
    loveSong,
    dislikeSong
  };
})();