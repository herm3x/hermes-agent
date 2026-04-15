import { getConfig, setConfig, resetDailyCounter } from '../utils/config';
import { MarketProposal, ProposalCardData, TweetData } from '../types';

chrome.runtime.onInstalled.addListener(async () => {
  await resetDailyCounter();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: any): Promise<any> {
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

async function generateProposal(
  tweetData: Omit<TweetData, 'element'>
): Promise<{ data: ProposalCardData }> {
  const config = await getConfig();

  try {
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
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const result = await response.json();

    await setConfig({ proposalsToday: config.proposalsToday + 1 });

    return {
      data: {
        proposal: result.proposal as MarketProposal,
        existingMarket: result.existingMarket || undefined,
        tweetId: tweetData.id,
        status: 'ready',
      },
    };
  } catch (err) {
    return {
      data: {
        proposal: null as any,
        tweetId: tweetData.id,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Failed to reach Hermex backend',
      },
    };
  }
}
