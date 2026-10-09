import type { Pt } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import { beamLayout, type Beam } from "./beams";

// Where the vault's pieces go on screen (spec 2026-10-09 §2, §5). While the key waits, the vault sits big in the
// centre with the devil key beside it (as before). Once the key turns, the chest is at lower centre, ~28 % of
// the screen tall when open; five beams fan up out of its mouth past the screen edges, each reward's spot and
// label on screen and clear of the others; the total sits just above the lid. Pure, screen px.

/** The vault-case sprite's frame (vault-case.json). */
export const VAULT_FRAME = { w: 68, h: 78, frames: 4 } as const;
/** The open chest's height (frame px): its lid's top (row 33) down to the frame's bottom. */
export const OPEN_H = 45;
/** The body's width (frame px). */
export const BODY_W = 40;
/** The body's centre sits this far (frame px) above the frame's bottom; the closed vault's middle. */
export const BODY_UP = 14;
/** The beams leave the open chest this far (frame px) below the lid's top: from behind the standing lid. */
export const BEAM_MOUTH = 6;
/** A streamed icon's box (world px). */
export const BEAM_ICON = 32;

const CHEST_SHARE = 0.28;
const BOTTOM_LANDSCAPE = 0.88;
const BOTTOM_PORTRAIT = 0.8;
/** World px between the total and the lid. */
const GAP = 2;

export interface VaultLayout {
  /** The key phase: the vault's bottom-centre and scale, the devil key's home, the hint's top. */
  key: { bottom: Pt; S: number; home: Pt; hintY: number };
  /** The open chest: its bottom-centre (x, bottom), the open lid's top, its whole-number scale. */
  chest: { x: number; bottom: number; top: number; S: number };
  /** The five beams, left to right, and a streamed icon's box size. */
  beams: Beam[];
  icon: number;
  /** The total's centre, and its font size. */
  totalAt: Pt;
  totalSize: number;
}

export function vaultLayout(screen: { w: number; h: number }, k: number): VaultLayout {
  const { w, h } = screen;
  const cx = w / 2;

  const Sk = Math.max(1, Math.floor(Math.min((h * 0.5) / OPEN_H, (w * 0.62) / BODY_W)));
  const keyCentreY = Math.round(h * 0.5 + 4.5 * Sk);
  const key = {
    bottom: { x: cx, y: keyCentreY + BODY_UP * Sk },
    S: Sk,
    home: { x: cx - BODY_W * Sk * 0.5 - 16 * Sk * 0.6, y: keyCentreY - 6 * Sk },
    hintY: keyCentreY + 16 * Sk,
  };

  const S = Math.max(1, Math.min(Math.round((h * CHEST_SHARE) / OPEN_H), Math.floor((w * 0.9) / VAULT_FRAME.w)));
  const bottom = Math.round(h * (h > w ? BOTTOM_PORTRAIT : BOTTOM_LANDSCAPE));
  const top = bottom - OPEN_H * S;

  const totalSize = hdFontSize(k, 16);
  const icon = BEAM_ICON * k;
  const mouth = { x: cx, y: top + BEAM_MOUTH * S };

  return {
    key,
    chest: { x: cx, bottom, top, S },
    beams: beamLayout(screen, mouth, icon, 2 * hdFontSize(k)),
    icon,
    totalAt: { x: cx, y: Math.round(top - GAP * k - totalSize * 0.75) },
    totalSize,
  };
}
