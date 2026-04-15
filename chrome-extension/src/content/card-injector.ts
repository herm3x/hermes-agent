import { ProposalCardData, MarketProposal, PredictFunMarket, HermexConfig, DEFAULT_CONFIG } from '../types';

const CARD_ATTR = 'data-hermex-card';
let currentConfig: HermexConfig = DEFAULT_CONFIG;

export function setCardConfig(config: HermexConfig): void {
  currentConfig = config;
}

export function injectLoadingCard(tweetEl: HTMLElement, tweetId: string): void {
  if (tweetEl.querySelector(`[${CARD_ATTR}]`)) return;

  const card = document.createElement('div');
  card.setAttribute(CARD_ATTR, tweetId);
  card.className = 'hermex-card hermex-loading';
  card.innerHTML = `
    <div class="hermex-card-header">
      <span class="hermex-logo">☤ Hermex</span>
      <span class="hermex-badge">Loading...</span>
    </div>
    <div class="hermex-card-body">
      <div class="hermex-spinner"></div>
      <p class="hermex-loading-text">Hermes Agent is analyzing this tweet...</p>
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
    card.innerHTML = buildErrorCard(data.errorMessage || 'Failed to generate proposal');
    return;
  }

  card.innerHTML = buildProposalCard(data.proposal, data.existingMarket, data.tweetId);
  attachCardListeners(card as HTMLElement, data);
}

function buildProposalCard(
  proposal: MarketProposal,
  existingMarket?: PredictFunMarket,
  tweetId?: string,
): string {
  const yesProb = Math.round(proposal.initial_probability * 100);
  const noProb = 100 - yesProb;
  const endTime = formatEndTime(proposal.end_time);
  const isTestnet = currentConfig.useTestnet;
  const tags = proposal.tags.map(t => `<span class="hermex-tag">${escapeHtml(t)}</span>`).join('');

  const marketInfo = existingMarket
    ? `<div class="hermex-market-info">
        <span>Volume: $${formatNumber(existingMarket.volume)}</span>
        <span>Liquidity: $${formatNumber(existingMarket.liquidity)}</span>
        <span>Ends: ${endTime}</span>
      </div>`
    : `<div class="hermex-market-info">
        <span class="hermex-new-market">New Market Proposal</span>
        <span>Ends: ${endTime}</span>
      </div>`;

  return `
    <div class="hermex-card-header">
      <div class="hermex-header-left">
        <span class="hermex-logo">☤ Hermex</span>
        <span class="hermex-source">Predict.fun</span>
      </div>
      <div class="hermex-header-right">
        ${isTestnet ? '<span class="hermex-badge hermex-testnet">Testnet</span>' : ''}
      </div>
    </div>
    <div class="hermex-card-body">
      <h3 class="hermex-title">${escapeHtml(proposal.title)}</h3>
      <p class="hermex-desc">${escapeHtml(proposal.description)}</p>
      <div class="hermex-outcomes">
        <div class="hermex-outcome hermex-yes">
          <span class="hermex-outcome-label">Yes</span>
          <div class="hermex-bar-container">
            <div class="hermex-bar hermex-bar-yes" style="width: ${yesProb}%"></div>
          </div>
          <span class="hermex-prob">${yesProb}%</span>
        </div>
        <div class="hermex-outcome hermex-no">
          <span class="hermex-outcome-label">No</span>
          <div class="hermex-bar-container">
            <div class="hermex-bar hermex-bar-no" style="width: ${noProb}%"></div>
          </div>
          <span class="hermex-prob">${noProb}%</span>
        </div>
      </div>
      ${marketInfo}
      <div class="hermex-tags">${tags}</div>
    </div>
    <div class="hermex-card-actions">
      <button class="hermex-btn hermex-btn-primary hermex-trade-btn"
              data-tweet-id="${tweetId}">
        Trade on Predict.fun
      </button>
      <div class="hermex-secondary-actions">
        <button class="hermex-btn hermex-btn-secondary hermex-copy-btn"
                data-proposal='${JSON.stringify(proposal).replace(/'/g, '&#39;')}'>
          Copy Proposal
        </button>
        <button class="hermex-btn hermex-btn-secondary hermex-vote-btn">
          Vote to Launch
        </button>
      </div>
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
