/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
const $ = (id) => document.getElementById(id);
const $input = (id) => document.getElementById(id);
const $textarea = (id) => document.getElementById(id);
async function loadSettings() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    const config = response?.config;
    if (!config)
        return;
    $input('toggle-enabled').checked = config.enabled;
    $input('toggle-auto').checked = config.autoPropose;
    $input('toggle-testnet').checked = config.useTestnet;
    $input('api-url').value = config.apiUrl;
    $input('min-followers').value = String(config.minFollowers);
    $textarea('kol-whitelist').value = config.kolWhitelist.join('\n');
    $('proposals-today').textContent = String(config.proposalsToday);
    $('daily-limit').textContent = String(config.dailyLimit);
}
async function saveSettings() {
    const whitelist = $textarea('kol-whitelist').value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: {
            enabled: $input('toggle-enabled').checked,
            autoPropose: $input('toggle-auto').checked,
            useTestnet: $input('toggle-testnet').checked,
            apiUrl: $input('api-url').value.trim(),
            minFollowers: parseInt($input('min-followers').value) || 50000,
            kolWhitelist: whitelist,
        },
    });
    const btn = $('save-btn');
    btn.textContent = 'Saved!';
    btn.classList.add('saved');
    setTimeout(() => {
        btn.textContent = 'Save Settings';
        btn.classList.remove('saved');
    }, 1500);
}
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    $('save-btn').addEventListener('click', saveSettings);
});


/******/ })()
;
//# sourceMappingURL=popup.js.map