import { describe, it, expect } from 'vitest';
import {
  GibworkAgentService,
  GIBWORK_MCP_TOOLS,
  executeMcpToolCall,
  buildCliProgram,
  DEFAULT_PAYOUT_WALLET,
  USDC_MAINNET_MINT,
  parseKeypairFromSecret,
  resolvePayoutWalletAddress,
} from '../src/index.js';

const HACKATHON_BOUNTY_ID = '1052f22d-3f87-4b1d-b0d7-71a60679e7fa';

describe('@emk4652/gibwork-mcp-cli Test Suite', () => {
  const service = new GibworkAgentService({
    payoutWallet: DEFAULT_PAYOUT_WALLET,
    production: true,
  });

  it('validates Solana payout wallet and deterministic signer generation', () => {
    const resolved = resolvePayoutWalletAddress();
    expect(resolved).toBe('9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1');

    const kp = parseKeypairFromSecret();
    expect(kp.publicKey.toBase58()).toHaveLength(44);
  });

  it('lists active bounties from Gibwork API and includes the $1,000 USDC Hackathon bounty', async () => {
    const bounties = await service.listBounties({ onlyOpen: true });
    expect(Array.isArray(bounties)).toBe(true);
    expect(bounties.length).toBeGreaterThan(0);

    const hackathon = bounties.find((b) => b.id === HACKATHON_BOUNTY_ID);
    expect(hackathon).toBeDefined();
    expect(hackathon?.title).toContain('Gibwork Developer Hackathon Bounty');
    expect(hackathon?.rewardUiAmount).toBe(1000);
    expect(hackathon?.asset?.symbol).toBe('USDC');
    expect(hackathon?.asset?.mintAddress).toBe(USDC_MAINNET_MINT);
    expect(hackathon?.allowOnlyVerifiedSubmissions).toBe(false);
  }, 20000);

  it('retrieves full bounty details for 1052f22d-3f87-4b1d-b0d7-71a60679e7fa via @gibwork/sdk', async () => {
    const details = await service.getBounty(HACKATHON_BOUNTY_ID);
    expect(details.id).toBe(HACKATHON_BOUNTY_ID);
    expect(details.isOpen).toBe(true);
    expect(details.rewardUiAmount).toBe(1000);
    expect(details.tags).toContain('Development');
    expect(details.content).toContain('SDK, CLI, or MCP');
  }, 20000);

  it('verifies Solana Mainnet SPL USDC escrow state and payout wallet on-curve status', async () => {
    const escrow = await service.verifySolanaEscrow(HACKATHON_BOUNTY_ID);
    expect(escrow.bountyId).toBe(HACKATHON_BOUNTY_ID);
    expect(escrow.verified).toBe(true);
    expect(escrow.escrowStatus).toBe('LOCKED_ACTIVE');
    expect(escrow.mintAddress).toBe(USDC_MAINNET_MINT);
    expect(escrow.tokenSymbol).toBe('USDC');
    expect(escrow.decimals).toBe(6);
    expect(escrow.lockedUiAmount).toBe(1000);
    expect(escrow.mintInitialized).toBe(true);
    expect(escrow.payoutWallet).toBe(DEFAULT_PAYOUT_WALLET);
    expect(escrow.payoutWalletValidOnCurve).toBe(true);
  }, 25000);

  it('ranks bounties by developer skill stack with word-boundary precision', async () => {
    const matches = await service.matchSkills({
      skills: ['mcp', 'cli', 'sdk', 'development'],
      minReward: 50,
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].bounty.id).toBe(HACKATHON_BOUNTY_ID);
    expect(matches[0].matchScore).toBe(100);
    expect(matches[0].matchedSkills).toEqual(expect.arrayContaining(['mcp', 'cli', 'sdk']));
    expect(matches[0].recommendedAction).toBe('EXECUTE_IMMEDIATELY');
  }, 20000);

  it('generates an idempotent submission draft and dry-run task creation payload', async () => {
    const draft = await service.draftSubmission({
      taskId: HACKATHON_BOUNTY_ID,
      repoUrl: 'https://github.com/emk4652/gibwork-mcp-cli',
      summary: 'MCP server + CLI + autonomous agent toolkit built on @gibwork/sdk and @solana/web3.js',
      deliverables: ['MCP stdio server', 'CLI tool', 'Solana Mainnet USDC escrow verifier', 'Vitest suite'],
    });
    expect(draft.taskId).toBe(HACKATHON_BOUNTY_ID);
    expect(draft.payoutWallet).toBe(DEFAULT_PAYOUT_WALLET);
    expect(draft.sdkInputPayload.content).toContain(DEFAULT_PAYOUT_WALLET);
    expect(draft.sdkInputPayload.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const created = await service.createTask({
      title: 'Automated Rust Anchor Security Review',
      content: 'Audit the escrow vault PDA instructions.',
      tags: ['Development', 'Solana'],
      amountUsdc: '150.00',
      dryRun: true,
    });
    expect(created.mode).toBe('dry_run');
    if (created.mode === 'dry_run') {
      expect(created.sdkPayload.payment.amount).toBe('150.00');
      expect(created.sdkPayload.payment.mintAddress).toBe(USDC_MAINNET_MINT);
    }
  }, 20000);

  it('registers all 6 required MCP tools and executes tool calls cleanly', async () => {
    const toolNames = GIBWORK_MCP_TOOLS.map((t) => t.name);
    expect(toolNames).toEqual([
      'gibwork_list_bounties',
      'gibwork_get_bounty',
      'gibwork_verify_solana_escrow',
      'gibwork_match_skills',
      'gibwork_draft_submission',
      'gibwork_create_task',
    ]);

    const resGet = await executeMcpToolCall(service, 'gibwork_get_bounty', {
      taskId: HACKATHON_BOUNTY_ID,
    });
    expect(resGet.isError).toBeUndefined();
    const parsed = JSON.parse(resGet.content[0].text);
    expect(parsed.id).toBe(HACKATHON_BOUNTY_ID);

    const resErr = await executeMcpToolCall(service, 'unknown_tool', {});
    expect(resErr.isError).toBe(true);
  }, 20000);

  it('constructs the Commander CLI with list, inspect, verify-escrow, watch, and draft-submission commands', () => {
    const program = buildCliProgram(service);
    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toEqual(
      expect.arrayContaining(['list', 'inspect', 'verify-escrow', 'watch', 'draft-submission'])
    );
  });
});
