(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const namespaces = {};

  function applyTemplate(message, substitutions) {
    if (!message || substitutions == null) return message;
    if (Array.isArray(substitutions)) {
      let index = 0;
      return message.replace(/\{([a-zA-Z0-9_]+)\}/g, () => {
        const value = substitutions[index];
        index += 1;
        return value === undefined || value === null ? '' : String(value);
      });
    }
    if (typeof substitutions === 'object') {
      return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
        substitutions[name] !== undefined ? String(substitutions[name]) : match);
    }
    return message;
  }

  root.i18n = {
    t(key, substitutions) {
      const stored = namespaces[key];
      const ns = !stored && chrome && chrome.i18n && chrome.i18n.getMessage
        ? chrome.i18n.getMessage(key, substitutions)
        : null;
      const raw = stored || ns || key;
      return applyTemplate(raw, substitutions);
    },
    set(key, value) {
      namespaces[key] = value;
    },
    async loadLocale(locale) {
      const safe = /^[a-z]{2}(-[A-Za-z0-9]+)?$/.test(String(locale || '')) ? locale : 'en';
      try {
        const url = chrome.runtime.getURL('_locales/' + safe + '/messages.json');
        const res = await fetch(url);
        if (!res.ok) return false;
        const data = await res.json();
        for (const [key, entry] of Object.entries(data)) {
          namespaces[key] = entry.message;
        }
        this.locale = safe;
        return true;
      } catch (e) {
        return false;
      }
    }
  };
})();