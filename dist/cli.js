#!/usr/bin/env node
import { Command } from 'commander';
import { GibworkAgentService } from './service.js';
import { DEFAULT_PAYOUT_WALLET } from './signer.js';
export function buildCliProgram(serviceInstance) {
    const program = new Command();
    program
        .name('gibwork-kit')
        .description('Autonomous Developer Agent Kit & CLI for Gibwork Bounties and Solana SPL USDC Escrow Verification')
        .version('1.0.0')
        .option('-w, --wallet <address>', 'Solana payout wallet address', DEFAULT_PAYOUT_WALLET)
        .option('-r, --rpc <url>', 'Solana Mainnet RPC URL', 'https://api.mainnet-beta.solana.com')
        .option('--json', 'Output raw JSON instead of formatted monospace tables', false);
    const getService = (cmdObj) => {
        if (serviceInstance)
            return serviceInstance;
        const opts = cmdObj.optsWithGlobals();
        return new GibworkAgentService({
            payoutWallet: opts.wallet,
            solanaRpcUrl: opts.rpc,
        });
    };
    program
        .command('list')
        .description('List open bounties on Gibwork with real-time reward pool and KYC status')
        .option('-m, --min-reward <amount>', 'Minimum reward amount in UI units', '0')
        .option('-s, --symbol <symbol>', 'Filter by token symbol (e.g. USDC)')
        .option('-t, --tag <tag>', 'Filter by tag (e.g. Development)')
        .option('-q, --search <query>', 'Substring search in title or content')
        .action(async (options, cmd) => {
        const globalOpts = cmd.optsWithGlobals();
        const service = getService(cmd);
        const bounties = await service.listBounties({
            onlyOpen: true,
            minReward: Number(options.minReward || 0),
            symbol: options.symbol,
            tag: options.tag,
            search: options.search,
        });
        if (globalOpts.json) {
            process.stdout.write(JSON.stringify(bounties, null, 2) + '\n');
            return;
        }
        process.stdout.write(`\nGIBWORK ACTIVE BOUNTIES (${bounties.length} MATCHED) | PAYOUT WALLET: ${service.getPayoutWallet()}\n`);
        process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n');
        process.stdout.write(`${pad('ID', 38)} | ${pad('REWARD', 14)} | ${pad('KYC', 7)} | ${pad('DEADLINE', 12)} | TITLE\n`);
        process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n');
        for (const b of bounties) {
            const rewardStr = `${b.rewardUiAmount.toFixed(2)} ${b.asset?.symbol ?? 'USDC'}`;
            const kycStr = b.allowOnlyVerifiedSubmissions ? 'REQ' : '0% KYC';
            const deadlineStr = b.deadline ? b.deadline.slice(0, 10) : 'NONE';
            const titleStr = b.title.length > 40 ? b.title.slice(0, 37) + '...' : b.title;
            process.stdout.write(`${pad(b.id, 38)} | ${pad(rewardStr, 14)} | ${pad(kycStr, 7)} | ${pad(deadlineStr, 12)} | ${titleStr}\n`);
        }
        process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n\n');
    });
    program
        .command('inspect <id>')
        .description('Inspect full technical requirements, submission counts, and asset details for a bounty')
        .action(async (id, _options, cmd) => {
        const globalOpts = cmd.optsWithGlobals();
        const service = getService(cmd);
        const bounty = await service.getBounty(id);
        if (globalOpts.json) {
            process.stdout.write(JSON.stringify(bounty, null, 2) + '\n');
            return;
        }
        process.stdout.write('\n================================================================================\n');
        process.stdout.write(`BOUNTY INSPECTION: ${bounty.title}\n`);
        process.stdout.write('================================================================================\n');
        process.stdout.write(`Task ID            : ${bounty.id}\n`);
        process.stdout.write(`Public URL         : ${bounty.url}\n`);
        process.stdout.write(`Status             : ${bounty.status} (Open: ${bounty.isOpen})\n`);
        process.stdout.write(`Reward Pool        : ${bounty.rewardUiAmount.toFixed(2)} ${bounty.asset?.symbol ?? 'USDC'} (${bounty.asset?.amount ?? '0'} base units)\n`);
        process.stdout.write(`SPL Mint Address   : ${bounty.asset?.mintAddress ?? 'N/A'}\n`);
        process.stdout.write(`KYC Policy         : ${bounty.allowOnlyVerifiedSubmissions ? 'Verified Only' : '0% KYC (Open Permissionless)'}\n`);
        process.stdout.write(`Deadline           : ${bounty.deadline ?? 'No deadline'}\n`);
        process.stdout.write(`Tags               : ${bounty.tags.join(', ') || 'None'}\n`);
        process.stdout.write(`Submissions        : Pending=${bounty.pendingSubmissions ?? 0} | Approved=${bounty.approvedSubmissions ?? 0} | Rejected=${bounty.rejectedSubmissions ?? 0}\n`);
        process.stdout.write(`Target Wallet      : ${service.getPayoutWallet()}\n`);
        process.stdout.write('--------------------------------------------------------------------------------\n');
        process.stdout.write('DESCRIPTION & REQUIREMENTS:\n\n');
        process.stdout.write(`${bounty.content}\n`);
        process.stdout.write('================================================================================\n\n');
    });
    program
        .command('verify-escrow <id>')
        .description('Verify on-chain SPL USDC token state on Solana Mainnet and validate payout wallet readiness')
        .action(async (id, _options, cmd) => {
        const globalOpts = cmd.optsWithGlobals();
        const service = getService(cmd);
        const report = await service.verifySolanaEscrow(id, globalOpts.wallet);
        if (globalOpts.json) {
            process.stdout.write(JSON.stringify(report, null, 2) + '\n');
            return;
        }
        process.stdout.write('\n================================================================================\n');
        process.stdout.write(`SOLANA MAINNET ESCROW VERIFICATION: ${report.escrowStatus}\n`);
        process.stdout.write('================================================================================\n');
        process.stdout.write(`Bounty ID          : ${report.bountyId}\n`);
        process.stdout.write(`Bounty Title       : ${report.title}\n`);
        process.stdout.write(`Solana Network     : ${report.network} (${report.rpcEndpoint})\n`);
        process.stdout.write(`SPL Token Mint     : ${report.mintAddress} (${report.tokenSymbol})\n`);
        process.stdout.write(`Mint Program Owner : ${report.mintProgramOwner}\n`);
        process.stdout.write(`Mint Initialized   : ${report.mintInitialized}\n`);
        process.stdout.write(`Mainnet Supply     : ${report.mintSupplyUi} ${report.tokenSymbol}\n`);
        process.stdout.write(`Escrow Locked Pool : ${report.lockedUiAmount.toFixed(2)} ${report.tokenSymbol} (${report.lockedBaseUnits} raw)\n`);
        process.stdout.write(`Remaining Pool     : ${report.remainingUiAmount.toFixed(2)} ${report.tokenSymbol}\n`);
        process.stdout.write(`Payout Wallet      : ${report.payoutWallet}\n`);
        process.stdout.write(`Ed25519 On-Curve   : ${report.payoutWalletValidOnCurve}\n`);
        process.stdout.write(`Wallet SOL Balance : ${report.payoutWalletSolBalance.toFixed(6)} SOL\n`);
        process.stdout.write(`Timestamp          : ${report.checkedAt}\n`);
        process.stdout.write('================================================================================\n\n');
    });
    program
        .command('watch')
        .description('Scan and rank Gibwork bounties matching developer skills (single pass or polling interval)')
        .option('-s, --skills <skills>', 'Comma-separated list of agent skills', 'mcp,cli,sdk,typescript,solana,node')
        .option('-m, --min-reward <amount>', 'Minimum USDC reward threshold', '50')
        .option('-i, --interval <seconds>', 'Poll interval in seconds (0 for single execution)', '0')
        .action(async (options, cmd) => {
        const globalOpts = cmd.optsWithGlobals();
        const service = getService(cmd);
        const skills = String(options.skills)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const minReward = Number(options.minReward || 0);
        const intervalSec = Number(options.interval || 0);
        const runCycle = async () => {
            const matches = await service.matchSkills({
                skills,
                minReward,
                preferUsdc: true,
            });
            if (globalOpts.json) {
                process.stdout.write(JSON.stringify(matches, null, 2) + '\n');
                return;
            }
            process.stdout.write(`\n[${new Date().toISOString()}] SKILL MATCH SCANNER | SKILLS: ${skills.join(', ')}\n`);
            process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n');
            process.stdout.write(`${pad('SCORE', 7)} | ${pad('ACTION', 21)} | ${pad('REWARD', 14)} | ${pad('MATCHED SKILLS', 26)} | TITLE\n`);
            process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n');
            for (const m of matches) {
                const rewardStr = `${m.bounty.rewardUiAmount.toFixed(2)} ${m.bounty.asset?.symbol ?? 'USDC'}`;
                const matchedStr = m.matchedSkills.join(', ') || 'none';
                const titleStr = m.bounty.title.length > 36 ? m.bounty.title.slice(0, 33) + '...' : m.bounty.title;
                process.stdout.write(`${pad(`${m.matchScore}/100`, 7)} | ${pad(m.recommendedAction, 21)} | ${pad(rewardStr, 14)} | ${pad(matchedStr.slice(0, 26), 26)} | ${titleStr}\n`);
            }
            process.stdout.write('--------------------------------------------------------------------------------------------------------------------\n\n');
        };
        await runCycle();
        if (intervalSec > 0) {
            setInterval(() => {
                runCycle().catch((err) => {
                    process.stderr.write(`Watch cycle error: ${String(err)}\n`);
                });
            }, intervalSec * 1000);
        }
    });
    program
        .command('draft-submission <id>')
        .description('Generate an idempotent @gibwork/sdk submission payload bound to the Solana payout wallet')
        .requiredOption('--repo <url>', 'Public GitHub repository URL')
        .requiredOption('--summary <text>', 'Concise technical summary of the implementation')
        .option('--deliverables <items>', 'Comma-separated deliverables list', 'MCP Server,CLI Tool,Unit Tests,README Documentation')
        .option('--demo <url>', 'Optional demo video or terminal log URL')
        .action(async (id, options, cmd) => {
        const globalOpts = cmd.optsWithGlobals();
        const service = getService(cmd);
        const deliverables = String(options.deliverables)
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);
        const draft = await service.draftSubmission({
            taskId: id,
            repoUrl: options.repo,
            summary: options.summary,
            deliverables,
            demoUrl: options.demo,
            payoutWallet: globalOpts.wallet,
        });
        if (globalOpts.json) {
            process.stdout.write(JSON.stringify(draft, null, 2) + '\n');
            return;
        }
        process.stdout.write('\n================================================================================\n');
        process.stdout.write(`SUBMISSION DRAFT READY: ${draft.bountyTitle}\n`);
        process.stdout.write('================================================================================\n');
        process.stdout.write(`${draft.markdownPreview}\n`);
        process.stdout.write('--------------------------------------------------------------------------------\n');
        process.stdout.write('SDK PAYLOAD (submissions.prepareCreate):\n');
        process.stdout.write(JSON.stringify(draft.sdkInputPayload, null, 2) + '\n');
        process.stdout.write('================================================================================\n\n');
    });
    return program;
}
function pad(value, length) {
    if (value.length >= length)
        return value.slice(0, length);
    return value + ' '.repeat(length - value.length);
}
const isMainModule = process.argv[1] &&
    (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'));
if (isMainModule) {
    const program = buildCliProgram();
    program.parseAsync(process.argv).catch((err) => {
        process.stderr.write(`CLI Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map