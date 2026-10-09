// SHIM (M2b-C4 Task 2): the old opening beats, kept only so VaultScene/VaultReels compile until Tasks 3-4 move
// them onto cues.ts's VAULT_CUES. Values are squeezed onto the new 14.5 s timeline (open = the impact).

export const VAULT_CUE_TIMES = { chains: 0.3, burst: 0.9, open: 1.0, reels: 1.5 } as const;

export interface LegacyVaultCues {
  vaultFrame: 0 | 1 | 2 | 3;
  lockSpin: boolean;
  beam: number;
  fountain: boolean;
  reelsIn: number;
}

export function legacyVaultCues(t: number): LegacyVaultCues {
  const T = VAULT_CUE_TIMES;
  return {
    vaultFrame: t < T.burst ? 1 : t < T.open ? 2 : 3,
    lockSpin: t < T.chains,
    beam: t < T.open ? 0 : Math.min(1, (t - T.open) / 0.8),
    fountain: t >= T.open,
    reelsIn: t < T.reels ? 0 : Math.min(1, (t - T.reels) / 0.6),
  };
}
