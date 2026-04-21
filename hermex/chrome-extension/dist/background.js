/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/types/index.ts
const DEFAULT_CONFIG = {
    enabled: true,
    apiUrl: 'https://herm3x.xyz',
    useTestnet: true,
    autoPropose: true,
    kolWhitelist: [],
    minFollowers: 50000,
    dailyLimit: 500,
    proposalsToday: 0,
};
const TOP_KOLS = (/* unused pure expression or super */ null && ([
    'elonmusk', 'VitalikButerin', 'realDonaldTrump', 'POTUS',
    'cz_binance', 'brian_armstrong', 'justinsuntron', 'aantonop',
    'APompliano', 'IvanOnTech', 'PeterSchiff', 'naval',
    'pmarca', 'sama', 'jack', 'saylor',
    'GaryGensler', 'CathieDWood', 'BarrySilbert', 'cdixon',
    'laurashin', 'ErikVoorhees', 'TylerWinklevoss', 'cameron',
    'jessepollak', 'DeItaone', 'tier10k', 'WatcherGuru',
    'unusual_whales', 'RaoulGMI', 'whale_alert', 'documentingbtc',
    'NousResearch', 'AIaboringAtMeta', 'OpenAI', 'AnthropicAI',
    'GoogleDeepMind', 'ylaboringecun', 'kaboringpathy', 'drjimfan',
]));

;// ./src/utils/config.ts

async function getRawConfig() {
    const result = await chrome.storage.local.get('hermexConfig');
    return { ...DEFAULT_CONFIG, ...result.hermexConfig };
}
async function getConfig() {
    await resetDailyCounter();
    return getRawConfig();
}
async function setConfig(updates) {
    const current = await getRawConfig();
    const updated = { ...current, ...updates };
    await chrome.storage.local.set({ hermexConfig: updated });
    return updated;
}
async function resetDailyCounter() {
    const result = await chrome.storage.local.get('hermexLastReset');
    const today = new Date().toDateString();
    if (result.hermexLastReset !== today) {
        const cfg = await getRawConfig();
        await chrome.storage.local.set({
            hermexLastReset: today,
            hermexConfig: { ...cfg, proposalsToday: 0 },
        });
    }
}

;// ./src/background/background.ts

chrome.runtime.onInstalled.addListener(async () => {
    await resetDailyCounter();
});
(async () => {
    await resetDailyCounter();
    const cfg = await getConfig();
    if (cfg.proposalsToday >= cfg.dailyLimit || cfg.dailyLimit <= 50) {
        await setConfig({ proposalsToday: 0, dailyLimit: 500 });
    }
})();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
});
async function handleMessage(message) {
    switch (message.type) {
        case 'GET_CONFIG':
            return { config: await getConfig() };
        case 'UPDATE_CONFIG':
            return { config: await setConfig(message.config) };
        case 'GENERATE_PROPOSAL':
            return await generateProposal(message.tweetData);
        default:
            return null;
    }
}
async function generateProposal(tweetData) {
    const config = await getConfig();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`${config.apiUrl}/api/proposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tweet: {
                    id: tweetData.id,
                    text: tweetData.text,
                    author_handle: tweetData.authorHandle,
                    author_name: tweetData.authorName,
                    timestamp: tweetData.timestamp,
                },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }
        const result = await response.json();
        await setConfig({ proposalsToday: config.proposalsToday + 1 });
        return {
            data: {
                proposal: result.proposal,
                existingMarket: result.existingMarket || undefined,
                marketData: result.marketData || undefined,
                tweetId: tweetData.id,
                status: 'ready',
            },
        };
    }
    catch (err) {
        return {
            data: {
                proposal: null,
                tweetId: tweetData.id,
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Failed to reach Hermex backend',
            },
        };
    }
}

/******/ })()
;
//# sourceMappingURL=background.js.map