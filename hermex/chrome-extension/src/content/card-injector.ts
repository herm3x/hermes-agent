import { ProposalCardData, MarketProposal, PredictFunMarket, HermexConfig, DEFAULT_CONFIG } from '../types';

const CARD_ATTR = 'data-hermex-card';
let currentConfig: HermexConfig = DEFAULT_CONFIG;

export function setCardConfig(config: HermexConfig): void {
  currentConfig = config;
}

function getLogoUrl(): string {
  try { return chrome.runtime.getURL('assets/hermex-eye.jpg'); } catch { return ''; }
}

function getLogoPngUrl(): string {
  try { return chrome.runtime.getURL('assets/hermex-eye.png'); } catch { return ''; }
}

export function injectLoadingCard(tweetEl: HTMLElement, tweetId: string): void {
  if (tweetEl.querySelector(`[${CARD_ATTR}]`)) return;

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
  } else {
    tweetEl.appendChild(card);
  }
}

export function updateCard(tweetId: string, data: ProposalCardData): void {
  const card = document.querySelector(`[${CARD_ATTR}="${tweetId}"]`);
  if (!card) return;

  card.className = 'hermex-card';

  if (data.status === 'error') {
    (card as HTMLElement).remove();
    return;
  }

  card.innerHTML = buildProposalCard(data.proposal, data.existingMarket, data.tweetId, data.marketData);
  attachCardListeners(card as HTMLElement, data);
}

function buildProposalCard(
  proposal: MarketProposal,
  existingMarket?: PredictFunMarket,
  tweetId?: string,
  marketData?: any,
): string {
  const yesProb = Math.round(proposal.initial_probability * 100);
  const noProb = 100 - yesProb;
  const endTime = formatEndTime(proposal.end_time);
  const isTestnet = currentConfig.useTestnet;
  const tags = proposal.tags.map(t => `<span class="hermex-tag">${escapeHtml(t)}</span>`).join('');

  const cat = (proposal as any).category || 'crypto';
  const categoryColors: Record<string, string> = {
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

  const reasoning = (proposal as any).confidence_reasoning
    ? `<div class="hermex-reasoning">◈ ${escapeHtml((proposal as any).confidence_reasoning)}</div>`
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

function buildErrorCard(message: string): string {
  return `
    <div class="hermex-card-header">
      <span class="hermex-logo">☤ Hermex</span>
      <span class="hermex-badge hermex-error-badge">Error</span>
    </div>
    <div class="hermex-card-body hermex-error-body">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function attachCardListeners(card: HTMLElement, data: ProposalCardData): void {
  const tradeBtn = card.querySelector('.hermex-trade-btn');
  tradeBtn?.addEventListener('click', () => {
    if (data.existingMarket) {
      window.open(data.existingMarket.url, '_blank');
    } else {
      window.open('https://predict.fun', '_blank');
    }
  });

  const copyBtn = card.querySelector('.hermex-copy-btn');
  copyBtn?.addEventListener('click', () => {
    const proposalJson = copyBtn.getAttribute('data-proposal') || '';
    navigator.clipboard.writeText(proposalJson).then(() => {
      const btn = copyBtn as HTMLButtonElement;
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  });

  const voteBtn = card.querySelector('.hermex-vote-btn');
  voteBtn?.addEventListener('click', () => {
    const btn = voteBtn as HTMLButtonElement;
    const currentText = btn.textContent || '';
    const match = currentText.match(/\((\d+)/);
    const votes = match ? parseInt(match[1]) + 1 : 1;
    btn.textContent = `Vote to Launch (${votes})`;
    btn.classList.add('hermex-voted');
  });
}

function formatEndTime(isoStr: string): string {
  const end = new Date(isoStr);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return '<1h';
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
