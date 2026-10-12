import { LazySolanaWalletLogin } from "@idosgames/wallet/react/lazy";
import type { RenderLinkWallet } from "@idosgames/app-shell";
import type { LoginScreenExtras } from "./base/login/LoginScreen";
import { ENV_WALLETCONNECT_PROJECT_ID } from "./env";
import {
  IDOS_WEB3_NETWORK_ID,
  IDOS_WEB3_WALLETCONNECT_PROJECT_ID,
} from "./idos.title";

// Wallet sign-in seam — Casecremental signs in with SOLANA wallets (plan F8).
//
// The challenge is issued on the Title's Solana network. Its key is "solana" on both Titles: mainnet on the live
// Title (the one that already carries its FOMO token), devnet on ZVKC34TR-DEV (for the NFT spike). Signing the
// challenge is an off-chain signMessage — no transaction, no fee — so the cluster does not matter for sign-in.
// IDOS_WEB3_NETWORK_ID (baked by the platform) wins when it is set; this Title was created as web2, so it is empty.
//
// "@idosgames/wallet/react/lazy" keeps Reown AppKit out of the first load until the player taps the button, and
// inside the idosgames.com frame it signs through the site's wallet. walletConnectProjectId is required even on
// desktop (F8 found sign-in does not work without it); it also adds phone wallets (QR / deep link).
//
// Guardrail: the wallet is an identity here, nothing else. Cases are bought only with in-game cash; the game has
// no deposit or withdraw UI (the lobby wallet panel stays hidden on this web2 Title).

/** The Title's Solana network key (cfg.Blockchain.Networks). */
export const SOLANA_NETWORK_ID = "solana";

const projectId = (): string | undefined =>
  IDOS_WEB3_WALLETCONNECT_PROJECT_ID || ENV_WALLETCONNECT_PROJECT_ID || undefined;

export const renderWalletLogin: LoginScreenExtras["renderWalletLogin"] = ({
  client,
  onAuthenticated,
  disabled,
  style,
  label,
}) => (
  <LazySolanaWalletLogin
    client={client}
    networkID={IDOS_WEB3_NETWORK_ID || SOLANA_NETWORK_ID}
    onAuthenticated={onAuthenticated}
    disabled={disabled}
    style={style}
    label={label}
    appName="Casecremental"
    walletConnectProjectId={projectId()}
  />
);

// "Link wallet" on the play-access screen (./base/login/PlayAccessScreen) — the same button in link mode.
export const renderWalletLink: RenderLinkWallet = ({
  client,
  networkID,
  onLinked,
  disabled,
  style,
}) => (
  <LazySolanaWalletLogin
    mode="link"
    client={client}
    networkID={networkID || IDOS_WEB3_NETWORK_ID || SOLANA_NETWORK_ID}
    onLinked={onLinked}
    disabled={disabled}
    style={style}
    appName="Casecremental"
    walletConnectProjectId={projectId()}
  />
);
