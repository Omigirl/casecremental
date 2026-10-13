// The player's Solana wallet (plan F8): which address the platform verified for this account, for the ◎ mark on the
// leaderboard. The platform fills LastWalletLogin / LinkedWallets only after the wallet signed its challenge (a wallet
// sign-in or a signature link), so a player cannot type an address in here. CloudCode cannot read this state
// (ReadUserData(["Blockchain"]) answers {} on ZVKC34TR-DEV, 2026-10-13), so the client sends what it reads with
// endRun and CloudCode publishes it - see cloudcode/casecremental.js publishWallet.

/** The Titles' Solana network key (cfg.Blockchain.Networks; src/walletLogin.tsx SOLANA_NETWORK_ID). */
export const SOLANA_NETWORK = "solana";

/** A base58 Solana address (32–44 characters, no 0, O, I or l). */
export const isSolanaAddress = (s: unknown): s is string => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

interface WalletRef {
  NetworkID?: string | null;
  Address?: string | null;
  LinkType?: string | null;
  IsSignatureVerified?: boolean | null;
}

/** The part of the SDK's UserBlockchainState (client.blockchain.getUserState().State) this reads. */
export interface BlockchainStateLike {
  LastWalletLogin?: WalletRef | null;
  LinkedWallets?: Record<string, WalletRef> | null;
}

/** The account's Solana address proven by a signature: the last wallet sign-in, else a wallet linked by signature. */
export function verifiedSolanaWallet(state: BlockchainStateLike | null | undefined): string | null {
  const last = state?.LastWalletLogin;
  if (last?.NetworkID === SOLANA_NETWORK && isSolanaAddress(last.Address)) return last.Address;
  for (const w of Object.values(state?.LinkedWallets ?? {}))
    if (
      w?.NetworkID === SOLANA_NETWORK &&
      isSolanaAddress(w.Address) &&
      (w.IsSignatureVerified === true || w.LinkType === "SignatureVerified")
    )
      return w.Address;
  return null;
}
