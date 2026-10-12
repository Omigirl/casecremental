import { describe, expect, it } from "vitest";
import { isSolanaAddress, verifiedSolanaWallet } from "./wallet";

const W = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

describe("the player's Solana wallet", () => {
  it("knows a base58 Solana address", () => {
    expect(isSolanaAddress(W)).toBe(true);
    expect(isSolanaAddress("0x1234")).toBe(false);
    expect(isSolanaAddress("0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl")).toBe(false); // not base58
    expect(isSolanaAddress("")).toBe(false);
    expect(isSolanaAddress(42)).toBe(false);
  });

  it("reads the wallet the platform verified: the last wallet sign-in, else a wallet linked by signature", () => {
    // the shape client.blockchain.getUserState() answered on ZVKC34TR-DEV after loginWithWalletSolana (2026-10-13)
    const signedIn = {
      LinkedWallets: { solana: { NetworkID: "solana", Address: W, LinkType: "SignatureVerified", IsSignatureVerified: true } },
      LastWalletLogin: { NetworkID: "solana", Address: W, GatePassed: true },
    };
    expect(verifiedSolanaWallet(signedIn)).toBe(W);
    expect(verifiedSolanaWallet({ LinkedWallets: { solana: { NetworkID: "solana", Address: W, IsSignatureVerified: true } } })).toBe(W);
    expect(verifiedSolanaWallet({ LinkedWallets: { [W]: { NetworkID: "solana", Address: W, LinkType: "SignatureVerified" } } })).toBe(W);
  });

  it("ignores another network, an unproven link, a malformed address, and no state", () => {
    expect(verifiedSolanaWallet({ LastWalletLogin: { NetworkID: "bsc", Address: "0x12ab" }, LinkedWallets: {} })).toBeNull();
    expect(
      verifiedSolanaWallet({ LinkedWallets: { solana: { NetworkID: "solana", Address: W, LinkType: "AutoLinkedFromTransaction" } } }),
    ).toBeNull();
    expect(verifiedSolanaWallet({ LastWalletLogin: { NetworkID: "solana", Address: "<script>" } })).toBeNull();
    expect(verifiedSolanaWallet({ LinkedWallets: null, LastWalletLogin: null })).toBeNull();
    expect(verifiedSolanaWallet(null)).toBeNull();
    expect(verifiedSolanaWallet(undefined)).toBeNull();
  });
});
