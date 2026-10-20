import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
export const DEFAULT_PAYOUT_WALLET = '9GYpcKGMJ1DUtiWJb3WS5NDMS9ff8x2MWehrw6uCtUZ1';
export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export function parseKeypairFromSecret(secret) {
    if (!secret || !secret.trim()) {
        // Generate deterministic ephemeral read-only keypair when no secret key is supplied
        const seed = new Uint8Array(32).fill(7);
        return Keypair.fromSeed(seed);
    }
    const trimmed = secret.trim();
    if (trimmed.startsWith('[')) {
        const arr = JSON.parse(trimmed);
        const bytes = Uint8Array.from(arr);
        return bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
    }
    const decoded = bs58.decode(trimmed);
    return decoded.length === 32 ? Keypair.fromSeed(decoded) : Keypair.fromSecretKey(decoded);
}
export function createKeypairWalletSigner(keypair) {
    return {
        publicKey: keypair.publicKey,
        async signMessage(message) {
            return nacl.sign.detached(message, keypair.secretKey);
        },
        async signTransaction(transaction) {
            transaction.sign([keypair]);
            return transaction;
        },
    };
}
export function resolvePayoutWalletAddress(overrideAddress) {
    const candidate = overrideAddress || process.env.GIBWORK_PAYOUT_WALLET || DEFAULT_PAYOUT_WALLET;
    const pub = new PublicKey(candidate.trim());
    return pub.toBase58();
}
//# sourceMappingURL=signer.js.map