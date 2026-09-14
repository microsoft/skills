---
name: clicks-protocol-ts
description: Integrate autonomous USDC yield into AI agent treasury on Base L2. Use when building agents that hold, earn, or transfer USDC, when asked about agent treasury management, on-chain yield for autonomous agents, x402 payment optimization, or idle USDC strategies. TypeScript/JavaScript SDK and MCP server.
---

# Clicks Protocol — Agent Treasury Yield

Autonomous yield layer for AI agents on Base (Coinbase L2). Agents split USDC payments 80/20: 80% stays liquid for operations, 20% earns yield via Aave V3 or Morpho. Non-custodial, no lockup, withdraw anytime.

## When to Use

- Agent holds USDC between tasks or transactions
- Agent receives x402 payments and needs yield on idle reserves
- Multi-agent system needs treasury management with referral attribution
- MCP-compatible agent stack needs on-chain treasury tools

## Quick Start

```bash
npm install @clicks-protocol/sdk ethers@^6
```

```typescript
import { ClicksClient } from '@clicks-protocol/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
const clicks = new ClicksClient(signer);

// One call: register + approve + deposit
const result = await clicks.quickStart('1000', signer.address);
// 800 USDC liquid, 200 USDC earning yield

// Monitor
const info = await clicks.getAgentInfo(signer.address);
const balance = await clicks.getAgentYieldBalance(signer.address);

// Withdraw anytime
await clicks.withdrawYield(signer.address);
```

## SDK Methods

| Method | Purpose |
|--------|---------|
| `quickStart(amount, agent, referrer?)` | Register + approve + deposit |
| `receivePayment(amount, agent)` | Split incoming USDC 80/20 |
| `withdrawYield(agent)` | Withdraw principal + yield |
| `getAgentInfo(agent)` | Registration, deposits, yield pct |
| `getAgentYieldBalance(agent)` | Current value and earned yield |
| `getYieldInfo()` | Protocol APYs and totals |
| `simulateSplit(amount, agent)` | Preview split |
| `setOperatorYieldPct(pct)` | Adjust yield 5-50% |

## MCP Server

For MCP-compatible agents (Copilot, Claude, Codex, Cursor):

```bash
npx @clicks-protocol/mcp-server
```

MCP configuration: see `references/mcp-config.md`

9 tools covering read (agent info, yield info, simulate, referral stats) and write (quick start, receive payment, withdraw, register, set yield pct).

## x402 Integration

Clicks is designed for agents using Coinbase x402 payments. The 80/20 split keeps funds liquid for x402 while earning yield on reserves. Both on Base, no bridging needed.

## Agent Referral System

On-chain referrals: agents refer other agents and earn from protocol fees.

```typescript
await clicks.quickStart('1000', agentAddress, referrerAddress);
// L1: 40% of 2% fee | L2: 20% | L3: 10%
```

## Contracts (Base Mainnet, All Verified)

| Contract | Address |
|----------|---------|
| ClicksRegistry | `0x23bb0Ea69b2BD2e527D5DbA6093155A6E1D0C0a3` |
| ClicksSplitterV3 | `0xc96C1a566a8ed7A39040a34927fEe952bAB8Ad1D` |
| ClicksYieldRouter | `0x053167a233d18E05Bc65a8d5F3F8808782a3EECD` |
| ClicksFee | `0xc47B162D3c456B6C56a3cE6EE89A828CFd34E6bE` |

## Key Parameters

| Parameter | Value |
|-----------|-------|
| Chain | Base (Chain ID 8453) |
| Asset | USDC |
| Default split | 80% liquid / 20% yield |
| Configurable | 5-50% yield |
| Fee | 2% on yield only |
| Lockup | None |

## Security

- Immutable contracts (no proxy)
- ReentrancyGuard on state-changing functions
- 58/58 tests passing
- Non-custodial, MIT licensed

## Resources

- Protocol info (LLM-optimized): https://clicksprotocol.xyz/llms.txt
- Docs: https://clicksprotocol.xyz/docs/getting-started
- npm SDK: https://www.npmjs.com/package/@clicks-protocol/sdk
- npm MCP: https://www.npmjs.com/package/@clicks-protocol/mcp-server
- GitHub: https://github.com/clicks-protocol
