export interface MarketProposal {
  title: string;
  description: string;
  outcomes: string[];
  resolution_source: string;
  end_time: string;
  tags: string[];
  initial_probability: number;
  category?: string;
  confidence_reasoning?: string;
}

export interface TweetData {
  id: string;
  text: string;
  authorHandle: string;
  authorName: string;
  authorFollowers?: number;
  timestamp: string;
  replyTo?: string;
  element: HTMLElement;
}

export interface PredictFunMarket {
  id: string;
  title: string;
  description: string;
  outcomes: { name: string; probability: number }[];
  volume: number;
  liquidity: number;
  endDate: string;
  url: string;
}

export interface MarketDataSim {
  volume: string;
  volumeRaw: number;
  liquidity: string;
  liquidityRaw: number;
  traders: number;
  spread: string;
  yesPrice: string;
  noPrice: string;
  priceChange24h: string;
  priceChangeDirection: 'up' | 'down';
  hoursActive: number;
  tier: number;
}

export interface ProposalCardData {
  proposal: MarketProposal;
  existingMarket?: PredictFunMarket;
  marketData?: MarketDataSim;
  tweetId: string;
  status: 'loading' | 'ready' | 'error';
  errorMessage?: string;
}

export interface HermexConfig {
  enabled: boolean;
  apiUrl: string;
  useTestnet: boolean;
  autoPropose: boolean;
  kolWhitelist: string[];
  minFollowers: number;
  dailyLimit: number;
  proposalsToday: number;
}

export const DEFAULT_CONFIG: HermexConfig = {
  enabled: true,
  apiUrl: 'https://herm3x.com',
  useTestnet: true,
  autoPropose: true,
  kolWhitelist: [],
  minFollowers: 50000,
  dailyLimit: 500,
  proposalsToday: 0,
};

export const TOP_KOLS: string[] = [
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
];

export type MessageType =
  | { type: 'GENERATE_PROPOSAL'; tweetData: Omit<TweetData, 'element'> }
  | { type: 'PROPOSAL_RESULT'; tweetId: string; data: ProposalCardData }
  | { type: 'MATCH_MARKET'; query: string }
  | { type: 'MARKET_RESULT'; market?: PredictFunMarket }
  | { type: 'GET_CONFIG' }
  | { type: 'CONFIG_RESULT'; config: HermexConfig }
  | { type: 'UPDATE_CONFIG'; config: Partial<HermexConfig> };
