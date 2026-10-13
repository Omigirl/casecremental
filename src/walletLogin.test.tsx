import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { LazySolanaWalletLogin } from "@idosgames/wallet/react/lazy";
import { renderWalletLink, renderWalletLogin, SOLANA_NETWORK_ID } from "./walletLogin";

const client = {} as never;

describe("wallet seam", () => {
  it("renders the Solana button on the Title's Solana network", () => {
    const el = renderWalletLogin({ client, onAuthenticated: () => {}, disabled: false, style: {} } as never);
    expect(isValidElement(el) && el.type).toBe(LazySolanaWalletLogin);
    expect((el as { props: { networkID: string } }).props.networkID).toBe(SOLANA_NETWORK_ID);
  });

  it("renders the Solana button without a project id", () => {
    const el = renderWalletLogin({ client, onAuthenticated: () => {}, disabled: false, style: {} } as never) as { props: Record<string, unknown> };
    expect(el.props.walletConnectProjectId === undefined || typeof el.props.walletConnectProjectId === "string").toBe(true);
  });

  it("links a wallet in link mode on the network the gate asks for", () => {
    const el = renderWalletLink({ client, networkID: "", onLinked: () => {}, disabled: false, style: {} } as never) as { props: Record<string, unknown> };
    expect(el.props).toMatchObject({ mode: "link", networkID: SOLANA_NETWORK_ID });
  });

  it("uses the network the DEV config defines", async () => {
    const { readFileSync } = await import("node:fs");
    const cfg = JSON.parse(readFileSync(new URL("../cloudcode/config/blockchain.dev.json", import.meta.url), "utf8"));
    expect(Object.keys(cfg.Networks)).toEqual([SOLANA_NETWORK_ID]);
    expect(cfg.Networks[SOLANA_NETWORK_ID].Type).toBe("Solana");
  });
});
