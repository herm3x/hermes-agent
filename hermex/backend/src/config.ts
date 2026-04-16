import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3888'),
  nodeEnv: process.env.NODE_ENV || 'development',

  llm: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    hermesApiUrl: process.env.HERMES_API_URL || '',
    hermesApiKey: process.env.HERMES_API_KEY || '',
    model: process.env.LLM_MODEL || 'nousresearch/hermes-3-llama-3.1-405b',
  },

  predictFun: {
    apiUrl: process.env.PREDICT_FUN_API_URL || 'https://api-testnet.predict.fun',
    apiKey: process.env.PREDICT_FUN_API_KEY || '',
  },
} as const;

export function getLLMBaseUrl(): string {
  if (config.llm.hermesApiUrl) return config.llm.hermesApiUrl;
  return 'https://openrouter.ai/api/v1';
}

export function getLLMApiKey(): string {
  if (config.llm.hermesApiKey) return config.llm.hermesApiKey;
  return config.llm.openrouterApiKey;
}
