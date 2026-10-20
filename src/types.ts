export interface GibworkBountyAsset {
  id?: string;
  mintAddress: string;
  symbol: string;
  imageUrl?: string | null;
  amount: string;
  price?: number;
  decimals: number;
}

export interface GibworkBountyItem {
  id: string;
  slug?: string;
  title: string;
  content: string;
  requirements?: string | null;
  deadline: string | null;
  tags: string[];
  status: string;
  isOpen: boolean;
  isFeatured?: boolean;
  allowOnlyVerifiedSubmissions: boolean;
  allowOnlyDiscordGuildSubmissions?: boolean;
  requiredDiscordGuildId?: string | null;
  requiredDiscordRoleIds?: string[];
  remainingAmount?: number;
  rewardUiAmount: number;
  minSubmissionAmount?: number | string | null;
  xpBonus?: number;
  asset: GibworkBountyAsset | null;
  creatorUsername?: string;
  creatorRating?: number;
  pendingSubmissions?: number;
  approvedSubmissions?: number;
  rejectedSubmissions?: number;
  url: string;
}

export interface SolanaEscrowVerification {
  bountyId: string;
  title: string;
  verified: boolean;
  network: 'mainnet-beta';
  rpcEndpoint: string;
  mintAddress: string;
  tokenSymbol: string;
  decimals: number;
  lockedBaseUnits: string;
  lockedUiAmount: number;
  remainingUiAmount: number;
  mintSupplyUi: string;
  mintInitialized: boolean;
  mintProgramOwner: string;
  payoutWallet: string;
  payoutWalletValidOnCurve: boolean;
  payoutWalletSolBalance: number;
  escrowStatus: 'LOCKED_ACTIVE' | 'CLOSED_OR_DEPLETED' | 'UNVERIFIED_ASSET';
  checkedAt: string;
}

export interface SkillMatchCandidate {
  bounty: GibworkBountyItem;
  matchedSkills: string[];
  matchScore: number;
  rewardDensityScore: number;
  recommendedAction: string;
}

export interface SubmissionDraft {
  taskId: string;
  bountyTitle: string;
  payoutWallet: string;
  idempotencyKey: string;
  htmlContent: string;
  markdownPreview: string;
  sdkInputPayload: {
    content: string;
    referral: string | null;
    mediaIds: string[];
    idempotencyKey: string;
  };
  createdAt: string;
}
