# `@emk4652/gibwork-mcp-cli`

Autonomous Developer Agent Kit, Model Context Protocol (MCP) Server, and Terminal CLI for discovering Gibwork bounties, verifying on-chain Solana SPL USDC escrow pools, matching agent skill stacks, and preparing idempotent task submissions.

Built specifically as a non-web-app developer toolset for the **Gibwork Developer Hackathon Bounty** (`1052f22d-3f87-4b1d-b0d7-71a60679e7fa`).

- **Target Bounty**: `https://gib.work/bounty/1052f22d-3f87-4b1d-b0d7-71a60679e7fa`
- **Reward Pool**: `1,000.00 USDC` (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- **Configured Solana Payout Wallet**: `9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1`
- **Core Stack**: `@gibwork/sdk` (`v0.2.0`), `@modelcontextprotocol/sdk`, `@solana/web3.js`, `commander`, `typescript`, `vitest`

---

## Problem Statement and Value Proposition

Autonomous coding agents (Claude Code, Cursor, Antigravity, Codex, OpenClaw) and CLI-first developers need a deterministic way to:
1. Query open permissionless (0% KYC) bounties across Gibwork without leaving the terminal or IDE context.
2. Independently verify on-chain Solana SPL token metadata (mint initialization, decimals, circulating supply, locked base units, and Ed25519 payout wallet validity) against `https://api.mainnet-beta.solana.com` before allocating compute to a task.
3. Rank open bounties by exact word-boundary skill matches and reward density (`USDC / pendingSubmissions`).
4. Generate idempotent submission payloads (`UUIDv4` key + sanitized HTML + payout wallet binding) compatible with `@gibwork/sdk` (`submissions.prepareCreate` and `tasks.create`).

---

## System Architecture

```
+-----------------------------------------------------------------------+
|                Autonomous Coding Agents & Developers                  |
|       (Claude Code / Cursor / Antigravity / OpenClaw / Terminal)      |
+-----------------------------------+-----------------------------------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
                  v (stdio JSON-RPC)                  v (POSIX CLI)
+-----------------------------------+-----------------------------------+
|  MCP Server (dist/mcp.js)         |  CLI Binary (dist/cli.js)         |
|  - gibwork_list_bounties          |  - gibwork-kit list               |
|  - gibwork_get_bounty             |  - gibwork-kit inspect <id>       |
|  - gibwork_verify_solana_escrow   |  - gibwork-kit verify-escrow <id> |
|  - gibwork_match_skills           |  - gibwork-kit watch              |
|  - gibwork_draft_submission       |  - gibwork-kit draft-submission   |
|  - gibwork_create_task            |                                   |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                 GibworkAgentService (src/service.ts)                  |
|     Ed25519 Wallet Signer + HTML Sanitizer + Skill Scoring Engine     |
+-----------------+-----------------------------------+-----------------+
                  |                                   |
                  v                                   v
+-----------------------------------+-----------------------------------+
|  Gibwork Official Endpoints       |  Solana Mainnet RPC               |
|  - @gibwork/sdk (sdk.gib.work)    |  - api.mainnet-beta.solana.com    |
|  - Explore REST (api.gib.work)    |  - SPL Mint & Wallet Verification |
+-----------------------------------+-----------------------------------+
```

---

## Installation and Build

Requires Node.js 22 or newer.

```bash
git clone https://github.com/emk4652/gibwork-mcp-cli.git
cd gibwork-mcp-cli
npm install
npm run build
npm test
```

### Environment Variables

All read, discovery, skill-matching, and on-chain escrow verification operations work out of the box with zero configuration (using an ephemeral Ed25519 reader keypair for `@gibwork/sdk` signature headers). For write operations or custom RPC routing, set:

| Variable | Default Value | Purpose |
| :--- | :--- | :--- |
| `GIBWORK_PAYOUT_WALLET` | `9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1` | Solana SPL USDC destination wallet |
| `SOLANA_PRIVATE_KEY` | Ephemeral Ed25519 reader seed | Base58 or JSON byte array for signing transactions |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana Mainnet RPC endpoint |
| `GIBWORK_EXPLORE_API_URL` | `https://api.gib.work` | Public fallback discovery endpoint |

---

## MCP Server Configuration

Register `@emk4652/gibwork-mcp-cli` in your agent's `mcp_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gibwork-agent-kit": {
      "command": "node",
      "args": ["/absolute/path/to/gibwork-agent-kit/dist/mcp.js"],
      "env": {
        "GIBWORK_PAYOUT_WALLET": "9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1",
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

### Exposed MCP Tools

| Tool Name | Input Parameters | Output Payload |
| :--- | :--- | :--- |
| `gibwork_list_bounties` | `onlyOpen`, `minReward`, `symbol`, `tag`, `search` | Normalized array of open Gibwork bounties |
| `gibwork_get_bounty` | `taskId` (UUID) | Full bounty specification, rules, and submission counts |
| `gibwork_verify_solana_escrow` | `taskId` (UUID), `payoutWallet` (optional) | Live Solana Mainnet SPL mint supply, decimals, and wallet status |
| `gibwork_match_skills` | `skills` (string[]), `minReward`, `preferUsdc` | Ranked opportunities with `0-100` score and reward density |
| `gibwork_draft_submission` | `taskId`, `repoUrl`, `summary`, `deliverables`, `demoUrl` | Idempotent `UUIDv4` submission payload for `@gibwork/sdk` |
| `gibwork_create_task` | `title`, `content`, `tags`, `amountUsdc`, `dryRun` | Validated `CreateTaskInput` or broadcasted task intent |

---

## CLI Usage and Live Output Verification

### 1. List Open Bounties (`gibwork-kit list`)

```bash
node ./dist/cli.js list
```

```text
GIBWORK ACTIVE BOUNTIES (6 MATCHED) | PAYOUT WALLET: 9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1
--------------------------------------------------------------------------------------------------------------------
ID                                     | REWARD         | KYC     | DEADLINE     | TITLE
--------------------------------------------------------------------------------------------------------------------
48b29af8-6516-43cd-8407-0247497c0f9a   | 150.00 USDC    | 0% KYC  | 2026-10-24   | Share One Little Thing About Using BA...
fee5da23-be65-4b10-b635-ad74a0761688   | 250.00 USDC    | 0% KYC  | 2026-10-21   | Share Your BASIS Story 50 Topics, Pic...
9adb1772-5fdc-4aba-9036-86124b03cd6e   | 5.00 USDC      | 0% KYC  | 2026-10-20   | OGs VS NEWBIES
d321ae8f-34f0-4c2f-b6ef-af7773d096ba   | 200.00 CREDITS | 0% KYC  | 2026-11-27   | Create an X Thread About the Gibwork ...
5f073804-bb43-49c9-99c0-3fb498180465   | 300.00 USDC    | 0% KYC  | 2026-10-30   | Create a UGC Video Bounty for the Gib...
1052f22d-3f87-4b1d-b0d7-71a60679e7fa   | 1000.00 USDC   | 0% KYC  | 2026-10-30   | Gibwork Developer Hackathon Bounty
--------------------------------------------------------------------------------------------------------------------
```

### 2. Verify Solana Mainnet Escrow (`gibwork-kit verify-escrow <id>`)

```bash
node ./dist/cli.js verify-escrow 1052f22d-3f87-4b1d-b0d7-71a60679e7fa
```

```text
================================================================================
SOLANA MAINNET ESCROW VERIFICATION: LOCKED_ACTIVE
================================================================================
Bounty ID          : 1052f22d-3f87-4b1d-b0d7-71a60679e7fa
Bounty Title       : Gibwork Developer Hackathon Bounty
Solana Network     : mainnet-beta (https://api.mainnet-beta.solana.com)
SPL Token Mint     : EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)
Mint Program Owner : TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
Mint Initialized   : true
Mainnet Supply     : 7854347689.068509 USDC
Escrow Locked Pool : 1000.00 USDC (1000000000 raw)
Remaining Pool     : 1000.00 USDC
Payout Wallet      : 9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1
Ed25519 On-Curve   : true
Wallet SOL Balance : 0.000000 SOL
Timestamp          : 2026-10-20T11:43:36.366Z
================================================================================
```

### 3. Watch and Rank by Skill Stack (`gibwork-kit watch`)

```bash
node ./dist/cli.js watch --skills "mcp,cli,sdk,typescript,solana"
```

```text
[2026-10-20T11:44:50.000Z] SKILL MATCH SCANNER | SKILLS: mcp, cli, sdk, typescript, solana
--------------------------------------------------------------------------------------------------------------------
SCORE   | ACTION                | REWARD         | MATCHED SKILLS             | TITLE
--------------------------------------------------------------------------------------------------------------------
100/100 | EXECUTE_IMMEDIATELY   | 1000.00 USDC   | mcp, cli, sdk              | Gibwork Developer Hackathon Bounty
55/100  | INSPECT_REQUIREMENTS  | 300.00 USDC    | none                       | Create a UGC Video Bounty for the...
45/100  | INSPECT_REQUIREMENTS  | 250.00 USDC    | none                       | Share Your BASIS Story 50 Topics,...
45/100  | INSPECT_REQUIREMENTS  | 150.00 USDC    | none                       | Share One Little Thing About Usin...
25/100  | SKIP_LOW_MATCH        | 200.00 CREDITS | none                       | Create an X Thread About the Gibw...
--------------------------------------------------------------------------------------------------------------------
```

### 4. Draft Idempotent Submission (`gibwork-kit draft-submission <id>`)

```bash
node ./dist/cli.js draft-submission 1052f22d-3f87-4b1d-b0d7-71a60679e7fa \
  --repo "https://github.com/emk4652/gibwork-mcp-cli" \
  --summary "Built @emk4652/gibwork-mcp-cli integrating @gibwork/sdk with MCP stdio tools and Solana Mainnet SPL USDC verification."
```

---

## Automated Test Suite

Run the Vitest integration suite against live Gibwork and Solana Mainnet endpoints:

```bash
npm test
```

```text
 RUN  v3.2.7

 ✓ tests/gibwork-kit.test.ts (8 tests) 1343ms
   ✓ validates Solana payout wallet and deterministic signer generation
   ✓ lists active bounties from Gibwork API and includes the $1,000 USDC Hackathon bounty
   ✓ retrieves full bounty details for 1052f22d-3f87-4b1d-b0d7-71a60679e7fa via @gibwork/sdk
   ✓ verifies Solana Mainnet SPL USDC escrow state and payout wallet on-curve status
   ✓ ranks bounties by developer skill stack with word-boundary precision
   ✓ generates an idempotent submission draft and dry-run task creation payload
   ✓ registers all 6 required MCP tools and executes tool calls cleanly
   ✓ constructs the Commander CLI with list, inspect, verify-escrow, watch, and draft-submission commands

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

## License

MIT
