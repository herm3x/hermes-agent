import OpenAI from 'openai';
import { config, getLLMBaseUrl, getLLMApiKey } from '../config.js';
import type { TweetInput, MarketProposal } from '../types/index.js';
import { addLog } from './logger.js';
import { trackLLMUsage } from './token-tracker.js';

const SYSTEM_PROMPT = `You are a senior quantitative analyst at a top prediction market exchange (like Polymarket).
Your job: convert tweets into tradeable prediction markets with ACCURATE opening odds.

You think like a market maker — you set the initial price where you'd be comfortable taking both sides.

OUTPUT FORMAT — respond ONLY with valid JSON:
{
  "title": "...",
  "description": "...",
  "outcomes": ["Yes", "No"],
  "resolution_source": "...",
  "end_time": "ISO 8601",
  "tags": [...],
  "initial_probability": 0.XX,
  "category": "crypto|politics|tech|sports|culture|business",
  "confidence_reasoning": "one sentence why this probability"
}

MARKET DESIGN RULES:
- Title: specific, time-bound, objectively resolvable. NOT vague.
  GOOD: "Will Tesla accept DOGE payments before May 1, 2026?"
  BAD: "Will crypto go up?"
- Resolution: must be checkable by anyone — official announcements, on-chain data, public records
- End time: pick the EXACT right window. Breaking news → 4-24h. Policy → 48-72h. Product launch → match the stated date.
- Description: 1-2 sentences of market rationale, mention WHY this probability

PROBABILITY — THIS IS THE MOST IMPORTANT PART:
You are pricing a real market. Think: "At what price would smart money buy Yes AND No?"

Framework by tweet type:
- CEO/founder announces specific product + date → 0.82-0.94
- Politician makes campaign promise → 0.11-0.28
- Influencer predicts price target with no evidence → 0.04-0.15
- Breaking news confirmed by multiple sources → 0.88-0.97
- Rumor / "sources say" → 0.25-0.42
- Person says "I will do X" (personal commitment) → 0.55-0.78
- Troll / sarcasm / joke → 0.02-0.08
- Technical analysis / chart prediction → 0.18-0.35
- Regulatory/legal prediction → 0.20-0.45
- Partnership/deal announcement → 0.70-0.88

NEVER use: 0.50, 0.45, 0.55, 0.35, 0.65, 0.40, 0.60 — these show you didn't analyze
Use 2 decimal precision: 0.13, 0.27, 0.71, 0.86 etc.

Each tweet is unique. Your probability MUST reflect the SPECIFIC content, author credibility, and verifiability.`;

let openai: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      baseURL: getLLMBaseUrl(),
      apiKey: getLLMApiKey(),
    });
  }
  return openai;
}

export async function generateProposal(tweet: TweetInput): Promise<MarketProposal> {
  const client = getClient();
  const userMessage = buildPrompt(tweet);

  try {
    addLog('hermes_llm', `Generating proposal for @${tweet.author_handle}: "${tweet.text.substring(0, 60)}..."`);
    const t0 = Date.now();

    const completion = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    trackLLMUsage(completion);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      addLog('hermes_llm', 'Empty response from LLM', 'error');
      throw new Error('Empty response from LLM');
    }

    const proposal = parseProposal(content);
    const tokens = completion.usage;
    addLog('hermes_llm', `Proposal generated in ${elapsed}s — "${proposal.title}" (${tokens?.total_tokens || '?'} tokens)`);
    return proposal;
  } catch (err: any) {
    addLog('hermes_llm', `LLM call failed: ${err?.message || 'Unknown'}`, 'error');
    if (err?.status === 400 && err?.message?.includes('response_format')) {
      throw err;
    }
    throw new Error(`LLM call failed: ${err?.message || 'Unknown error'}`);
  }
}

const AUTHOR_PROFILES: Record<string, string> = {
  elonmusk: 'CEO of Tesla & SpaceX, owner of X. Known for memes, trolling, and actual product launches. Credibility varies wildly — some tweets are jokes, some are billion-dollar announcements.',
  vitalikbuterin: 'Ethereum co-founder. Highly technical, rarely makes unsubstantiated claims. When he says something technical, it usually happens.',
  cz_binance: 'Former Binance CEO. Deep crypto insider knowledge. Had legal issues in 2023-24 but remains influential.',
  realdonaldtrump: '47th US President. Known for bold claims, some follow through, many don\'t. Political promises need heavy discounting.',
  brian_armstrong: 'Coinbase CEO. Generally makes measured, accurate statements about Coinbase products.',
  naval: 'Angel investor, philosopher. Tweets are usually opinions/advice, not verifiable predictions.',
  saylor: 'MicroStrategy founder, massive Bitcoin bull. Always optimistic about BTC, take with grain of salt.',
  justinsuntron: 'TRON founder. Known for hype and self-promotion. Heavy discount recommended.',
  apompliano: 'Crypto media figure. Often shares others\' news. Mid-tier credibility for predictions.',
  sama: 'OpenAI CEO. When he announces AI products, they usually ship. High credibility for OpenAI-related.',
};

function buildPrompt(tweet: TweetInput): string {
  const now = new Date().toISOString();
  const handle = tweet.author_handle.toLowerCase();
  const profile = AUTHOR_PROFILES[handle];

  let prompt = `Current UTC time: ${now}\n`;
  prompt += `Random seed: ${Math.random().toString(36).slice(2, 8)}\n\n`;
  prompt += `Tweet by @${tweet.author_handle} (${tweet.author_name}):\n`;
  prompt += `"${tweet.text}"\n`;
  prompt += `Posted: ${tweet.timestamp}\n`;

  if (profile) {
    prompt += `\nAuthor background: ${profile}\n`;
  }

  if (tweet.reply_chain?.length) {
    prompt += `\nReply context:\n`;
    tweet.reply_chain.forEach((reply, i) => {
      prompt += `  ${i + 1}. ${reply}\n`;
    });
  }

  prompt += `\nAnalyze this specific tweet. Consider: what exactly is being claimed? Is it verifiable? What's this person's track record? Then output valid JSON only.`;
  return prompt;
}

function parseProposal(raw: string): MarketProposal {
  let cleaned = raw.trim();

  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }

  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    cleaned = cleaned.substring(braceStart, braceEnd + 1);
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.title || !parsed.outcomes || !parsed.end_time) {
    throw new Error('Invalid proposal structure: missing required fields (title, outcomes, end_time)');
  }

  const endTime = new Date(parsed.end_time);
  if (isNaN(endTime.getTime())) {
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 24);
    parsed.end_time = fallback.toISOString();
  }

  let prob = Number(parsed.initial_probability) || 0.5;
  const forbidden = [0.50, 0.45, 0.55, 0.35, 0.65, 0.40, 0.60];
  if (forbidden.includes(prob)) {
    prob = prob + (Math.random() * 0.16 - 0.08);
  }
  prob = Math.max(0.02, Math.min(0.98, prob));
  prob = Math.round(prob * 100) / 100;

  return {
    title: String(parsed.title),
    description: String(parsed.description || ''),
    outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map(String) : ['Yes', 'No'],
    resolution_source: String(parsed.resolution_source || 'Official X posts'),
    end_time: parsed.end_time,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    initial_probability: prob,
    category: String(parsed.category || 'crypto'),
    confidence_reasoning: String(parsed.confidence_reasoning || ''),
  };
}
