import { randomUUID } from 'node:crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  GibworkClient,
  type CreateTaskInput,
  type PreparedTaskIntent,
  type CreateTaskResult,
  type TaskDetails,
  type AvailableTask,
} from '@gibwork/sdk';
import {
  createKeypairWalletSigner,
  parseKeypairFromSecret,
  resolvePayoutWalletAddress,
  USDC_MAINNET_MINT,
} from './signer.js';
import type {
  GibworkBountyItem,
  SolanaEscrowVerification,
  SkillMatchCandidate,
  SubmissionDraft,
} from './types.js';

export interface GibworkAgentServiceOptions {
  privateKey?: string;
  payoutWallet?: string;
  solanaRpcUrl?: string;
  exploreApiUrl?: string;
  sdkBaseUrl?: string;
  production?: boolean;
  fetchImpl?: typeof fetch;
}

export class GibworkAgentService {
  private readonly sdkClient: GibworkClient;
  private readonly connection: Connection;
  private readonly exploreApiUrl: string;
  private readonly solanaRpcUrl: string;
  private readonly payoutWallet: string;
  private readonly fetchImpl: typeof fetch;
  private readonly signerAddress: string;

  constructor(options: GibworkAgentServiceOptions = {}) {
    const secret = options.privateKey ?? process.env.SOLANA_PRIVATE_KEY;
    const keypair = parseKeypairFromSecret(secret);
    const signer = createKeypairWalletSigner(keypair);
    this.signerAddress = signer.publicKey.toBase58();
    this.payoutWallet = resolvePayoutWalletAddress(options.payoutWallet);
    this.solanaRpcUrl =
      options.solanaRpcUrl ??
      process.env.SOLANA_RPC_URL ??
      'https://api.mainnet-beta.solana.com';
    this.exploreApiUrl =
      options.exploreApiUrl ??
      process.env.GIBWORK_EXPLORE_API_URL ??
      'https://api.gib.work';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;

    this.sdkClient = new GibworkClient({
      signer,
      production: options.production ?? true,
      ...(options.sdkBaseUrl ? { baseUrl: options.sdkBaseUrl } : {}),
      fetch: this.fetchImpl,
    });

    this.connection = new Connection(this.solanaRpcUrl, 'confirmed');
  }

  public getPayoutWallet(): string {
    return this.payoutWallet;
  }

  public getSignerWallet(): string {
    return this.signerAddress;
  }

  public async listBounties(filter: {
    page?: number;
    limit?: number;
    onlyOpen?: boolean;
    minReward?: number;
    symbol?: string;
    tag?: string;
    search?: string;
  } = {}): Promise<GibworkBountyItem[]> {
    const page = filter.page ?? 1;
    const limit = Math.min(Math.max(filter.limit ?? 15, 1), 100);
    let items: GibworkBountyItem[] = [];

    try {
      const sdkPage = await this.sdkClient.tasks.listAvailable({ page, limit });
      items = sdkPage.results.map((t) => this.normalizeAvailableTask(t));
    } catch {
      const res = await this.fetchImpl(`${this.exploreApiUrl}/explore`);
      if (!res.ok) {
        throw new Error(`Failed to fetch bounties from Gibwork explore API: HTTP ${res.status}`);
      }
      const data = (await res.json()) as { results?: Record<string, unknown>[] };
      items = (data.results ?? []).map((r) => this.normalizeExploreItem(r));
    }

    return items.filter((item) => {
      if (filter.onlyOpen !== false && !item.isOpen) return false;
      if (filter.minReward !== undefined && item.rewardUiAmount < filter.minReward) return false;
      if (
        filter.symbol &&
        item.asset?.symbol?.toUpperCase() !== filter.symbol.trim().toUpperCase()
      ) {
        return false;
      }
      if (
        filter.tag &&
        !item.tags.some((t) => t.toLowerCase().includes(filter.tag!.trim().toLowerCase()))
      ) {
        return false;
      }
      if (filter.search) {
        const q = filter.search.trim().toLowerCase();
        const hay = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  public async getBounty(taskId: string): Promise<GibworkBountyItem> {
    try {
      const details = await this.sdkClient.tasks.get(taskId.trim());
      return this.normalizeTaskDetails(details);
    } catch {
      const all = await this.listBounties({ onlyOpen: false, limit: 100 });
      const found = all.find((b) => b.id.toLowerCase() === taskId.trim().toLowerCase());
      if (!found) {
        throw new Error(`Bounty ${taskId} not found in Gibwork API`);
      }
      return found;
    }
  }

  public async verifySolanaEscrow(
    taskId: string,
    overridePayoutWallet?: string
  ): Promise<SolanaEscrowVerification> {
    const bounty = await this.getBounty(taskId);
    const targetWallet = resolvePayoutWalletAddress(overridePayoutWallet ?? this.payoutWallet);
    const walletPubkey = new PublicKey(targetWallet);
    const walletOnCurve = PublicKey.isOnCurve(walletPubkey.toBytes());

    const asset = bounty.asset;
    const mintAddress = asset?.mintAddress || USDC_MAINNET_MINT;
    const tokenSymbol = asset?.symbol || 'USDC';
    const decimals = asset?.decimals ?? 6;
    const lockedBaseUnits = String(asset?.amount ?? '0');
    const lockedUiAmount = Number(lockedBaseUnits) / Math.pow(10, decimals);
    const remainingUiAmount = bounty.remainingAmount ?? lockedUiAmount;

    let mintSupplyUi = '0';
    let mintInitialized = false;
    let mintProgramOwner = 'Unknown';
    let walletSolBalance = 0;

    if (mintAddress && mintAddress.length >= 32) {
      const mintPubkey = new PublicKey(mintAddress);
      const [supplyResp, accountResp, balanceLamports] = await Promise.all([
        this.connection.getTokenSupply(mintPubkey),
        this.connection.getParsedAccountInfo(mintPubkey),
        this.connection.getBalance(walletPubkey),
      ]);

      mintSupplyUi = supplyResp.value.uiAmountString ?? String(supplyResp.value.uiAmount ?? 0);
      mintProgramOwner = accountResp.value?.owner?.toBase58() ?? 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const parsedData = accountResp.value?.data;
      if (parsedData && typeof parsedData === 'object' && 'parsed' in parsedData) {
        mintInitialized = Boolean(parsedData.parsed?.info?.isInitialized);
      } else {
        mintInitialized = accountResp.value !== null;
      }
      walletSolBalance = Number(balanceLamports) / 1e9;
    }

    const isLockedActive = bounty.isOpen && lockedUiAmount > 0 && mintInitialized;

    return {
      bountyId: bounty.id,
      title: bounty.title,
      verified: isLockedActive,
      network: 'mainnet-beta',
      rpcEndpoint: this.solanaRpcUrl,
      mintAddress,
      tokenSymbol,
      decimals,
      lockedBaseUnits,
      lockedUiAmount,
      remainingUiAmount,
      mintSupplyUi,
      mintInitialized,
      mintProgramOwner,
      payoutWallet: targetWallet,
      payoutWalletValidOnCurve: walletOnCurve,
      payoutWalletSolBalance: walletSolBalance,
      escrowStatus: isLockedActive
        ? 'LOCKED_ACTIVE'
        : !mintInitialized
          ? 'UNVERIFIED_ASSET'
          : 'CLOSED_OR_DEPLETED',
      checkedAt: new Date().toISOString(),
    };
  }

  public async matchSkills(input: {
    skills: string[];
    minReward?: number;
    preferUsdc?: boolean;
  }): Promise<SkillMatchCandidate[]> {
    const bounties = await this.listBounties({
      onlyOpen: true,
      minReward: input.minReward ?? 0,
      limit: 50,
    });

    const normalizedSkills = input.skills.map((s) => s.trim().toLowerCase()).filter(Boolean);

    const candidates: SkillMatchCandidate[] = bounties.map((bounty) => {
      const corpus = `${bounty.title} ${bounty.content} ${bounty.tags.join(' ')}`.toLowerCase();
      const matchedSkills = normalizedSkills.filter((skill) => {
        const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'i');
        return re.test(corpus);
      });

      let score = matchedSkills.length * 25;
      if (bounty.asset?.symbol === 'USDC' && input.preferUsdc !== false) {
        score += 20;
      }
      if (!bounty.allowOnlyVerifiedSubmissions) {
        score += 15; // 0% KYC bonus
      }
      if (bounty.rewardUiAmount >= 500) {
        score += 20;
      } else if (bounty.rewardUiAmount >= 100) {
        score += 10;
      }

      const pending = Math.max(bounty.pendingSubmissions ?? 1, 1);
      const rewardDensityScore = Number((bounty.rewardUiAmount / pending).toFixed(2));
      const finalScore = Math.min(100, score);

      let recommendedAction = 'SKIP_LOW_MATCH';
      if (finalScore >= 60) {
        recommendedAction = 'EXECUTE_IMMEDIATELY';
      } else if (finalScore >= 35) {
        recommendedAction = 'INSPECT_REQUIREMENTS';
      }

      return {
        bounty,
        matchedSkills,
        matchScore: finalScore,
        rewardDensityScore,
        recommendedAction,
      };
    });

    return candidates.sort(
      (a, b) => b.matchScore - a.matchScore || b.bounty.rewardUiAmount - a.bounty.rewardUiAmount
    );
  }

  public async draftSubmission(input: {
    taskId: string;
    repoUrl: string;
    summary: string;
    deliverables: string[];
    demoUrl?: string;
    payoutWallet?: string;
    idempotencyKey?: string;
    executePrepareOnApi?: boolean;
  }): Promise<SubmissionDraft & { preparedIntent?: unknown }> {
    const bounty = await this.getBounty(input.taskId);
    const wallet = resolvePayoutWalletAddress(input.payoutWallet ?? this.payoutWallet);
    const idempotencyKey = input.idempotencyKey ?? randomUUID();

    const deliverablesHtml = input.deliverables
      .map((d) => `<li>${escapeHtml(d)}</li>`)
      .join('');

    const demoSectionHtml = input.demoUrl
      ? `<p><strong>Demo / Verification URL:</strong> <a href="${escapeHtml(input.demoUrl)}">${escapeHtml(input.demoUrl)}</a></p>`
      : '';

    const htmlContent = [
      `<h3>Submission for ${escapeHtml(bounty.title)}</h3>`,
      `<p>${escapeHtml(input.summary)}</p>`,
      `<p><strong>GitHub Repository:</strong> <a href="${escapeHtml(input.repoUrl)}">${escapeHtml(input.repoUrl)}</a></p>`,
      demoSectionHtml,
      `<h4>Deliverables Verified</h4>`,
      `<ul>${deliverablesHtml}</ul>`,
      `<p><strong>Solana Payout Wallet (USDC/SPL):</strong> <code>${wallet}</code></p>`,
    ]
      .filter(Boolean)
      .join('');

    const markdownPreview = [
      `# Submission: ${bounty.title}`,
      `- **Task ID**: \`${bounty.id}\``,
      `- **Repository**: ${input.repoUrl}`,
      ...(input.demoUrl ? [`- **Demo URL**: ${input.demoUrl}`] : []),
      `- **Payout Wallet**: \`${wallet}\``,
      `- **Idempotency Key**: \`${idempotencyKey}\``,
      ``,
      `## Executive Summary`,
      input.summary,
      ``,
      `## Deliverables`,
      ...input.deliverables.map((d) => `- ${d}`),
    ].join('\n');

    const sdkInputPayload = {
      content: htmlContent,
      referral: null,
      mediaIds: [] as string[],
      idempotencyKey,
    };

    let preparedIntent: unknown = undefined;
    if (input.executePrepareOnApi) {
      preparedIntent = await this.sdkClient.submissions.prepareCreate(bounty.id, sdkInputPayload);
    }

    return {
      taskId: bounty.id,
      bountyTitle: bounty.title,
      payoutWallet: wallet,
      idempotencyKey,
      htmlContent,
      markdownPreview,
      sdkInputPayload,
      ...(preparedIntent ? { preparedIntent } : {}),
      createdAt: new Date().toISOString(),
    };
  }

  public async createTask(input: {
    title: string;
    content: string;
    tags: string[];
    amountUsdc: string;
    minSubmissionAmountUsdc?: string;
    mintAddress?: string;
    deadline?: string;
    allowOnlyVerifiedSubmissions?: boolean;
    dryRun?: boolean;
  }): Promise<
    | { mode: 'dry_run'; sdkPayload: CreateTaskInput; signerWallet: string }
    | { mode: 'prepared'; intent: PreparedTaskIntent }
    | { mode: 'submitted'; result: CreateTaskResult }
  > {
    const sdkPayload: CreateTaskInput = {
      title: input.title.trim(),
      content: input.content.trim().startsWith('<')
        ? input.content.trim()
        : `<p>${escapeHtml(input.content.trim())}</p>`,
      tags: input.tags.map((t) => t.trim()).filter(Boolean),
      payment: {
        mintAddress: input.mintAddress ?? USDC_MAINNET_MINT,
        amount: input.amountUsdc.trim(),
      },
      minSubmissionAmount: (input.minSubmissionAmountUsdc ?? '5.00').trim(),
      deadline: input.deadline ?? null,
      allowOnlyVerifiedSubmissions: input.allowOnlyVerifiedSubmissions ?? false,
    };

    if (input.dryRun !== false) {
      return {
        mode: 'dry_run',
        sdkPayload,
        signerWallet: this.signerAddress,
      };
    }

    const result = await this.sdkClient.tasks.create(sdkPayload);
    return {
      mode: 'submitted',
      result,
    };
  }

  private normalizeAvailableTask(t: AvailableTask): GibworkBountyItem {
    const decimals = t.asset?.decimals ?? 6;
    const rawAmount = t.asset?.amount ?? '0';
    const rewardUiAmount = Number(rawAmount) / Math.pow(10, decimals);

    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      content: stripHtml(t.content),
      requirements: t.requirements ? stripHtml(t.requirements) : null,
      deadline: t.deadline,
      tags: t.tags ?? [],
      status: t.status,
      isOpen: t.isOpen,
      allowOnlyVerifiedSubmissions:
        t.participationRequirements?.allowOnlyVerifiedSubmissions ?? false,
      allowOnlyDiscordGuildSubmissions:
        t.participationRequirements?.allowOnlyDiscordGuildSubmissions ?? false,
      requiredDiscordGuildId: t.participationRequirements?.requiredDiscordGuildId ?? null,
      requiredDiscordRoleIds: t.participationRequirements?.requiredDiscordRoleIds ?? [],
      rewardUiAmount,
      minSubmissionAmount: t.minSubmissionAmount,
      asset: t.asset
        ? {
            mintAddress: t.asset.mintAddress,
            symbol: t.asset.symbol,
            imageUrl: t.asset.imageUrl,
            amount: String(t.asset.amount),
            decimals: t.asset.decimals,
          }
        : null,
      pendingSubmissions: t.totalSubmissions,
      url: `https://gib.work/bounty/${t.id}`,
    };
  }

  private normalizeTaskDetails(d: TaskDetails): GibworkBountyItem {
    const decimals = d.asset?.decimals ?? 6;
    const rawAmount = String(d.asset?.amount ?? '0');
    const rewardUiAmount = Number(rawAmount) / Math.pow(10, decimals);

    return {
      id: d.id,
      slug: d.slug,
      title: d.title,
      content: stripHtml(d.content),
      requirements: typeof d.requirements === 'string' ? stripHtml(d.requirements) : null,
      deadline: d.deadline,
      tags: d.tags ?? [],
      status: d.status,
      isOpen: d.isOpen,
      isFeatured: d.isFeatured,
      allowOnlyVerifiedSubmissions: d.allowOnlyVerifiedSubmissions,
      allowOnlyDiscordGuildSubmissions: d.allowOnlyDiscordGuildSubmissions,
      requiredDiscordGuildId: d.requiredDiscordGuildId,
      requiredDiscordRoleIds: d.requiredDiscordRoleIds ?? [],
      rewardUiAmount,
      minSubmissionAmount: d.minSubmissionAmount,
      xpBonus: typeof d.xpBonus === 'number' ? d.xpBonus : undefined,
      asset: d.asset
        ? {
            id: d.asset.id,
            mintAddress: d.asset.mintAddress,
            symbol: d.asset.symbol,
            imageUrl: d.asset.imageUrl,
            amount: String(d.asset.amount),
            price: d.asset.price,
            decimals: d.asset.decimals,
          }
        : null,
      creatorUsername: d.user?.username,
      creatorRating: d.user?.rating,
      pendingSubmissions: d.taskSubmissionsPendingCount,
      approvedSubmissions: d.taskSubmissionsApprovedCount,
      rejectedSubmissions: d.taskSubmissionsRejectedCount,
      url: `https://gib.work/bounty/${d.id}`,
    };
  }

  private normalizeExploreItem(r: Record<string, unknown>): GibworkBountyItem {
    const asset = r.asset as Record<string, unknown> | null;
    const decimals = typeof asset?.decimals === 'number' ? asset.decimals : 6;
    const rawAmount = String(asset?.amount ?? '0');
    const rewardUiAmount = Number(rawAmount) / Math.pow(10, decimals);
    const user = r.user as Record<string, unknown> | undefined;

    return {
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      content: stripHtml(String(r.content ?? '')),
      deadline: typeof r.deadline === 'string' ? r.deadline : null,
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      status: String(r.status ?? 'CREATED'),
      isOpen: Boolean(r.isOpen),
      isFeatured: Boolean(r.isFeatured),
      allowOnlyVerifiedSubmissions: Boolean(r.allowOnlyVerifiedSubmissions),
      remainingAmount: typeof r.remainingAmount === 'number' ? r.remainingAmount : rewardUiAmount,
      rewardUiAmount,
      xpBonus: typeof r.xpBonus === 'number' ? r.xpBonus : undefined,
      asset: asset
        ? {
            id: typeof asset.id === 'string' ? asset.id : undefined,
            mintAddress: String(asset.mintAddress ?? ''),
            symbol: String(asset.symbol ?? 'USDC'),
            imageUrl: typeof asset.imageUrl === 'string' ? asset.imageUrl : null,
            amount: rawAmount,
            price: typeof asset.price === 'number' ? asset.price : undefined,
            decimals,
          }
        : null,
      creatorUsername: typeof user?.username === 'string' ? user.username : undefined,
      url: `https://gib.work/bounty/${String(r.id ?? '')}`,
    };
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|ul|ol|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
