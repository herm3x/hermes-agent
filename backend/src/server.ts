import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import proposalRoutes from './routes/proposal.js';

const app = express();

app.use(cors({
  origin: [
    'chrome-extension://*',
    'https://x.com',
    'https://twitter.com',
    'http://localhost:*',
  ],
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
