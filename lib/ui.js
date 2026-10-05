(() => {
  const root = window.SongCleaner = window.SongCleaner || {};
  const Utils = root.Utils;
  const Core = root.Core;

  const I18N_KEYS = new Map([
    ['keep', 'actionKeep'],
    ['sortout', 'actionSortOut'],
    ['love', 'actionLove']
  ]);

  function t(key, sub) {
    return root.i18n.t(key, sub);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hueFor(input) {
    let hash = 0;
    const str = String(input || 'song');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'value') node.value = value;
      else node.setAttribute(key, value);
    }
    if (children !== undefined && children !== null) {
      for (const child of [].concat(children)) {
        if (child) node.appendChild(child);
      }
    }
    return node;
  }

  const OVERLAY_STYLES = `
    *{box-sizing:border-box}
    .wrap{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;
      background:var(--overlay);color:var(--text);font-family:var(--font-mono);font-size:15px;line-height:1.7;
      -webkit-font-smoothing:antialiased}

    .header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);
      background:var(--bg-card);position:relative;z-index:5}
    .logo{width:28px;height:28px;flex:none;object-fit:contain}
    .brand{font-family:var(--font-display);font-size:15px;letter-spacing:2px;text-transform:uppercase;color:var(--text-head)}
    .spacer{flex:1}
    .counter{font-size:12px;color:var(--text-muted);white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:1px}
    .bar-wrapper{position:relative;height:4px;background:var(--bg-alt);border-bottom:1px solid var(--border);flex:none}
    .bar{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--accent);transition:width .25s steps(12)}

    .iconbtn{appearance:none;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;
      width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;
      transition:color .08s linear,border-color .08s linear,background .08s linear}
    .iconbtn:hover{border-color:var(--accent);color:var(--accent)}
    .iconbtn:disabled{opacity:.35;cursor:default}
    .iconbtn[data-active=true]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}

    .main{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative}
    .view{position:absolute;inset:0;display:none;flex-direction:column}
    .view[data-active=true]{display:flex}

    .center{flex:1;display:flex;align-items:center;justify-content:center}
    .spinner{width:34px;height:34px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);
      animation:ssspin .8s linear infinite}
    @keyframes ssspin{to{transform:rotate(360deg)}}
    .centermsg{color:var(--text-muted);font-size:14px;text-align:center;padding:0 24px;line-height:1.7}
    .loadtext{color:var(--accent);font-family:var(--font-display);font-size:18px;letter-spacing:2px}

    .deck{flex:1;display:flex;align-items:center;justify-content:center;padding:24px;position:relative}
    .card{position:absolute;width:min(360px,86vw);height:min(430px,62vh);overflow:hidden;
      background:var(--bg-card);border:1px solid var(--border);box-shadow:8px 8px 0 var(--shadow-md);
      transform-origin:center center;will-change:transform;touch-action:none}
    .card .art{position:absolute;inset:0;background-size:cover;background-position:center}
    .card .artgrad{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
    .card .artgrad span{font-size:72px;font-weight:700;color:rgba(255,255,255,.9);font-family:var(--font-display)}
    .card .shade{position:absolute;left:0;right:0;bottom:0;height:62%;
      background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.92))}
    .card .info{position:absolute;left:0;right:0;bottom:0;padding:18px 20px}
    .card .title{font-family:var(--font-display);font-size:22px;line-height:1.2;margin-bottom:4px;color:#fff;letter-spacing:1px}
    .card .artist{font-size:14px;color:#d7dde0;margin-bottom:6px}
    .card .meta{font-size:12px;color:#a8b3b8}
    .card .chip{display:inline-block;margin:8px 4px 0 0;padding:2px 8px;border:1px solid var(--accent);background:transparent;
      font-size:11px;color:var(--accent);font-weight:500;letter-spacing:.5px}
    .card .plays{position:absolute;top:16px;right:16px;padding:3px 9px;border:1px solid var(--accent);background:rgba(0,0,0,.6);
      font-size:11px;color:var(--accent);font-variant-numeric:tabular-nums}
    .card .gesture{position:absolute;top:26px;left:20px;padding:6px 14px;font-family:var(--font-display);
      font-size:16px;letter-spacing:2px;text-transform:uppercase;opacity:0;transform:scale(.85)}
    .card .gesture.sort{color:var(--danger);border:2px solid var(--danger);background:rgba(0,0,0,.55)}
    .card .gesture.keep{color:var(--ok);border:2px solid var(--ok);background:rgba(0,0,0,.55)}
    .card.deciding .gesture{opacity:1}
    .card.running{transition:transform .3s ease,opacity .3s ease}
    .card.out-right{transform:translateX(130%) rotate(22deg) !important;opacity:0}
    .card.out-left{transform:translateX(-130%) rotate(-22deg) !important;opacity:0}
    .card .heartbadge{position:absolute;top:16px;left:16px;display:flex;color:var(--accent);opacity:0;
      transition:opacity .2s;filter:drop-shadow(0 0 8px var(--accent-glow))}
    .card .heartbadge[data-on=true]{opacity:1}
    .card .loved{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-top:6px;font-weight:700}

    .actions{display:flex;align-items:flex-start;justify-content:center;gap:14px;padding:18px 12px 26px}
    .act-wrap{display:flex;flex-direction:column;align-items:center;min-width:92px}
    .act{width:56px;height:56px;border:1px solid var(--border);cursor:pointer;background:var(--bg-card);color:var(--text);
      display:flex;align-items:center;justify-content:center;font-size:21px;
      box-shadow:4px 4px 0 var(--shadow-sm);
      transition:transform .08s linear,background .08s linear,color .08s linear,border-color .08s linear}
    .act svg{display:block}
    .act:hover{border-color:var(--accent);color:var(--accent)}
    .act:active{transform:translate(2px,2px);box-shadow:none}
    .act.sort{color:var(--danger);border-color:var(--danger)}
    .act.sort:hover{background:var(--danger);color:var(--on-accent)}
    .act.keep{color:var(--ok);border-color:var(--ok)}
    .act.keep:hover{background:var(--ok);color:var(--on-accent)}
    .act.love{color:var(--accent);border-color:var(--accent)}
    .act.love:hover{background:var(--accent);color:var(--on-accent)}
    .act.love[data-on=true]{background:var(--accent);color:var(--on-accent)}
    .act-label{font-size:11px;color:var(--text-muted);text-align:center;margin-top:6px;text-transform:uppercase;letter-spacing:1px}

    .hints{text-align:center;font-size:11px;color:var(--text-muted);padding:0 16px 14px;line-height:1.7}
    .hints::before{content:'// ';color:var(--accent)}

    .listwrap{flex:1;overflow:auto;padding:12px 16px 90px}
    .search{width:100%;margin-bottom:10px;padding:10px 12px;border:1px solid var(--border);background:var(--input-bg);
      color:var(--text);font-size:14px;outline:none;font-family:var(--font-mono)}
    .search::placeholder{color:var(--text-muted)}
    .search:focus{border-color:var(--accent)}
    .row{display:flex;align-items:center;gap:12px;padding:9px 10px;cursor:pointer;border-bottom:1px solid var(--border);
      transition:background .08s linear}
    .row:hover{background:var(--bg-alt)}
    .row.sel{background:var(--accent-glow)}
    .row.cur{box-shadow:inset 3px 0 0 var(--accent)}
    .checkbox{width:20px;height:20px;border:1px solid var(--border);flex:none;display:flex;
      align-items:center;justify-content:center;font-size:12px;color:var(--on-accent)}
    .row.sel .checkbox{background:var(--accent);border-color:var(--accent)}
    .cover{width:42px;height:42px;flex:none;background-size:cover;background-position:center;
      display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;border:1px solid var(--border);font-family:var(--font-display)}
    .rowinfo{flex:1;min-width:0}
    .r-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-head)}
    .r-artist{font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rmeta{font-size:11px;color:var(--text-muted);white-space:nowrap}
    .chip-action{flex:none;font-size:11px;font-weight:700;padding:3px 9px;letter-spacing:1px;text-transform:uppercase}
    .chip-action.sortout{background:var(--danger);color:var(--on-accent)}
    .chip-action.keep{background:var(--ok);color:var(--on-accent)}
    .chip-action.love{border:1px solid var(--accent);color:var(--accent)}
    .batch{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;background:var(--bg-card);
      border-top:1px solid var(--border);display:flex;gap:8px;align-items:center}
    .bact{flex:1;padding:11px 8px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:12px;
      font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:1px;font-family:var(--font-mono)}
    .bact:hover{border-color:var(--accent);color:var(--accent)}
    .bact.sort:hover{border-color:var(--danger);color:var(--danger)}
    .bact.keep:hover{border-color:var(--ok);color:var(--ok)}
    .bact.clear{flex:none;width:44px}

    .reviewwrap{flex:1;overflow:auto;padding:16px 16px 90px}
    .review-head{font-family:var(--font-display);font-size:20px;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;color:var(--text-head)}
    .review-sub{font-size:12px;color:var(--text-muted);margin-bottom:14px}
    .rev-group{margin-bottom:14px}
    .rev-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--text-sub);margin:10px 4px 6px}
    .rev-title::before{content:'// ';color:var(--accent)}
    .rev-row{display:flex;align-items:center;gap:12px;padding:8px;background:var(--bg-alt);border:1px solid var(--border)}
    .rev-row .cover{width:34px;height:34px}
    .rev-remove{flex:none;width:30px;height:30px;border:1px solid transparent;background:transparent;color:var(--danger);
      cursor:pointer;font-size:15px}
    .rev-remove:hover{border-color:var(--danger)}
    .commit-bar{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;background:var(--bg-card);border-top:1px solid var(--border)}
    .commit{width:100%;padding:14px;border:1px solid var(--accent);color:var(--on-accent);font-size:14px;font-weight:700;
      text-transform:uppercase;letter-spacing:2px;cursor:pointer;background:var(--accent);font-family:var(--font-mono);
      box-shadow:4px 4px 0 var(--shadow-md);
      transition:background .08s linear,color .08s linear,box-shadow .08s linear,transform .08s linear}
    .commit:hover{background:transparent;color:var(--accent)}
    .commit:active{transform:translate(2px,2px);box-shadow:none}
    .commit:disabled{opacity:.4;cursor:default}
    .commit-hint{font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px}
    .commit-hint::before{content:'// ';color:var(--accent)}

    .done{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}
    .done .check{width:76px;height:76px;display:flex;align-items:center;justify-content:center;font-size:34px;
      color:var(--accent);margin-bottom:18px;border:1px solid var(--accent);box-shadow:6px 6px 0 var(--shadow-sm)}
    .done h2{font-family:var(--font-display);font-size:24px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;color:var(--text-head)}
    .done p{color:var(--text-muted);font-size:14px;margin:0 0 6px}
    .done .again{margin-top:18px;padding:12px 26px;border:1px solid var(--accent);background:transparent;color:var(--accent);
      font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;cursor:pointer;font-family:var(--font-mono)}
    .done .again:hover{background:var(--accent);color:var(--on-accent)}

    .toasts{position:fixed;top:16px;right:16px;z-index:10;display:flex;flex-direction:column;gap:8px;max-width:320px}
    .toast{padding:10px 14px;background:var(--bg-card);border:1px solid var(--border);color:var(--text);font-size:13px;
      line-height:1.5;box-shadow:4px 4px 0 var(--shadow-md);animation:sstoast .2s steps(3,end)}
    .toast.err{border-color:var(--danger);color:var(--danger)}
    @keyframes sstoast{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
  `;

  class Overlay {
    constructor(controller) {
      this.controller = controller;
      this.session = null;
      this.view = 'none';
      this.selection = new Set();
      this.loveState = false;
      this.host = null;
      this.shadow = null;
      this.deck = [];
      this._keyHandler = null;
      this._bound = null;
    }

    get isOpen() {
      return Boolean(this.host);
    }

    createDom() {
      const host = document.createElement('div');
      host.id = 'songcleaner-overlay-host';
      host.style.all = 'initial';
      const shadow = host.attachShadow({ mode: 'open' });
      this.host = host;
      this.shadow = shadow;

      const template = `
        <style>:host{all:initial;display:block}${root.Theme ? root.Theme.hostCss() : ''}${OVERLAY_STYLES}</style>
        <div class="wrap">
          <div class="header">
            <img class="logo" src="{{logo}}" alt="">
            <div class="brand">SongCleaner</div>
            <div class="spacer"></div>
            <div class="counter"></div>
            <button class="iconbtn" data-role="view-list" title="Liste">{{i:view-list}}</button>
            <button class="iconbtn" data-role="view-cards" title="Karten">{{i:view-grid}}</button>
            <button class="iconbtn" data-role="review" title="Review">{{i:check}}</button>
            <button class="iconbtn" data-role="undo" title="Undo">{{i:undo}}</button>
            <button class="iconbtn" data-role="close" title="Close">{{i:close}}</button>
          </div>
          <div class="bar-wrapper"><div class="bar"></div></div>
          <div class="main">
            <div class="view" data-view="loading">
              <div class="center"><div class="spinner"></div></div>
              <div class="center"><div class="loadtext" data-role="loadtext"></div></div>
            </div>
            <div class="view" data-view="cards">
              <div class="deck"></div>
              <div class="actions">
                <div class="act-wrap"><button class="act sort">{{i:thumb-down}}</button><div class="act-label">Aussortieren</div></div>
                <div class="act-wrap"><button class="act love">{{i:heart}}</button><div class="act-label">Liken</div></div>
                <div class="act-wrap"><button class="act keep">{{i:thumb-up}}</button><div class="act-label">Behalten</div></div>
              </div>
              <div class="hints">Links: Aussortieren · Rechts: Behalten · L: Liken · Z: Rückgängig · Esc: Schließen</div>
            </div>
            <div class="view" data-view="list">
              <div class="listwrap"></div>
              <div class="batch">
                <button class="bact sort">Aussortieren</button>
                <button class="bact keep">Behalten</button>
                <button class="bact clear">{{i:close}}</button>
              </div>
            </div>
            <div class="view" data-view="review">
              <div class="reviewwrap"></div>
              <div class="commit-bar">
                <button class="commit">Bestätigen</button>
                <div class="commit-hint">Aussortierte Songs wandern in eine Playlist – gelöscht wird nichts.</div>
              </div>
            </div>
            <div class="view" data-view="empty">
              <div class="center"><div class="centermsg">Keine Songs in dieser Auswahl.</div></div>
            </div>
            <div class="view" data-view="error">
              <div class="center"><div class="centermsg" data-role="errormsg"></div></div>
            </div>
            <div class="view" data-view="done">
              <div class="done">
                <div class="check">{{i:check-circle-outline}}</div>
                <h2>Fertig!</h2>
                <p data-role="done-text"></p>
                <button class="again">Neue Sitzung</button>
              </div>
            </div>
          </div>
          <div class="toasts"></div>
        </div>
      `;

      let logoUrl = 'icons/logo.png';
      try { logoUrl = chrome.runtime.getURL('icons/logo.png'); } catch (e) { /* */ }
      shadow.innerHTML = template
        .replace(/\{\{logo\}\}/g, logoUrl)
        .replace(/\{\{i:([a-z0-9-]+)\}\}/g, (_, name) => root.Icon.svg(name));
      shadow.querySelector('.done .check').innerHTML = root.Icon.svg('check-circle-outline', 34);
      shadow.querySelector('.bact.clear').innerHTML = root.Icon.svg('close', 16);

      document.body.appendChild(host);
      this.bindActions();
    }

    bindActions() {
      const shadow = this.shadow;
      shadow.querySelector('[data-role="close"]').addEventListener('click', () => this.close());
      shadow.querySelector('[data-role="view-list"]').addEventListener('click', () => this.showView('list'));
      shadow.querySelector('[data-role="view-cards"]').addEventListener('click', () => this.showView('cards'));
      shadow.querySelector('[data-role="review"]').addEventListener('click', () => this.showView('review'));
      shadow.querySelector('[data-role="undo"]').addEventListener('click', () => this.doUndo());
      const actSort = shadow.querySelector('.act.sort');
      const actKeep = shadow.querySelector('.act.keep');
      const actLove = shadow.querySelector('.act.love');
      actSort.addEventListener('click', () => this.doDecide('sortout'));
      actKeep.addEventListener('click', () => this.doDecide('keep'));
      actLove.addEventListener('click', () => this.toggleLove());

      const batchSort = shadow.querySelector('.bact.sort');
      const batchKeep = shadow.querySelector('.bact.keep');
      const batchClear = shadow.querySelector('.bact.clear');
      batchSort.addEventListener('click', () => this.batchDecide('sortout'));
      batchKeep.addEventListener('click', () => this.batchDecide('keep'));
      batchClear.addEventListener('click', () => { this.selection.clear(); this.renderList(); });

      shadow.querySelector('.commit').addEventListener('click', () => this.doCommit());
      shadow.querySelector('.commit-hint').textContent = t('commitSortOutHint');
      shadow.querySelector('.again').addEventListener('click', () => this.close());
    }

    bindKeys() {
      if (this._keyHandler) return;
      this._keyHandler = (event) => {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (this.view === 'cards') {
          if (event.key === 'ArrowLeft') { event.preventDefault(); this.doDecide('sortout'); }
          else if (event.key === 'ArrowRight') { event.preventDefault(); this.doDecide('keep'); }
          else if (event.key === 'l' || event.key === 'L') this.toggleLove();
          else if (event.key === 'z' || event.key === 'Z') this.doUndo();
        }
        if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      };
      document.addEventListener('keydown', this._keyHandler, true);
    }

    open(source) {
      if (!this.host) this.createDom();
      this.bindKeys();
      this.host.style.display = 'block';
      this.view = 'none';
      this.session = null;
      this.showView('loading');
      const loadText = () => this.shadow.querySelector('[data-role="loadtext"]');
      const loadTextNode = loadText();
      if (loadTextNode) loadTextNode.textContent = '';
      this.controller.open(source, (progress) => {
        const node = loadText();
        if (!node) return;
        node.textContent = typeof progress === 'string'
          ? progress
          : t('stateLoading') + ' ' + (progress || 0);
      })
        .then(({ session }) => {
          this.session = session;
          if (!session || !session.count() && session.queue.length === 0) {
            throw new Error('EMPTY');
          }
          this.deck = [];
          this.selection.clear();
          this.showView('cards');
          this.renderHeader();
        })
        .catch((err) => {
          if (err && err.name === 'EMPTY') {
            this.showView('empty');
          } else {
            this.showError((err && err.message) || String(err));
          }
        });
      return this;
    }

    close() {
      if (this.controller.stopPreview) this.controller.stopPreview();
      if (this._keyHandler) {
        document.removeEventListener('keydown', this._keyHandler, true);
        this._keyHandler = null;
      }
      if (this.host) {
        this.host.parentNode && this.host.parentNode.removeChild(this.host);
        this.host = null;
        this.shadow = null;
      }
      this.session = null;
    }

    async toggle() {
      if (this.isOpen) {
        this.close();
        return false;
      }
      let resume = false;
      try { resume = await this.controller.hasSavedSession(); } catch (e) { resume = false; }
      this.open(resume ? { type: 'resume' } : { type: 'all' });
      return this.isOpen;
    }

    showView(name) {
      this.view = name;
      const views = this.shadow.querySelectorAll('.view');
      for (const v of views) {
        v.dataset.active = v.dataset.view === name ? 'true' : 'false';
      }
      if (name === 'cards' && this.session) this.renderDeck();
      if (name === 'list' && this.session) this.renderList();
      if (name === 'review' && this.session) this.renderReview();
      this.renderHeader();
    }

    renderHeader() {
      const bar = this.shadow.querySelector('.bar');
      if (!this.session) {
        this.updateToday();
        bar.style.width = '0';
        return;
      }
      const total = this.session.queue.length;
      const decided = this.session.count();
      bar.style.width = total ? `${Math.round((decided / total) * 100)}%` : '0';
      const reviewBtn = this.shadow.querySelector('[data-role="review"]');
      if (reviewBtn) reviewBtn.dataset.active = decided > 0 ? 'true' : 'false';
      this.updateToday();
    }

    updateToday() {
      const counter = this.shadow.querySelector('.counter');
      if (!counter || !this.isOpen) return;
      const decided = this.session ? this.session.count() : 0;
      const total = this.session ? this.session.queue.length : 0;
      counter.textContent = decided + '/' + total;
    }

    currentSong() {
      return this.session ? this.session.current() : null;
    }

    doDecide(action) {
      const song = this.currentSong();
      if (!song || !this.session) return;
      this.applyDecision(song, action);
    }

    async applyDecision(song, action) {
      let result;
      try {
        result = await this.controller.decide(this.session, song, action);
      } catch (e) {
        result = { ok: false };
      }
      if (!result.ok) {
        this.renderHeader();
        this.renderDeck();
        return;
      }
      this.renderHeader();
      this.renderDeck();
    }

    toggleLove() {
      const song = this.currentSong();
      if (!song || !this.session) return;
      const next = !this.controller.isLoved(this.session, song);
      this.controller.setLove(this.session, song, next);
      const heart = this.shadow.querySelector('.act.love');
      heart.dataset.on = next ? 'true' : 'false';
      const card = this.topCard();
      if (card) {
        const badge = card.querySelector('.heartbadge');
        if (badge) badge.dataset.on = next ? 'true' : 'false';
      }
    }

    isLoved() {
      const song = this.currentSong();
      return song && this.session ? this.controller.isLoved(this.session, song) : false;
    }

    async doUndo() {
      if (!this.session) return;
      await this.controller.undo(this.session);
      this.renderHeader();
      this.renderDeck();
    }

    async playCurrent() {
      const song = this.currentSong();
      if (!song) {
        if (this.controller.stopPreview) this.controller.stopPreview();
        return;
      }
      const autoPreview = await this.pref('autoPreview');
      if (autoPreview && this.controller.canPreview()) {
        try { await this.controller.playPreview(song); } catch (e) { /* */ }
      }
    }

    pref(key) {
      return this.controller.getPref(key);
    }

    topCard() {
      const deck = this.shadow.querySelector('.deck');
      return deck ? deck.querySelector('.card') : null;
    }

    renderDeck() {
      const deck = this.shadow.querySelector('.deck');
      deck.innerHTML = '';
      this.deck = [];
      if (!this.session) return;
      const queue = this.session.queue;
      const limit = 3;
      for (let i = 0; i < limit; i++) {
        const song = queue[this.session.currentIndex + i];
        if (!song) break;
        const isTop = i === 0;
        const card = this.buildCard(song, isTop);
        deck.appendChild(card);
        this.deck.push(card);
        if (!isTop) {
          card.style.transform = `translateY(${i * 12}px) scale(${1 - i * 0.05})`;
          card.style.opacity = String(1 - i * 0.25);
          card.style.zIndex = String(limit - i);
        } else {
          card.style.zIndex = String(limit + 1);
          this.attachDrag(card, this.deck);
        }
      }
      const heart = this.shadow.querySelector('.act.love');
      heart.dataset.on = this.isLoved() ? 'true' : 'false';
      this.playCurrent();
    }

    buildCard(song, interactive) {
      const artwork = Utils.artworkUrl(song.artworkTemplate, 400);
      const hue = hueFor((song.title || '') + song.artist);
      const duration = Utils.formatDuration(song.durationMs);
      const decade = song.year ? `${Math.floor(song.year / 10) * 10}er` : '';
      const plays = song.playCount !== undefined ? `${song.playCount}×` : '';
      const additions = [];
      if (song.genre) additions.push(song.genre);
      if (decade) additions.push(decade);
      if (duration) additions.push(duration);

      const card = el('div', { class: 'card' + (interactive ? ' interactive' : '') });
      if (artwork) {
        card.appendChild(el('div', { class: 'art', style: `background-image:url("${artwork}")` }));
      } else {
        card.appendChild(el('div', { class: 'artgrad', style: `background:linear-gradient(160deg,hsl(${hue},70%,38%),hsl(${(hue + 40) % 360},72%,22%))` },
          [el('span', { text: String(song.title || '?').charAt(0).toUpperCase() })]));
      }
      card.appendChild(el('div', { class: 'shade' }));
      card.appendChild(el('div', { class: 'heartbadge', html: root.Icon.svg('heart', 22) }));
      if (plays) card.appendChild(el('div', { class: 'plays', text: plays }));
      card.appendChild(el('div', { class: 'info' }, [
        el('div', { class: 'title', text: song.title }),
        el('div', { class: 'artist', text: song.artist }),
        el('div', { class: 'meta', text: `${song.album || ''} · ${song.year || ''}`.replace(/^\s*·\s*/, '').replace(/·\s*$/,'') || ' ' }),
        el('div', { class: 'chips' }, additions.map((a) => el('span', { class: 'chip', text: a })))
      ]));
      card.appendChild(el('div', { class: 'gesture sort', text: t('actionSortOut').toUpperCase() }));
      card.appendChild(el('div', { class: 'gesture keep', text: t('actionKeep').toUpperCase() }));
      return card;
    }

    attachDrag(card, deck) {
      let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, id = 0;
      const onDown = (e) => {
        if (this.view !== 'cards') return;
        const target = e.target;
        if (target && target.closest && target.closest('.act,button')) return;
        dragging = true;
        dx = 0; dy = 0;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        card.style.transition = '';
        if (e.pointerId !== undefined) card.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      const onMove = (e) => {
        if (!dragging) return;
        const pt = e.touches ? e.touches[0] : e;
        dx = pt.clientX - startX;
        dy = pt.clientY - startY;
        card.style.transform = `translate(${dx}px,${dy * 0.35}px) rotate(${dx / 14}deg)`;
        const label = dx > 70 ? card.querySelector('.gesture.keep')
          : dx < -70 ? card.querySelector('.gesture.sort') : null;
        card.classList.toggle('deciding', Boolean(label));
        if (label) {
          card.querySelector('.gesture.keep').style.opacity = '0';
          card.querySelector('.gesture.sort').style.opacity = '0';
          label.style.opacity = '1';
        } else {
          card.querySelector('.gesture.keep').style.opacity = '0';
          card.querySelector('.gesture.sort').style.opacity = '0';
        }
      };
      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        let resolved = null;
        if (dx > 90) resolved = 'keep';
        else if (dx < -90) resolved = 'sortout';
        if (resolved) {
          card.classList.add('running', reservedClass(resolved));
          card.style.transform = '';
          const song = this.currentSong();
          const result = { ok: true };
          if (song && this.session) {
            this.controller.decide(this.session, song, resolved).then((r) => {
              if (!r.ok) {
                card.classList.remove('running', reservedClass(resolved));
                card.style.transform = '';
                card.querySelector('.gesture.keep').style.opacity = '0';
                card.querySelector('.gesture.sort').style.opacity = '0';
                return;
              }
              this.renderHeader();
              this.renderDeck();
            }).catch(() => {
              card.classList.remove('running', reservedClass(resolved));
              this.renderHeader();
              this.renderDeck();
            });
          }
        } else {
          card.style.transition = 'transform .25s ease';
          card.style.transform = '';
          card.classList.remove('deciding');
          card.querySelector('.gesture.keep').style.opacity = '0';
          card.querySelector('.gesture.sort').style.opacity = '0';
        }
      };
      card.addEventListener('pointerdown', onDown);
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerup', onUp);
      card.addEventListener('pointercancel', onUp);
      if (card.addEventListener) card.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    }

    reservedClass(actionName) {
      if (actionName === 'keep') return 'out-right';
      if (actionName === 'sortout') return 'out-left';
      return '';
    }

    renderList() {
      const wrap = this.shadow.querySelector('.listwrap');
      wrap.innerHTML = '';
      if (!this.session) return;
      const session = this.session;
      const query = this._listQuery || '';
      const q = String(query || '').toLowerCase();
      const items = session.queue.map((song, index) => ({ song, index }));
      const visible = q
        ? items.filter((it) => String(it.song.title).toLowerCase().includes(q) ||
            String(it.song.artist).toLowerCase().includes(q))
        : items;

      const search = el('input', { class: 'search', placeholder: t('searchPlaceholder') });
      search.value = query;
      search.addEventListener('input', () => {
        this._listQuery = search.value;
        this.renderList();
      });
      wrap.appendChild(search);

      const list = el('div');
      if (!visible.length) {
        list.appendChild(el('div', { class: 'centermsg', style: 'padding:20px', text: t('noSongs') }));
      }
      for (const { song, index } of visible) {
        const key = Core.keyOf(song);
        const decidedAction = session.decisions.get(key);
        const love = session.love.has(key);
        const isCurrent = index === session.currentIndex;
        const selected = this.selection.has(key);
        const row = el('div', { class: 'row' + (selected ? ' sel' : '') + (isCurrent ? ' cur' : '') });
        const checkbox = el('div', { class: 'checkbox', text: selected ? '✓' : '' });
        const artwork = Utils.artworkUrl(song.artworkTemplate, 96);
        let cover;
        if (artwork) cover = el('div', { class: 'cover', style: `background-image:url("${artwork}")` });
        else cover = el('div', { class: 'cover', style: `background:linear-gradient(160deg,hsl(${hueFor(song.title + song.artist)},70%,38%),hsl(${(hueFor(song.title + song.artist) + 40) % 360},72%,22%))`, text: (song.title || '?').charAt(0).toUpperCase() });
        const info = el('div', { class: 'rowinfo' }, [
          el('div', { class: 'r-title', text: song.title }),
          el('div', { class: 'r-artist', text: song.artist }),
          el('div', { class: 'rmeta', text: [
            song.genre, song.year ? `${Math.floor(song.year / 10) * 10}er` : null,
            song.dateAdded ? Utils.monthLabel(Utils.monthKey(song.dateAdded)) : null,
            song.playCount !== undefined ? `${song.playCount}×` : null
          ].filter(Boolean).join(' · ') })
        ]);
        row.appendChild(checkbox);
        row.appendChild(cover);
        row.appendChild(info);
        if (decidedAction) {
          row.appendChild(el('div', { class: 'chip-action ' + decidedAction, text: t(I18N_KEYS.get(decidedAction)) }));
        }
        if (love) row.appendChild(el('div', { class: 'chip-action love', text: '♥' }));
        row.addEventListener('click', (e) => {
          if (e.target.closest('.chip-action,.cover')) return;
          if (this.selection.has(key)) this.selection.delete(key);
          else this.selection.add(key);
          this.renderList();
        });
        list.appendChild(row);
      }
      wrap.appendChild(list);
      this.updateBatchBar();
    }

    updateBatchBar() {
      const batch = this.shadow.querySelector('.batch');
      const count = this.selection.size;
      if (batch) {
        batch.style.display = count ? 'flex' : 'none';
      }
    }

    async batchDecide(action) {
      if (!this.session || !this.selection.size) return;
      const keys = [...this.selection];
      let ok = true;
      try {
        for (const key of keys) {
          const song = this.session.queue.find((s) => Core.keyOf(s) === key);
          if (!song) continue;
          const result = await this.controller.decide(this.session, song, action);
          if (!result.ok) {
            ok = false;
          }
        }
      } catch (e) {
        ok = false;
      }
      this.selection.clear();
      this.renderHeader();
      this.playCurrent();
      this.renderList();
      return ok;
    }

    renderReview() {
      const wrap = this.shadow.querySelector('.reviewwrap');
      wrap.innerHTML = '';
      if (!this.session) return;
      const session = this.session;
      const summary = session.summary();
      wrap.appendChild(el('div', { class: 'review-head', text: t('reviewTitle') }));
      wrap.appendChild(el('div', { class: 'review-sub', text: summary.total + ' ' + t('commitSortOutHint') }));

      if (!summary.total) {
        wrap.appendChild(el('div', { class: 'centermsg', style: 'padding:24px', text: t('reviewEmpty') }));
      }

      const groups = [
        ['sortout', t('reviewSortedOut'), 'sortout'],
        ['keep', t('reviewKept'), 'keep']
      ];
      for (const [action, label, cls] of groups) {
        const songs = [];
        for (const [key, act] of session.decisions) {
          if (act !== action) continue;
          const song = session.queue.find((s) => Core.keyOf(s) === key);
          if (song) songs.push(song);
        }
        if (!songs.length) continue;
        const group = el('div', { class: 'rev-group' });
        group.appendChild(el('div', { class: 'rev-title', text: label }));
        for (const song of songs) {
          const dashed = session.love.has(Core.keyOf(song)) ? ' ♥' : '';
          group.appendChild(this.reviewRow(song, dashed));
        }
        wrap.appendChild(group);
      }

      const commit = this.shadow.querySelector('.commit');
      commit.disabled = !summary.total;
      commit.textContent = t('commitButton', [summary.total]);
      commit.style.opacity = summary.total ? '1' : '.4';
    }

    reviewRow(song, suffix) {
      const artwork = Utils.artworkUrl(song.artworkTemplate, 96);
      let cover;
      if (artwork) cover = el('div', { class: 'cover', style: `background-image:url("${artwork}")` });
      else cover = el('div', { class: 'cover', style: `background:linear-gradient(160deg,hsl(${hueFor(song.title + song.artist)},70%,38%),hsl(${(hueFor(song.title + song.artist) + 40) % 360},72%,22%))`, text: (song.title || '?').charAt(0).toUpperCase() });
      const info = el('div', { class: 'rowinfo' }, [
        el('div', { class: 'r-title', text: song.title + (suffix || '') }),
        el('div', { class: 'r-artist', text: song.artist })
      ]);
      const remove = el('button', { class: 'rev-remove', html: root.Icon.svg('close', 16) });
      remove.addEventListener('click', async () => {
        await this.controller.revertDecision(this.session, Core.keyOf(song));
        this.renderHeader();
        this.renderReview();
      });
      const row = el('div', { class: 'rev-row' });
      row.appendChild(cover);
      row.appendChild(info);
      row.appendChild(remove);
      return row;
    }

    updateCommitProgress(progress) {
      const commitBtn = this.shadow.querySelector('.commit');
      if (!commitBtn) return;
      const total = progress.total || 0;
      const done = Math.max(0, Math.min(progress.done || 0, total));
      commitBtn.textContent = total > 0 && done >= total
        ? t('commitFinalizing')
        : t('commitProgress', [done, total]);
    }

    async doCommit() {
      const session = this.session;
      if (!session || !session.count()) return;
      const commitBtn = this.shadow.querySelector('.commit');
      commitBtn.disabled = true;
      let total = session.sortedOutSongs().length + session.bookmarkedSongs().length + session.lovedSongs().length;
      try {
        const suggestLess = await this.controller.getPref('suggestLess');
        if (suggestLess) total += session.sortedOutSongs().length;
      } catch (e) { /* */ }
      commitBtn.textContent = t('commitProgress', [0, total]);
      try {
        const summary = await this.controller.commit(session, (p) => this.updateCommitProgress(p));
        this.showView('done');
        const doneText = t('commitDone', [summary.sorted, summary.kept]);
        this.shadow.querySelector('[data-role="done-text"]').textContent = doneText;
      } catch (err) {
        this.toast(t('commitError', [String((err && err.message) || err)]), true);
        commitBtn.disabled = false;
        commitBtn.textContent = t('btnConfirm');
      }
    }

    showError(message) {
      this.shadow.querySelector('[data-role="errormsg"]').textContent = message;
      this.showView('error');
    }

    toast(message, isError) {
      const toasts = this.shadow.querySelector('.toasts');
      const node = el('div', { class: 'toast' + (isError ? ' err' : ''), text: message });
      toasts.appendChild(node);
      setTimeout(() => {
        node.style.opacity = '0';
        node.style.transition = 'opacity .3s';
        setTimeout(() => node.remove(), 320);
      }, 3200);
    }
  }

  root.UI = {
    createOverlay(controller) {
      return new Overlay(controller);
    }
  };
})();