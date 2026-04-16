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

  // ──── Clock ────
  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toTimeString().substring(0, 8);
  }
  setInterval(updateClock, 1000);
  updateClock();

  function setMood() {}

  // ──── System Monitor ────
  async function fetchSystem() {
    try {
      const res = await fetch(`${API}/system`);
      const d = await res.json();

      document.getElementById('cpuVal').textContent = d.cpu.load.toFixed(2);
      document.getElementById('cpuSub').textContent = `${d.cpu.cores} cores — ${d.cpu.model.substring(0, 30)}`;
      document.getElementById('cpuBar').style.width = Math.min(100, d.cpu.load * 100) + '%';

      document.getElementById('memVal').textContent = d.memory.percent + '%';
      document.getElementById('memSub').textContent = `${d.memory.used} / ${d.memory.total}`;
      document.getElementById('memBar').style.width = d.memory.percent + '%';

      document.getElementById('diskVal').textContent = d.disk.percent + '%';
      document.getElementById('diskSub').textContent = `${d.disk.used} / ${d.disk.total}`;
      document.getElementById('diskBar').style.width = d.disk.percent + '%';

      document.getElementById('uptimeVal').textContent = d.uptime.formatted;
      document.getElementById('infoOS').textContent = d.platform;
      document.getElementById('infoCPUModel').textContent = d.cpu.model.substring(0, 40);
      document.getElementById('infoNode').textContent = `Bun ${d.nodeVersion}`;
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

  function renderLogs() {
    const body = document.getElementById('logsBody');
    let filtered = allLogs;
    if (logFilter === 'errors') filtered = allLogs.filter(l => l.level === 'error' || l.level === 'warn');
    else if (logFilter === 'llm') filtered = allLogs.filter(l => l.source === 'hermes_llm');

    body.innerHTML = filtered.map(l => {
      const cls = l.level === 'error' ? ' error' : l.level === 'info' && l.source === 'SYSTEM' ? ' info' : '';
      return `<div class="log-line${cls}"><span class="log-ts">${esc(l.timestamp)}</span> <span class="log-src">${esc(l.source)}</span> <span class="log-msg">${esc(l.message)}</span></div>`;
    }).join('');
    body.scrollTop = body.scrollHeight;
  }

  setInterval(fetchLogs, 2000);
  fetchLogs();

  document.querySelectorAll('.log-tabs .tab').forEach(tab => {
    tab.addEventListener('click', e => {
      document.querySelectorAll('.log-tabs .tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const text = e.target.textContent;
      if (text === 'ERRORS') logFilter = 'errors';
      else if (text === 'LLM') logFilter = 'llm';
      else logFilter = 'all';
      renderLogs();
    });
  });

  // ──── Token Usage ────
  async function fetchTokens() {
    try {
      const res = await fetch(`${API}/tokens`);
      const d = await res.json();
      document.getElementById('totalTokens').textContent = d.totalTokens.toLocaleString();
      document.getElementById('inputTokens').textContent = d.inputTokens.toLocaleString();
      document.getElementById('outputTokens').textContent = d.outputTokens.toLocaleString();
      document.getElementById('cacheReadTokens').textContent = d.cacheReadTokens.toLocaleString();
      document.getElementById('apiRequests').textContent = d.requests.toLocaleString();
      document.getElementById('llmMessages').textContent = d.messages.toLocaleString();

      document.getElementById('reqCount').textContent = d.requests;
      document.getElementById('proposalCount').textContent = d.messages;
      document.getElementById('llmCallCount').textContent = d.messages;
    } catch (e) {
      console.error('Tokens fetch failed:', e);
    }
  }
  setInterval(fetchTokens, 4000);
  fetchTokens();

  // ──── File Explorer ────
  async function loadDirectory(dir) {
    try {
      const res = await fetch(`${API}/files?dir=${encodeURIComponent(dir)}`);
      const d = await res.json();
      currentFileDir = d.path;
      document.getElementById('currentDir').textContent = d.path;

      const container = document.getElementById('fileTreeItems');
      if (!d.entries.length) {
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
          if (type === 'directory') loadDirectory(currentFileDir + '/' + name);
          else loadFilePreview(currentFileDir + '/' + name);
          container.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
        });
      });
    } catch (e) {
      console.error('Files fetch failed:', e);
    }
  }

  async function loadFilePreview(filePath) {
    const preview = document.getElementById('filePreviewContent');
    try {
      const res = await fetch(`${API}/files/read?path=${encodeURIComponent(filePath)}`);
      const d = await res.json();
      if (d.error) { preview.innerHTML = `<div class="fc-row error">${esc(d.error)}</div>`; return; }
      const lines = d.content.split('\n').slice(0, 30);
      preview.innerHTML = lines.map(l => `<div class="fc-row">${esc(l)}</div>`).join('') +
        (d.content.split('\n').length > 30 ? '<div class="fc-row dim">... (truncated)</div>' : '');
    } catch {
      preview.innerHTML = '<div class="fc-row error">Failed to load file</div>';
    }
  }

  document.getElementById('btnBackDir').addEventListener('click', () => {
    if (!currentFileDir) return;
    const parent = currentFileDir.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parent);
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

  // ──── API Endpoints (dynamic) ────
  async function fetchEndpoints() {
    try {
      const res = await fetch(`${API}/endpoints`);
      const d = await res.json();
      const el = document.getElementById('apiEndpoints');
      if (!el) return;
      el.innerHTML = d.endpoints.map(ep =>
        `<div class="info-item"><span class="fc-key">${esc(ep.method)}</span> ${esc(ep.path)}</div>`
      ).join('');
    } catch (e) { console.error('Endpoints fetch failed:', e); }
  }
  fetchEndpoints();

  // ──── Health Check ────
  document.getElementById('linkHealth').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/health`);
      const d = await res.json();
      addProposal({ title: `Health: ${d.status} — ${d.service} v${d.version}`, tags: ['health'] });
    } catch {
      addProposal({ title: 'Health check FAILED', tags: ['error'] });
    }
    fetchLogs();
  });

  document.getElementById('linkPredictFun').addEventListener('click', (e) => {
    e.preventDefault();
    window.open('https://predict.fun', '_blank');
  });

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

  // ──── Refresh ────
  document.getElementById('btnRefresh').addEventListener('click', () => {
    setMood('working');
    fetchSystem();
    fetchLogs();
    fetchTokens();
    checkServices();
    if (currentFileDir) loadDirectory(currentFileDir);
    setTimeout(() => setMood('idle'), 2000);
  });

  // ──── Auto Toggle ────
  let autoMode = true;
  document.getElementById('btnAuto').addEventListener('click', () => {
    autoMode = !autoMode;
    const btn = document.getElementById('btnAuto');
    btn.textContent = autoMode ? 'AUTO' : 'MANUAL';
    btn.className = autoMode ? 'btn btn-accent' : 'btn btn-default';
  });

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

  // ──── Init ────
  loadDirectory('.');

})();
