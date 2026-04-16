/**
 * Feed Market Generator
 *
 * Pipeline:
 *   1. Fetch N recent tweets per tracked KOL (real — via X API / RSSHub / Nitter)
 *   2. Generate a market proposal per tweet using the Hermes LLM
 *   3. Try to match the proposal to a REAL on-chain Predict.fun market
 *      (testnet). If matched, populate real volume/liquidity; otherwise
 *      leave on-chain fields null and flag the proposal as "proposal".
 *   4. Cache result, refresh every REFRESH_MS in background.
 */

import { fetchRecentTweets, RawTweet } from './tweet-fetcher';
import { generateProposal } from './hermes';
import { addLog } from './logger';
import { matchMarketIdForQuery, getMarketStats, getMarketOrderbook } from './predict-fun';
import type { TweetInput } from '../types';

export interface FeedMarket {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  timestamp: string;
  tweet: string;
  tweetUrl: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  // On-chain stats — ONLY populated when this market matches a real
  // Predict.fun testnet market. null = proposal-only (not yet minted).
  predictFunMarketId: number | null;
  volume: number | null;
  liquidity: number | null;
  traders: number | null;
  priceChange: number | null;
  endDate: string;
  source: string;
  status: 'proposal' | 'on-chain';
}

interface KOL {
  handle: string;
  name: string;
  tweetsPerRefresh: number;
  tier: 'S' | 'A' | 'B';
}

const TRACKED_KOLS: KOL[] = [
  { handle: 'elonmusk', name: 'Elon Musk', tweetsPerRefresh: 3, tier: 'S' },
  { handle: 'cz_binance', name: 'CZ 🔶 BNB', tweetsPerRefresh: 3, tier: 'S' },
  { handle: 'Teknium', name: 'Teknium', tweetsPerRefresh: 3, tier: 'A' },
  { handle: 'NousResearch', name: 'Nous Research', tweetsPerRefresh: 3, tier: 'A' },
];

const REFRESH_MS = Number(process.env.FEED_REFRESH_MS || 10 * 60 * 1000);

interface Cache {
  markets: FeedMarket[];
  updatedAt: number;
  sources: Record<string, string>;
  refreshing: boolean;
}

const cache: Cache = {
  markets: [],
  updatedAt: 0,
  sources: {},
  refreshing: false,
};

// NOTE: we deliberately do NOT synthesize volume/liquidity/traders.
// Those fields are only populated when the tweet's proposal matches a
// real on-chain Predict.fun market (see services/predict-fun.ts enrichment).

function relTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    if (!then) return 'just now';
    const diff = Date.now() - then;
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return 'recent';
  }
}

/**
 * Build a market question from the tweet using keyword heuristics.
 * Works offline, instant. Used when LLM is unavailable or out of credits.
 */
function heuristicMarket(tw: RawTweet, kol: KOL): { title: string; prob: number; endDate: string } {
  const text = tw.text;
  const lower = text.toLowerCase();

  // End date heuristics: near-term claims get 60d, broader claims get end-of-year
  const now = new Date();
  const in60d = new Date(now.getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const in180d = new Date(now.getTime() + 180 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const eoy = `${now.getFullYear()}-12-31`;

  // Detect claim type
  let title: string;
  let endDate = eoy;
  let base = 0.5;

  const firstSentence = (text.split(/[.!?]\s/)[0] || text).trim().replace(/\s+/g, ' ');
  const excerpt = firstSentence.length > 90 ? firstSentence.slice(0, 87) + '...' : firstSentence;

  // Stable hash from tweet id for deterministic template variation
  let seed = 0;
  for (let i = 0; i < tw.id.length; i++) seed = (seed * 31 + tw.id.charCodeAt(i)) >>> 0;

  const shipMatch = text.match(/\b(ship|shipping|launch(?:ing)?|release|releasing|drop(?:ping)?|coming soon|unveil|reveal|announce)\b/i);
  const priceMatch = text.match(/\$\s*([0-9][0-9,.]*)\s*([kKmM]|[Bb])?/);
  const percentMatch = text.match(/(\d{1,3})\s*%/);
  const mentionsEoY = /\b(q[1-4]|end of|by \w+ \d{4}|next year)\b/i.test(text);

  if (shipMatch) {
    const templates = [
      `Will @${kol.handle}'s "${excerpt}" ship within 90 days?`,
      `@${kol.handle} promised: ${shipMatch[1]} — delivered within 60 days?`,
      `${excerpt} — YES by ${in60d}?`,
    ];
    title = templates[seed % templates.length];
    endDate = in60d;
    base = 0.52;
  } else if (priceMatch) {
    const priceStr = priceMatch[0];
    title = `${excerpt} — will ${priceStr} target hit within 60 days?`;
    endDate = in60d;
    base = 0.38;
  } else if (percentMatch) {
    title = `@${kol.handle} called ${percentMatch[0]} — does it materialize by EOY?`;
    endDate = eoy;
    base = 0.45;
  } else if (/\b(bullish|moon|rally|pump|all[-\s]time|ath|new high)\b/i.test(text)) {
    title = `${excerpt} — @${kol.handle}'s bullish call plays out within 60 days?`;
    endDate = in60d;
    base = 0.42;
  } else if (/\b(bearish|crash|dump|collapse|bubble|correction)\b/i.test(text)) {
    title = `${excerpt} — @${kol.handle}'s bearish call plays out within 60 days?`;
    endDate = in60d;
    base = 0.45;
  } else if (/\b(agi|gpt-\d|claude|hermes|llama|gemini|qwen|benchmark|mmlu|lmsys|sota)\b/i.test(lower)) {
    const templates = [
      `@${kol.handle}: "${excerpt}" — does next benchmark confirm?`,
      `Will @${kol.handle}'s AI claim — "${excerpt}" — hold up by EOY?`,
      `${excerpt} — proven true within 6 months?`,
    ];
    title = templates[seed % templates.length];
    endDate = in180d;
    base = 0.48;
  } else if (/\b(etf|sec|regulat|approval|lawsuit|settlement|license|partnership|listed|listing|ipo)\b/i.test(lower)) {
    title = `${excerpt} — regulatory/business outcome resolves favorably by EOY?`;
    endDate = eoy;
    base = 0.5;
  } else if (/\?/.test(text)) {
    // Tweet itself is a question — turn it into a YES market
    title = `${excerpt} — YES?`;
    endDate = mentionsEoY ? eoy : in180d;
    base = 0.47;
  } else if (/\b(will|going to|soon|targeting|plan(ning)?|expect)\b/i.test(lower)) {
    title = `@${kol.handle} forecasts: "${excerpt}" — comes true by EOY?`;
    endDate = eoy;
    base = 0.5;
  } else {
    const templates = [
      `Will @${kol.handle} be proven right on "${excerpt}"?`,
      `${excerpt} — @${kol.handle} accurate by EOY?`,
      `"${excerpt}" — market verdict by year-end: YES?`,
    ];
    title = templates[seed % templates.length];
    endDate = eoy;
    base = 0.5;
  }

  // Tier credibility adjustment + deterministic noise (same tweet → same prob)
  const tierAdj = kol.tier === 'S' ? 0.04 : kol.tier === 'A' ? 0.02 : 0;
  const noise = ((seed % 180) / 1000) - 0.09; // ±9% deterministic
  const prob = Math.max(0.12, Math.min(0.88, +(base + tierAdj + noise).toFixed(2)));

  return { title, prob, endDate };
}

async function tweetToMarket(kol: KOL, tw: RawTweet, source: string): Promise<FeedMarket | null> {
  const tweetInput: TweetInput = {
    id: tw.id,
    text: tw.text,
    author_handle: kol.handle,
    author_name: kol.name,
    timestamp: tw.createdAt,
  };

  let question: string;
  let yp: number;
  let endDate: string;
  let generator: 'llm' | 'heuristic' = 'heuristic';

  try {
    const proposal = await generateProposal(tweetInput);
    question = proposal.title;
    yp = Math.max(0.03, Math.min(0.97, +proposal.initial_probability.toFixed(2)));
    endDate = (proposal.end_time || `${new Date().getFullYear()}-12-31`).slice(0, 10);
    generator = 'llm';
  } catch (e: any) {
    const h = heuristicMarket(tw, kol);
    question = h.title;
    yp = h.prob;
    endDate = h.endDate;
    addLog(
      'feed_gen',
      `heuristic market for @${kol.handle} (LLM fallback: ${e?.message?.slice(0, 60) || 'n/a'})`,
      'warn',
    );
  }

  return {
    id: `${kol.handle}-${tw.id}`.slice(0, 80),
    author: kol.name,
    handle: kol.handle,
    avatar: `https://unavatar.io/twitter/${kol.handle}`,
    timestamp: relTime(tw.createdAt),
    tweet: tw.text,
    tweetUrl: tw.url,
    question,
    yesPrice: yp,
    noPrice: +(1 - yp).toFixed(2),
    // All on-chain fields start null. A subsequent enrichment step matches
    // this proposal to a real Predict.fun market and fills them in.
    predictFunMarketId: null,
    volume: null,
    liquidity: null,
    traders: null,
    priceChange: null,
    endDate,
    source: `${source}/${generator}`,
    status: 'proposal',
  };
}

async function refreshFeed(): Promise<void> {
  if (cache.refreshing) return;
  cache.refreshing = true;
  try {
    addLog('feed_gen', 'refreshing live markets from tracked KOLs...');
    const next: FeedMarket[] = [];
    const sources: Record<string, string> = {};

    for (const kol of TRACKED_KOLS) {
      const { tweets, source } = await fetchRecentTweets(kol.handle, kol.tweetsPerRefresh);
      sources[kol.handle] = source;
      if (!tweets.length) continue;
      for (const tw of tweets) {
        const m = await tweetToMarket(kol, tw, source);
        if (m) next.push(m);
      }
    }

    if (next.length) {
      // Enrich with real Predict.fun on-chain data (best-effort, in parallel).
      await Promise.all(
        next.map(async (m) => {
          try {
            const id = await matchMarketIdForQuery(m.question);
            if (!id) return;
            const [stats, ob] = await Promise.all([getMarketStats(id), getMarketOrderbook(id)]);
            m.predictFunMarketId = id;
            if (stats) {
              m.volume = Math.round(stats.volumeTotalUsd);
              m.liquidity = Math.round(stats.totalLiquidityUsd);
            }
            if (ob?.lastPrice != null) {
              const lastYes = ob.lastOutcome?.toLowerCase() === 'yes' ? ob.lastPrice : 1 - ob.lastPrice;
              m.yesPrice = +lastYes.toFixed(2);
              m.noPrice = +(1 - lastYes).toFixed(2);
            }
            m.status = 'on-chain';
          } catch { /* leave as proposal */ }
        }),
      );

      const onChainCount = next.filter((m) => m.status === 'on-chain').length;
      cache.markets = next;
      cache.updatedAt = Date.now();
      cache.sources = sources;
      addLog(
        'feed_gen',
        `refreshed ${next.length} markets — ${onChainCount} matched on-chain (sources: ${Object.entries(sources)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')})`,
      );
    } else {
      addLog('feed_gen', 'no tweets fetched from any source, keeping cache / seed fallback', 'warn');
    }
  } catch (e: any) {
    addLog('feed_gen', `refresh failed: ${e?.message || 'unknown'}`, 'error');
  } finally {
    cache.refreshing = false;
  }
}

export function getFeedCache(): Cache {
  return cache;
}

export function triggerRefresh(): void {
  refreshFeed().catch((e) => addLog('feed_gen', `refresh error: ${e?.message}`, 'error'));
}

export function startFeedGenerator(): void {
  triggerRefresh();
  setInterval(() => triggerRefresh(), REFRESH_MS);
}
