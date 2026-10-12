import { earningsFromScore } from "../../meta/plausibility";
import { TROPHIES, TROPHY_CATALOG, trophyById } from "../../meta/trophies";

// What the lobby's Trophy Case and Leaderboard show (plan F7), as pure rules over the SDK's data shapes.

export interface TrophyGroup {
  /** A case id, or "vaults" for the vault legends. */
  source: string;
  cells: Array<{ id: string; owned: boolean; rarity: "covert" | "gold"; vault: boolean }>;
}

/**
 * The trophies the player owns: the Trophies items of the client's inventory, plus the ids the server last answered
 * (CloudCode's grants can take a while to reach the client's inventory — cloudcode/probe.js).
 */
export function ownedTrophyIds(
  unstackable: Record<string, { ItemID: string; CatalogID?: string | null }> | null | undefined,
  fromServer: Iterable<string> = [],
): Set<string> {
  const out = new Set<string>();
  for (const it of Object.values(unstackable ?? {})) if (it.CatalogID === TROPHY_CATALOG) out.add(it.ItemID);
  for (const id of fromServer) if (trophyById(id)) out.add(id);
  return out;
}

/** Every trophy, grouped by its case (content order), the vault legends last. */
export function trophyGroups(owned: ReadonlySet<string>): TrophyGroup[] {
  const groups: TrophyGroup[] = [];
  for (const t of TROPHIES) {
    const key = t.vault ? "vaults" : t.source;
    let g = groups.find((x) => x.source === key);
    if (!g) groups.push((g = { source: key, cells: [] }));
    g.cells.push({ id: t.id, owned: owned.has(t.id), rarity: t.rarity, vault: t.vault });
  }
  return groups;
}

export interface BoardEntry {
  UserID: string;
  Score?: number | null;
  Rank?: number | null;
  PublicProfile?: { Username?: string | null } | null;
}

export interface BoardRow {
  rank: number;
  userId: string;
  /** The player's name, or null (the screen shows the wallet or "Player"). */
  name: string | null;
  wallet: string | null;
  earnings: number;
  me: boolean;
}

export const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address);

/** A base58 Solana address (32–44 characters, no 0, O, I or l). */
export const isSolanaAddress = (s: unknown): s is string => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/** The Public user-data key CloudCode's endRun fills with the player's verified Solana wallet (plan F8). */
export const WALLET_KEY = "cc_wallet";

/** userId → wallet, from batchGetPublicUserCustomDataOf's results. Anything odd is skipped. */
export function walletsFrom(
  results: ReadonlyArray<{ UserID?: string | null; Public?: Record<string, { Value?: string | null }> | null }> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of results ?? []) {
    const v = r.Public?.[WALLET_KEY]?.Value;
    if (r.UserID && isSolanaAddress(v)) out[r.UserID] = v;
  }
  return out;
}

/** A row's player: "name ◎" for a named wallet player, "◎ abcd…wxyz" for an unnamed one, else the name or `anonymous`. */
export function rowLabel(row: Pick<BoardRow, "name" | "wallet">, anonymous: string): string {
  if (row.name) return row.wallet ? `${row.name} ◎` : row.name;
  return row.wallet ? `◎ ${shortAddress(row.wallet)}` : anonymous;
}

/** best_run's top entries as rows, best first; the score (floor(log10 × 1000)) back as money. */
export function boardRows(entries: readonly BoardEntry[], wallets: Readonly<Record<string, string>>, myId: string | null): BoardRow[] {
  return [...entries]
    .sort((a, b) => (a.Rank ?? Infinity) - (b.Rank ?? Infinity) || (b.Score ?? 0) - (a.Score ?? 0))
    .map((e, i) => ({
      rank: e.Rank ?? i + 1,
      userId: e.UserID,
      name: e.PublicProfile?.Username?.trim() || null,
      wallet: wallets[e.UserID] ?? null,
      earnings: earningsFromScore(e.Score ?? 0),
      me: e.UserID === myId,
    }));
}
