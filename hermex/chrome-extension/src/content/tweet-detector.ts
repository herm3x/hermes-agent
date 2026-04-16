import { TweetData, TOP_KOLS } from '../types';

let PROCESSED_TWEETS = new Set<string>();

export function clearProcessed(): void {
  PROCESSED_TWEETS = new Set<string>();
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

export function extractTweetData(tweetEl: HTMLElement): TweetData | null {
  const linkEl = tweetEl.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
  if (!linkEl) return null;

  const href = linkEl.getAttribute('href') || '';
  const statusMatch = href.match(/\/(\w+)\/status\/(\d+)/);
  if (!statusMatch) return null;

  const authorHandle = statusMatch[1];
  const tweetId = statusMatch[2];

  if (PROCESSED_TWEETS.has(tweetId)) return null;

  const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
  const text = tweetTextEl?.textContent?.trim() || '';
  if (!text || text.length < 10) return null;

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

export function isKolTweet(handle: string, whitelist: string[]): boolean {
  const lower = handle.toLowerCase();
  const allKols = [...TOP_KOLS.map(k => k.toLowerCase()), ...whitelist.map(k => k.toLowerCase())];
  return allKols.includes(lower);
}

export function isPredictable(text: string): boolean {
  let score = 0;
  for (const pattern of CONTROVERSY_PATTERNS) {
    if (pattern.test(text)) score++;
  }
  if (text.length > 100) score++;
  if (text.includes('@')) score++;
  return score >= 2;
}

export function shouldPropose(tweet: TweetData, whitelist: string[]): boolean {
  if (PROCESSED_TWEETS.has(tweet.id)) return false;
  const isKol = isKolTweet(tweet.authorHandle, whitelist);
  const predictable = isPredictable(tweet.text);
  return isKol || predictable;
}

export function markProcessed(tweetId: string): void {
  PROCESSED_TWEETS.add(tweetId);
}

export function getTweetElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-testid="tweet"]')) as HTMLElement[];
}
