(() => {
  const root = window.SongCleaner = window.SongCleaner || {};

  function fontUrl(file) {
    try {
      return chrome.runtime.getURL('media/fonts/' + file);
    } catch (e) {
      return 'media/fonts/' + file;
    }
  }

  function fontRules() {
    const face = (family, weight, style, file) =>
      '@font-face{font-family:\'' + family + '\';font-style:' + style + ';font-weight:' + weight +
      ';font-display:swap;src:url(\'' + fontUrl(file) + '\') format(\'woff2\');}';
    return [
      face('JetBrains Mono', 400, 'normal', 'jetbrains-mono-latin-400-normal.woff2'),
      face('JetBrains Mono', 400, 'italic', 'jetbrains-mono-latin-400-italic.woff2'),
      face('JetBrains Mono', 500, 'normal', 'jetbrains-mono-latin-500-normal.woff2'),
      face('JetBrains Mono', 700, 'normal', 'jetbrains-mono-latin-700-normal.woff2'),
      face('Share Tech Mono', 400, 'normal', 'share-tech-mono-latin-400-normal.woff2')
    ].join('');
  }

  const LIGHT = {
    '--font-display': "'Share Tech Mono','JetBrains Mono',Consolas,'Courier New',monospace",
    '--font-mono': "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace",
    '--bg-body': '#ffffff',
    '--bg-card': '#ffffff',
    '--bg-alt': '#f8f9fa',
    '--text': '#111111',
    '--text-head': '#000000',
    '--text-sub': '#222222',
    '--text-muted': '#666666',
    '--border': '#111111',
    '--input-bg': '#ffffff',
    '--accent': '#007a8f',
    '--accent-hover': '#005b6b',
    '--accent-light': '#009cb8',
    '--accent-glow': 'rgba(0,122,143,0.1)',
    '--on-accent': '#0c0f11',
    '--ok': '#0f8a4b',
    '--warn': '#b45309',
    '--danger': '#c1121f',
    '--shadow-sm': 'rgba(0,0,0,0.15)',
    '--shadow-md': 'rgba(0,0,0,0.25)',
    '--shadow-lg': 'rgba(0,0,0,0.35)',
    '--overlay': 'rgba(255,255,255,0.96)'
  };

  const DARK = {
    '--bg-body': '#0b0d0f',
    '--bg-card': '#121518',
    '--bg-alt': '#161a1e',
    '--text': '#dee2e6',
    '--text-head': '#f1f3f5',
    '--text-sub': '#adb5bd',
    '--text-muted': '#78828a',
    '--border': '#24292e',
    '--input-bg': '#14181c',
    '--accent': '#00e5ff',
    '--accent-hover': '#80f2ff',
    '--accent-light': '#b3f7ff',
    '--accent-glow': 'rgba(0,229,255,0.2)',
    '--on-accent': '#0c0f11',
    '--ok': '#2ed573',
    '--warn': '#facc15',
    '--danger': '#ff4d5e',
    '--shadow-sm': 'rgba(0,0,0,0.5)',
    '--shadow-md': 'rgba(0,0,0,0.65)',
    '--shadow-lg': 'rgba(0,0,0,0.8)',
    '--overlay': 'rgba(3,4,5,0.93)'
  };

  function declarations(tokens) {
    return Object.keys(tokens).map((key) => key + ':' + tokens[key]).join(';');
  }

  function block(selector, tokens, scheme) {
    return selector + '{' + declarations(tokens) + ';color-scheme:' + scheme + '}';
  }

  function tokenRules() {
    return block(':root', LIGHT, 'light') +
      '@media (prefers-color-scheme: dark){' + block(':root:not([data-theme="light"])', DARK, 'dark') + '}' +
      block(':root[data-theme="dark"]', DARK, 'dark') +
      block(':root[data-theme="light"]', LIGHT, 'light');
  }

  function hostRules() {
    return block(':host', LIGHT, 'light') +
      '@media (prefers-color-scheme: dark){' + block(':host', DARK, 'dark') + '}';
  }

  function css() {
    return fontRules() + tokenRules();
  }

  function hostCss() {
    return fontRules() + hostRules();
  }

  root.Theme = {
    fontRules,
    tokenRules,
    hostRules,
    css,
    hostCss,
    tokens: { light: LIGHT, dark: DARK }
  };

  if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:' && document.head) {
    if (!document.getElementById('ss-theme')) {
      const style = document.createElement('style');
      style.id = 'ss-theme';
      style.textContent = css();
      document.head.appendChild(style);
    }
  }
})();
