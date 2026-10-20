import { Keypair } from '@solana/web3.js';
import type { WalletSigner } from '@gibwork/sdk';
export declare const DEFAULT_PAYOUT_WALLET = "9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1";
export declare const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export declare function parseKeypairFromSecret(secret?: string): Keypair;
export declare function createKeypairWalletSigner(keypair: Keypair): WalletSigner;
export declare function resolvePayoutWalletAddress(overrideAddress?: string): string;
//# sourceMappingURL=signer.d.ts.map