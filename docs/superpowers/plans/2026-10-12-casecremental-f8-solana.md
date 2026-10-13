# Casecremental F8 — Solana — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can sign in with a Solana wallet, wallet players show as such on the `best_run` leaderboard, and a time-boxed devnet spike decides whether a ★ trophy can be withdrawn as a Solana NFT — kept if it works end to end, cut (with the reason written down) if not.

**Architecture:** Sign-in is the SDK's ready-made `LazySolanaWalletLogin` (`@idosgames/wallet/react/lazy`) dropped into the existing wallet seam `src/walletLogin.tsx`, challenged on the Title's Solana network `solana`. The leaderboard learns who is a wallet player from the server: F7's `endRun` copies the player's verified Solana address (from `server.ReadUserData`) into the Public user-data key `cc_wallet`, and the Leaderboard tab reads those keys for the listed players (`client.userCustomData.batchGetPublicUserCustomDataOf`). The NFT spike uses `client.blockchain.requestNFTWithdrawal` on `ZVKC34TR-DEV` with devnet and decides by a written cut rule.

> **Outcome (2026-10-13): the wallet mark is NOT server-verified.** A DEV probe found CloudCode cannot read a player's
> Blockchain data (`server.ReadUserData(["Blockchain"])` answers `{}`), so `endRun` publishes the address the client
> reads from `client.blockchain.getUserState()` and sends with the call; CloudCode checks only its format. The ◎ mark is
> client-sent and cosmetic, like best_run. Where this plan (and commit f50f574's subject) says the server verifies the
> address, read it that way — see `docs/feature-history/casecremental-finish.md` § F8.

**Tech Stack:** `@idosgames/wallet` 0.6.2 (`LazySolanaWalletLogin`, `loginWithWalletSolana`), `@idosgames/core` 0.21.2 (`client.blockchain.*`, `client.userCustomData.*`, `NoopPlatformAdapter`), `@solana/web3.js` 1.98.4, Reown AppKit 1.8.23 (already in `package.json`), the idosgames MCP (`get_blockchain` / `save_blockchain`, `publish_cloud_code`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-casecremental-finish-design.md` §9 (binding: wallet sign-in; wallet-linked players on the leaderboard; the ★ NFT spike on devnet via `client.blockchain.requestNFTWithdrawal`, cut if it fails, reason in the feature history; the guardrail), with §1 and §11. The original design: base spec `docs/superpowers/specs/2026-10-07-casecremental-design.md` §11. **F7 lands first** (`docs/superpowers/plans/2026-10-12-casecremental-f7-server-meta.md`): this plan extends its `cloudcode/casecremental.js`, its `ui/lobby/Leaderboard.tsx` and its user-data key `cc_wallet`. Before Task 1 read the F7 section of `docs/feature-history/casecremental-finish.md` and `cloudcode/probe.js`'s verdict.

**What exists today (read 2026-10-12):**
- Live `ZVKC34TR` already has a Blockchain section: network `solana` (Type Solana, ChainID 0 = mainnet, NFT withdrawals switched on, `NftCollections: []`), wallet login **off**, account safety with a 7-day minimum account age; and the protected crypto currency `Main` ("FOMO", mint `D3Ca3V8nhwgcHn1dvikjbCTHaQ3zHrQKi1Q7mbaCidos` on that network) with its IOU `Main_IOU`.
- `ZVKC34TR-DEV` has **no** Blockchain section.
- `src/idos.title.ts` (platform-owned) says `IDOS_WEB3 = false`, `IDOS_WEB3_NETWORK_ID = ""`, so the lobby's wallet panel stays hidden (`src/base/lobby/model.ts` `hasWallet`) — which is what we want: no deposit/withdraw UI, no token in the game.
- `src/walletLogin.tsx` (ours, "safe to edit") renders the **EVM** `LazyWalletLogin` with the fallback network `"bsc"` — on this Title that network does not exist, so today the wallet button would fail.
- `@idosgames/wallet`: Solana sign-in exists (`LazySolanaWalletLogin`, `SolanaWalletLogin`, `loginWithWalletSolana`, link mode included; inside the idosgames.com frame it signs through the site). Solana **token** withdrawals exist (`useSolanaBridge`, `createPlatformPoolAdapter` → the pool program's `withdraw_spl`). There is **no Solana NFT withdrawal helper** — `withdrawNft` / `submitEvmNftWithdrawal` are EVM-only; the core `requestNFTWithdrawal(itemID, networkID, walletAddress, amount, category?, level?, itemInstanceID?)` returns a `SolanaSignature` for Solana, but submitting it on chain is left to the game. Items bind to Solana as `Item.NFT.Networks.solana = { ContractAddress: <mint>, TokenStandard: "SPL" | "Metaplex", TokenID }`, and a network's `NftCollections` binds a collection mint to an item catalog.

**Decision — mainnet or devnet:** one network key, **`solana`**, on both Titles, so the client has one constant. **Live keeps its existing mainnet network** (it already carries the Title's FOMO token; wallet sign-in is an off-chain signature — no transaction, no fee, no SOL needed — so mainnet costs players nothing and matches the wallets they actually use). **DEV gets `solana` on devnet** (ChainID 103, which `@idosgames/wallet` maps to devnet), because the NFT spike must not touch real assets. Sign-in itself works the same on either.

**Needs the user (ask once, at the start of Task 1):**
1. A **Reown / WalletConnect project id** (free at dashboard.reown.com). It is public, not a secret, and goes into the Title's `Blockchain.WalletLogin.WalletConnectProjectId` (the platform bakes it into `src/idos.title.ts`) and, for local runs, `VITE_WALLETCONNECT_PROJECT_ID` in `.env.local`. Without it desktop extension wallets (Phantom, Solflare) still work; **phone wallets do not**.
2. A Solana wallet extension (Phantom) in the browser for the one manual sign-in check (Task 1 Step 7); the agent cannot sign for them.
3. Go-ahead to switch on wallet sign-in on the **live** Title (Task 1 Step 3).

## Global Constraints

- Every player-facing string exists in EN (`i18n/en.ts`) and RU (`i18n/ru.ts`) and fits `i18n/budgets.ts`; Russian has exactly the English keys; whole-word wrapping.
- Never put secrets, keys or tokens in client code or in `cloudcode/`. A WalletConnect project id is public by design; a devnet keypair used by a spike script lives only in the scratchpad and is never committed.
- SDK calls return `OperationResult` (`isOk` / `isFail`) and never throw; `@idosgames/wallet` flows return `{ ok: false, stage, error }`. A failed wallet call never blocks play or the other sign-in methods.
- Use only APIs present in `node_modules/@idosgames/*/dist/*.d.ts` (checked for this plan: `LazySolanaWalletLogin` props, `loginWithWalletSolana`, `client.blockchain.requestNFTWithdrawal/retryWithdrawal/confirmWithdrawal/getUserState/getDefinitions`, `client.userCustomData.batchGetPublicUserCustomDataOf`, `NoopPlatformAdapter`). Never invent one.
- **Guardrail:** cases are bought only with in-game cash, never crypto or real money. No store offer, case, vault or perk may be priced in `Main`/FOMO or any crypto; the lobby wallet panel stays hidden; nothing in this plan adds a deposit path.
- IDOS module boundaries; do not edit `src/modules.ts`, `src/config.ts`, `src/idos.title.ts`, `idos.modules.lock.json`. `src/walletLogin.tsx` is the seam meant for this.
- File size rule (IDOS.md) as in F7.
- Every commit keeps green: `npm run typecheck`, `npx vitest run src/modules/casecremental cloudcode`, `npm run build`.
- Commit messages `feat(solana): …` / `docs(solana): …`, ending with (after a blank line):
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S
  ```
- Stage by path; never stage `docs/todo.md`, the `{…}.png` files or untracked `art/source/audio/*`. Stay on `casecremental-finish`.
- Every `save_blockchain` replaces the whole Blockchain section: `get_blockchain` first, change only what the step names, send the rest back.

## Review Focus

1. **Signing in from inside the idosgames.com frame.** The tap must go through the site's wallet, not die silently. `LazySolanaWalletLogin` does this by itself (`loginWithWalletViaPlatform`); keep it the lazy component, never the eager one. Check: Task 1 Step 7 (frame case named in the check list).
2. **A wallet that cannot sign messages, or the player cancels the signature.** The error shows under the button and the guest / e-mail sign-ins still work. Check: Task 1 Step 7.
3. **No WalletConnect project id.** Desktop extension wallets still work; nothing crashes on the login screen. Test: Task 1, "renders the Solana button without a project id".
4. **A leaderboard with players who have no wallet, a wallet but no name, or a name and a wallet.** No badge / short address / name, never a crash when `cc_wallet` is missing or garbage. Test: Task 2, "shows a wallet only when it looks like a Solana address".
5. **The NFT spike debits a trophy and then fails on chain.** The item must come back (pending-withdrawal TTL or `retryWithdrawal`), and the spike runs only on a throwaway DEV account. Check: Task 3, Step 5 and the cut rule.

---

### Task 1: Solana wallet sign-in

**Files:**
- Create: `cloudcode/config/blockchain.dev.json`, `src/walletLogin.test.tsx`
- Modify: `src/walletLogin.tsx`

**Interfaces:**
- Produces: `export const SOLANA_NETWORK_ID = "solana"` in `src/walletLogin.tsx`; `renderWalletLogin` and `renderWalletLink` render `LazySolanaWalletLogin`. Both Titles: `Blockchain.WalletLogin.Enabled = true`, network key `solana`.

- [ ] **Step 1: Ask the user** the three questions in "Needs the user" above. Continue with an empty project id if they have none yet (note it for the feature history).

- [ ] **Step 2: DEV blockchain config.** Write `cloudcode/config/blockchain.dev.json`:
  ```json
  {
    "SystemState": { "DepositsEnabled": false, "WithdrawalsEnabled": false, "NftDepositsEnabled": false, "NftWithdrawalsEnabled": true, "PlatformOverrides": { "Ios": true, "Android": true, "Web": true } },
    "Networks": {
      "solana": {
        "NetworkID": "solana",
        "DisplayName": "Solana devnet",
        "Type": "Solana",
        "ChainID": 103,
        "ChainConfigVersion": 3,
        "DepositsEnabled": false,
        "WithdrawalsEnabled": false,
        "NftDepositsEnabled": false,
        "NftWithdrawalsEnabled": true,
        "PlatformOverrides": { "Ios": true, "Android": true, "Web": true },
        "NftCollections": []
      }
    },
    "AccountSafety": { "MinAccountAgeDays": 0, "MultiAccountCheckEnabled": false, "BanOnSharedWithdrawalAddress": false, "PendingWithdrawalTtlHours": 1 },
    "WalletLogin": { "Enabled": true, "WalletConnectProjectId": "" }
  }
  ```
  (Put the user's project id in `WalletConnectProjectId` if given.) Load `select:mcp__idosgames__get_blockchain,mcp__idosgames__save_blockchain`. `get_blockchain` (DEV) → expect empty; `save_blockchain` (DEV) with the file; `get_blockchain` again and record what the engine filled in (`RewardPoolAddress`, `RpcUrl`, `ChainTicker` come from the platform registry) — Task 3 needs `RewardPoolAddress`. If the save rejects ChainID 103, retry with `"ChainID": 0` and note that DEV is then on mainnet (Task 3 must then be cut without on-chain steps).

- [ ] **Step 3: Live — wallet login on, nothing else touched** (only with the user's go-ahead). `get_blockchain` (live), keep the output in the scratchpad as the rollback, then `save_blockchain` (live) with the same object except `WalletLogin` = `{ "Enabled": true, "WalletConnectProjectId": "<id or empty>" }`. Read back: network `solana`, `Main`'s settings and account safety unchanged.

- [ ] **Step 4: Write the failing test** `src/walletLogin.test.tsx`:
  ```tsx
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
  ```
  Run: `npx vitest run src/walletLogin.test.tsx` — Expected: FAIL (`SOLANA_NETWORK_ID` is not exported; the element is `LazyWalletLogin`).

- [ ] **Step 5: Rewrite `src/walletLogin.tsx`.**
  ```tsx
  import { LazySolanaWalletLogin } from "@idosgames/wallet/react/lazy";
  import type { RenderLinkWallet } from "@idosgames/app-shell";
  import type { LoginScreenExtras } from "./base/login/LoginScreen";
  import { ENV_WALLETCONNECT_PROJECT_ID } from "./env";
  import { IDOS_WEB3_NETWORK_ID, IDOS_WEB3_WALLETCONNECT_PROJECT_ID } from "./idos.title";

  // Wallet sign-in seam — Casecremental signs in with SOLANA wallets (plan F8).
  //
  // The challenge is issued on the Title's Solana network. Its key is "solana" on both Titles: mainnet on the live
  // Title (the one that already carries its FOMO token), devnet on ZVKC34TR-DEV (for the NFT spike). Signing the
  // challenge is an off-chain signMessage — no transaction, no fee — so the cluster does not matter for sign-in.
  // IDOS_WEB3_NETWORK_ID (baked by the platform) wins when it is set; this Title was created as web2, so it is empty.
  //
  // "@idosgames/wallet/react/lazy" keeps Reown AppKit out of the first load until the player taps the button, and
  // inside the idosgames.com frame it signs through the site's wallet. walletConnectProjectId adds phone wallets
  // (QR / deep link); without it only browser-extension wallets (Phantom, Solflare…) are offered.
  //
  // Guardrail: the wallet is an identity here, nothing else. Cases are bought only with in-game cash; the game has
  // no deposit or withdraw UI (the lobby wallet panel stays hidden on this web2 Title).

  /** The Title's Solana network key (cfg.Blockchain.Networks). */
  export const SOLANA_NETWORK_ID = "solana";

  const projectId = (): string | undefined => IDOS_WEB3_WALLETCONNECT_PROJECT_ID || ENV_WALLETCONNECT_PROJECT_ID || undefined;

  export const renderWalletLogin: LoginScreenExtras["renderWalletLogin"] = ({ client, onAuthenticated, disabled, style }) => (
    <LazySolanaWalletLogin
      client={client}
      networkID={IDOS_WEB3_NETWORK_ID || SOLANA_NETWORK_ID}
      onAuthenticated={onAuthenticated}
      disabled={disabled}
      style={style}
      appName="Casecremental"
      walletConnectProjectId={projectId()}
    />
  );

  // "Link wallet" on the play-access screen (./base/login/PlayAccessScreen) — the same button in link mode.
  export const renderWalletLink: RenderLinkWallet = ({ client, networkID, onLinked, disabled, style }) => (
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
  ```
  The file is outside `src/modules/casecremental/`, so `npm run format` skips it (`.prettierignore`); keep the existing style.

- [ ] **Step 6: Run the checks.**
  Run: `npx vitest run src/walletLogin.test.tsx && npm run typecheck && npm run build`
  Expected: PASS; the build's main chunk does not grow by the AppKit size (the lazy entry keeps it in its own chunk — compare `dist/assets` before/after; a jump of megabytes in the entry chunk means the eager import slipped in).

- [ ] **Step 7: Sign in for real (the user, with Phantom).** `npm run dev`, open `http://localhost:5180` (DEV Title). Ask the user to: tap "Sign in with wallet" → pick Phantom → approve the **message** (no transaction) → land in the game. Then check with them: (a) cancel the signature once — an error shows under the button, the guest sign-in still works; (b) on a phone with the project id set, the WalletConnect modal offers wallets (skip if no id); (c) if a build of the game is up on its idosgames.com page, the button there signs through the site's wallet (else note "not checked: no build deployed"). In the page, `idosClient.data.user.state?.Blockchain?.LastWalletLogin` shows `{ NetworkID: "solana", Address: … }` — note its exact shape for Task 2.

- [ ] **Step 8: Commit.**
  ```bash
  git add src/walletLogin.tsx src/walletLogin.test.tsx cloudcode/config/blockchain.dev.json
  git commit -m "feat(solana): sign in with a Solana wallet on the Title's solana network" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 2: Wallet players on the leaderboard

> Superseded in part: the server cannot read the wallet, so the client sends it (see the Outcome note at the top).

The server, not the client, says who is a wallet player: `endRun` copies the verified address into the Public key `cc_wallet` (registered by F7). The Leaderboard tab fetches `cc_wallet` for the listed players and shows `◎ 7xKX…gAsU` (or the name with a ◎ mark).

**Files:**
- Modify: `cloudcode/casecremental.js`, `cloudcode/casecremental.test.ts`, `cloudcode/casecremental.bundle.js` (regenerated), `src/modules/casecremental/ui/lobby/lobbyRules.ts`, `src/modules/casecremental/ui/lobby/lobbyRules.test.ts`, `src/modules/casecremental/ui/lobby/Leaderboard.tsx`, `src/modules/casecremental/i18n/en.ts`, `src/modules/casecremental/i18n/ru.ts`

**Interfaces:**
- Consumes: F7's `makeIo`, `RULES.endRun`, `boardRows(entries, wallets, myId)`, `shortAddress`.
- Produces:
  ```js
  // cloudcode/casecremental.js — io gains:
  walletAddress(): string | null   // the account's verified Solana address, from server.ReadUserData({ Fields: ["Blockchain"] })
  // endRun: when walletAddress() differs from the stored cc_wallet, writes Public cc_wallet = address
  ```
  ```ts
  // ui/lobby/lobbyRules.ts
  export const isSolanaAddress: (s: unknown) => s is string;   // base58, 32–44 chars
  export function walletsFrom(results: ReadonlyArray<{ UserID?: string | null; Public?: Record<string, { Value?: string | null }> | null }> | null | undefined): Record<string, string>;
  ```

- [ ] **Step 1: Write the failing tests.**
  Add to `cloudcode/casecremental.test.ts` (extend `fakeIo` in `cloudcode/load.ts` with `wallet: null as string | null` in `st` and `walletAddress: () => st.wallet` in `io`):
  ```ts
  describe("wallet on the board (F8)", () => {
    it("endRun publishes the verified wallet once", () => {
      p.st.wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
      end();
      expect(p.st.data.Public!.cc_wallet).toBe("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
      p.st.t += 900;
      end({ runId: "r2", trophy: "vault2", lifetimeEarnings: 2e9 });
      expect(p.st.data.Public!.cc_wallet).toBe("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
    });

    it("a player without a wallet gets no key", () => {
      end();
      expect(p.st.data.Public!.cc_wallet).toBeUndefined();
    });
  });
  ```
  and a case in the `makeIo` test: the fake `ReadUserData` answers `{ Fields: ["Blockchain"] }` with the shape Task 1 Step 7 recorded, e.g. `{ Success: true, Data: { Blockchain: { LastWalletLogin: { NetworkID: "solana", Address: "7xKX…" }, LinkedWallets: {} } } }`, and `io.walletAddress()` returns the address; with `NetworkID: "bsc"` and no Solana entry in `LinkedWallets` it returns `null`.

  Add to `ui/lobby/lobbyRules.test.ts`:
  ```ts
  import { isSolanaAddress, walletsFrom } from "./lobbyRules";

  describe("wallets on the board", () => {
    it("shows a wallet only when it looks like a Solana address", () => {
      const w = walletsFrom([
        { UserID: "a", Public: { cc_wallet: { Value: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } } },
        { UserID: "b", Public: { cc_wallet: { Value: "<script>" } } },
        { UserID: "c", Public: {} },
        { UserID: null, Public: { cc_wallet: { Value: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } } },
      ]);
      expect(w).toEqual({ a: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" });
      expect(walletsFrom(undefined)).toEqual({});
      expect(isSolanaAddress("0x1234")).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run them to see them fail.**
  Run: `npx vitest run cloudcode src/modules/casecremental/ui/lobby`
  Expected: FAIL.

- [ ] **Step 3: Server side.** In `cloudcode/casecremental.js`:
  - `var WALLET_KEY = "cc_wallet";` and `var SOLANA = "solana";` next to the other constants.
  - In `makeIo`'s returned object (adapt the field names to Task 1 Step 7's recorded shape):
    ```js
    walletAddress: function () {
      var r = server.ReadUserData({ Fields: ["Blockchain"] });
      var b = r && r.Success && r.Data && r.Data.Blockchain;
      if (!b) return null;
      if (b.LastWalletLogin && b.LastWalletLogin.NetworkID === SOLANA && typeof b.LastWalletLogin.Address === "string") return b.LastWalletLogin.Address;
      var linked = b.LinkedWallets && b.LinkedWallets[SOLANA];
      return linked && typeof linked.Address === "string" ? linked.Address : null;
    },
    ```
  - In `RULES.endRun`, after the two `writeData` calls:
    ```js
    var wallet = io.walletAddress ? io.walletAddress() : null;
    if (wallet && io.readData("Public", WALLET_KEY) !== wallet) io.writeData("Public", WALLET_KEY, wallet);
    ```
    `writeData` stores strings as they are (F7's `makeIo` passes a string through unquoted), and `readData` parses JSON — so for this String key read it raw: add `readRaw(bucket, key)` to `makeIo` returning `rec.Value` without parsing, use it here, and mirror it in `fakeIo` (`readRaw: (b, k) => st.data[b][k] ?? null`).
  - Run `npm run cloud` to regenerate the bundle.

- [ ] **Step 4: Client side.** In `ui/lobby/lobbyRules.ts`:
  ```ts
  /** A base58 Solana address (32–44 characters, no 0, O, I or l). */
  export const isSolanaAddress = (s: unknown): s is string => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

  /** userId → wallet, from batchGetPublicUserCustomDataOf's results (key cc_wallet). Anything odd is skipped. */
  export function walletsFrom(
    results: ReadonlyArray<{ UserID?: string | null; Public?: Record<string, { Value?: string | null }> | null }> | null | undefined,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const r of results ?? []) {
      const v = r.Public?.cc_wallet?.Value;
      if (r.UserID && isSolanaAddress(v)) out[r.UserID] = v;
    }
    return out;
  }
  ```
  In `ui/lobby/Leaderboard.tsx`, replace the `const wallets = {}` line:
  ```ts
  const ids = top.map((e) => e.UserID);
  const pub = ids.length > 0 ? await client.userCustomData.batchGetPublicUserCustomDataOf(ids) : null;
  const wallets = pub && pub.ok ? walletsFrom(pub.data.Results) : {};
  ```
  (a failed batch read leaves the board without badges — never an error screen). Show a named wallet player as `name ◎`: change the name cell to
  ```tsx
  {r.name ? `${r.name}${r.wallet ? " ◎" : ""}` : r.wallet ? `◎ ${shortAddress(r.wallet)}` : t("lobby.player")}
  ```
  and give the cell `title={r.wallet ? t("lobby.wallet") : undefined}` with the strings `"lobby.wallet": "Signed in with a Solana wallet"` / `"lobby.wallet": "Вход через кошелёк Solana"`.

- [ ] **Step 5: Run the tests.**
  Run: `npx vitest run cloudcode src/modules/casecremental && npm run typecheck && npm run build`
  Expected: PASS.

- [ ] **Step 6: Publish and check on DEV.** `publish_cloud_code` (DEV) with the regenerated bundle and the same five handlers. Put a wallet player on the board without a browser wallet — a Node script **in the scratchpad** (never committed), run from the repo root so it resolves `node_modules`:
  ```js
  // scratchpad/wallet-run.mjs — signs in to ZVKC34TR-DEV with a throwaway devnet keypair and ends one run.
  import { createIDosGamesClient, NoopPlatformAdapter } from "@idosgames/core";
  import { loginWithWalletSolana } from "@idosgames/wallet";
  import { Keypair } from "@solana/web3.js";
  import { ed25519 } from "@noble/curves/ed25519";

  const kp = Keypair.generate();
  const client = createIDosGamesClient({ titleID: "ZVKC34TR-DEV", platform: new NoopPlatformAdapter(), throttleMs: 0 });
  const login = await loginWithWalletSolana({
    client,
    networkID: "solana",
    walletAddress: kp.publicKey.toBase58(),
    signMessage: async (msg) => ed25519.sign(msg, kp.secretKey.slice(0, 32)),
  });
  console.log("login", login.ok ? "ok" : login);
  const r = await client.cloudCode.execute("endRun", { runId: `rw${Date.now().toString(36)}`, lifetimeEarnings: 3e6, elapsedSec: 500, endedAt: Date.now() / 1000, finaleReached: true, trophy: "vault1" });
  console.log("endRun", JSON.stringify(r.ok ? r.data.FunctionResult : r));
  const fr = r.ok ? (typeof r.data.FunctionResult === "string" ? JSON.parse(r.data.FunctionResult) : r.data.FunctionResult) : null;
  if (fr?.score && !fr.serverScore) console.log("submit", JSON.stringify(await client.leaderboard.submitScore("best_run", fr.score)));
  console.log("address", kp.publicKey.toBase58());
  ```
  Run: `node <scratchpad>/wallet-run.mjs` (Node ≥ 20). `@noble/curves` is a dependency of `@solana/web3.js`, present in `node_modules` but not in `package.json` — fine for a scratch script, never import it from `src/`. If `loginWithWalletSolana` refuses in Node, sign in with Phantom in the browser instead (Task 1 Step 7) and run a vault there. Then open the Leaders tab in the signed-in browser: the wallet player shows `◎ <first4>…<last4>`. Also check a guest's row has no badge.

- [ ] **Step 7: Commit.**
  ```bash
  git add cloudcode/casecremental.js cloudcode/casecremental.test.ts cloudcode/load.ts cloudcode/casecremental.bundle.js src/modules/casecremental/ui/lobby src/modules/casecremental/i18n
  git commit -m "feat(solana): wallet players show on the leaderboard, verified by the server" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```

---

### Task 3: Spike — withdraw a ★ trophy as a devnet NFT (time-boxed)

**Time box: 2 hours of work, on `ZVKC34TR-DEV` only, with a throwaway account and a throwaway devnet keypair.** Throwaway code lives in the scratchpad; nothing from this task is committed except the feature-history note (Task 4) — and, only if it **passes**, a follow-up plan for the real feature.

**Cut rule — the spike is CUT the moment any of these is true, and the reason is the exact failing step and message:**
1. After Task 1 Step 2, the DEV `solana` network has no `RewardPoolAddress` (the platform has no devnet program for this Title), or the save forced ChainID 0 (mainnet).
2. `client.blockchain.requestNFTWithdrawal` for a ★ trophy item bound to a devnet mint answers a refusal (`isFail`) that no config change in Step 3 fixes within the box.
3. It answers, but without a `SolanaSignature`, or the signature's `Domain` / `ProgramID` names an instruction the platform pool program does not have for NFTs, so there is no on-chain call to make. (`@idosgames/wallet` 0.6.2 has no Solana NFT submit; the token path `createPlatformPoolAdapter` → `withdraw_spl` may accept a 0-decimal mint — that is what the spike tries, and nothing else.)
4. The on-chain transaction fails (`PlatformPoolError` code or a program error) after one honest attempt with the pool funded.
5. The 2 hours run out before the ★ shows in the devnet wallet (Solana explorer, `?cluster=devnet`).
**PASS** = the trophy left the player's inventory, the NFT is in the devnet wallet, and `confirmWithdrawal` succeeded.

**Files:** none committed in this task (scratchpad only).

- [ ] **Step 1: Read what DEV has.** `get_blockchain` (DEV): note `Networks.solana.RewardPoolAddress`, `RpcUrl`, `ChainID`. Cut rule 1 applies here.

- [ ] **Step 2: Make a devnet NFT the pool can release.** In a scratchpad Node script with `@solana/web3.js` (already a dependency): generate a keypair, airdrop devnet SOL (`connection.requestAirdrop`, 1 SOL; faucet limits apply — if the airdrop is refused twice, use https://faucet.solana.com manually with the printed address), create a 0-decimal SPL mint with supply 1 owned by the pool's token account. If this needs the SPL Token program instructions that `@solana/web3.js` alone does not build (no `@solana/spl-token` in `package.json`), installing it is **not** allowed in the project — install it inside the scratchpad folder (`npm i @solana/spl-token` there) and run from there with the project's `node_modules` on `NODE_PATH`. If the platform pool requires the NFT to be **deposited** into it (`client.blockchain.depositNFT(networkID, txHash)`) rather than minted to it, do that. Record every address.

- [ ] **Step 3: Bind one trophy to it on DEV.** `get_item` (DEV) → in `Catalogs.Trophies.Items.bc_knife` set `"NFT": { "MetadataUrl": null, "Networks": { "solana": { "ContractAddress": "<mint>", "TokenID": "<mint>", "TokenStandard": "SPL", "MaxLevel": 1 } } }` → `save_item` (DEV). `get_blockchain` (DEV) → set `Networks.solana.NftCollections` to `[{ "ContractAddress": "<mint or collection mint>", "ItemCatalogID": "Trophies", "DisplayName": "Casecremental Trophies (devnet)", "DepositsEnabled": true, "WithdrawalsEnabled": true }]` → `save_blockchain` (DEV). (These DEV-only edits are rolled back in Step 6 whatever the outcome.)

- [ ] **Step 4: Request the withdrawal.** In a signed-in DEV browser session for a throwaway guest that owns `bc_knife` (grant it through `reportTrophy` after reaching it, or with the F7 smoke calls), with a devnet wallet address `W` (Phantom on devnet, or the scratch keypair's address):
  ```js
  await idosClient.user.getUserState();
  const inst = Object.values(idosClient.data.user.state.InventoryV2.UnstackableItems).find((i) => i.ItemID === "bc_knife");
  const r = await idosClient.blockchain.requestNFTWithdrawal("bc_knife", "solana", W, "1", undefined, undefined, inst.ItemInstanceID);
  JSON.stringify(r.ok ? r.data : r, null, 1);
  ```
  Cut rules 2–3 apply to this answer. Keep `TitleTransactionID`.

- [ ] **Step 5: Submit it on chain, or put the trophy back.** If a `SolanaSignature` came back: build `createPlatformPoolAdapter({ connection, owner: W, programId: RewardPoolAddress, signTransaction })` (from `@idosgames/wallet/react/solana`; in Node use the scratch keypair to sign) and call `adapter.submitWithdrawal(r.data.SolanaSignature)`; then `idosClient.blockchain.confirmWithdrawal(TitleTransactionID, txSignature)`. Look the wallet up on the devnet explorer. Cut rules 4–5 apply. **If it fails after the debit:** call `idosClient.blockchain.retryWithdrawal(TitleTransactionID)` once (a fresh signature while `Pending`); otherwise the pending withdrawal expires after `PendingWithdrawalTtlHours` (1 h on DEV) and the item returns — check the inventory after the TTL and write the outcome down.

- [ ] **Step 6: Roll DEV back.** Remove the `NFT` block from `bc_knife` (`save_item`) and empty `NftCollections` (`save_blockchain`), unless the spike passed and the user wants to keep it for the follow-up.

---

### Task 4: Write it down

**Files:**
- Modify: `docs/feature-history/casecremental-finish.md` (an F8 section), `docs/feature-history/README.md` (extend the finish line's gist)

- [ ] **Step 1: Guardrail check.** `get_store`, `get_lootbox` (DEV and live): no offer, lootbox or price uses `Main`, `Main_IOU` or any crypto (the idle-rpg seed's GEMS/GOLD offers on live are not ours but are not crypto either). `grep -rn "Main\b\|FOMO\|requestTokenWithdrawal\|depositToken" src/modules/casecremental` → nothing. Write the result down.

- [ ] **Step 2: Feature history.** Add `## F8 — Solana` to `docs/feature-history/casecremental-finish.md`:
  - Sign-in: `LazySolanaWalletLogin` in `src/walletLogin.tsx`, network key `solana` on both Titles; live = mainnet (already the Title's token network; sign-in is a free off-chain signature), DEV = devnet (ChainID 103) for the spike. Whether a WalletConnect project id is set (phones need it).
  - The lobby wallet panel stays hidden on purpose (web2 Title, guardrail); the wallet is an identity only.
  - Wallet players on the board: `endRun` publishes the verified address to Public `cc_wallet`; the board shows `◎ abcd…wxyz`. A player can overwrite their own Public key — it is cosmetic, and the next `endRun` writes the verified one back.
  - **The NFT spike:** PASS or CUT, the failing cut rule with its exact message, what was learned (the `SolanaSignature` shape, whether the pool releases a 0-decimal mint, the TTL return), and the time spent. If CUT: "★ trophies stay in-game items; revisit when `@idosgames/wallet` ships a Solana NFT withdrawal." If PASS: a follow-up plan file name for the real feature (a withdraw button on a ★ in the Trophy Case, devnet → mainnet decision for the user, metadata JSON hosting).
  In `README.md`, extend the finish line's gist with "F8: Solana wallet sign-in, wallet players on the board, NFT spike <passed | cut>".

- [ ] **Step 3: Memory.** Update the auto-memory note `casecremental-title.md` (in `C:\Users\rainbow\.claude\projects\C--Users-rainbow-dev-hackatons-solanaidos\memory\`): the Title now holds CLOUT / Trophies / best_run / CloudCode (F7), the `solana` network on both Titles (DEV devnet, live mainnet), wallet login on, and the spike's outcome. Keep it short.

- [ ] **Step 4: Commit.**
  ```bash
  git add docs/feature-history/casecremental-finish.md docs/feature-history/README.md
  git commit -m "docs(solana): F8 sign-in, the leaderboard badge and the NFT spike's outcome" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01M6RNxeeCp9mtvDhrmU2F5S"
  ```
