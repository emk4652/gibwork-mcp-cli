import { type CreateTaskInput, type PreparedTaskIntent, type CreateTaskResult } from '@gibwork/sdk';
import type { GibworkBountyItem, SolanaEscrowVerification, SkillMatchCandidate, SubmissionDraft } from './types.js';
export interface GibworkAgentServiceOptions {
    privateKey?: string;
    payoutWallet?: string;
    solanaRpcUrl?: string;
    exploreApiUrl?: string;
    sdkBaseUrl?: string;
    production?: boolean;
    fetchImpl?: typeof fetch;
}
export declare class GibworkAgentService {
    private readonly sdkClient;
    private readonly connection;
    private readonly exploreApiUrl;
    private readonly solanaRpcUrl;
    private readonly payoutWallet;
    private readonly fetchImpl;
    private readonly signerAddress;
    constructor(options?: GibworkAgentServiceOptions);
    getPayoutWallet(): string;
    getSignerWallet(): string;
    listBounties(filter?: {
        page?: number;
        limit?: number;
        onlyOpen?: boolean;
        minReward?: number;
        symbol?: string;
        tag?: string;
        search?: string;
    }): Promise<GibworkBountyItem[]>;
    getBounty(taskId: string): Promise<GibworkBountyItem>;
    verifySolanaEscrow(taskId: string, overridePayoutWallet?: string): Promise<SolanaEscrowVerification>;
    matchSkills(input: {
        skills: string[];
        minReward?: number;
        preferUsdc?: boolean;
    }): Promise<SkillMatchCandidate[]>;
    draftSubmission(input: {
        taskId: string;
        repoUrl: string;
        summary: string;
        deliverables: string[];
        demoUrl?: string;
        payoutWallet?: string;
        idempotencyKey?: string;
        executePrepareOnApi?: boolean;
    }): Promise<SubmissionDraft & {
        preparedIntent?: unknown;
    }>;
    createTask(input: {
        title: string;
        content: string;
        tags: string[];
        amountUsdc: string;
        minSubmissionAmountUsdc?: string;
        mintAddress?: string;
        deadline?: string;
        allowOnlyVerifiedSubmissions?: boolean;
        dryRun?: boolean;
    }): Promise<{
        mode: 'dry_run';
        sdkPayload: CreateTaskInput;
        signerWallet: string;
    } | {
        mode: 'prepared';
        intent: PreparedTaskIntent;
    } | {
        mode: 'submitted';
        result: CreateTaskResult;
    }>;
    private normalizeAvailableTask;
    private normalizeTaskDetails;
    private normalizeExploreItem;
}
export declare function stripHtml(html: string): string;
//# sourceMappingURL=service.d.ts.map