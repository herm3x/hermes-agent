import { config } from '../config.js';
import type { PredictFunMarket } from '../types/index.js';

const BASE_URL = config.predictFun.apiUrl;

export async function searchMarkets(query: string): Promise<PredictFunMarket | null> {
  try {
    const url = `${BASE_URL}/v1/markets?search=${encodeURIComponent(query)}&limit=5&status=active`;

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

    const data = await response.json();
    const markets = data.markets || data.data || data;

    if (!Array.isArray(markets) || markets.length === 0) {
      return null;
    }

    const best = findBestMatch(markets, query);
    if (!best) return null;

    return normalizeMarket(best);
  } catch (err) {
    console.warn('Predict.fun search failed:', err);
    return null;
  }
}

function findBestMatch(markets: any[], query: string): any | null {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

  let bestMarket = null;
  let bestScore = 0;

  for (const market of markets) {
    const title = (market.title || market.question || '').toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (title.includes(word)) score++;
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
    name: o.name || o.title || 'Unknown',
    probability: o.probability || o.price || 0.5,
  }));

  const isTestnet = BASE_URL.includes('testnet');
  const baseWebUrl = isTestnet ? 'https://testnet.predict.fun' : 'https://predict.fun';

  return {
    id: raw.id || raw.market_id || '',
    title: raw.title || raw.question || '',
    description: raw.description || '',
    outcomes,
    volume: raw.volume || raw.total_volume || 0,
    liquidity: raw.liquidity || raw.total_liquidity || 0,
    endDate: raw.end_date || raw.close_time || '',
    url: `${baseWebUrl}/market/${raw.id || raw.market_id}`,
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
