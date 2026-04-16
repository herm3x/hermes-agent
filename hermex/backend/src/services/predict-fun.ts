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
