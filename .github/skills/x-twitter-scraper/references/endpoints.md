# Xquik REST API — Complete Endpoint Reference

Base URL: `https://api.xquik.com/v1`
Auth: `X-API-Key` header on all requests.

---

## X Lookups

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| GET | `/x/tweets/search` | Search tweets (query, type, cursor) | 1 |
| GET | `/x/tweets/:id` | Tweet lookup | 1 |
| GET | `/x/tweets/:id/replies` | Tweet replies | 1 |
| GET | `/x/tweets/:id/quotes` | Quote tweets | 1 |
| GET | `/x/tweets/:id/retweeters` | Retweeters | 1 |
| GET | `/x/tweets/:id/favoriters` | Who liked the tweet | 2 |
| GET | `/x/tweets/:id/thread` | Full thread | 1 |
| GET | `/x/tweets/:id/article` | Linked article content | 7 |
| GET | `/x/tweets/:id/download-media` | Download media (images, video, GIFs) | 1 |
| GET | `/x/users/:id` | User profile by ID | 2 |
| GET | `/x/users/by-username/:username` | User profile by username | 2 |
| GET | `/x/users/:id/tweets` | User's tweets | 1 |
| GET | `/x/users/:id/likes` | User's liked tweets | 1 |
| GET | `/x/users/:id/media` | User's media tweets | 1 |
| GET | `/x/users/:id/followers-you-know` | Mutual followers | 2 |
| GET | `/x/users/:id/verified-followers` | Verified followers | 2 |
| GET | `/x/follow-check` | Check mutual follow (query: sourceId, targetId) | 7 |
| GET | `/x/bookmarks` | User bookmarks | 1 |
| GET | `/x/bookmark-folders` | Bookmark folders | 1 |
| GET | `/x/notifications` | Notifications | 1 |
| GET | `/x/timeline` | Home timeline | 1 |
| GET | `/x/dm-history` | DM conversation history | 1 |
| GET | `/x/trends` | Trending topics by country | 3 |

## Extractions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/extractions` | Create extraction (23 types) |
| GET | `/extractions` | List extractions |
| GET | `/extractions/estimate` | Estimate cost |
| GET | `/extractions/:id` | Get extraction status |
| GET | `/extractions/:id/results` | Get results (paginated) |
| GET | `/extractions/:id/export` | Export as CSV or JSON |

### Extraction Types (23)

| Type | Input | Credits/Result |
|------|-------|---------------|
| `replies` | tweetId | 1 |
| `retweets` | tweetId | 1 |
| `quotes` | tweetId | 1 |
| `favoriters` | tweetId | 2 |
| `retweeters` | tweetId | 2 |
| `followers` | userId | 2 |
| `following` | userId | 2 |
| `verified-followers` | userId | 2 |
| `user-tweets` | userId | 1 |
| `user-likes` | userId | 1 |
| `user-media` | userId | 1 |
| `mentions` | userId | 1 |
| `search` | query | 1 |
| `thread` | tweetId | 1 |
| `articles` | tweetId | 7 |
| `community-members` | communityId | 2 |
| `community-posts` | communityId | 1 |
| `list-members` | listId | 2 |
| `list-followers` | listId | 2 |
| `space-participants` | spaceId | 2 |
| `people-search` | query | 2 |
| `bookmarks` | accountId | 1 |
| `notifications` | accountId | 1 |

## Monitors

| Method | Path | Description |
|--------|------|-------------|
| POST | `/monitors` | Create monitor |
| GET | `/monitors` | List monitors |
| GET | `/monitors/:id` | Get monitor |
| PATCH | `/monitors/:id` | Update monitor |
| DELETE | `/monitors/:id` | Delete monitor |

**Monitor events**: `new_tweet`, `new_reply`, `new_quote`, `new_retweet`, `follower_change`

## Events

| Method | Path | Description |
|--------|------|-------------|
| GET | `/events` | List events (filterable) |
| GET | `/events/:id` | Get single event |

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks` | List webhooks |
| PATCH | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| POST | `/webhooks/:id/test` | Send test event |
| GET | `/webhooks/:id/deliveries` | Delivery history |

## Draws (Giveaways)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/draws` | Create draw |
| GET | `/draws` | List draws |
| GET | `/draws/:id` | Get draw with winners |
| GET | `/draws/:id/export` | Export results |

### Draw Filters

| Filter | Type | Description |
|--------|------|-------------|
| `mustFollow` | string[] | Must follow these user IDs |
| `mustLike` | boolean | Must have liked the tweet |
| `mustRetweet` | boolean | Must have retweeted |
| `mustReply` | boolean | Must have replied |
| `mustQuote` | boolean | Must have quote-tweeted |
| `minFollowers` | number | Minimum follower count |
| `maxFollowers` | number | Maximum follower count |
| `minAccountAge` | number | Minimum account age in days |
| `excludeBots` | boolean | Exclude likely bot accounts |
| `includeKeywords` | string[] | Reply must contain keywords |
| `excludeKeywords` | string[] | Reply must not contain keywords |

## Write Actions

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/x/write/tweet` | Post tweet | 2 |
| DELETE | `/x/write/tweet` | Delete tweet | 2 |
| POST | `/x/write/like` | Like tweet | 2 |
| POST | `/x/write/unlike` | Unlike tweet | 2 |
| POST | `/x/write/retweet` | Retweet | 2 |
| POST | `/x/write/follow` | Follow user | 2 |
| POST | `/x/write/unfollow` | Unfollow user | 2 |
| POST | `/x/write/dm` | Send DM | 2 |
| POST | `/x/write/profile` | Update profile | 2 |
| POST | `/x/write/avatar` | Update avatar | 2 |
| POST | `/x/write/banner` | Update banner | 2 |
| POST | `/x/write/upload-media` | Upload media | 2 |
| POST | `/x/write/community/join` | Join community | 2 |
| POST | `/x/write/community/leave` | Leave community | 2 |

## Trends & Radar

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| GET | `/x/trends` | Regional trending topics | 3 |
| GET | `/radar` | Trending from 7 sources | 0 (free) |

## Compose & Drafts

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/compose` | Compose/refine/score tweet | 0 (free) |
| POST | `/drafts` | Save draft | 0 (free) |
| GET | `/drafts` | List drafts | 0 (free) |
| GET | `/drafts/:id` | Get draft | 0 (free) |
| DELETE | `/drafts/:id` | Delete draft | 0 (free) |

## Styles

| Method | Path | Description | Credits |
|--------|------|-------------|---------|
| POST | `/styles/analyze` | Analyze tweet style | 0 (free) |
| POST | `/styles` | Save style | 0 (free) |
| GET | `/styles` | List styles | 0 (free) |
| GET | `/styles/:id` | Get style | 0 (free) |
| DELETE | `/styles/:id` | Delete style | 0 (free) |
| POST | `/styles/compare` | Compare styles | 0 (free) |
| POST | `/styles/performance` | Style performance | 0 (free) |

## Account & Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/account` | Get account info |
| PATCH | `/account/locale` | Update locale |
| POST | `/account/x-identity` | Set X identity |
| POST | `/account/subscribe` | Subscribe to plan |
| GET | `/credits/balance` | Credit balance |
| POST | `/credits/topup` | Top up credits |
| POST | `/api-keys` | Create API key |
| GET | `/api-keys` | List API keys |
| DELETE | `/api-keys/:id` | Revoke API key |

## X Accounts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/x-accounts/connect` | Connect X account |
| GET | `/x-accounts` | List connected accounts |
| GET | `/x-accounts/:id` | Get account details |
| DELETE | `/x-accounts/:id` | Disconnect account |
| POST | `/x-accounts/:id/re-auth` | Re-authenticate |

## Integrations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/integrations` | Create (Telegram) |
| GET | `/integrations` | List integrations |
| GET | `/integrations/:id` | Get integration |
| PATCH | `/integrations/:id` | Update integration |
| DELETE | `/integrations/:id` | Delete integration |
| POST | `/integrations/:id/test` | Send test event |
| GET | `/integrations/:id/deliveries` | Delivery history |

## Support

| Method | Path | Description |
|--------|------|-------------|
| POST | `/support` | Create ticket |
| GET | `/support` | List tickets |
| GET | `/support/:id` | Get ticket |

## Flows

| Method | Path | Description |
|--------|------|-------------|
| POST | `/flows` | Create flow |
| GET | `/flows` | List flows |
| GET | `/flows/:id` | Get flow |
| PATCH | `/flows/:id` | Update flow |
| DELETE | `/flows/:id` | Delete flow |
| GET | `/flows/:id/runs` | Get flow runs |
