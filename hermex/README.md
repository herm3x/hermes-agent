<p align="center">
  <img src="assets/hermex-eye.png" alt="Hermex" width="140" style="border-radius: 24px;">
</p>

<pre align="center">
╦ ╦ ╔═╗ ╦═╗ ╔╦╗ ╔═╗ ═╗ ╦
╠═╣ ║╣  ╠╦╝ ║║║ ║╣  ╔╩╦╝
╩ ╩ ╚═╝ ╩╚═ ╩ ╩ ╚═╝ ╩ ╚═
</pre>

<p align="center">
  <b>Prediction Markets on X</b><br>
  <sub>Turn every KOL tweet into a tradeable market — in under 3 seconds.</sub>
</p>

<p align="center">
  <a href="https://x.com/herm3x"><img src="https://img.shields.io/badge/𝕏-@herm3x-000000?style=for-the-badge&logo=x&logoColor=white" alt="X @herm3x"></a>&nbsp;
  <a href="https://predict.fun"><img src="https://img.shields.io/badge/Predict.fun-Trade_Now-6366f1?style=for-the-badge" alt="Predict.fun"></a>&nbsp;
  <a href="https://github.com/herm3x/hermes-agent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT"></a>
</p>

---

## What is Hermex?

Hermex is a **Chrome Extension** that transforms your X (Twitter) feed into a live prediction market.

When you browse X, Hermex automatically detects tweets from KOLs and celebrities, sends them to the **Hermes Agent** (LLM), and injects a **prediction market card** directly below the tweet — with Yes/No pricing, market volume, liquidity, and a one-click link to trade on **[Predict.fun](https://predict.fun)**.

No extra tabs. No switching apps. Predictions appear inline, as if X had prediction markets built in.

---

## Preview

<table>
<tr>
<td width="60%" align="center">
  <img src="assets/hermex-feed-card.png" alt="Hermex Prediction Card" width="100%">
  <br><b>Prediction card injected below a KOL tweet</b>
</td>
<td width="40%" align="center">
  <img src="assets/hermex-popup.png" alt="Hermex Extension Popup" width="100%">
  <br><b>Extension popup — settings & stats</b>
</td>
</tr>
</table>

---

## How It Works

```
  ① Tweet detected        ② Hermes Agent          ③ Card appears
  ┌──────────────┐  ───►  ┌──────────────┐  ───►  ┌──────────────┐
  │  @elonmusk   │        │  Analyze     │        │  Yes   72¢   │
  │  "Doge to    │        │  Generate    │        │  No    28¢   │
  │   the moon   │        │  Price       │        │  $142K Vol   │
  │   🚀"        │        │  Resolve     │        │  Trade ►     │
  └──────────────┘        └──────────────┘        └──────────────┘
      X Feed               Hermes 3 405B           Inline below
   MutationObserver         < 3 seconds              the tweet
```

1. You browse X normally — Hermex runs silently in the background
2. A `MutationObserver` detects KOL tweets in real-time (zero polling)
3. The tweet is sent to **Hermes Agent**, which acts as a quantitative analyst
4. The agent generates a market title, resolution criteria, and smart probabilities
5. A **prediction card** with Yes/No pricing, volume, and liquidity appears below the tweet
6. Click **"Trade on Predict.fun"** to place a real trade

---

## Key Features

| | Feature | Description |
|---|---------|-------------|
| ⚡ | **< 3 second generation** | From tweet detection to card injection |
| 🧠 | **Smart probabilities** | Hermes Agent reasons like a quant — not random, not lazy 50/50 |
| 📊 | **Realistic market data** | Simulated volume, liquidity, traders, and spread based on KOL influence tier |
| 🔗 | **Predict.fun integration** | Matches existing markets or links to create new ones |
| 🛡️ | **Resilient extension** | Survives page navigation, account switches, and context invalidation |
| 🎨 | **Native-looking UI** | Royal Blue glassmorphism design that feels like part of X |
| 📡 | **Live dashboard** | System monitor with CPU, memory, request stats, token usage |
| 🧪 | **Testnet-first** | Safe testing on Predict.fun testnet before mainnet |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                      │
│  ├── Content Script — DOM observer + card injection  │
│  ├── Background SW — API relay + config management   │
│  └── Popup — Settings, KOL whitelist, stats          │
└───────────────┬──────────────────────────────────────┘
                │ REST API
┌───────────────▼──────────────────────────────────────┐
│  Hermex Backend (Express + TypeScript + Bun)         │
│  ├── POST /api/proposal  — LLM market generation    │
│  ├── GET  /api/markets   — Predict.fun lookup        │
│  ├── GET  /api/system    — Live system monitor       │
│  └── GET  /api/health    — Health check              │
└───────┬──────────────────────┬───────────────────────┘
        │                      │
┌───────▼────────┐    ┌────────▼────────┐
│  Hermes Agent  │    │  Predict.fun    │
│  Hermes 3 405B │    │  REST API       │
│  via OpenRouter│    │  Testnet / Main │
└────────────────┘    └─────────────────┘
```

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Chrome or Chromium
- [OpenRouter API key](https://openrouter.ai)

### 1. Clone

```bash
git clone https://github.com/herm3x/hermes-agent.git
cd hermes-agent/hermex
```

### 2. Start the Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add your OPENROUTER_API_KEY
bun install
bun run dev
# ☤ Hermex Backend running at http://localhost:6088
```

### 3. Build the Chrome Extension

```bash
cd chrome-extension
bun install
bun run build
```

### 4. Load the Extension

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select `hermex/chrome-extension/dist`
4. Pin the ☤ icon in your toolbar
5. Open X.com — prediction cards will appear automatically

### 5. Configure (Optional)

Click the Hermex icon in the toolbar:

| Setting | Default | Description |
|---------|---------|-------------|
| Backend API URL | `http://localhost:6088` | Your backend endpoint |
| Testnet Mode | On | Use Predict.fun testnet |
| Auto-propose | On | Automatically generate for detected KOL tweets |
| Min Followers | 50,000 | Minimum follower count to trigger |
| KOL Whitelist | — | Custom handles to always track |

---

## Deploy to VPS

```bash
git clone https://github.com/herm3x/hermes-agent.git
cd hermes-agent/hermex

# Configure
cd backend && cp .env.example .env
# Edit .env — add OPENROUTER_API_KEY

# Docker
cd ..
docker compose up -d

# Verify
curl http://your-server:6088/api/health
```

Then update the **Backend API URL** in the extension popup to your server's public address.

---

## Tracked KOLs

Default watchlist includes 40+ accounts:

`@elonmusk` `@VitalikButerin` `@cz_binance` `@realDonaldTrump` `@sama` `@NousResearch` `@OpenAI` `@AnthropicAI` `@GoogleDeepMind` `@APompliano` `@CathieDWood` `@saylor` `@naval` `@pmarca` `@brian_armstrong` ...

Add any handle via the **KOL Whitelist** in the extension popup.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript · Webpack · Chrome Manifest V3 |
| Backend | Bun · Express · TypeScript |
| LLM | Hermes 3 405B via OpenRouter |
| Markets | Predict.fun REST API (Testnet + Mainnet) |
| Deployment | Docker · docker-compose |
| UI Design | Royal Blue glassmorphism · JetBrains Mono |

---

## Roadmap

- [x] Chrome Extension — real-time KOL tweet detection
- [x] Hermes Agent — smart probability generation
- [x] Predict.fun testnet integration
- [x] Live dashboard with system monitoring
- [x] Docker deployment
- [ ] Predict.fun deep linking (jump to specific market)
- [ ] Hot Tweet Markets sidebar (Top 5 live proposals)
- [ ] Hermes self-learning loop (improve from market outcomes)
- [ ] Predict.fun mainnet support
- [ ] Telegram / Discord push notifications
- [ ] KOL subscription feed

---

<p align="center">
  <img src="assets/hermex-eye.png" alt="Hermex" width="48"><br><br>
  <a href="https://x.com/herm3x"><b>𝕏 @herm3x</b></a><br>
  <sub>Built with <a href="https://nousresearch.com">Hermes Agent</a> · <a href="https://predict.fun">Predict.fun</a></sub><br>
  <sub>MIT License</sub>
</p>
