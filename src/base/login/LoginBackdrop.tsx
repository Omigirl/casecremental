import type { CSSProperties, ReactNode } from "react";
import {
  PixelGlyph,
  Sprite,
  WEAPONS,
  type Strip,
  type WeaponId,
} from "./pixelArt";
import roomBackUrl from "./assets/room-back.png";
import tableUrl from "./assets/table.png";
import coinUrl from "./assets/coin.png";
import bootcampUrl from "./assets/case-bootcamp.png";
import wildwoodUrl from "./assets/case-wildwood.png";
import bedrockUrl from "./assets/case-bedrock.png";
import mainframeUrl from "./assets/case-mainframe.png";
import neonUrl from "./assets/case-neon.png";
import deepspaceUrl from "./assets/case-deepspace.png";
import infernoUrl from "./assets/case-inferno.png";

// The sign-in screen's backdrop: the game's workshop wall, a case reel slowly scrolling past its gold
// marker (blues mostly, a red and a knife teasing in now and then), and the workbench at the bottom with
// a few cases idling on it and coins turning. Decoration only: aria-hidden, takes no pointer.
// Motion is slow and has no flashing; under prefers-reduced-motion everything stands still (./loginCss).

const RARITY = {
  milspec: "#4b69ff",
  restricted: "#8847ff",
  classified: "#d32ce6",
  covert: "#eb4b4b",
  gold: "#ffd700",
} as const;
type Rarity = keyof typeof RARITY;

/** The reel's cards, in order. Twice in the track so the scroll loops seamlessly. */
const REEL: readonly [WeaponId, Rarity][] = [
  ["rifle", "milspec"],
  ["pistol", "milspec"],
  ["smg", "restricted"],
  ["rifle", "milspec"],
  ["sniper", "classified"],
  ["pistol", "milspec"],
  ["smg", "milspec"],
  ["rifle", "covert"],
  ["pistol", "restricted"],
  ["smg", "milspec"],
  ["knife", "gold"],
  ["sniper", "milspec"],
  ["pistol", "milspec"],
  ["rifle", "restricted"],
  ["smg", "milspec"],
  ["pistol", "classified"],
];

const caseStrip = (url: string): Strip => ({
  url,
  frameW: 27,
  frameH: 31,
  frames: 4,
});
const COIN: Strip = { url: coinUrl, frameW: 14, frameH: 22, frames: 4 };

/** What idles on the workbench: x as a share of the width, `wide` = shown only on wider screens. */
type BenchItem =
  | { kind: "case"; url: string; x: number; delay: number; wide?: boolean }
  | { kind: "coin"; x: number; spin: number; wide?: boolean };

const BENCH: readonly BenchItem[] = [
  { kind: "case", url: bootcampUrl, x: 0.04, delay: 0 },
  { kind: "coin", x: 0.14, spin: 1.6, wide: true },
  { kind: "case", url: wildwoodUrl, x: 0.18, delay: 1.3, wide: true },
  { kind: "case", url: neonUrl, x: 0.27, delay: 0.6, wide: true },
  { kind: "coin", x: 0.27, spin: 2.1 },
  { kind: "case", url: mainframeUrl, x: 0.66, delay: 1.9, wide: true },
  { kind: "coin", x: 0.7, spin: 1.8 },
  { kind: "case", url: deepspaceUrl, x: 0.76, delay: 0.9, wide: true },
  { kind: "case", url: bedrockUrl, x: 0.86, delay: 2.4, wide: true },
  { kind: "coin", x: 0.83, spin: 2.4, wide: true },
  { kind: "case", url: infernoUrl, x: 0.96, delay: 1.5 },
];

function SkinCard({
  weapon,
  rarity,
}: {
  weapon: WeaponId;
  rarity: Rarity;
}): ReactNode {
  const color = RARITY[rarity];
  return (
    <div className="ccl-card" style={{ "--rarity": color } as CSSProperties}>
      <PixelGlyph
        g={WEAPONS[weapon]}
        fill={color}
        style={{ filter: "drop-shadow(0 var(--p) 0 #120e10)" }}
      />
      <div className="ccl-card-bar" />
    </div>
  );
}

export function LoginBackdrop(): ReactNode {
  const cards = [...REEL, ...REEL];
  return (
    <div className="ccl-bg" aria-hidden="true">
      <div
        className="ccl-room"
        style={{ backgroundImage: `url("${roomBackUrl}")` }}
      />
      <div className="ccl-lamp" />
      <div className="ccl-vignette" />
      <div className="ccl-reel">
        <div className="ccl-reel-window">
          <div className="ccl-reel-track">
            {cards.map(([weapon, rarity], i) => (
              <SkinCard key={i} weapon={weapon} rarity={rarity} />
            ))}
          </div>
        </div>
        <div className="ccl-reel-marker" />
      </div>
      <div className="ccl-bench">
        <div
          className="ccl-table"
          style={{ backgroundImage: `url("${tableUrl}")` }}
        />
        {BENCH.map((item, i) =>
          item.kind === "case" ? (
            <div
              key={i}
              className={
                item.wide ? "ccl-bench-item ccl-wide" : "ccl-bench-item"
              }
              style={{ left: `${item.x * 100}%` }}
            >
              <Sprite
                strip={caseStrip(item.url)}
                className="ccl-bob"
                style={{ animationDelay: `${-item.delay}s` }}
              />
            </div>
          ) : (
            <div
              key={i}
              className={
                item.wide
                  ? "ccl-bench-item ccl-coin ccl-wide"
                  : "ccl-bench-item ccl-coin"
              }
              style={{ left: `${item.x * 100}%` }}
            >
              <Sprite strip={COIN} spin={item.spin} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
