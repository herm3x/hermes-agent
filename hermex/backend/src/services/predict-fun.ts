import { config } from '../config.js';
import type { PredictFunMarket } from '../types/index.js';

const BASE_URL = config.predictFun.apiUrl;

export async function searchMarkets(query: string): Promise<PredictFunMarket | null> {
  try {
    const url = `${BASE_URL}/v1/markets?limit=50`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (config.predictFun.apiKey) {
      headers['Authorization'] = `Bearer ${config.predictFun.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`Predict.fun API returned ${response.status}`);
      return null;
    }

    const body = await response.json() as { success?: boolean; data?: any[] };

    if (!body.success || !Array.isArray(body.data) || body.data.length === 0) {
      return null;
    }

    const best = findBestMatch(body.data, query);
    if (!best) return null;

    return normalizeMarket(best);
  } catch (err) {
    console.warn('Predict.fun search failed:', err);
    return null;
  }
}

function findBestMatch(markets: any[], query: string): any | null {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  let bestMarket = null;
  let bestScore = 0;

  for (const market of markets) {
    if (market.tradingStatus !== 'OPEN') continue;

    const title = (market.title || '').toLowerCase();
    const question = (market.question || '').toLowerCase();
    const description = (market.description || '').toLowerCase();
    const searchable = `${title} ${question} ${description}`;

    let score = 0;
    for (const word of queryWords) {
      if (searchable.includes(word)) score++;
    }

    const similarity = score / Math.max(queryWords.length, 1);
    if (similarity > bestScore && similarity > 0.3) {
      bestScore = similarity;
      bestMarket = market;
    }
  }

  return bestMarket;
}

function normalizeMarket(raw: any): PredictFunMarket {
  const outcomes = (raw.outcomes || []).map((o: any) => ({
    name: o.name || 'Unknown',
    probability: o.probability || o.price || 0.5,
  }));

  const slug = raw.categorySlug || '';
  const marketUrl = `https://predict.fun/${slug}`;

  return {
    id: String(raw.id || ''),
    title: raw.question || raw.title || '',
    description: raw.description || '',
    outcomes,
    volume: raw.stats?.volume ?? 0,
    liquidity: raw.stats?.liquidity ?? 0,
    endDate: raw.boostEndsAt || raw.createdAt || '',
    url: marketUrl,
  };
}

export async function getMarketById(marketId: string): Promise<PredictFunMarket | null> {
  try {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (config.predictFun.apiKey) {
      headers['Authorization'] = `Bearer ${config.predictFun.apiKey}`;
    }

    const response = await fetch(`${BASE_URL}/v1/markets/${marketId}`, { headers });
    if (!response.ok) return null;

    const data = await response.json();
    return normalizeMarket(data);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Raw on-chain stats (real numbers from Predict.fun testnet/mainnet) *
 * ------------------------------------------------------------------ */

export interface OnChainStats {
  marketId: number;
  totalLiquidityUsd: number;
  volume24hUsd: number;
  volumeTotalUsd: number;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (config.predictFun.apiKey) h.Authorization = `Bearer ${config.predictFun.apiKey}`;
  return h;
}

export async function getMarketStats(marketId: number | string): Promise<OnChainStats | null> {
  try {
    const r = await fetch(`${BASE_URL}/v1/markets/${marketId}/stats`, { headers: authHeaders() });
    if (!r.ok) return null;
    const body = (await r.json()) as { success?: boolean; data?: any };
    if (!body?.success || !body.data) return null;
    return {
      marketId: Number(marketId),
      totalLiquidityUsd: Number(body.data.totalLiquidityUsd ?? 0),
      volume24hUsd: Number(body.data.volume24hUsd ?? 0),
      volumeTotalUsd: Number(body.data.volumeTotalUsd ?? 0),
    };
  } catch {
    return null;
  }
}

export interface OrderbookSnapshot {
  marketId: number;
  asks: Array<[number, number]>;
  bids: Array<[number, number]>;
  lastPrice: number | null;
  lastSide: string | null;
  lastOutcome: string | null;
  updatedAt: number;
}

export async function getMarketOrderbook(marketId: number | string): Promise<OrderbookSnapshot | null> {
  try {
    const r = await fetch(`${BASE_URL}/v1/markets/${marketId}/orderbook`, { headers: authHeaders() });
    if (!r.ok) return null;
    const body = (await r.json()) as { success?: boolean; data?: any };
    if (!body?.success || !body.data) return null;
    const d = body.data;
    const last = d.lastOrderSettled;
    return {
      marketId: Number(marketId),
      asks: Array.isArray(d.asks) ? d.asks.slice(0, 5) : [],
      bids: Array.isArray(d.bids) ? d.bids.slice(0, 5) : [],
      lastPrice: last ? Number(last.price) : null,
      lastSide: last ? String(last.side) : null,
      lastOutcome: last ? String(last.outcome) : null,
      updatedAt: Number(d.updateTimestampMs ?? Date.now()),
    };
  } catch {
    return null;
  }
}

export interface LiveMarket {
  id: number;
  conditionId: string;
  question: string;
  title: string;
  description: string;
  categorySlug: string;
  imageUrl: string | null;
  tradingStatus: string;
  outcomes: Array<{ name: string; onChainId: string }>;
  url: string;
  stats: OnChainStats | null;
  orderbook: OrderbookSnapshot | null;
}

/** Fetch top N real on-chain markets with stats merged in. */
export async function listLiveMarkets(limit = 12): Promise<LiveMarket[]> {
  try {
    const r = await fetch(`${BASE_URL}/v1/markets?limit=${Math.min(limit * 4, 100)}`, {
      headers: authHeaders(),
    });
    if (!r.ok) return [];
    const body = (await r.json()) as { data?: any[] };
    const raw = Array.isArray(body.data) ? body.data : [];
    const open = raw.filter(
      (m) => m?.tradingStatus === 'OPEN' && m?.isVisible !== false,
    );
    const withStats = await Promise.all(
      open.slice(0, limit).map(async (m) => {
        const [stats, ob] = await Promise.all([
          getMarketStats(m.id),
          getMarketOrderbook(m.id),
        ]);
        return {
          id: Number(m.id),
          conditionId: String(m.conditionId || ''),
          question: String(m.question || m.title || ''),
          title: String(m.title || m.question || ''),
          description: String(m.description || ''),
          categorySlug: String(m.categorySlug || ''),
          imageUrl: m.imageUrl ? String(m.imageUrl) : null,
          tradingStatus: String(m.tradingStatus),
          outcomes: (m.outcomes || []).map((o: any) => ({
            name: String(o.name || ''),
            onChainId: String(o.onChainId || ''),
          })),
          url: `https://predict.fun/${m.categorySlug || ''}`,
          stats,
          orderbook: ob,
        } as LiveMarket;
      }),
    );
    return withStats;
  } catch {
    return [];
  }
}

/** Return the single best-matching real market id for a free-text query, or null. */
export async function matchMarketIdForQuery(query: string): Promise<number | null> {
  try {
    const r = await fetch(`${BASE_URL}/v1/markets?limit=100`, { headers: authHeaders() });
    if (!r.ok) return null;
    const body = (await r.json()) as { data?: any[] };
    const raw = Array.isArray(body.data) ? body.data : [];
    const open = raw.filter((m) => m?.tradingStatus === 'OPEN');
    const match = findBestMatch(open, query);
    return match ? Number(match.id) : null;
  } catch {
    return null;
  }
}
