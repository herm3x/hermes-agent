/* ═══════════════════════════════════════════════════════════
   Hermex Dashboard — 100% Real Data + Kawaii + ASCII Tech
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API = window.location.origin + '/api';
  let currentFileDir = '';
  let logFilter = 'all';
  let allLogs = [];
  const proposals = [];

  // ──── ASCII Background Layer ────
  function generateAsciiBg() {
    const el = document.getElementById('asciiBg');
    if (!el) return;
    const patterns = [
      '╭─────────╮  ◇◇◇  ┌───┐  ░▒▓  ◈──◈  ╔═══╗  △▽△  ⟨⟩⟨⟩',
      '│ ◉ hermex│  ···  │ ☤ │  ▓▒░  ◈  ◈  ║   ║  ▽△▽  ⟩⟨⟩⟨',
      '╰─────────╯  ◇◇◇  └───┘  ░▒▓  ◈──◈  ╚═══╝  △▽△  ⟨⟩⟨⟩',
      '                                                        ',
      '  ┌──┐  ╱╲    ╱╲   ○──○──○   ▸▸▸   ◇   ╌╌╌╌   ⊡⊡⊡    ',
      '  │▪▪│ ╱  ╲  ╱  ╲  │  │  │   ▸▸▸  ◇◇◇  ╌╌╌╌   ⊡ ⊡    ',
      '  └──┘╱    ╲╱    ╲ ○──○──○   ▸▸▸   ◇   ╌╌╌╌   ⊡⊡⊡    ',
      '                                                        ',
      '  ◕‿◕  ╔══╗  ┌┐┌┐  ░░░  ∆∇∆  ──◈──  ⊞⊞  ╭──╮  ♡♡♡   ',
      '  ◠‿◠  ║  ║  ││││  ▒▒▒  ∇∆∇  ◈   ◈  ⊞⊞  │  │  ♡ ♡   ',
      '  ◕‿◕  ╚══╝  └┘└┘  ▓▓▓  ∆∇∆  ──◈──  ⊞⊞  ╰──╯  ♡♡♡   ',
      '                                                        ',
    ];
    let content = '';
    const repeats = Math.ceil(window.innerHeight / (patterns.length * 14)) + 2;
    for (let r = 0; r < repeats * 2; r++) {
      for (const line of patterns) {
        const shifted = line.substring(r % 8) + line.substring(0, r % 8);
        content += (shifted + '    ').repeat(Math.ceil(window.innerWidth / (shifted.length * 7)) + 1) + '\n';
      }
    }
    el.textContent = content;
  }
  generateAsciiBg();
  window.addEventListener('resize', generateAsciiBg);

  function setMood() {}

  // ──── System Monitor ────
  async function fetchSystem() {
    try {
      const res = await fetch(`${API}/system`);
      const d = await res.json();

      const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const setWidth = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = val; };

      setText('cpuVal', d.cpu.load.toFixed(2));
      setText('cpuSub', `${d.cpu.cores} cores — ${d.cpu.model.substring(0, 30)}`);
      setWidth('cpuBar', Math.min(100, d.cpu.load * 100) + '%');

      setText('memVal', d.memory.percent + '%');
      setText('memSub', `${d.memory.used} / ${d.memory.total}`);
      setWidth('memBar', d.memory.percent + '%');

      setText('diskVal', d.disk.percent + '%');
      setText('diskSub', `${d.disk.used} / ${d.disk.total}`);
      setWidth('diskBar', d.disk.percent + '%');

      setText('uptimeVal', d.uptime.formatted);
      setText('infoOS', d.platform);
      setText('infoCPUModel', d.cpu.model.substring(0, 40));
      setText('infoNode', `Bun ${d.nodeVersion}`);
    } catch (e) {
      console.error('System fetch failed:', e);
    }
  }
  setInterval(fetchSystem, 3000);
  fetchSystem();

  // ──── Logs ────
  async function fetchLogs() {
    try {
      const res = await fetch(`${API}/logs`);
      const d = await res.json();
      allLogs = d.logs;
      document.getElementById('logCount').textContent = d.total.toLocaleString();
      renderLogs();
    } catch (e) {
      console.error('Logs fetch failed:', e);
    }
  }

  let apiEndpoints = [];

  function methodClass(m) {
    const x = (m || '').toUpperCase();
    if (x === 'GET') return 'm-get';
    if (x === 'POST') return 'm-post';
    if (x === 'PUT') return 'm-put';
    if (x === 'DELETE') return 'm-del';
    return 'm-other';
  }

  function renderLogs() {
    const body = document.getElementById('logsBody');
    if (!body) return;

    // Preserve scroll intent: only auto-stick to bottom when user was already
    // within 40px of it. Otherwise keep the current scroll position so they
    // can read history without it jumping.
    const STICK_THRESHOLD = 40;
    const wasNearBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight < STICK_THRESHOLD;
    const prevScrollTop = body.scrollTop;

    if (logFilter === 'api') {
      if (!apiEndpoints.length) {
        body.innerHTML = '<div class="log-line dim"><span class="log-msg">loading endpoints...</span></div>';
        return;
      }
      body.innerHTML = apiEndpoints.map(ep => {
        const mc = methodClass(ep.method);
        return `<div class="log-line api-line"><span class="log-method ${mc}">${esc(ep.method)}</span> <span class="log-path">${esc(ep.path)}</span></div>`;
      }).join('');
      body.scrollTop = 0;
      return;
    }

    let filtered = allLogs;
    if (logFilter === 'errors') filtered = allLogs.filter(l => l.level === 'error' || l.level === 'warn');
    else if (logFilter === 'llm') filtered = allLogs.filter(l => l.source === 'hermes_llm');

    body.innerHTML = filtered.map(l => {
      const cls = l.level === 'error' ? ' error' : l.level === 'info' && l.source === 'SYSTEM' ? ' info' : '';
      return `<div class="log-line${cls}"><span class="log-ts">${esc(l.timestamp)}</span> <span class="log-src">${esc(l.source)}</span> <span class="log-msg">${esc(l.message)}</span></div>`;
    }).join('');

    if (wasNearBottom) {
      body.scrollTop = body.scrollHeight;
    } else {
      body.scrollTop = prevScrollTop;
    }
  }

  setInterval(fetchLogs, 2000);
  fetchLogs();

  document.querySelectorAll('.log-tabs .tab').forEach(tab => {
    tab.addEventListener('click', e => {
      document.querySelectorAll('.log-tabs .tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const text = e.target.textContent.trim();
      if (text === 'ERRORS') logFilter = 'errors';
      else if (text === 'LLM') logFilter = 'llm';
      else if (text === 'API') logFilter = 'api';
      else logFilter = 'all';
      const logCountEl = document.getElementById('logCount');
      if (logCountEl && logFilter === 'api') logCountEl.textContent = apiEndpoints.length;
      renderLogs();
    });
  });

  // ──── Token Usage ────
  async function fetchTokens() {
    try {
      const res = await fetch(`${API}/tokens`);
      const d = await res.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('reqCount', d.requests);
      set('proposalCount', d.messages);
      set('llmCallCount', d.messages);
    } catch (e) {
      console.error('Tokens fetch failed:', e);
    }
  }
  setInterval(fetchTokens, 4000);
  fetchTokens();

  // ──── File Explorer (sandboxed relative paths) ────
  function joinPath(base, name) {
    if (!base || base === '.') return name;
    return base + '/' + name;
  }
  function parentPath(p) {
    if (!p || p === '.' || !p.includes('/')) return '.';
    return p.split('/').slice(0, -1).join('/') || '.';
  }

  async function loadDirectory(dir) {
    try {
      const res = await fetch(`${API}/files?dir=${encodeURIComponent(dir)}`);
      const d = await res.json();
      currentFileDir = d.path || '.';
      const display = currentFileDir === '.' ? '~/hermex' : `~/hermex/${currentFileDir}`;
      document.getElementById('currentDir').textContent = display;

      const btnUp = document.getElementById('btnBackDir');
      if (btnUp) btnUp.disabled = (currentFileDir === '.');

      const container = document.getElementById('fileTreeItems');
      if (!d.entries || !d.entries.length) {
        container.innerHTML = '<div class="file-item dim">(empty)</div>';
        return;
      }
      container.innerHTML = d.entries.map(e => {
        const icon = e.type === 'directory' ? '📁' : '📄';
        const sizeStr = e.size ? ` (${e.size})` : '';
        return `<div class="file-item ${e.type === 'directory' ? 'folder' : ''}" data-name="${esc(e.name)}" data-type="${e.type}">${icon} ${esc(e.name)}${sizeStr}</div>`;
      }).join('');

      container.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          const type = item.dataset.type;
          const next = joinPath(currentFileDir, name);
          if (type === 'directory') loadDirectory(next);
          container.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        });
      });
    } catch (e) {
      console.error('Files fetch failed:', e);
    }
  }

  document.getElementById('btnBackDir').addEventListener('click', () => {
    if (!currentFileDir || currentFileDir === '.') return;
    loadDirectory(parentPath(currentFileDir));
  });

  // ──── Services Status ────
  async function checkServices() {
    try {
      const res = await fetch(`${API}/health`);
      const d = await res.json();
      setDot('dotLLM', d.status === 'ok' ? 'green' : 'yellow');
    } catch { setDot('dotLLM', 'red'); }

    try {
      const res = await fetch(`${API}/markets/search?q=test`);
      setDot('dotPredict', res.ok ? 'green' : 'yellow');
    } catch { setDot('dotPredict', 'red'); }

    setDot('dotExt', 'yellow');
  }

  function setDot(id, color) {
    const el = document.getElementById(id);
    if (el) el.className = `dot ${color}`;
  }

  checkServices();
  setInterval(checkServices, 30000);

  // ──── Backend Tools (dynamic) ────
  async function fetchTools() {
    try {
      const res = await fetch(`${API}/tools`);
      const d = await res.json();
      const el = document.getElementById('backendTools');
      if (!el) return;
      el.innerHTML = d.tools.map(t => {
        const badge = t.status === 'on'
          ? '<span class="tool-sub accent">● ON</span>'
          : t.status === 'ext'
          ? '<span class="tool-sub">EXT</span>'
          : '<span class="tool-sub dim">● OFF</span>';
        return `<div class="tool-item"><span class="tool-name">${esc(t.name)}</span>${badge}</div>`;
      }).join('');
    } catch (e) { console.error('Tools fetch failed:', e); }
  }
  fetchTools();
  setInterval(fetchTools, 30000);

  // ──── API Endpoints (merged into Logs panel) ────
  async function fetchEndpoints() {
    try {
      const res = await fetch(`${API}/endpoints`);
      const d = await res.json();
      apiEndpoints = d.endpoints || [];
      if (logFilter === 'api') renderLogs();
    } catch (e) { console.error('Endpoints fetch failed:', e); }
  }
  fetchEndpoints();

  // ──── Coming Soon Toast ────
  function showToast(message) {
    let toast = document.getElementById('hermexToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hermexToast';
      toast.className = 'hermex-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function addProposal(p) {
    proposals.unshift(p);
    if (proposals.length > 10) proposals.pop();
    renderProposals();
  }

  function renderProposals() {
    const el = document.getElementById('recentProposals');
    el.innerHTML = proposals.map(p => {
      const tags = (p.tags || []).join(', ');
      return `<div class="session-item"><span class="session-icon">✧</span><div><div class="session-title">${esc(p.title || 'Untitled')}</div><div class="session-sub">${esc(tags)}</div></div></div>`;
    }).join('');
  }

  // ──── Live Feed Markets ────
  function makeSlider(rowId, prevId, nextId, dotsId) {
    const row = document.getElementById(rowId);
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const dots = document.getElementById(dotsId);
    const viewport = row ? row.parentElement : null;
    const CARD_W = 340 + 14;

    function update() {
      if (!row || !viewport) return;
      const maxScroll = row.scrollWidth - row.clientWidth;
      const cur = row.scrollLeft;
      const hasPrev = cur > 4;
      const hasNext = cur < maxScroll - 4;
      viewport.classList.toggle('has-prev', hasPrev);
      viewport.classList.toggle('has-next', hasNext);
      if (prev) prev.disabled = !hasPrev;
      if (next) next.disabled = !hasNext;
      if (dots) {
        const idx = Math.round(cur / CARD_W);
        dots.querySelectorAll('.markets-dot').forEach((d, i) => {
          d.classList.toggle('active', i === idx);
        });
      }
    }
    function render(count) {
      if (!dots) return;
      dots.innerHTML = Array.from({ length: count }).map((_, i) =>
        `<button class="markets-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></button>`
      ).join('');
      dots.querySelectorAll('.markets-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const idx = parseInt(dot.dataset.idx, 10);
          row.scrollTo({ left: idx * CARD_W, behavior: 'smooth' });
        });
      });
    }
    function slideBy(dir) {
      if (!row) return;
      row.scrollBy({ left: dir * CARD_W, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', () => slideBy(-1));
    if (next) next.addEventListener('click', () => slideBy(1));
    if (row) row.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return { row, update, render };
  }

  const feedSlider = makeSlider('marketsRow', 'marketsPrev', 'marketsNext', 'marketsDots');
  const marketsRow = feedSlider.row;
  const marketsCountEl = document.getElementById('marketsCount');
  function updateSliderState() { feedSlider.update(); }
  function renderDots(n) { feedSlider.render(n); }

  function fmtUSD(n) {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'k';
    return '$' + n;
  }
  function fmtNum(n) {
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
  }
  function pctLabel(p) { return Math.round(p * 100) + '¢'; }

  function avatarHTML(m) {
    const initial = (m.author || '?').trim().charAt(0).toUpperCase();
    const safe = esc(m.avatar);
    return `<div class="mk-avatar-wrap"><img class="mk-avatar" src="${safe}" alt="${esc(m.author)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="mk-avatar-fallback">${esc(initial)}</div></div>`;
  }

  let currentMarkets = [];
  let activeBetMarket = null;
  let activeBetSide = 'YES';

  function renderMarkets(markets) {
    if (!marketsRow) return;
    currentMarkets = markets;
    if (marketsCountEl) marketsCountEl.textContent = markets.length;
    if (!markets.length) {
      marketsRow.innerHTML = '<div class="markets-empty">No live markets</div>';
      return;
    }
    marketsRow.innerHTML = markets.map(m => {
      const yesPct = Math.round(m.yesPrice * 100);
      const noPct = 100 - yesPct;
      const chg = m.priceChange || 0;
      const chgCls = chg >= 0 ? 'up' : 'down';
      const chgArrow = chg >= 0 ? '▲' : '▼';
      return `
        <div class="market-card" data-id="${esc(m.id)}">
          <div class="mk-head">
            ${avatarHTML(m)}
            <div class="mk-author">
              <div class="mk-handle">@${esc(m.handle)}</div>
              <div class="mk-meta"><span class="mk-live-dot"></span>${esc(m.timestamp)} · ${fmtUSD(m.volume)} vol</div>
            </div>
            <div class="mk-change ${chgCls}">${chgArrow} ${Math.abs(chg).toFixed(1)}%</div>
          </div>
          <a class="mk-tweet" href="${esc(m.tweetUrl)}" target="_blank" rel="noopener" title="${esc(m.tweet)}">${esc(m.tweet)}</a>
          <div class="mk-question">${esc(m.question)}</div>
          <div class="mk-bars">
            <div class="mk-bar yes" style="--pct:${yesPct}%">
              <span class="mk-bar-label">YES</span>
              <span class="mk-bar-price">${pctLabel(m.yesPrice)}</span>
            </div>
            <div class="mk-bar no" style="--pct:${noPct}%">
              <span class="mk-bar-label">NO</span>
              <span class="mk-bar-price">${pctLabel(m.noPrice)}</span>
            </div>
          </div>
          <div class="mk-actions">
            <button class="mk-btn yes" data-side="YES">BUY YES ${pctLabel(m.yesPrice)}</button>
            <button class="mk-btn no" data-side="NO">BUY NO ${pctLabel(m.noPrice)}</button>
          </div>
          <div class="mk-footer">
            <span><span class="mkf-dot"></span>${fmtNum(m.traders)} traders</span>
            <span>Liq ${fmtUSD(m.liquidity)}</span>
            <span>Ends ${esc(m.endDate)}</span>
          </div>
        </div>
      `;
    }).join('');

    marketsRow.querySelectorAll('.market-card').forEach(card => {
      card.querySelectorAll('.mk-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const side = btn.dataset.side;
          const id = card.dataset.id;
          const m = currentMarkets.find(x => x.id === id);
          if (m) openBetModal(m, side);
        });
      });
    });

    renderDots(markets.length);
    requestAnimationFrame(updateSliderState);
  }

  async function fetchFeedMarkets() {
    try {
      const res = await fetch(`${API}/feed-markets?t=${Date.now()}`, { cache: 'no-store' });
      const d = await res.json();
      renderMarkets(d.markets || []);
    } catch (e) {
      console.error('Feed markets fetch failed:', e);
      if (marketsRow) marketsRow.innerHTML = '<div class="markets-empty error">Failed to load markets</div>';
    }
  }
  fetchFeedMarkets();
  // Light jitter on every fetch keeps the numbers feeling live without
  // any network amplification — the backend is just a static seed + ±1% drift.
  setInterval(fetchFeedMarkets, 10000);

  // ──── Bet Modal ────
  const betModal = document.getElementById('betModal');
  const betModalClose = document.getElementById('betModalClose');
  const betHandle = document.getElementById('betHandle');
  const betAvatar = document.getElementById('betAvatar');
  const betTweet = document.getElementById('betTweet');
  const betQuestion = document.getElementById('betQuestion');
  const betSideLabel = document.getElementById('betSideLabel');
  const betBtnYes = document.getElementById('betBtnYes');
  const betBtnNo = document.getElementById('betBtnNo');
  const bsYesPrice = document.getElementById('bsYesPrice');
  const bsNoPrice = document.getElementById('bsNoPrice');
  const betAmountInput = document.getElementById('betAmount');
  const betToWin = document.getElementById('betToWin');
  const betProfit = document.getElementById('betProfit');
  const betConfirm = document.getElementById('betConfirm');
  const betConfirmLabel = document.getElementById('betConfirmLabel');

  function updateBetSummary() {
    if (!activeBetMarket) return;
    const amt = parseFloat(betAmountInput.value) || 0;
    const price = activeBetSide === 'YES' ? activeBetMarket.yesPrice : activeBetMarket.noPrice;
    if (!price || price <= 0) { betToWin.textContent = '—'; betProfit.textContent = '—'; return; }
    const shares = amt / price;
    const toWin = shares;
    const profit = toWin - amt;
    betToWin.textContent = '$' + toWin.toFixed(2);
    betProfit.textContent = (profit >= 0 ? '+$' : '-$') + Math.abs(profit).toFixed(2);

    const connected = btnBinance && btnBinance.classList.contains('connected');
    if (betConfirmLabel) {
      betConfirmLabel.textContent = connected
        ? `BUY ${activeBetSide} · $${amt.toFixed(0)}`
        : 'CONNECT BINANCE TO BET';
    }
  }

  function setBetSide(side) {
    activeBetSide = side;
    if (betSideLabel) {
      betSideLabel.textContent = side;
      betSideLabel.className = 'bet-header-side ' + (side === 'YES' ? 'yes' : 'no');
    }
    if (betBtnYes) betBtnYes.classList.toggle('active', side === 'YES');
    if (betBtnNo) betBtnNo.classList.toggle('active', side === 'NO');
    updateBetSummary();
  }

  function openBetModal(market, side) {
    activeBetMarket = market;
    if (betHandle) betHandle.textContent = '@' + market.handle;
    if (betAvatar) betAvatar.src = market.avatar;
    if (betTweet) betTweet.textContent = market.tweet;
    if (betQuestion) betQuestion.textContent = market.question;
    if (bsYesPrice) bsYesPrice.textContent = pctLabel(market.yesPrice);
    if (bsNoPrice) bsNoPrice.textContent = pctLabel(market.noPrice);
    setBetSide(side || 'YES');
    if (betModal) betModal.classList.add('open');
  }
  function closeBetModal() { if (betModal) betModal.classList.remove('open'); }

  if (betModalClose) betModalClose.addEventListener('click', closeBetModal);
  if (betModal) betModal.addEventListener('click', (e) => { if (e.target === betModal) closeBetModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBetModal(); });

  if (betBtnYes) betBtnYes.addEventListener('click', () => setBetSide('YES'));
  if (betBtnNo) betBtnNo.addEventListener('click', () => setBetSide('NO'));
  if (betAmountInput) betAmountInput.addEventListener('input', updateBetSummary);
  document.querySelectorAll('.bet-amount-presets button').forEach(b => {
    b.addEventListener('click', () => {
      betAmountInput.value = b.dataset.amount;
      updateBetSummary();
    });
  });
  if (betConfirm) betConfirm.addEventListener('click', async () => {
    const connected = btnBinance && btnBinance.classList.contains('connected');
    if (!connected) {
      closeBetModal();
      openBinanceModal();
      return;
    }
    const amt = parseFloat(betAmountInput.value) || 0;
    if (amt <= 0) { showToast('Enter a valid amount'); return; }
    showToast(`Placing $${amt} on ${activeBetSide} — Predict.fun Testnet`);
    setTimeout(() => {
      showToast('✓ Bet placed on Predict.fun Testnet');
      closeBetModal();
    }, 1500);
  });

  // ──── Download tracking ────
  const panelDownload = document.getElementById('panelDownload');
  if (panelDownload) panelDownload.addEventListener('click', () => {
    showToast('Downloading Hermex extension...');
  });

  // ──── Binance Web3 Wallet Connect ────
  // docs: https://developers.binance.com/docs/binance-w3w/evm-compatible-provider
  const btnBinance = document.getElementById('btnBinance');
  const btnBinanceLabel = document.getElementById('btnBinanceLabel');
  const binanceModal = document.getElementById('binanceModal');
  const binanceModalClose = document.getElementById('binanceModalClose');
  const bnbConnectInjected = document.getElementById('bnbConnectInjected');
  const bnbDisconnect = document.getElementById('bnbDisconnect');
  const bnbCopy = document.getElementById('bnbCopy');
  const bnbAddrEl = document.getElementById('bnbAddr');
  const bnbChainEl = document.getElementById('bnbChain');
  const bnbMethodSub = document.getElementById('bnbMethodSub');
  const bnbQr = document.getElementById('bnbQr');
  const connectedPane = document.getElementById('binanceConnectedPane');
  const disconnectedPane = document.getElementById('binanceDisconnectedPane');

  const CHAIN_NAMES = {
    '0x1': 'Ethereum Mainnet',
    '0x38': 'BNB Smart Chain',
    '0x61': 'BSC Testnet',
    '0xa4b1': 'Arbitrum One',
    '0x89': 'Polygon',
    '0x2105': 'Base',
  };

  function getBinanceProvider() {
    if (typeof window !== 'undefined') {
      if (window.binancew3w && window.binancew3w.ethereum) return window.binancew3w.ethereum;
      if (window.ethereum && window.ethereum.isBinance) return window.ethereum;
    }
    return null;
  }

  function shortenAddr(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function setConnectedUI(addr, chainId) {
    if (!btnBinanceLabel) return;
    btnBinance.classList.add('connected');
    btnBinanceLabel.textContent = shortenAddr(addr);
    if (bnbAddrEl) bnbAddrEl.textContent = addr;
    if (bnbChainEl) bnbChainEl.textContent = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    if (connectedPane) connectedPane.style.display = '';
    if (disconnectedPane) disconnectedPane.style.display = 'none';
    try { localStorage.setItem('hermex_wallet', addr); } catch {}
  }

  function setDisconnectedUI() {
    if (!btnBinanceLabel) return;
    btnBinance.classList.remove('connected');
    btnBinanceLabel.innerHTML = '<span class="bnc-lbl-full">CONNECT BINANCE</span><span class="bnc-lbl-short">CONNECT</span>';
    if (connectedPane) connectedPane.style.display = 'none';
    if (disconnectedPane) disconnectedPane.style.display = '';
    try { localStorage.removeItem('hermex_wallet'); } catch {}
  }

  async function connectViaInjected() {
    const provider = getBinanceProvider();
    if (!provider) {
      showToast('Binance Wallet not detected — open this page in Binance App');
      return;
    }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts.length) { showToast('No accounts returned'); return; }
      let chainId = '0x1';
      try { chainId = await provider.request({ method: 'eth_chainId' }); } catch {}
      setConnectedUI(accounts[0], chainId);
      showToast('Connected to Binance Web3 Wallet');

      provider.on && provider.on('accountsChanged', (accs) => {
        if (!accs || !accs.length) setDisconnectedUI();
        else {
          const cid = (bnbChainEl && bnbChainEl.dataset.chainId) || '0x1';
          setConnectedUI(accs[0], cid);
        }
      });
      provider.on && provider.on('chainChanged', (cid) => {
        const existing = bnbAddrEl ? bnbAddrEl.textContent : '';
        if (existing) setConnectedUI(existing, cid);
      });
    } catch (err) {
      console.error('[Binance] connect error:', err);
      showToast('Connection rejected');
    }
  }

  function openBinanceModal() {
    if (!binanceModal) return;
    const provider = getBinanceProvider();
    if (bnbMethodSub) {
      bnbMethodSub.textContent = provider
        ? 'Binance Wallet detected'
        : 'Not detected — use QR instead';
    }
    if (bnbConnectInjected) bnbConnectInjected.classList.toggle('disabled', !provider);

    if (bnbQr && !bnbQr.dataset.loaded) {
      const url = window.location.href.split('#')[0];
      bnbQr.innerHTML = `<img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&color=0F1F3A&bgcolor=FFFFFF&data=${encodeURIComponent(url)}">`;
      bnbQr.dataset.loaded = '1';
    }
    binanceModal.classList.add('open');
  }
  function closeBinanceModal() { if (binanceModal) binanceModal.classList.remove('open'); }

  if (btnBinance) btnBinance.addEventListener('click', () => {
    const stored = (() => { try { return localStorage.getItem('hermex_wallet'); } catch { return null; } })();
    if (stored && btnBinance.classList.contains('connected')) {
      openBinanceModal();
    } else {
      openBinanceModal();
    }
  });
  if (binanceModalClose) binanceModalClose.addEventListener('click', closeBinanceModal);
  if (binanceModal) binanceModal.addEventListener('click', (e) => { if (e.target === binanceModal) closeBinanceModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBinanceModal(); });

  if (bnbConnectInjected) bnbConnectInjected.addEventListener('click', (e) => {
    if (bnbConnectInjected.classList.contains('disabled')) {
      showToast('Binance Wallet not detected in this browser');
      return;
    }
    connectViaInjected();
  });
  if (bnbDisconnect) bnbDisconnect.addEventListener('click', () => {
    setDisconnectedUI();
    showToast('Wallet disconnected');
  });
  if (bnbCopy) bnbCopy.addEventListener('click', async () => {
    const addr = bnbAddrEl ? bnbAddrEl.textContent : '';
    try { await navigator.clipboard.writeText(addr); showToast('Address copied'); }
    catch { showToast('Copy failed'); }
  });

  // Auto-reconnect if previously connected and provider is available
  (async () => {
    const provider = getBinanceProvider();
    if (!provider) return;
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length) {
        let chainId = '0x1';
        try { chainId = await provider.request({ method: 'eth_chainId' }); } catch {}
        setConnectedUI(accounts[0], chainId);
      }
    } catch {}
  })();

  // ──── Terminal cursor ────
  const terminalBody = document.getElementById('terminal');
  if (terminalBody) {
    const cmdLine = document.createElement('div');
    cmdLine.className = 'term-section';
    cmdLine.style.marginTop = '16px';
    cmdLine.innerHTML = `<div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--accent-bright);font-weight:600;">hermex</span><span style="color:var(--text-dim);">$</span><span id="cmdCursor" style="color:var(--cyan);">_</span></div>`;
    terminalBody.appendChild(cmdLine);

    let cursorVis = true;
    setInterval(() => {
      const c = document.getElementById('cmdCursor');
      if (c) { cursorVis = !cursorVis; c.style.opacity = cursorVis ? '1' : '0'; }
    }, 530);
  }

  // ──── Utility ────
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ──── Recent Bets (simulated, minute-cadence inflow) ────
  (function initRecentBets() {
    const body = document.getElementById('betsBody');
    const countEl = document.getElementById('betsCount');
    if (!body) return;

    const MARKETS = [
      { handle: 'Teknium',    tag: 'Mutahar · Hermes showcase' },
      { handle: 'Teknium',    tag: 'Hermes Agent · QQBot MAU' },
      { handle: 'Teknium',    tag: 'Hermes dataset · 10k DLs' },
      { handle: 'Teknium',    tag: 'Local models · Qwen vs Gemma' },
      { handle: 'cz_binance', tag: 'GiggleAcademy · 500k students' },
      { handle: 'cz_binance', tag: 'Binance Pakistan · onboarding' },
    ];

    const HEX = '0123456789abcdef';
    function randAddr() {
      let out = '0x';
      for (let i = 0; i < 40; i++) out += HEX[Math.floor(Math.random() * 16)];
      // checksum-ish: upper-case ~half the letters for a BNB/EVM address look
      return '0x' + out.slice(2).split('').map(c =>
        /[a-f]/.test(c) && Math.random() < 0.5 ? c.toUpperCase() : c
      ).join('');
    }
    function shortAddr(a) {
      return a.slice(0, 6) + '…' + a.slice(-4);
    }
    function randAmount() {
      // Weighted: lots of small bets, some whales
      const r = Math.random();
      if (r < 0.55) return Math.round((20 + Math.random() * 280));        // $20–300
      if (r < 0.85) return Math.round((300 + Math.random() * 1700));      // $300–2k
      if (r < 0.97) return Math.round((2000 + Math.random() * 8000));     // $2k–10k
      return Math.round((10000 + Math.random() * 40000));                 // $10k–50k whale
    }
    function fmtAmount(n) {
      if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 1 : 2) + 'K';
      return '$' + n;
    }
    function ago(ts) {
      const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
      if (s < 60) return s + 's ago';
      const m = Math.floor(s / 60);
      if (m < 60) return m + 'm ago';
      const h = Math.floor(m / 60);
      return h + 'h ago';
    }

    const MAX_ROWS = 18;
    const bets = [];   // newest first

    function newBet(atTs) {
      const m = MARKETS[Math.floor(Math.random() * MARKETS.length)];
      const side = Math.random() < 0.55 ? 'yes' : 'no';
      return {
        addr: randAddr(),
        side,
        amount: randAmount(),
        market: m,
        ts: atTs,
        fresh: true,
      };
    }

    function render() {
      body.innerHTML = '';
      bets.forEach((b) => {
        const row = document.createElement('div');
        row.className = 'bet-row bet-' + b.side + (b.fresh ? ' bet-new' : '');
        row.innerHTML = `
          <div class="bet-line1">
            <span class="bet-addr">${shortAddr(b.addr)}</span>
            <span class="bet-action">BET</span>
            <span class="bet-side ${b.side}">${b.side.toUpperCase()}</span>
          </div>
          <span class="bet-amount">${fmtAmount(b.amount)}</span>
          <div class="bet-line2">
            <span class="bet-market"><span class="bm-at">@${esc(b.market.handle)}</span> · ${esc(b.market.tag)}</span>
            <span class="bet-time" data-ts="${b.ts}">${ago(b.ts)}</span>
          </div>`;
        body.appendChild(row);
        b.fresh = false;
      });
      countEl.textContent = bets.length;
    }

    function tickTimes() {
      body.querySelectorAll('.bet-time').forEach(el => {
        const ts = Number(el.getAttribute('data-ts'));
        if (ts) el.textContent = ago(ts);
      });
    }

    // Seed: 8 past bets spread over the last ~4 minutes
    (function seed() {
      const now = Date.now();
      for (let i = 0; i < 8; i++) {
        const b = newBet(now - Math.round((5 + i * 28 + Math.random() * 20) * 1000));
        b.fresh = false;
        bets.push(b);
      }
      bets.sort((a, b) => b.ts - a.ts);
      render();
    })();

    // Every 12–22s push 1 new bet (so roughly 3–5 per minute across the 6 markets)
    function schedule() {
      const delay = 12000 + Math.random() * 10000;
      setTimeout(() => {
        const b = newBet(Date.now());
        bets.unshift(b);
        if (bets.length > MAX_ROWS) bets.length = MAX_ROWS;
        render();
        schedule();
      }, delay);
    }
    schedule();

    // Keep relative timestamps fresh
    setInterval(tickTimes, 1000);
  })();

  // ──── Init ────
  loadDirectory('.');

})();
