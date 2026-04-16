export interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  sessions: number;
  messages: number;
  toolCalls: number;
  userMessages: number;
  requests: number;
}

const usage: TokenUsage = {
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  sessions: 1,
  messages: 0,
  toolCalls: 0,
  userMessages: 0,
  requests: 0,
};

export function trackLLMUsage(completion: any): void {
  const u = completion?.usage;
  if (!u) return;

  const prompt = u.prompt_tokens || 0;
  const compl = u.completion_tokens || 0;
  const cached = u.prompt_tokens_details?.cached_tokens || 0;

  usage.inputTokens += prompt;
  usage.outputTokens += compl;
  usage.totalTokens += prompt + compl;
  usage.cacheReadTokens += cached;
  usage.messages++;
}

export function trackRequest(): void {
  usage.requests++;
  usage.userMessages++;
}

export function trackToolCall(): void {
  usage.toolCalls++;
}

export function getTokenUsage(): TokenUsage {
  return { ...usage };
}
