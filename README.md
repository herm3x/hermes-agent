# ☤ Hermex — Prediction Markets on X

**Inline prediction market proposals on every KOL tweet, powered by Hermes Agent + Predict.fun.**

Hermex is a Chrome Extension that monitors your X (Twitter) feed, detects KOL/celebrity tweets, and instantly generates prediction market proposals — all inline, without leaving X.

## How It Works

1. Install the Chrome Extension and browse X normally
2. **MutationObserver** watches your feed for KOL tweets in real-time
3. **Hermes Agent** analyzes each tweet in <2s and generates a market proposal
4. A **native-looking card** appears below the tweet with Yes/No outcomes and probabilities
5. One click to **trade on Predict.fun** — existing market or new proposal

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                     │
│  ├── Content Script — MutationObserver + UI inject  │
│  ├── Background SW — API communication              │
│  └── Popup — Settings & config                      │
└────────────────┬────────────────────────────────────┘
                 │ HTTP
┌────────────────▼────────────────────────────────────┐
│  Backend API (Express + TypeScript)                 │
│  ├── /api/proposal — Generate market proposal       │
│  ├── /api/markets/search — Match existing markets   │
│  └── /api/health — Health check                     │
└────────┬───────────────────────┬────────────────────┘
         │                       │
┌────────▼─────────┐   ┌────────▼─────────┐
│  Hermes Agent    │   │  Predict.fun API  │
│  (LLM Engine)    │   │  (Testnet/Main)   │
└──────────────────┘   └──────────────────┘
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your OpenRouter API key
npm install
npm run dev
```

### 2. Chrome Extension

```bash
cd chrome-extension
npm install
npm run build
```

Then load `chrome-extension/dist/` as an unpacked extension in Chrome:
- Go to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked" → select the `dist` folder

### 3. Configure

Click the Hermex extension icon in Chrome to configure:
- Backend API URL (default: `http://localhost:3888`)
- Testnet mode (recommended for testing)
- KOL whitelist
- Auto-propose settings

## Tech Stack

- **Chrome Extension**: TypeScript, Webpack, Manifest V3
- **Backend**: Node.js, Express, TypeScript
- **LLM**: Hermes Agent via OpenRouter / local endpoint
- **Markets**: Predict.fun REST API (Testnet + Mainnet)

## License

MIT
