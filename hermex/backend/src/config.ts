import dotenv from 'dotenv';
dotenv.config();

/**
 * LLM provider auto-detection priority:
 *   1. OPENAI_API_KEY        → OpenAI  (gpt-4o-mini default)
 *   2. ANTHROPIC_API_KEY     → Anthropic via /v1 (claude-3-5-haiku default)
 *   3. OPENROUTER_API_KEY    → OpenRouter (hermes-3 default)
 *   4. HERMES_API_URL + KEY  → custom OpenAI-compatible endpoint
 *   5. none → LLM disabled, heuristic fallback only
 */
function detectProvider(): 'openai' | 'anthropic' | 'openrouter' | 'custom' | 'none' {
  const forced = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (['openai', 'anthropic', 'openrouter', 'custom'].includes(forced)) {
    return forced as any;
  }
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.HERMES_API_URL && process.env.HERMES_API_KEY) return 'custom';
  return 'none';
}

const provider = detectProvider();

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  openrouter: 'nousresearch/hermes-3-llama-3.1-405b',
  custom: 'gpt-4o-mini',
  none: 'disabled',
};

/**
 * Pick a model for the detected provider. If the user's LLM_MODEL is wired for a
 * different provider (e.g. OpenRouter's "nousresearch/..." while we're on OpenAI),
 * we fall back to the provider's default instead of passing a bad model id.
 */
function resolveModel(p: string, userModel: string | undefined): string {
  if (!userModel) return DEFAULT_MODELS[p];
  const m = userModel.toLowerCase();
  if (p === 'openai') {
    const looksOpenAI = m.startsWith('gpt-') || /^o\d/.test(m) || m.startsWith('chatgpt');
    return looksOpenAI ? userModel : DEFAULT_MODELS[p];
  }
  if (p === 'anthropic') {
    return m.startsWith('claude-') ? userModel : DEFAULT_MODELS[p];
  }
  return userModel;
}

export const config = {
  port: parseInt(process.env.PORT || '3888'),
  nodeEnv: process.env.NODE_ENV || 'development',

  llm: {
    provider,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    hermesApiUrl: process.env.HERMES_API_URL || '',
    hermesApiKey: process.env.HERMES_API_KEY || '',
    model: resolveModel(provider, process.env.LLM_MODEL),
  },

  predictFun: {
    apiUrl: process.env.PREDICT_FUN_API_URL || 'https://api-testnet.predict.fun',
    apiKey: process.env.PREDICT_FUN_API_KEY || '',
  },
} as const;

export function getLLMBaseUrl(): string {
  if (config.llm.hermesApiUrl) return config.llm.hermesApiUrl;
  switch (config.llm.provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    default:
      return 'https://openrouter.ai/api/v1';
  }
}

export function getLLMApiKey(): string {
  switch (config.llm.provider) {
    case 'openai':
      return config.llm.openaiApiKey;
    case 'anthropic':
      return config.llm.anthropicApiKey;
    case 'openrouter':
      return config.llm.openrouterApiKey;
    case 'custom':
      return config.llm.hermesApiKey;
    default:
      return '';
  }
}

export function isLLMEnabled(): boolean {
  return config.llm.provider !== 'none' && !!getLLMApiKey();
}
