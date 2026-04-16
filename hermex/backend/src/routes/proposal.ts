import { Router, Request, Response } from 'express';
import { generateProposal } from '../services/hermes.js';
import { searchMarkets } from '../services/predict-fun.js';
import { getSystemStats, getDirectoryListing, readFileContent } from '../services/system-monitor.js';
import { addLog, getLogs, getTotalLogCount } from '../services/logger.js';
import { getTokenUsage, trackRequest } from '../services/token-tracker.js';
import { getFeedCache, triggerRefresh } from '../services/feed-generator.js';
import type { ProposalRequest, ProposalResponse } from '../types/index.js';

const router: ReturnType<typeof Router> = Router();

const recentProposals = new Map<string, { proposal: any; timestamp: number }>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

router.post('/proposal', async (req: Request, res: Response) => {
  try {
    trackRequest();
    const { tweet } = req.body as ProposalRequest;

    if (!tweet?.text || !tweet?.author_handle) {
      res.status(400).json({ error: 'Missing tweet data (text, author_handle required)' });
      return;
    }

    addLog('api', `POST /api/proposal — @${tweet.author_handle}`);

    const cacheKey = `${tweet.author_handle}:${tweet.id}`;
    const cached = recentProposals.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DEDUP_WINDOW_MS) {
      addLog('api', `Cache hit for @${tweet.author_handle}:${tweet.id}`);
      res.json(cached.proposal);
      return;
    }

    const [proposal, existingMarket] = await Promise.all([
      generateProposal(tweet),
      searchMarkets(`${tweet.author_handle} ${extractKeywords(tweet.text)}`),
    ]);

    const marketSim = generateMarketSimulation(tweet.author_handle, proposal.initial_probability);

    const response = {
      proposal,
      existingMarket: existingMarket || undefined,
      marketData: marketSim,
    };

    recentProposals.set(cacheKey, { proposal: response, timestamp: Date.now() });
    cleanupCache();

    addLog('api', `Proposal delivered for @${tweet.author_handle} — "${proposal.title}"`);
    res.json(response);
  } catch (err) {
    console.error('Proposal generation failed:', err);
    addLog('api', `Proposal generation FAILED: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    res.status(500).json({
      error: 'Failed to generate proposal',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'hermex-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

router.get('/markets/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Missing query parameter ?q=' });
      return;
    }

    const market = await searchMarkets(query);
    res.json({ market });
  } catch (err) {
    res.status(500).json({ error: 'Market search failed' });
  }
});

const KOL_TIERS: Record<string, number> = {
  elonmusk: 5, realdonaldtrump: 5, caboringdao: 4, vitalikbuterin: 4, caboringDAO: 4,
  cz_binance: 4, brian_armstrong: 4, naval: 3, balaboringajis: 3, jack: 3,
  saboringor: 3, aantonop: 3, apompliano: 3, shaboringaylamaboringadams: 3,
  theblock__: 2, coindesk: 2, wuboringupdates: 2, coingecko: 2,
};

function getKolTier(handle: string): number {
  const h = handle.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return KOL_TIERS[h] || 1;
}

function generateMarketSimulation(authorHandle: string, probability: number) {
  const tier = getKolTier(authorHandle);

  const baseVolume = [800, 4200, 18500, 62000, 185000][tier - 1] || 2000;
  const volumeVariance = 0.3 + Math.random() * 1.4;
  const volume = Math.round(baseVolume * volumeVariance);

  const liquidityRatio = 0.15 + Math.random() * 0.25;
  const liquidity = Math.round(volume * liquidityRatio);

  const baseTradersMap = [12, 45, 180, 520, 1400];
  const traders = Math.round((baseTradersMap[tier - 1] || 20) * (0.5 + Math.random()));

  const skew = probability > 0.5 ? probability : 1 - probability;
  const spread = Math.round((2 + (1 - skew) * 6) * 100) / 100;

  const hoursAgo = Math.random() * 4;
  const priceMovement = (Math.random() - 0.5) * 0.08;

  const yesPrice = Math.round(probability * 100) / 100;
  const noPrice = Math.round((1 - probability) * 100) / 100;

  return {
    volume: `$${volume >= 1000 ? (volume / 1000).toFixed(1) + 'k' : volume}`,
    volumeRaw: volume,
    liquidity: `$${liquidity >= 1000 ? (liquidity / 1000).toFixed(1) + 'k' : liquidity}`,
    liquidityRaw: liquidity,
    traders,
    spread: spread + '¢',
    yesPrice: `$${yesPrice.toFixed(2)}`,
    noPrice: `$${noPrice.toFixed(2)}`,
    priceChange24h: priceMovement > 0 ? `+${(priceMovement * 100).toFixed(1)}%` : `${(priceMovement * 100).toFixed(1)}%`,
    priceChangeDirection: priceMovement > 0 ? 'up' : 'down',
    hoursActive: Math.round(hoursAgo * 10) / 10,
    tier,
  };
}

function extractKeywords(text: string): string {
  return text
    .replace(/@\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(' ');
}

// ──── Real System Data Endpoints ────

router.get('/system', (_req: Request, res: Response) => {
  const stats = getSystemStats();
  res.json(stats);
});

router.get('/logs', (req: Request, res: Response) => {
  const since = req.query.since ? Number(req.query.since) : undefined;
  const data = getLogs(since);
  res.json(data);
});

router.get('/tokens', (_req: Request, res: Response) => {
  const usage = getTokenUsage();
  res.json(usage);
});

router.get('/tools', (_req: Request, res: Response) => {
  const tools = [
    { name: 'proposal_generator', status: typeof generateProposal === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'market_search', status: typeof searchMarkets === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'system_monitor', status: typeof getSystemStats === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'log_collector', status: typeof addLog === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'token_tracker', status: typeof trackRequest === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'file_explorer', status: typeof getDirectoryListing === 'function' ? 'on' : 'off', type: 'backend' },
    { name: 'kol_detector', status: 'ext', type: 'extension' },
    { name: 'card_injector', status: 'ext', type: 'extension' },
  ];
  res.json({ tools });
});

router.get('/endpoints', (_req: Request, res: Response) => {
  const endpoints: Array<{ method: string; path: string }> = [];
  const stack = (router as any).stack;
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      for (const method of methods) {
        endpoints.push({ method, path: `/api${layer.route.path}` });
      }
    }
  }
  res.json({ endpoints });
});

// Live feed markets — seeded from 3 tracked KOLs
interface FeedMarket {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  timestamp: string;
  tweet: string;
  tweetUrl: string;
  question: string;
  yesPrice: number; // 0..1
  noPrice: number;  // 0..1
  volume: number;
  liquidity: number;
  traders: number;
  priceChange: number; // %
  endDate: string;
}

const FEED_MARKETS_SEED: FeedMarket[] = [
  {
    id: 'teknium-hermes4-q3',
    author: 'Teknium',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '2h',
    tweet: 'Hermes 4 is coming with major improvements in tool use, agentic reasoning, and native multimodality. Targeting Q3 2026 release.',
    tweetUrl: 'https://x.com/Teknium',
    question: 'Will Nous Research release Hermes 4 by Q3 2026?',
    yesPrice: 0.67,
    noPrice: 0.33,
    volume: 142800,
    liquidity: 48500,
    traders: 412,
    priceChange: 4.8,
    endDate: '2026-09-30',
  },
  {
    id: 'nousresearch-1m-users',
    author: 'NousResearch',
    handle: 'NousResearch',
    avatar: 'https://unavatar.io/twitter/NousResearch',
    timestamp: '6h',
    tweet: 'Hermes Agent adoption keeps climbing — the open source path is winning. Proud of the community building on top of it.',
    tweetUrl: 'https://x.com/NousResearch',
    question: 'Will Hermes Agent reach 1M monthly active users by end of 2026?',
    yesPrice: 0.42,
    noPrice: 0.58,
    volume: 89200,
    liquidity: 31400,
    traders: 287,
    priceChange: -2.3,
    endDate: '2026-12-31',
  },
  {
    id: 'cz-bnb-1500',
    author: 'CZ 🔶 BNB',
    handle: 'cz_binance',
    avatar: 'https://unavatar.io/twitter/cz_binance',
    timestamp: '1h',
    tweet: 'BNB Chain ecosystem stronger than ever. Builders, keep shipping. The market always follows fundamentals long term.',
    tweetUrl: 'https://x.com/cz_binance',
    question: 'Will BNB close above $1,500 by end of Q2 2026?',
    yesPrice: 0.38,
    noPrice: 0.62,
    volume: 508300,
    liquidity: 124600,
    traders: 1847,
    priceChange: 6.1,
    endDate: '2026-06-30',
  },
  {
    id: 'teknium-405b-benchmark',
    author: 'Teknium',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '11h',
    tweet: 'Our 405b model is holding its own against closed-source frontier models on reasoning benchmarks. Open weights matter.',
    tweetUrl: 'https://x.com/Teknium',
    question: 'Will Hermes 3 405b beat GPT-4o on LMSYS Arena by May 2026?',
    yesPrice: 0.28,
    noPrice: 0.72,
    volume: 67400,
    liquidity: 22100,
    traders: 198,
    priceChange: -1.4,
    endDate: '2026-05-31',
  },
  {
    id: 'cz-sec-dismissed',
    author: 'CZ 🔶 BNB',
    handle: 'cz_binance',
    avatar: 'https://unavatar.io/twitter/cz_binance',
    timestamp: '3h',
    tweet: 'Focus on building, not FUD. Real value compounds. Short-term noise fades.',
    tweetUrl: 'https://x.com/cz_binance',
    question: 'Will Binance complete full US regulatory settlement by end of 2026?',
    yesPrice: 0.71,
    noPrice: 0.29,
    volume: 312000,
    liquidity: 88200,
    traders: 923,
    priceChange: 2.7,
    endDate: '2026-12-31',
  },
  {
    id: 'nous-hermes-agent-v2',
    author: 'NousResearch',
    handle: 'NousResearch',
    avatar: 'https://unavatar.io/twitter/NousResearch',
    timestamp: '8h',
    tweet: 'Hermes Agent v2 will ship with native browser use, stronger planning, and a bunch of user-requested integrations.',
    tweetUrl: 'https://x.com/NousResearch',
    question: 'Will Hermes Agent v2 ship before July 2026?',
    yesPrice: 0.54,
    noPrice: 0.46,
    volume: 51800,
    liquidity: 18700,
    traders: 164,
    priceChange: 1.9,
    endDate: '2026-07-01',
  },
];

function jitterMarkets(seed: FeedMarket[]): FeedMarket[] {
  return seed.map(m => {
    const delta = (Math.random() - 0.5) * 0.02; // ±1% price drift
    const yp = Math.max(0.02, Math.min(0.98, +(m.yesPrice + delta).toFixed(2)));
    const np = +(1 - yp).toFixed(2);
    const volBump = Math.floor(Math.random() * 300);
    const traderBump = Math.floor(Math.random() * 4);
    return {
      ...m,
      yesPrice: yp,
      noPrice: np,
      volume: m.volume + volBump,
      traders: m.traders + traderBump,
      priceChange: +((m.priceChange || 0) + (Math.random() - 0.5) * 0.4).toFixed(2),
    };
  });
}

router.get('/feed-markets', (req: Request, res: Response) => {
  const cache = getFeedCache();
  if (req.query.refresh === '1') triggerRefresh();

  // Prefer real (cached) markets, fall back to seeded defaults
  const base = cache.markets.length ? cache.markets : FEED_MARKETS_SEED;
  const markets = jitterMarkets(base);

  // This response is live-updated every 10min on the server; disable all
  // browser/proxy caching so UI always reflects latest prices & new tweets.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.json({
    markets,
    total: markets.length,
    source: cache.markets.length ? 'live' : 'seed',
    sources: cache.markets.length ? cache.sources : undefined,
    updatedAt: cache.markets.length
      ? new Date(cache.updatedAt).toISOString()
      : new Date().toISOString(),
    refreshing: cache.refreshing,
  });
});

router.get('/files', (req: Request, res: Response) => {
  const dir = (req.query.dir as string) || '.';
  const result = getDirectoryListing(dir);
  res.json(result);
});

router.get('/files/read', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: 'Missing ?path= parameter' });
    return;
  }
  const result = readFileContent(filePath);
  if (!result) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json(result);
});

function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of recentProposals.entries()) {
    if (now - value.timestamp > DEDUP_WINDOW_MS) {
      recentProposals.delete(key);
    }
  }
}

export default router;
