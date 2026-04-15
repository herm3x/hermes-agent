export interface TweetInput {
  id: string;
  text: string;
  author_handle: string;
  author_name: string;
  timestamp: string;
  reply_chain?: string[];
}

export interface MarketProposal {
  title: string;
  description: string;
  outcomes: string[];
  resolution_source: string;
  end_time: string;
  tags: string[];
  initial_probability: number;
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

export interface ProposalResponse {
  proposal: MarketProposal;
  existingMarket?: PredictFunMarket;
}

export interface ProposalRequest {
  tweet: TweetInput;
}
