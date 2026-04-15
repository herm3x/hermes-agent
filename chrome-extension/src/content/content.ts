import './styles.css';
import { extractTweetData, shouldPropose, markProcessed, getTweetElements } from './tweet-detector';
import { injectLoadingCard, updateCard } from './card-injector';
import { HermexConfig, DEFAULT_CONFIG, TweetData, ProposalCardData } from '../types';

let config: HermexConfig = DEFAULT_CONFIG;
let isProcessing = false;

async function loadConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (response?.config) config = response.config;
  } catch {
    /* use defaults */
  }
}

async function processTweet(tweet: TweetData): Promise<void> {
  if (config.proposalsToday >= config.dailyLimit) return;

  markProcessed(tweet.id);
  injectLoadingCard(tweet.element, tweet.id);

  try {
    const { element, ...tweetPayload } = tweet;
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PROPOSAL',
      tweetData: tweetPayload,
    });

    if (response?.data) {
      updateCard(tweet.id, response.data as ProposalCardData);
    } else {
      updateCard(tweet.id, {
        proposal: null as any,
        tweetId: tweet.id,
        status: 'error',
        errorMessage: 'No response from Hermes Agent',
      });
    }
  } catch (err) {
    updateCard(tweet.id, {
      proposal: null as any,
      tweetId: tweet.id,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

function scanFeed(): void {
  if (!config.enabled || isProcessing) return;
  isProcessing = true;

  try {
    const tweets = getTweetElements();
    for (const el of tweets) {
      const tweet = extractTweetData(el);
      if (!tweet) continue;
      if (shouldPropose(tweet, config.kolWhitelist)) {
        processTweet(tweet);
      }
    }
  } finally {
    isProcessing = false;
  }
}

function startObserver(): void {
  const observer = new MutationObserver((mutations) => {
    let hasNewTweets = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewTweets = true;
        break;
      }
    }
    if (hasNewTweets) {
      requestAnimationFrame(scanFeed);
    }
  });

  const timeline = document.querySelector('[data-testid="primaryColumn"]')
    || document.querySelector('main')
    || document.body;

  observer.observe(timeline, { childList: true, subtree: true });
}

async function init(): Promise<void> {
  await loadConfig();
  scanFeed();
  startObserver();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.hermexConfig) {
      config = { ...DEFAULT_CONFIG, ...changes.hermexConfig.newValue };
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
