import './styles.css';
import { extractTweetData, shouldPropose, markProcessed, getTweetElements, clearProcessed } from './tweet-detector';
import { injectLoadingCard, updateCard, setCardConfig } from './card-injector';
import { HermexConfig, DEFAULT_CONFIG, TweetData, ProposalCardData } from '../types';

let config: HermexConfig = DEFAULT_CONFIG;
let scanTimer: ReturnType<typeof setTimeout> | null = null;
let alive = true;

function isContextValid(): boolean {
  try {
    return !!(chrome?.runtime?.id);
  } catch {
    alive = false;
    return false;
  }
}

async function safeSendMessage(msg: any): Promise<any> {
  if (!isContextValid()) return null;
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch {
    alive = false;
    return null;
  }
}

async function loadConfig(): Promise<void> {
  const response = await safeSendMessage({ type: 'GET_CONFIG' });
  if (response?.config) {
    config = response.config;
    setCardConfig(config);
  }
}

async function processTweet(tweet: TweetData): Promise<void> {
  if (!alive) return;
  if (config.proposalsToday >= config.dailyLimit) return;

  markProcessed(tweet.id);
  injectLoadingCard(tweet.element, tweet.id);
  config.proposalsToday++;

  const { element, ...tweetPayload } = tweet;
  try {
    const response = await safeSendMessage({
      type: 'GENERATE_PROPOSAL',
      tweetData: tweetPayload,
    });

    if (!alive) return;

    if (response?.data) {
      updateCard(tweet.id, response.data as ProposalCardData);
    } else {
      const card = document.querySelector(`[data-hermex-card="${tweet.id}"]`);
      if (card) card.remove();
    }
  } catch (err) {
    console.error('[Hermex] processTweet error:', err);
  }
}

function scanFeed(): void {
  if (!alive || !config.enabled) return;

  const tweets = getTweetElements();
  for (const el of tweets) {
    const tweet = extractTweetData(el);
    if (!tweet) continue;
    const should = shouldPropose(tweet, config.kolWhitelist);
    if (should) {
      processTweet(tweet);
    }
  }
}

function debouncedScan(): void {
  if (!alive) return;
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(scanFeed, 300);
}

function startObserver(): void {
  const observer = new MutationObserver((mutations) => {
    if (!alive) { observer.disconnect(); return; }
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

function watchUrlChanges(): void {
  let lastUrl = location.href;
  setInterval(() => {
    if (!alive) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearProcessed();
      setTimeout(scanFeed, 1000);
    }
  }, 1000);
}

async function init(): Promise<void> {
  await loadConfig();
  if (!alive) return;
  scanFeed();
  startObserver();
  watchUrlChanges();

  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (!isContextValid()) return;
      if (changes.hermexConfig) {
        config = { ...DEFAULT_CONFIG, ...changes.hermexConfig.newValue };
        setCardConfig(config);
        clearProcessed();
        setTimeout(scanFeed, 500);
      }
    });
  } catch { /* context gone, ignore */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
