import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import type { WalletSigner } from '@gibwork/sdk';

export const DEFAULT_PAYOUT_WALLET = '9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1';
export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export function parseKeypairFromSecret(secret?: string): Keypair {
  if (!secret || !secret.trim()) {
    // Generate deterministic ephemeral read-only keypair when no secret key is supplied
    const seed = new Uint8Array(32).fill(7);
    return Keypair.fromSeed(seed);
  }
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as number[];
    const bytes = Uint8Array.from(arr);
    return bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
  }
  const decoded = bs58.decode(trimmed);
  return decoded.length === 32 ? Keypair.fromSeed(decoded) : Keypair.fromSecretKey(decoded);
}

export function createKeypairWalletSigner(keypair: Keypair): WalletSigner {
  return {
    publicKey: keypair.publicKey,
    async signMessage(message: Uint8Array): Promise<Uint8Array> {
      return nacl.sign.detached(message, keypair.secretKey);
    },
    async signTransaction(transaction: VersionedTransaction): Promise<VersionedTransaction> {
      transaction.sign([keypair]);
      return transaction;
    },
  };
}

export function resolvePayoutWalletAddress(overrideAddress?: string): string {
  const candidate = overrideAddress || process.env.GIBWORK_PAYOUT_WALLET || DEFAULT_PAYOUT_WALLET;
  const pub = new PublicKey(candidate.trim());
  return pub.toBase58();
}
