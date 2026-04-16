import { HermexConfig, DEFAULT_CONFIG } from '../types';

async function getRawConfig(): Promise<HermexConfig> {
  const result = await chrome.storage.local.get('hermexConfig');
  return { ...DEFAULT_CONFIG, ...result.hermexConfig };
}

export async function getConfig(): Promise<HermexConfig> {
  await resetDailyCounter();
  return getRawConfig();
}

export async function setConfig(updates: Partial<HermexConfig>): Promise<HermexConfig> {
  const current = await getRawConfig();
  const updated = { ...current, ...updates };
  await chrome.storage.local.set({ hermexConfig: updated });
  return updated;
}

export async function resetDailyCounter(): Promise<void> {
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
