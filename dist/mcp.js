#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { GibworkAgentService } from './service.js';
import { DEFAULT_PAYOUT_WALLET } from './signer.js';
export const GIBWORK_MCP_TOOLS = [
    {
        name: 'gibwork_list_bounties',
        description: 'List active bounties on Gibwork using @gibwork/sdk and api.gib.work with optional filters for minimum reward, token symbol (USDC), tags, and search query.',
        inputSchema: {
            type: 'object',
            properties: {
                onlyOpen: {
                    type: 'boolean',
                    description: 'Return only open bounties (default: true)',
                },
                minReward: {
                    type: 'number',
                    description: 'Minimum reward pool in UI units (e.g. 100 for 100 USDC)',
                },
                symbol: {
                    type: 'string',
                    description: 'Filter by token symbol such as USDC',
                },
                tag: {
                    type: 'string',
                    description: 'Filter by category tag such as Development',
                },
                search: {
                    type: 'string',
                    description: 'Substring search across title and description',
                },
            },
        },
    },
    {
        name: 'gibwork_get_bounty',
        description: 'Retrieve complete details for a specific Gibwork bounty by UUID, including full requirements, Discord role rules, submission counts, and SPL token asset metadata.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: {
                    type: 'string',
                    description: 'UUID of the Gibwork bounty (e.g. 1052f22d-3f87-4b1d-b0d7-71a60679e7fa)',
                },
            },
            required: ['taskId'],
        },
    },
    {
        name: 'gibwork_verify_solana_escrow',
        description: 'Verify on-chain SPL token mint state on Solana Mainnet (USDC supply, decimals, mint initialization) and validate the configured Solana payout wallet for a Gibwork bounty.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: {
                    type: 'string',
                    description: 'UUID of the Gibwork bounty to verify',
                },
                payoutWallet: {
                    type: 'string',
                    description: `Solana payout wallet address (defaults to ${DEFAULT_PAYOUT_WALLET})`,
                },
            },
            required: ['taskId'],
        },
    },
    {
        name: 'gibwork_match_skills',
        description: 'Rank and filter open Gibwork bounties against an autonomous agent or developer skill stack, computing a match score (0-100) and reward density per pending submission.',
        inputSchema: {
            type: 'object',
            properties: {
                skills: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of technical skills or keywords (e.g. ["mcp", "cli", "sdk", "typescript", "solana"])',
                },
                minReward: {
                    type: 'number',
                    description: 'Minimum reward threshold in UI units',
                },
                preferUsdc: {
                    type: 'boolean',
                    description: 'Boost score for native USDC bounties (default: true)',
                },
            },
            required: ['skills'],
        },
    },
    {
        name: 'gibwork_draft_submission',
        description: 'Prepare a structured, idempotent submission payload compatible with @gibwork/sdk submissions.prepareCreate and linked to the target Solana payout wallet.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: {
                    type: 'string',
                    description: 'UUID of the target Gibwork bounty',
                },
                repoUrl: {
                    type: 'string',
                    description: 'Public GitHub repository URL for the completed deliverable',
                },
                summary: {
                    type: 'string',
                    description: 'Technical summary of the solution and Gibwork SDK/MCP/CLI integration',
                },
                deliverables: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of verified deliverables included in the submission',
                },
                demoUrl: {
                    type: 'string',
                    description: 'Optional URL to a terminal recording, demo video, or verification artifact',
                },
                payoutWallet: {
                    type: 'string',
                    description: `Solana payout wallet address (defaults to ${DEFAULT_PAYOUT_WALLET})`,
                },
            },
            required: ['taskId', 'repoUrl', 'summary', 'deliverables'],
        },
    },
    {
        name: 'gibwork_create_task',
        description: 'Create or dry-run a new Gibwork bounty task funded with SPL USDC using @gibwork/sdk TasksResource.',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Title of the bounty task',
                },
                content: {
                    type: 'string',
                    description: 'HTML or plain-text description of the task requirements',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Skill tags (e.g. ["Development", "Solana"])',
                },
                amountUsdc: {
                    type: 'string',
                    description: 'Total USDC reward amount (e.g. "100.00")',
                },
                minSubmissionAmountUsdc: {
                    type: 'string',
                    description: 'Minimum payout per approved submission (default: "5.00")',
                },
                deadline: {
                    type: 'string',
                    description: 'ISO-8601 deadline timestamp',
                },
                dryRun: {
                    type: 'boolean',
                    description: 'When true (default), validates and returns the normalized SDK payload without broadcasting a Solana debit transaction',
                },
            },
            required: ['title', 'content', 'tags', 'amountUsdc'],
        },
    },
];
export async function executeMcpToolCall(service, name, args = {}) {
    try {
        switch (name) {
            case 'gibwork_list_bounties': {
                const results = await service.listBounties({
                    onlyOpen: typeof args.onlyOpen === 'boolean' ? args.onlyOpen : true,
                    minReward: typeof args.minReward === 'number' ? args.minReward : undefined,
                    symbol: typeof args.symbol === 'string' ? args.symbol : undefined,
                    tag: typeof args.tag === 'string' ? args.tag : undefined,
                    search: typeof args.search === 'string' ? args.search : undefined,
                });
                return {
                    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
                };
            }
            case 'gibwork_get_bounty': {
                if (typeof args.taskId !== 'string' || !args.taskId.trim()) {
                    throw new Error('taskId is required');
                }
                const bounty = await service.getBounty(args.taskId);
                return {
                    content: [{ type: 'text', text: JSON.stringify(bounty, null, 2) }],
                };
            }
            case 'gibwork_verify_solana_escrow': {
                if (typeof args.taskId !== 'string' || !args.taskId.trim()) {
                    throw new Error('taskId is required');
                }
                const verification = await service.verifySolanaEscrow(args.taskId, typeof args.payoutWallet === 'string' ? args.payoutWallet : undefined);
                return {
                    content: [{ type: 'text', text: JSON.stringify(verification, null, 2) }],
                };
            }
            case 'gibwork_match_skills': {
                const skills = Array.isArray(args.skills) ? args.skills.map(String) : [];
                if (skills.length === 0) {
                    throw new Error('skills must be a non-empty array of strings');
                }
                const matches = await service.matchSkills({
                    skills,
                    minReward: typeof args.minReward === 'number' ? args.minReward : undefined,
                    preferUsdc: typeof args.preferUsdc === 'boolean' ? args.preferUsdc : true,
                });
                return {
                    content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
                };
            }
            case 'gibwork_draft_submission': {
                if (typeof args.taskId !== 'string' || typeof args.repoUrl !== 'string' || typeof args.summary !== 'string') {
                    throw new Error('taskId, repoUrl, and summary are required');
                }
                const deliverables = Array.isArray(args.deliverables) ? args.deliverables.map(String) : [];
                const draft = await service.draftSubmission({
                    taskId: args.taskId,
                    repoUrl: args.repoUrl,
                    summary: args.summary,
                    deliverables,
                    demoUrl: typeof args.demoUrl === 'string' ? args.demoUrl : undefined,
                    payoutWallet: typeof args.payoutWallet === 'string' ? args.payoutWallet : undefined,
                });
                return {
                    content: [{ type: 'text', text: JSON.stringify(draft, null, 2) }],
                };
            }
            case 'gibwork_create_task': {
                if (typeof args.title !== 'string' ||
                    typeof args.content !== 'string' ||
                    typeof args.amountUsdc !== 'string') {
                    throw new Error('title, content, and amountUsdc are required');
                }
                const tags = Array.isArray(args.tags) ? args.tags.map(String) : ['Development'];
                const created = await service.createTask({
                    title: args.title,
                    content: args.content,
                    tags,
                    amountUsdc: args.amountUsdc,
                    minSubmissionAmountUsdc: typeof args.minSubmissionAmountUsdc === 'string' ? args.minSubmissionAmountUsdc : '5.00',
                    deadline: typeof args.deadline === 'string' ? args.deadline : undefined,
                    dryRun: typeof args.dryRun === 'boolean' ? args.dryRun : true,
                });
                return {
                    content: [{ type: 'text', text: JSON.stringify(created, null, 2) }],
                };
            }
            default:
                throw new Error(`Unknown MCP tool: ${name}`);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            isError: true,
            content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        };
    }
}
export function createGibworkMcpServer(options = {}) {
    const service = new GibworkAgentService(options);
    const server = new Server({
        name: '@emk4652/gibwork-mcp-cli',
        version: '1.0.0',
    }, {
        capabilities: {
            tools: {},
        },
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: GIBWORK_MCP_TOOLS,
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const toolArgs = (request.params.arguments ?? {});
        return executeMcpToolCall(service, toolName, toolArgs);
    });
    return { server, service };
}
export async function runStdioMcpServer(options = {}) {
    const { server } = createGibworkMcpServer(options);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
const isMainModule = process.argv[1] &&
    (process.argv[1].endsWith('mcp.js') || process.argv[1].endsWith('mcp.ts'));
if (isMainModule) {
    runStdioMcpServer().catch((err) => {
        process.stderr.write(`Fatal error in Gibwork MCP Server: ${String(err)}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=mcp.js.map