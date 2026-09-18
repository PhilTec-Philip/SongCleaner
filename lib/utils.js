(() => {
  const root = window.SongCleaner = window.SongCleaner || {};

  function normalizeTitle(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function normalizeArtist(value) {
    return normalizeTitle(value).replace(/^(the|die|der|das)\s+/, '');
  }

  const VARIANT_TOKENS = {
    remaster: ['remaster', 'remastered', 'remaster 2015', 'digitally remastered', 're-mastered', 'rmx'],
    acoustic: ['acoustic', 'live acoustic', 'unplugged'],
    live: ['live', 'live at', 'recorded live', 'in concert', 'on tour'],
    deluxe: ['deluxe', 'deluxe edition', 'deluxe version'],
    bonus: ['bonus track', 'bonus'],
    edit: ['radio edit', 'single edit', 'edit', 'short version', 'clean edit'],
    album: ['album version', 'original version', 'album'],
    instrumental: ['instrumental', 'karaoke version', 'no vocals'],
    extended: ['extended', 'extended mix', 'extended version'],
    demo: ['demo', 'demo version'],
    cover: ['cover version', 'tribute'],
    feat: ['remix', 'rework', 'ft.', 'feat.', 'original mix', 'club mix']
  };

  function variantOfTitle(title) {
    const t = normalizeTitle(title);
    if (!t) return null;
    for (const [variant, tokens] of Object.entries(VARIANT_TOKENS)) {
      for (const token of tokens) {
        const norm = normalizeTitle(token);
        if (norm && t.includes(norm)) return variant;
      }
    }
    return null;
  }

  function songKey(song) {
    return song.libraryId || song.catalogId || song.id;
  }

  function artworkUrl(template, width) {
    const size = width || 300;
    return template ? template.replace('{w}', size).replace('{h}', size).replace('/{f}', '') : null;
  }

  function formatDuration(ms) {
    if (!ms) return '';
    const totalSeconds = Math.round(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function monthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(monthKeyValue) {
    const [year, month] = monthKeyValue.split('-');
    const names = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    const en = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const lang = (root.i18n && root.i18n.locale) || 'de';
    const list = lang.startsWith('de') ? names : en;
    return `${list[Number(month) - 1]} ${year}`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function estimateBytes(template) {
    if (!template) return 0;
    const runtimeHint = /\.m4a|\.aac/i.test(template) ? 9000000 : 12000000;
    return runtimeHint;
  }

  function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  root.Utils = {
    normalizeTitle,
    normalizeArtist,
    variantOfTitle,
    songKey,
    artworkUrl,
    formatDuration,
    monthKey,
    monthLabel,
    todayKey,
    shuffle,
    estimateBytes,
    debounce
  };
})();