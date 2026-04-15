import { Router, Request, Response } from 'express';
import { generateProposal } from '../services/hermes.js';
import { searchMarkets } from '../services/predict-fun.js';
import type { ProposalRequest, ProposalResponse } from '../types/index.js';

const router = Router();

const recentProposals = new Map<string, { proposal: any; timestamp: number }>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

router.post('/proposal', async (req: Request, res: Response) => {
  try {
    const { tweet } = req.body as ProposalRequest;

    if (!tweet?.text || !tweet?.author_handle) {
      res.status(400).json({ error: 'Missing tweet data (text, author_handle required)' });
      return;
    }

    const cacheKey = `${tweet.author_handle}:${tweet.id}`;
    const cached = recentProposals.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DEDUP_WINDOW_MS) {
      res.json(cached.proposal);
      return;
    }

    const [proposal, existingMarket] = await Promise.all([
      generateProposal(tweet),
      searchMarkets(`${tweet.author_handle} ${extractKeywords(tweet.text)}`),
    ]);

    const response: ProposalResponse = {
      proposal,
      existingMarket: existingMarket || undefined,
    };

    recentProposals.set(cacheKey, { proposal: response, timestamp: Date.now() });

    cleanupCache();

    res.json(response);
  } catch (err) {
    console.error('Proposal generation failed:', err);
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

function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of recentProposals.entries()) {
    if (now - value.timestamp > DEDUP_WINDOW_MS) {
      recentProposals.delete(key);
    }
  }
}

export default router;
