import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import proposalRoutes from './routes/proposal.js';

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

app.use('/api', proposalRoutes);

app.get('/', (_req, res) => {
  res.json({
    name: 'Hermex Backend',
    version: '0.1.0',
    description: 'Hermes Agent + Predict.fun prediction market engine',
    endpoints: {
      health: 'GET /api/health',
      proposal: 'POST /api/proposal',
      searchMarkets: 'GET /api/markets/search?q=...',
    },
  });
});

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
});

export default app;
