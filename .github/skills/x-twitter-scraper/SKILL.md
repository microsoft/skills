---
name: x-twitter-scraper
description: >-
  X (Twitter) real-time data platform via Xquik REST API.
  Use when building X/Twitter integrations, scraping tweets, extracting user data,
  monitoring accounts, running giveaway draws, or composing tweets.
  Triggers: "twitter api", "x api", "tweet search", "twitter scraper", "tweet data",
  "follower extraction", "twitter monitoring", "giveaway draw".
---

# X (Twitter) Data Platform — Xquik REST API

Real-time X (Twitter) data access via the Xquik REST API. 120 endpoints, 2 MCP tools, HMAC webhooks, 23 bulk extraction types.

## Quick Start

```bash
# Get an API key at https://xquik.com
# Set the header: X-API-Key: <your-key>
BASE=https://api.xquik.com/v1
```

## Authentication

All requests require an `X-API-Key` header:

```bash
curl -H "X-API-Key: $XQUIK_API_KEY" "$BASE/x/tweets/search?query=openai&type=latest"
```

## Environment Variables

```bash
XQUIK_API_KEY=xq_...   # API key from https://xquik.com/dashboard/account
```

---

## Core Operations

### Tweet Search

```bash
GET /x/tweets/search?query=from:elonmusk&type=latest
```

```typescript
const res = await fetch(`${BASE}/x/tweets/search?query=${encodeURIComponent(query)}&type=latest`, {
  headers: { "X-API-Key": apiKey },
});
const { tweets, has_next_page, next_cursor } = await res.json();
```

**Search operators**: `from:`, `to:`, `#hashtag`, `min_faves:`, `min_retweets:`, `filter:media`, `since:`, `until:`, `-filter:replies`

### Tweet Lookup

```bash
GET /x/tweets/:id
```

Returns full tweet object with `text`, `created_at`, `favorite_count`, `retweet_count`, `reply_count`, `quote_count`, `views`, `bookmark_count`, `media`, `author`.

### User Lookup

```bash
GET /x/users/:id
GET /x/users/by-username/:username
```

Returns `name`, `screen_name`, `followers_count`, `following_count`, `description`, `location`, `verified`, `created_at`, `profile_image_url`.

### User Tweets

```bash
GET /x/users/:id/tweets?cursor=...
```

### User Likes

```bash
GET /x/users/:id/likes?cursor=...
```

---

## Write Actions

```bash
POST /x/write/tweet         # Post a tweet (body: { accountId, text })
POST /x/write/like          # Like (body: { accountId, tweetId })
POST /x/write/retweet       # Retweet (body: { accountId, tweetId })
POST /x/write/follow        # Follow (body: { accountId, targetUserId })
POST /x/write/unfollow      # Unfollow
POST /x/write/dm            # Send DM (body: { accountId, recipientId, text })
DELETE /x/write/tweet        # Delete tweet
POST /x/write/unlike        # Unlike
POST /x/write/upload-media  # Upload media (multipart/form-data)
```

---

## Bulk Extraction

23 extraction types for large datasets. Returns paginated results.

```bash
POST /extractions
{
  "type": "replies",
  "tweetId": "1234567890",
  "maxResults": 1000
}
```

**Extraction types**: `replies`, `retweets`, `quotes`, `favoriters`, `retweeters`, `followers`, `following`, `verified-followers`, `user-tweets`, `user-likes`, `user-media`, `mentions`, `search`, `thread`, `articles`, `community-members`, `community-posts`, `list-members`, `list-followers`, `space-participants`, `people-search`, `bookmarks`, `notifications`

```bash
GET /extractions/:id           # Check status
GET /extractions/:id/results   # Get results (paginated)
GET /extractions/:id/export    # Export as CSV/JSON
```

---

## Account Monitoring

Track accounts for new tweets, replies, quotes, follower changes.

```bash
POST /monitors
{
  "xAccountId": "44196397",
  "events": ["new_tweet", "new_reply", "follower_change"]
}
```

### Webhooks

Receive HMAC-SHA256 signed events at your endpoint:

```bash
POST /webhooks
{
  "url": "https://example.com/webhook",
  "events": ["monitor.new_tweet", "extraction.complete"]
}
```

**Signature verification** (Node.js):

```typescript
import { createHmac } from "crypto";

function verify(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === `sha256=${expected}`;
}
```

---

## Giveaway Draws

Run transparent random draws from tweet replies:

```bash
POST /draws
{
  "tweetId": "1234567890",
  "winnerCount": 3,
  "filters": {
    "mustFollow": ["44196397"],
    "mustLike": true,
    "mustRetweet": true,
    "minFollowers": 100,
    "excludeBots": true
  }
}
```

---

## Trending Topics

```bash
GET /x/trends?country=US
```

### Radar (Free)

Trending news from 7 sources (Google Trends, Hacker News, Polymarket, Wikipedia, GitHub, Reddit):

```bash
GET /radar
```

---

## Tweet Composition (Free)

Algorithm-optimized tweet composer with scoring:

```bash
POST /compose
{
  "topic": "AI agents are changing software development",
  "style": "professional",
  "action": "compose"
}
```

---

## MCP Server

2 tools via StreamableHTTP:

| Tool | Purpose |
|------|---------|
| `explore` | Search the API spec (free, no network calls) |
| `xquik` | Execute any API call with auto-injected auth |

**MCP config** (Claude Code):

```json
{
  "mcpServers": {
    "xquik": {
      "type": "streamable-http",
      "url": "https://xquik.com/mcp",
      "headers": { "X-API-Key": "xq_..." }
    }
  }
}
```

---

## Pagination

All list endpoints support cursor-based pagination:

```typescript
let cursor: string | undefined;
const allResults = [];

do {
  const url = new URL(`${BASE}/x/tweets/search`);
  url.searchParams.set("query", query);
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
  const data = await res.json();
  allResults.push(...data.tweets);
  cursor = data.has_next_page ? data.next_cursor : undefined;
} while (cursor);
```

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Invalid parameters | Check request body/query params |
| 401 | Invalid API key | Verify `X-API-Key` header |
| 402 | Insufficient credits | Top up via `POST /credits/topup` |
| 429 | Rate limited | Retry with exponential backoff |
| 500 | Server error | Retry (max 3 attempts) |

---

## Pricing

Reads from $0.00015/call. Writes $0.0003/call. Extractions $0.00015-$0.00105/result. Monitors, webhooks, radar, compose: free.

Plans: Starter $20/mo, Pro $99/mo, Business $199/mo. Pay-per-use credits available ($10 minimum top-up).

## Reference Files

| File | Contents |
|------|----------|
| [references/endpoints.md](references/endpoints.md) | Complete endpoint reference (120 endpoints) |
