/**
 * Fetches recent tweets from a public X profile.
 *
 * Source priority:
 *   1. X API v2 (if X_BEARER_TOKEN set)
 *   2. RSSHub public instance (rsshub.app)
 *   3. Nitter RSS (multiple public instances)
 *   4. null (caller should fall back to curated seed)
 */

import { addLog } from './logger';

export interface RawTweet {
  id: string;
  text: string;
  url: string;
  createdAt: string;
  author: string;
}

const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';

const XTRACKER_BASE = (process.env.XTRACKER_BASE || 'https://xtracker.polymarket.com/api').replace(/\/$/, '');

const RSSHUB_BASE = (process.env.RSSHUB_BASE || 'https://rsshub.app').replace(/\/$/, '');

const NITTER_HOSTS = [
  'nitter.privacydev.net',
  'nitter.poast.org',
  'nitter.tiekoetter.com',
  'nitter.net',
  'nitter.lucabased.xyz',
];

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
};

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  let v = m[1].trim();
  v = v.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  return v;
}

/**
 * Clean Nitter/RSSHub tweet text. Returns empty string if the item is a
 * retweet / quoted reply where the KOL's own content is <20 chars.
 */
function cleanTweetText(raw: string, username: string): string {
  let t = raw.trim();

  // Strip leading "Author Name: " / "@handle: " prefix
  t = t.replace(new RegExp(`^${username}:\\s*`, 'i'), '');
  t = t.replace(/^[^:()]{1,40}\s*\(@[A-Za-z0-9_]+\):\s*/, '');

  // Strip "R to @user:" (Nitter reply marker)
  t = t.replace(/^R to @\w+:\s*/i, '');

  // Strip trailing media markers
  t = t.replace(/\s+@\w+\s+(Video|Image|Photo|GIF)s?\s*$/i, '');

  // Strip trailing URLs that some RSS sources append
  t = t.replace(/\s+[—-]\s+https?:\/\/\S+$/, '');
  t = t.replace(/\s+https?:\/\/(?:nitter|t\.co)\S*\s*$/gi, '');

  // Strip stray affirmation artifacts some Nitter templates prepend
  t = t.replace(/^(yes|no|RT)\s+(?=[A-Z])/i, '');

  // Detect quoted tweets from DIFFERENT users. RSS body of a quote-tweet looks like
  //   "<KOL's own text> <QuotedName> (@otherhandle) <quoted text>"
  // or when the KOL added no commentary:
  //   "<QuotedName> (@otherhandle) <quoted text>"
  // We keep only the KOL's own text before the foreign (@handle) token.
  // If no own text remains (<20 chars), drop the item (pure retweet).
  const mentionIter = t.matchAll(/\(@([A-Za-z0-9_]+)\)/g);
  for (const mm of mentionIter) {
    const handle = mm[1].toLowerCase();
    if (handle === username.toLowerCase()) continue;
    const idx = mm.index ?? 0;
    const own = t.slice(0, idx).trim();
    // Strip any trailing name-fragment right before the "(@..."
    const ownClean = own.replace(/[\s—\-–]*[A-Za-z0-9_🔶🔥 .·'"()\[\]\/\\λe]{0,60}$/u, (m) => {
      // only strip if the trailing bit looks like a name (Capitalized word or ends with closing paren)
      if (/[A-Z]|\)/.test(m)) return '';
      return m;
    }).trim();
    if (ownClean.length < 20) {
      return ''; // pure retweet
    }
    t = ownClean;
    break;
  }

  // Remove any remaining inline mentions of OTHER users after we've isolated
  // the KOL's content — keep self-mentions
  t = t.replace(/\s+@(?!\s)(\w+)\b/g, (_m, h) =>
    h.toLowerCase() === username.toLowerCase() ? ` @${h}` : '',
  );

  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function parseRssItems(xml: string, username: string): RawTweet[] {
  const items: RawTweet[] = [];
  const seen = new Set<string>();
  const re = /<item[\s>]([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const creator = stripHtml(extractTag(block, 'dc:creator')).replace(/^@/, '').toLowerCase();
    const rawTitle = stripHtml(extractTag(block, 'title'));
    const rawDesc = stripHtml(extractTag(block, 'description'));
    const link = extractTag(block, 'link').trim();
    const guid = extractTag(block, 'guid');
    const pub = extractTag(block, 'pubDate');

    // Skip if this item is from a different author (retweet / quoted reply)
    if (creator && creator !== username.toLowerCase()) continue;

    // Prefer title (cleaner) unless it's too short
    let text = rawTitle.length >= 20 ? rawTitle : rawDesc;
    text = cleanTweetText(text, username);

    if (!text || text.length < 20) continue;
    if (/^RT by @/i.test(text)) continue;

    // Dedup near-duplicates (same first 60 chars)
    const dedupKey = text.slice(0, 60).toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    items.push({
      id: guid || link || `${username}-${Math.random().toString(36).slice(2)}`,
      text: text.slice(0, 420),
      url: link || `https://x.com/${username}`,
      createdAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
      author: username,
    });
  }
  return items;
}

async function fetchFromXApi(username: string, limit: number): Promise<RawTweet[] | null> {
  if (!X_BEARER_TOKEN) return null;
  try {
    const userRes = await withTimeout(
      fetch(`https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
      }),
      8000,
    );
    if (!userRes.ok) return null;
    const userJson: any = await userRes.json();
    const userId = userJson?.data?.id;
    if (!userId) return null;

    const tweetsRes = await withTimeout(
      fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=${Math.max(5, Math.min(100, limit * 3))}&tweet.fields=created_at&exclude=retweets,replies`,
        { headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` } },
      ),
      8000,
    );
    if (!tweetsRes.ok) return null;
    const j: any = await tweetsRes.json();
    const arr: any[] = j?.data || [];
    return arr.slice(0, limit).map((t) => ({
      id: t.id,
      text: t.text,
      url: `https://x.com/${username}/status/${t.id}`,
      createdAt: t.created_at || new Date().toISOString(),
      author: username,
    }));
  } catch {
    return null;
  }
}

/**
 * Polymarket's XTracker — the same pipeline Polymarket uses to monitor
 * politicians/traders for their markets. Public, unauthenticated.
 * Covers a curated list (cz_binance, elonmusk, WhiteHouse, tedcruz, etc.)
 */
async function fetchFromXTracker(username: string, limit: number): Promise<RawTweet[] | null> {
  try {
    const url = `${XTRACKER_BASE}/users/${encodeURIComponent(username)}/posts?platform=X`;
    const res = await withTimeout(fetch(url), 8000);
    if (!res.ok) return null;
    const body: any = await res.json();
    const posts: any[] = Array.isArray(body) ? body : body?.data || [];
    if (!posts.length) return null;

    const cleaned: RawTweet[] = [];
    for (const p of posts) {
      let text: string = (p.content || p.text || '').trim();
      if (!text) continue;

      // Skip retweets — XTracker includes them as "RT @user: ..."
      if (/^RT\s+@\w+:/i.test(text)) continue;

      // Strip ALL t.co URLs (media / quote shortlinks), collapse whitespace
      text = text
        .replace(/(?:^|\s+)https?:\/\/t\.co\/\S+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Drop trivial tweets (pure URL / single-word reply / very short)
      if (text.length < 20) continue;
      // Drop tweets that are just a URL after t.co stripping
      if (/^https?:\/\//.test(text)) continue;

      cleaned.push({
        id: p.id || p.platformId || `xt-${Math.random().toString(36).slice(2)}`,
        text: text.slice(0, 420),
        url: p.url || `https://x.com/${username}/status/${p.platformId || p.id || ''}`,
        createdAt: p.createdAt || p.importedAt || new Date().toISOString(),
        author: username,
      });
      if (cleaned.length >= limit) break;
    }
    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

async function fetchFromRssHub(username: string, limit: number): Promise<RawTweet[] | null> {
  try {
    const url = `${RSSHUB_BASE}/twitter/user/${encodeURIComponent(username)}`;
    const res = await withTimeout(fetch(url, { headers: COMMON_HEADERS }), 8000);
    if (!res.ok) return null;
    const xml = await res.text();
    const tweets = parseRssItems(xml, username);
    return tweets.length ? tweets.slice(0, limit) : null;
  } catch {
    return null;
  }
}

async function fetchFromNitter(username: string, limit: number): Promise<RawTweet[] | null> {
  for (const host of NITTER_HOSTS) {
    try {
      const url = `https://${host}/${encodeURIComponent(username)}/rss`;
      const res = await withTimeout(fetch(url, { headers: COMMON_HEADERS }), 6000);
      if (!res.ok) continue;
      const xml = await res.text();
      const tweets = parseRssItems(xml, username);
      if (tweets.length) return tweets.slice(0, limit);
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchRecentTweets(
  username: string,
  limit = 3,
): Promise<{ tweets: RawTweet[]; source: 'x-api' | 'xtracker' | 'rsshub' | 'nitter' | 'none' }> {
  // 1. Official X API — highest fidelity (requires paid bearer token)
  let tweets = await fetchFromXApi(username, limit);
  if (tweets && tweets.length) {
    addLog('tweet_fetch', `@${username}: ${tweets.length} tweets via x-api`);
    return { tweets, source: 'x-api' };
  }

  // 2. Polymarket XTracker — free, first-party, but only ~8 tracked accounts
  //    (cz_binance, elonmusk, WhiteHouse, tedcruz, ZelenskyyUa, etc.)
  tweets = await fetchFromXTracker(username, limit);
  if (tweets && tweets.length) {
    addLog('tweet_fetch', `@${username}: ${tweets.length} tweets via xtracker`);
    return { tweets, source: 'xtracker' };
  }

  // 3. RSSHub public instance
  tweets = await fetchFromRssHub(username, limit);
  if (tweets && tweets.length) {
    addLog('tweet_fetch', `@${username}: ${tweets.length} tweets via rsshub`);
    return { tweets, source: 'rsshub' };
  }

  // 4. Nitter RSS — fallback of last resort
  tweets = await fetchFromNitter(username, limit);
  if (tweets && tweets.length) {
    addLog('tweet_fetch', `@${username}: ${tweets.length} tweets via nitter`);
    return { tweets, source: 'nitter' };
  }

  addLog('tweet_fetch', `@${username}: all sources failed, using seed fallback`, 'warn');
  return { tweets: [], source: 'none' };
}
