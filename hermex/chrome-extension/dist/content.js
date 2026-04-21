/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/types/index.ts
const DEFAULT_CONFIG = {
    enabled: true,
    apiUrl: 'https://herm3x.xyz',
    useTestnet: true,
    autoPropose: true,
    kolWhitelist: [],
    minFollowers: 50000,
    dailyLimit: 500,
    proposalsToday: 0,
};
const TOP_KOLS = [
    'elonmusk', 'VitalikButerin', 'realDonaldTrump', 'POTUS',
    'cz_binance', 'brian_armstrong', 'justinsuntron', 'aantonop',
    'APompliano', 'IvanOnTech', 'PeterSchiff', 'naval',
    'pmarca', 'sama', 'jack', 'saylor',
    'GaryGensler', 'CathieDWood', 'BarrySilbert', 'cdixon',
    'laurashin', 'ErikVoorhees', 'TylerWinklevoss', 'cameron',
    'jessepollak', 'DeItaone', 'tier10k', 'WatcherGuru',
    'unusual_whales', 'RaoulGMI', 'whale_alert', 'documentingbtc',
    'NousResearch', 'AIaboringAtMeta', 'OpenAI', 'AnthropicAI',
    'GoogleDeepMind', 'ylaboringecun', 'kaboringpathy', 'drjimfan',
];

;// ./src/content/tweet-detector.ts

let PROCESSED_TWEETS = new Set();
function clearProcessed() {
    PROCESSED_TWEETS = new Set();
}
const CONTROVERSY_PATTERNS = [
    /\b(wrong|disagree|scam|fraud|lawsuit|fired|resign|ban|arrest|hack|exploit|rug)\b/i,
    /\b(breaking|urgent|just in|confirmed|denied|leaked)\b/i,
    /\b(will|won't|going to|planning|announce|launching|shutting down)\b/i,
    /@\w+\s+(you|your|is|are|was|were)\b/i,
    /\b(bet|predict|odds|chance|probability|unlikely|guaranteed)\b/i,
    /[!?]{2,}/,
    /🚨|⚠️|🔥|💀|😱/,
];
function extractTweetData(tweetEl) {
    const linkEl = tweetEl.querySelector('a[href*="/status/"]');
    if (!linkEl)
        return null;
    const href = linkEl.getAttribute('href') || '';
    const statusMatch = href.match(/\/(\w+)\/status\/(\d+)/);
    if (!statusMatch)
        return null;
    const authorHandle = statusMatch[1];
    const tweetId = statusMatch[2];
    if (PROCESSED_TWEETS.has(tweetId))
        return null;
    const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
    const text = tweetTextEl?.textContent?.trim() || '';
    if (!text || text.length < 10)
        return null;
    const nameEl = tweetEl.querySelector('[data-testid="User-Name"]');
    const authorName = nameEl?.querySelector('span')?.textContent?.trim() || authorHandle;
    const timeEl = tweetEl.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || new Date().toISOString();
    return {
        id: tweetId,
        text,
        authorHandle,
        authorName,
        timestamp,
        element: tweetEl,
    };
}
function isKolTweet(handle, whitelist) {
    const lower = handle.toLowerCase();
    const allKols = [...TOP_KOLS.map(k => k.toLowerCase()), ...whitelist.map(k => k.toLowerCase())];
    return allKols.includes(lower);
}
function isPredictable(text) {
    let score = 0;
    for (const pattern of CONTROVERSY_PATTERNS) {
        if (pattern.test(text))
            score++;
    }
    if (text.length > 100)
        score++;
    if (text.includes('@'))
        score++;
    return score >= 2;
}
function shouldPropose(tweet, whitelist) {
    if (PROCESSED_TWEETS.has(tweet.id))
        return false;
    const isKol = isKolTweet(tweet.authorHandle, whitelist);
    const predictable = isPredictable(tweet.text);
    return isKol || predictable;
}
function markProcessed(tweetId) {
    PROCESSED_TWEETS.add(tweetId);
}
function getTweetElements() {
    return Array.from(document.querySelectorAll('[data-testid="tweet"]'));
}

;// ./src/content/card-injector.ts

const CARD_ATTR = 'data-hermex-card';
let currentConfig = DEFAULT_CONFIG;
function setCardConfig(config) {
    currentConfig = config;
}
function getLogoUrl() {
    try {
        return chrome.runtime.getURL('assets/hermex-eye.jpg');
    }
    catch {
        return '';
    }
}
function getLogoPngUrl() {
    try {
        return chrome.runtime.getURL('assets/hermex-eye.png');
    }
    catch {
        return '';
    }
}
function injectLoadingCard(tweetEl, tweetId) {
    if (tweetEl.querySelector(`[${CARD_ATTR}]`))
        return;
    const logoUrl = getLogoUrl();
    const logoPng = getLogoPngUrl();
    const card = document.createElement('div');
    card.setAttribute(CARD_ATTR, tweetId);
    card.className = 'hermex-card hermex-loading';
    card.innerHTML = `
    <div class="hermex-card-header">
      <div class="hermex-header-left">
        <div class="hermex-logo-wrap">
          <img src="${logoUrl}" onerror="this.src='${logoPng}'" alt="" class="hermex-logo-img">
          <div class="hermex-logo-glow"></div>
        </div>
        <pre class="hermex-ascii-name">╦ ╦ ╔═╗ ╦═╗ ╔╦╗ ╔═╗ ═╗ ╦
╠═╣ ║╣  ╠╦╝ ║║║ ║╣  ╔╩╦╝
╩ ╩ ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩ ╚═</pre>
      </div>
    </div>
    <div class="hermex-card-body">
      <div class="hermex-spinner"></div>
      <p class="hermex-loading-text">Hermes Agent analyzing...</p>
    </div>
  `;
    const insertTarget = tweetEl.querySelector('[data-testid="tweetText"]')?.parentElement;
    if (insertTarget) {
        insertTarget.after(card);
    }
    else {
        tweetEl.appendChild(card);
    }
}
function updateCard(tweetId, data) {
    const card = document.querySelector(`[${CARD_ATTR}="${tweetId}"]`);
    if (!card)
        return;
    card.className = 'hermex-card';
    if (data.status === 'error') {
        card.className = 'hermex-card hermex-error';
        card.innerHTML = buildErrorCard(data.errorMessage || 'Failed to generate proposal');
        const retryBtn = card.querySelector('.hermex-retry-btn');
        retryBtn?.addEventListener('click', () => {
            card.remove();
        });
        return;
    }
    card.innerHTML = buildProposalCard(data.proposal, data.existingMarket, data.tweetId, data.marketData);
    attachCardListeners(card, data);
}
function buildProposalCard(proposal, existingMarket, tweetId, marketData) {
    const yesProb = Math.round(proposal.initial_probability * 100);
    const noProb = 100 - yesProb;
    const endTime = formatEndTime(proposal.end_time);
    const isTestnet = currentConfig.useTestnet;
    const tags = proposal.tags.map(t => `<span class="hermex-tag">${escapeHtml(t)}</span>`).join('');
    const cat = proposal.category || 'crypto';
    const categoryColors = {
        crypto: '#5b9aff', politics: '#ff6b8a', tech: '#5aedc2',
        sports: '#ffc46b', culture: '#b8a0ff', business: '#64d8ff',
    };
    const catColor = categoryColors[cat] || '#5b9aff';
    const vol = marketData?.volume || '--';
    const liq = marketData?.liquidity || '--';
    const traders = marketData?.traders || 0;
    const spread = marketData?.spread || '--';
    const priceChange = marketData?.priceChange24h || '+0.0%';
    const changeDir = marketData?.priceChangeDirection || 'up';
    const changeIcon = changeDir === 'up' ? '▲' : '▼';
    const changeClass = changeDir === 'up' ? 'hermex-change-up' : 'hermex-change-down';
    const reasoning = proposal.confidence_reasoning
        ? `<div class="hermex-reasoning">◈ ${escapeHtml(proposal.confidence_reasoning)}</div>`
        : '';
    const logoUrl = getLogoUrl();
    const logoPng = getLogoPngUrl();
    return `
    <div class="hermex-card-header">
      <div class="hermex-header-left">
        <div class="hermex-logo-wrap">
          <img src="${logoUrl}" onerror="this.src='${logoPng}'" alt="" class="hermex-logo-img">
          <div class="hermex-logo-glow"></div>
        </div>
        <div class="hermex-brand">
          <pre class="hermex-ascii-name">╦ ╦ ╔═╗ ╦═╗ ╔╦╗ ╔═╗ ═╗ ╦
╠═╣ ║╣  ╠╦╝ ║║║ ║╣  ╔╩╦╝
╩ ╩ ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩ ╚═</pre>
          <span class="hermex-sub-brand">Predict.fun · <span class="hermex-cat-inline" style="color:${catColor}">${escapeHtml(cat)}</span></span>
        </div>
      </div>
      <div class="hermex-header-right">
        <span class="${changeClass}">${changeIcon} ${priceChange}</span>
        ${isTestnet ? '<span class="hermex-badge hermex-testnet">TESTNET</span>' : ''}
      </div>
    </div>
    <div class="hermex-card-body">
      <h3 class="hermex-title">${escapeHtml(proposal.title)}</h3>
      <p class="hermex-desc">${escapeHtml(proposal.description)}</p>
      ${reasoning}
      <div class="hermex-outcomes">
        <button class="hermex-outcome-btn hermex-yes-btn">
          <span class="hermex-outcome-label">YES</span>
          <span class="hermex-outcome-price">${yesProb}¢</span>
          <div class="hermex-mini-bar">
            <div class="hermex-mini-fill hermex-mini-yes" style="width:${yesProb}%"></div>
          </div>
        </button>
        <button class="hermex-outcome-btn hermex-no-btn">
          <span class="hermex-outcome-label">NO</span>
          <span class="hermex-outcome-price">${noProb}¢</span>
          <div class="hermex-mini-bar">
            <div class="hermex-mini-fill hermex-mini-no" style="width:${noProb}%"></div>
          </div>
        </button>
      </div>
      <div class="hermex-market-stats">
        <span class="hermex-stat">VOL <span class="hermex-stat-val">${vol}</span></span>
        <span class="hermex-stat">LIQ <span class="hermex-stat-val">${liq}</span></span>
        <span class="hermex-stat">TRADERS <span class="hermex-stat-val">${traders}</span></span>
        <span class="hermex-stat">SPREAD <span class="hermex-stat-val">${spread}</span></span>
        <span class="hermex-stat">ENDS <span class="hermex-stat-val">${endTime}</span></span>
      </div>
      <div class="hermex-tags">${tags}</div>
    </div>
    <div class="hermex-card-actions">
      <button class="hermex-btn hermex-btn-primary hermex-trade-btn"
              data-tweet-id="${tweetId}">
        TRADE ON PREDICT.FUN
      </button>
      <div class="hermex-secondary-actions">
        <button class="hermex-btn hermex-btn-secondary hermex-copy-btn"
                data-proposal='${JSON.stringify(proposal).replace(/'/g, '&#39;')}'>
          COPY
        </button>
        <button class="hermex-btn hermex-btn-secondary hermex-vote-btn">
          VOTE TO LAUNCH
        </button>
      </div>
    </div>
    <div class="hermex-card-footer">
      <span class="hermex-powered">Powered by <a href="https://github.com/herm3x/hermes-agent" target="_blank">Hermes Agent</a></span>
    </div>
  `;
}
function buildErrorCard(message) {
    const logoUrl = getLogoUrl();
    const logoPng = getLogoPngUrl();
    return `
    <div class="hermex-card-header">
      <div class="hermex-header-left">
        <div class="hermex-logo-wrap">
          <img src="${logoUrl}" onerror="this.src='${logoPng}'" alt="" class="hermex-logo-img">
          <div class="hermex-logo-glow"></div>
        </div>
        <pre class="hermex-ascii-name">╦ ╦ ╔═╗ ╦═╗ ╔╦╗ ╔═╗ ═╗ ╦
╠═╣ ║╣  ╠╦╝ ║║║ ║╣  ╔╩╦╝
╩ ╩ ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩ ╚═</pre>
      </div>
      <span class="hermex-badge hermex-error-badge">OFFLINE</span>
    </div>
    <div class="hermex-card-body hermex-error-body">
      <p class="hermex-error-msg">${escapeHtml(message)}</p>
      <p class="hermex-error-hint">Check extension settings → Backend API URL</p>
      <button class="hermex-btn hermex-btn-secondary hermex-retry-btn">DISMISS</button>
    </div>
  `;
}
function attachCardListeners(card, data) {
    const tradeBtn = card.querySelector('.hermex-trade-btn');
    tradeBtn?.addEventListener('click', () => {
        if (data.existingMarket) {
            window.open(data.existingMarket.url, '_blank');
        }
        else {
            window.open('https://predict.fun', '_blank');
        }
    });
    const copyBtn = card.querySelector('.hermex-copy-btn');
    copyBtn?.addEventListener('click', () => {
        const proposalJson = copyBtn.getAttribute('data-proposal') || '';
        navigator.clipboard.writeText(proposalJson).then(() => {
            const btn = copyBtn;
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = orig; }, 1500);
        });
    });
    const voteBtn = card.querySelector('.hermex-vote-btn');
    voteBtn?.addEventListener('click', () => {
        const btn = voteBtn;
        const currentText = btn.textContent || '';
        const match = currentText.match(/\((\d+)/);
        const votes = match ? parseInt(match[1]) + 1 : 1;
        btn.textContent = `Vote to Launch (${votes})`;
        btn.classList.add('hermex-voted');
    });
}
function formatEndTime(isoStr) {
    const end = new Date(isoStr);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const diffH = Math.round(diffMs / (1000 * 60 * 60));
    if (diffH < 1)
        return '<1h';
    if (diffH < 24)
        return `${diffH}h`;
    return `${Math.round(diffH / 24)}d`;
}
function formatNumber(n) {
    if (n >= 1_000_000)
        return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)
        return (n / 1_000).toFixed(1) + 'k';
    return n.toString();
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

;// ./src/content/content.ts




let config = DEFAULT_CONFIG;
let scanTimer = null;
let alive = true;
function isContextValid() {
    try {
        return !!(chrome?.runtime?.id);
    }
    catch {
        alive = false;
        return false;
    }
}
async function safeSendMessage(msg) {
    if (!isContextValid())
        return null;
    try {
        return await chrome.runtime.sendMessage(msg);
    }
    catch {
        alive = false;
        return null;
    }
}
async function loadConfig() {
    const response = await safeSendMessage({ type: 'GET_CONFIG' });
    if (response?.config) {
        config = response.config;
        setCardConfig(config);
    }
}
async function processTweet(tweet) {
    if (!alive)
        return;
    if (config.proposalsToday >= config.dailyLimit)
        return;
    markProcessed(tweet.id);
    injectLoadingCard(tweet.element, tweet.id);
    config.proposalsToday++;
    const { element, ...tweetPayload } = tweet;
    try {
        const response = await safeSendMessage({
            type: 'GENERATE_PROPOSAL',
            tweetData: tweetPayload,
        });
        if (!alive)
            return;
        if (response?.data) {
            updateCard(tweet.id, response.data);
        }
        else {
            updateCard(tweet.id, {
                proposal: null,
                tweetId: tweet.id,
                status: 'error',
                errorMessage: 'Could not reach Hermex backend',
            });
        }
    }
    catch (err) {
        console.error('[Hermex] processTweet error:', err);
        updateCard(tweet.id, {
            proposal: null,
            tweetId: tweet.id,
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Unexpected error',
        });
    }
}
function scanFeed() {
    if (!alive || !config.enabled)
        return;
    const tweets = getTweetElements();
    for (const el of tweets) {
        const tweet = extractTweetData(el);
        if (!tweet)
            continue;
        const should = shouldPropose(tweet, config.kolWhitelist);
        if (should) {
            processTweet(tweet);
        }
    }
}
function debouncedScan() {
    if (!alive)
        return;
    if (scanTimer)
        clearTimeout(scanTimer);
    scanTimer = setTimeout(scanFeed, 300);
}
function startObserver() {
    const observer = new MutationObserver((mutations) => {
        if (!alive) {
            observer.disconnect();
            return;
        }
        let hasNewNodes = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                hasNewNodes = true;
                break;
            }
        }
        if (hasNewNodes) {
            debouncedScan();
        }
    });
    const timeline = document.querySelector('[data-testid="primaryColumn"]')
        || document.querySelector('main')
        || document.body;
    observer.observe(timeline, { childList: true, subtree: true });
}
function watchUrlChanges() {
    let lastUrl = location.href;
    setInterval(() => {
        if (!alive)
            return;
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            clearProcessed();
            setTimeout(scanFeed, 1000);
        }
    }, 1000);
}
async function init() {
    await loadConfig();
    if (!alive)
        return;
    scanFeed();
    startObserver();
    watchUrlChanges();
    try {
        chrome.storage.onChanged.addListener((changes) => {
            if (!isContextValid())
                return;
            if (changes.hermexConfig) {
                config = { ...DEFAULT_CONFIG, ...changes.hermexConfig.newValue };
                setCardConfig(config);
                clearProcessed();
                setTimeout(scanFeed, 500);
            }
        });
    }
    catch { /* context gone, ignore */ }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}

/******/ })()
;
//# sourceMappingURL=content.js.map