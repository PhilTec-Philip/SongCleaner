(() => {
  const root = window.SongCleaner = window.SongCleaner || {};

  const pending = new Map();
  const eventHandlers = new Map();
  let seq = 0;
  let readyPromise = null;
  let helloInfo = null;

  function nextId() {
    seq += 1;
    return 'ss-' + Date.now().toString(36) + '-' + seq;
  }

  function request(method, args, timeoutMs) {
    const id = nextId();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(id);
        reject(new Error('BRIDGE_TIMEOUT:' + method));
      }, timeoutMs || 20000);
      pending.set(id, { resolve, reject, timer });
      window.postMessage({ __ss: 1, type: 'ss:req', id, method, args }, '*');
    });
  }

  function on(name, handler) {
    if (!eventHandlers.has(name)) eventHandlers.set(name, new Set());
    eventHandlers.get(name).add(handler);
    return () => eventHandlers.get(name).delete(handler);
  }

  function emitLocal(name, data) {
    const set = eventHandlers.get(name);
    if (set) for (const handler of set) {
      try { handler(data); } catch (e) { /* */ }
    }
  }

  window.addEventListener('message', (event) => {
    if (!event || event.source !== window) return;
    const data = event.data;
    if (!data || data.__ss !== 1) return;
    if (data.type === 'ss:res') {
      const entry = pending.get(data.id);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      pending.delete(data.id);
      if (data.ok) entry.resolve(data.result);
      else {
        const err = new Error((data.error && data.error.message) || 'BRIDGE_ERROR');
        err.name = (data.error && data.error.name) || 'BRIDGE_ERROR';
        entry.reject(err);
      }
      return;
    }
    if (data.type === 'ss:event') {
      emitLocal(data.name, data.data);
    }
  });

  async function ensureReady() {
    if (helloInfo) return helloInfo;
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const info = await request('hello', null, 3000);
          helloInfo = info;
          if (info.tokens) {
            const { authorization, mediaUserToken } = info.tokens;
            if (authorization || mediaUserToken) {
              emitLocal('tokens', info.tokens);
            }
          }
          return helloInfo;
        } catch (e) {
          if (attempt === 29) throw e;
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      throw new Error('BRIDGE_UNAVAILABLE');
    })();
    return readyPromise;
  }

  async function getTokens() {
    const info = await ensureReady();
    if (info.tokens && (info.tokens.authorization || info.tokens.mediaUserToken)) {
      return info.tokens;
    }
    return request('getTokens');
  }

  async function waitForTokens(timeoutMs) {
    const deadline = Date.now() + (timeoutMs || 30000);
    for (;;) {
      try {
        const tokens = await getTokens();
        if (tokens.authorization && tokens.mediaUserToken) return tokens;
      } catch (e) { /* */ }
      if (Date.now() > deadline) throw new Error('NO_TOKENS');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  root.Bridge = {
    request,
    on,
    ensureReady,
    getTokens,
    waitForTokens
  };
})();