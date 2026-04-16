import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import proposalRoutes from './routes/proposal.js';
import { startFeedGenerator } from './services/feed-generator.js';

const app: ReturnType<typeof express> = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed =
      origin.startsWith('chrome-extension://') ||
      origin === 'https://x.com' ||
      origin === 'https://twitter.com' ||
      origin.startsWith('http://localhost');
    callback(null, allowed);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(new URL('.', import.meta.url).pathname, '..', 'public')));

app.use('/api', proposalRoutes);

app.listen(config.port, () => {
  console.log(`
  ☤ Hermex Backend v0.1.0
  ────────────────────────────────
  Port:     ${config.port}
  Env:      ${config.nodeEnv}
  LLM:      ${config.llm.model}
  Predict:  ${config.predictFun.apiUrl}
  ────────────────────────────────
  Ready at  http://localhost:${config.port}
  `);
  // Kick off background KOL feed generation (fetch real tweets → LLM → market)
  startFeedGenerator();
});

export default app;
