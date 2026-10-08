// The vault opening's beats (rework spec §4), seconds after the key turns: the lock spins, chains snap, light
// bursts through the cracks, the lid opens with a golden column and a coin fountain, then the five reels
// come in (their landings are sim events at VAULT_LAND_TIMES).

export const VAULT_CUE_TIMES = { chains: 1.5, burst: 2.6, open: 3.4, reels: 4.0 } as const;

export interface VaultCues {
  vaultFrame: 0 | 1 | 2 | 3;
  lockSpin: boolean;
  /** The golden column's strength, 0–1. */
  beam: number;
  fountain: boolean;
  /** The reels sliding in, 0–1. */
  reelsIn: number;
}

export function vaultCues(t: number): VaultCues {
  const T = VAULT_CUE_TIMES;
  return {
    vaultFrame: t < T.burst ? 1 : t < T.open ? 2 : 3,
    lockSpin: t < T.chains,
    beam: t < T.open ? 0 : Math.min(1, (t - T.open) / 0.8),
    fountain: t >= T.open,
    reelsIn: t < T.reels ? 0 : Math.min(1, (t - T.reels) / 0.6),
  };
}
