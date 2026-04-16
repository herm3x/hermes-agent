import { Router, Request, Response } from 'express';
import { generateProposal } from '../services/hermes.js';
import { searchMarkets } from '../services/predict-fun.js';
import { getSystemStats, getDirectoryListing, readFileContent } from '../services/system-monitor.js';
import { addLog, getLogs, getTotalLogCount } from '../services/logger.js';
import { getTokenUsage, trackRequest } from '../services/token-tracker.js';
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

/**
 * /api/feed-markets
 * Curated static feed of 6 real KOL tweets (Teknium + cz_binance) with
 * hand-written market questions and plausible volume/liquidity/traders
 * stats. Light jitter is applied on each request so the numbers feel
 * live without hammering any upstream API.
 */
interface FeedMarket {
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
  volume: number;
  liquidity: number;
  traders: number;
  priceChange: number;
  endDate: string;
}

const FEED_MARKETS_SEED: FeedMarket[] = [
  {
    id: 'teknium-mutahar-2044621204397683093',
    author: 'Teknium (e/λ)',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '3h',
    tweet: 'Awesome and honored to have Mutahar choosing Hermes Agent!\n\nFeel free to reach out to me if you need any help or have suggestions 🫡🫡',
    tweetUrl: 'https://x.com/Teknium/status/2044621204397683093',
    question: 'Will Mutahar publish a Hermes Agent showcase video before June 2026?',
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 84_300,
    liquidity: 27_800,
    traders: 241,
    priceChange: 3.4,
    endDate: '2026-05-31',
  },
  {
    id: 'teknium-qqbot-bedrock-2044557360962871711',
    author: 'Teknium (e/λ)',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '7h',
    tweet: 'Added official support to Hermes Agent for:\n\nQQBot - hugely popular messaging platform in China\n\nAWS Bedrock Model Provider\n\nRun `hermes update` in your terminal to access early!',
    tweetUrl: 'https://x.com/Teknium/status/2044557360962871711',
    question: 'Will Hermes Agent cross 100k MAU from Chinese QQBot users by Q3 2026?',
    yesPrice: 0.44,
    noPrice: 0.56,
    volume: 52_100,
    liquidity: 18_600,
    traders: 176,
    priceChange: -1.8,
    endDate: '2026-09-30',
  },
  {
    id: 'teknium-dataset-2044518923677405648',
    author: 'Teknium (e/λ)',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '10h',
    tweet: 'A new open hermes agent focused dataset has been released!\n\nCheck it out 👀👀',
    tweetUrl: 'https://x.com/Teknium/status/2044518923677405648',
    question: 'Will this new Hermes Agent dataset exceed 10k HuggingFace downloads in 30 days?',
    yesPrice: 0.68,
    noPrice: 0.32,
    volume: 34_700,
    liquidity: 12_400,
    traders: 118,
    priceChange: 5.2,
    endDate: '2026-05-15',
  },
  {
    id: 'teknium-local-models-2044383042031260153',
    author: 'Teknium (e/λ)',
    handle: 'Teknium',
    avatar: 'https://unavatar.io/twitter/Teknium',
    timestamp: '19h',
    tweet: 'For local models, which is better in Hermes Agent?',
    tweetUrl: 'https://x.com/Teknium/status/2044383042031260153',
    question: 'Will Qwen beat Gemma in Teknium\'s local model poll?',
    yesPrice: 0.57,
    noPrice: 0.43,
    volume: 91_600,
    liquidity: 31_200,
    traders: 314,
    priceChange: 2.1,
    endDate: '2026-04-22',
  },
  {
    id: 'cz-giggle-2044772267574304780',
    author: 'CZ 🔶 BNB',
    handle: 'cz_binance',
    avatar: 'https://unavatar.io/twitter/cz_binance',
    timestamp: '1h',
    tweet: '.@GiggleAcademy is now teaching 274.4k kids, for free.',
    tweetUrl: 'https://x.com/cz_binance/status/2044772267574304780',
    question: 'Will GiggleAcademy pass 500k active students before end of 2026?',
    yesPrice: 0.71,
    noPrice: 0.29,
    volume: 318_400,
    liquidity: 87_600,
    traders: 912,
    priceChange: 4.7,
    endDate: '2026-12-31',
  },
  {
    id: 'cz-pakistan-2044759742531195257',
    author: 'CZ 🔶 BNB',
    handle: 'cz_binance',
    avatar: 'https://unavatar.io/twitter/cz_binance',
    timestamp: '2h',
    tweet: 'Guess who\'s licensed in Pakistan?',
    tweetUrl: 'https://x.com/cz_binance/status/2044759742531195257',
    question: 'Will Binance Pakistan open user onboarding before July 2026?',
    yesPrice: 0.74,
    noPrice: 0.26,
    volume: 642_800,
    liquidity: 158_300,
    traders: 1834,
    priceChange: 6.9,
    endDate: '2026-06-30',
  },
];

function jitterMarkets(seed: FeedMarket[]): FeedMarket[] {
  return seed.map((m) => {
    const delta = (Math.random() - 0.5) * 0.02; // ±1% drift
    const yp = Math.max(0.03, Math.min(0.97, +(m.yesPrice + delta).toFixed(2)));
    const np = +(1 - yp).toFixed(2);
    const volBump = Math.floor(Math.random() * 400);
    const traderBump = Math.floor(Math.random() * 5);
    return {
      ...m,
      yesPrice: yp,
      noPrice: np,
      volume: m.volume + volBump,
      traders: m.traders + traderBump,
      priceChange: +(m.priceChange + (Math.random() - 0.5) * 0.4).toFixed(2),
    };
  });
}

router.get('/feed-markets', (_req: Request, res: Response) => {
  const markets = jitterMarkets(FEED_MARKETS_SEED);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.json({
    markets,
    total: markets.length,
    source: 'curated',
    updatedAt: new Date().toISOString(),
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
