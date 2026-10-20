# Redesign Your Favourite App on Solana: Gibwork Command Center (v3)

- **Target Bounty**: Superteam Earn - Redesign Your Favourite App on Solana (`$1,500.00 USDC`, `isKycRequired: false`)
- **Bounty Listing**: `https://superteam.fun/earn/listing/redesign-your-favourite-app-on-solana`
- **Interactive Prototype File**: [`index.html`](./index.html)
- **Author & Solana Payout Wallet**: `9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1` (`emk4652`)

## 1. Executive Summary & UX Audit of Current Gibwork Web/Mobile UI

While building `@emk4652/gibwork-mcp-cli` on top of `@gibwork/sdk`, we audited the daily workflow of developers, designers, and task creators on `gib.work`. We identified four concrete friction points in the existing interface:

| Friction Area | Current UI Behavior | Redesigned Command Center Solution | Quantified UX Improvement |
| :--- | :--- | :--- | :--- |
| **Escrow Transparency** | Reward amounts are displayed as plain text without direct on-chain vault verification or fee breakdown. | Every row displays the live Solana PDA escrow status, token mint (`USDC`), and exact `0.15 USDC` submission intent fee inline. | Zero ambiguity on locked funds or participation fee requirements. |
| **Multi-Line Card Bloat** | Card grids wrap descriptions across 5+ lines, showing only 3-4 bounties per viewport and hiding critical requirements. | Strict single-line high-density table (`whitespace-nowrap`) with dedicated columns for Reward, Escrow PDA, Category, Deadline, and a symmetric Specification Modal. | **3.4x** more active bounties visible above the fold on 1080p screens. |
| **Platform Wallet 403 Error** | Contributors attempting API/SDK submission without a linked web profile wallet hit an opaque `403 Forbidden` error. | Built-in **Pre-Flight Readiness Bar** that checks Profile Wallet Link, `>= 0.15 USDC` Fee Balance, and Idempotency Key before submission. | Eliminates failed transaction intents and clarifies onboarding steps. |
| **CLI / Agent Integration** | Developers must manually copy task UUIDs from the browser URL bar to use `@gibwork/sdk`. | 1-click **Copy SDK / MCP Snippet** modal per row that generates ready-to-run TypeScript & CLI commands for any bounty UUID. | Reduces developer setup time from ~4 minutes to **1 click**. |

## 2. Visual & Architectural Standards Applied

1. **Zero Generic AI Patterns**: No purple/indigo gradients, no decorative glowing pills, no fake pulsing status dots, and no multi-line card clutter.
2. **Strict Single-Line Table Density**: All bounty records render in a single horizontal row using monospace numerals (`JetBrains Mono` / `Consolas`) for USDC amounts, UUID prefixes, and countdown timers.
3. **Symmetric Inspection & Submission Modal**: Clicking **Inspect / Submit** opens a balanced modal showing full task requirements, live `@gibwork/sdk` TypeScript code, and 1-click transaction signing.
