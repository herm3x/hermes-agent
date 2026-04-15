import OpenAI from 'openai';
import { config, getLLMBaseUrl, getLLMApiKey } from '../config.js';
import type { TweetInput, MarketProposal } from '../types/index.js';

const SYSTEM_PROMPT = `You are the Hermex market curator — the top prediction market strategist for Predict.fun.

Given a tweet from X (Twitter), generate a prediction market proposal.

STRICT OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no explanation:
{
  "title": "Will [specific event] happen by [deadline]?",
  "description": "Based on [tweet context]. [Brief market rationale].",
  "outcomes": ["Yes", "No"],
  "resolution_source": "Official X posts + on-chain data + verified news",
  "end_time": "ISO 8601 timestamp (1-72 hours from now)",
  "tags": ["crypto", "drama", ...relevant tags],
  "initial_probability": 0.XX
}

Rules:
- Title must be a clear, binary Yes/No question
- Resolution criteria must be objectively verifiable with no ambiguity
- End time: 1-72 hours from now, pick the most appropriate window
- Initial probability: your best estimate based on context (0.01-0.99)
- Tags: 2-5 relevant tags
- Description: concise, 1-2 sentences max
- Make it engaging and tradeable — think like a market maker
- Consider the author's track record, audience, and controversy level`;

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
    const completion = await client.chat.completions.create({
      model: config.llm.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return parseProposal(content);
  } catch (err: any) {
    if (err?.status === 400 && err?.message?.includes('response_format')) {
      throw err;
    }
    throw new Error(`LLM call failed: ${err?.message || 'Unknown error'}`);
  }
}

function buildPrompt(tweet: TweetInput): string {
  const now = new Date().toISOString();
  let prompt = `Current UTC time: ${now}\n\n`;
  prompt += `Tweet by @${tweet.author_handle} (${tweet.author_name}):\n`;
  prompt += `"${tweet.text}"\n`;
  prompt += `Posted: ${tweet.timestamp}\n`;

  if (tweet.reply_chain?.length) {
    prompt += `\nReply context:\n`;
    tweet.reply_chain.forEach((reply, i) => {
      prompt += `  ${i + 1}. ${reply}\n`;
    });
  }

  prompt += `\nGenerate a prediction market proposal for this tweet. Respond ONLY with valid JSON.`;
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

  return {
    title: String(parsed.title),
    description: String(parsed.description || ''),
    outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.map(String) : ['Yes', 'No'],
    resolution_source: String(parsed.resolution_source || 'Official X posts'),
    end_time: parsed.end_time,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    initial_probability: Math.max(0.01, Math.min(0.99, Number(parsed.initial_probability) || 0.5)),
  };
}
