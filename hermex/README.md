# ☤ Hermex

**Real-time prediction markets on X — powered by Hermes Agent.**

Hermex turns every KOL tweet into a tradeable prediction market. A Chrome Extension watches your X feed, and when it spots a tweet from an influential account, the Hermes Agent generates a market proposal in under 3 seconds — complete with smart probabilities, resolution criteria, and simulated order book data. Everything appears inline, right below the tweet.

```
╦ ╦ ╔═╗ ╦═╗ ╔╦╗ ╔═╗ ═╗ ╦
╠═╣ ║╣  ╠╦╝ ║║║ ║╣  ╔╩╦╝
╩ ╩ ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩ ╚═
```

---

## How It Works

1. Browse X normally with the Hermex extension installed
2. A `MutationObserver` detects KOL tweets in real time
3. Hermes Agent (LLM) analyzes the tweet and generates a prediction market
4. A prediction card appears below the tweet with Yes/No outcomes, probabilities, volume, and liquidity
5. One click to trade on [Predict.fun](https://predict.fun)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                      │
│  ├── Content Script — DOM observer + card injection  │
│  ├── Background SW — API relay + config management   │
│  └── Popup — Settings, KOL whitelist, stats          │
└───────────────┬──────────────────────────────────────┘
                │ REST
┌───────────────▼──────────────────────────────────────┐
│  Backend API (Express + TypeScript + Bun)             │
│  ├── POST /api/proposal  — LLM market generation     │
│  ├── GET  /api/markets/search — Predict.fun lookup    │
│  ├── GET  /api/system    — Live system monitor        │
│  └── GET  /api/health    — Health check               │
└───────┬──────────────────────┬───────────────────────┘
        │                      │
┌───────▼────────┐    ┌────────▼────────┐
│  Hermes Agent  │    │  Predict.fun    │
│  (LLM via      │    │  REST API       │
│   OpenRouter)  │    │  (Testnet/Main) │
└────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- Chrome / Chromium browser
- OpenRouter API key ([get one here](https://openrouter.ai))

### 1. Clone & Setup

```bash
git clone https://github.com/herm3x/hermes-agent.git
cd hermes-agent/hermex
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add your OPENROUTER_API_KEY
bun install
bun run dev
```

The backend starts at `http://localhost:6088`.

### 3. Chrome Extension

```bash
cd chrome-extension
bun install
bun run build
```

Then load the extension:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `chrome-extension/dist`
4. Pin the Hermex icon in your toolbar

### 4. Configure

Click the Hermex extension icon to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Backend API URL | `http://localhost:6088` | Your backend endpoint |
| Testnet Mode | On | Use Predict.fun testnet |
| Auto-propose | On | Auto-generate for KOL tweets |
| Min Followers | 50,000 | Minimum follower threshold |
| KOL Whitelist | — | Custom handles to always track |

## Deploy to VPS (Docker)

```bash
# Copy .env
cd backend && cp .env.example .env
# Edit .env with your API keys

# Build & run
docker compose up -d

# Check health
curl http://your-server:6088/api/health
```

For the Chrome Extension to connect to your VPS, update the **Backend API URL** in the extension popup to your server's public URL (e.g. `https://hermex.yourdomain.com`).

## Features

- **Real-time detection** — MutationObserver watches the X feed with zero polling
- **Smart probabilities** — Hermes Agent acts as a quantitative analyst, generating context-aware odds
- **KOL-aware pricing** — Market simulation with volume/liquidity scaled to author influence
- **Predict.fun integration** — Matches existing markets or links to create new ones
- **Resilient extension** — Auto-reconnects on context invalidation, survives page navigation
- **Dashboard** — Live system monitor with CPU, memory, request stats

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript, Webpack, Manifest V3 |
| Backend | Bun, Express, TypeScript |
| LLM | Hermes 3 (405B) via OpenRouter |
| Markets | Predict.fun REST API |
| Deploy | Docker, docker-compose |

## Project Structure

```
hermex/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express server
│   │   ├── config.ts          # Environment config
│   │   ├── routes/proposal.ts # API routes + market simulation
│   │   └── services/
│   │       ├── hermes.ts      # LLM integration
│   │       ├── predict-fun.ts # Predict.fun API client
│   │       ├── logger.ts      # Request logger
│   │       └── system-monitor.ts
│   └── .env.example
├── chrome-extension/
│   ├── src/
│   │   ├── content/           # Content script (DOM injection)
│   │   ├── background/        # Service worker
│   │   ├── popup/             # Extension popup UI
│   │   ├── types/             # Shared TypeScript types
│   │   └── utils/             # Config management
│   ├── public/                # Static assets + manifest
│   └── assets/                # Icons + branding
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## License

MIT

---

Built with [Hermes Agent](https://nousresearch.com) + [Predict.fun](https://predict.fun)
