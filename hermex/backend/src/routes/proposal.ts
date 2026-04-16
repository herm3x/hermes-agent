import { Router, Request, Response } from 'express';
import { generateProposal } from '../services/hermes.js';
import { searchMarkets, listLiveMarkets } from '../services/predict-fun.js';
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

/**
 * /api/feed-markets
 * Real tweet-derived proposals. No seed data, no jitter, no synthesized
 * volume or price drift. Returns an empty list until the feed-generator
 * has completed its first refresh.
 */
router.get('/feed-markets', (req: Request, res: Response) => {
  const cache = getFeedCache();
  if (req.query.refresh === '1') triggerRefresh();

  const markets = cache.markets;

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.json({
    markets,
    total: markets.length,
    source: markets.length ? 'live' : 'empty',
    sources: markets.length ? cache.sources : undefined,
    updatedAt: cache.updatedAt ? new Date(cache.updatedAt).toISOString() : null,
    refreshing: cache.refreshing,
  });
});

/**
 * /api/predict-markets
 * Real on-chain Predict.fun (BNB testnet) markets — `tradingStatus=OPEN`,
 * with live volume, liquidity, and orderbook. No API key required.
 * Cached in-process for 60s to stay inside the 240 req/min testnet limit.
 */
interface PredictMarketCache {
  expires: number;
  payload: any;
}
let predictMarketCache: PredictMarketCache | null = null;
const PREDICT_TTL_MS = 60 * 1000;

router.get('/predict-markets', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
    const now = Date.now();
    if (predictMarketCache && predictMarketCache.expires > now && !req.query.refresh) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.json(predictMarketCache.payload);
      return;
    }
    const markets = await listLiveMarkets(limit);
    const payload = {
      markets,
      total: markets.length,
      source: 'predict.fun-testnet',
      updatedAt: new Date().toISOString(),
    };
    predictMarketCache = { expires: now + PREDICT_TTL_MS, payload };
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json(payload);
  } catch (err) {
    addLog('api', `predict-markets failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    res.status(500).json({ error: 'predict-markets failed' });
  }
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
