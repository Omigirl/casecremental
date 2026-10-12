// The sign-in screen's stylesheet: the game's palette, pixel bevels and Press Start 2P (copied from
// src/modules/casecremental/ui/styles.ts and ui/pixelFrame.ts — the base cannot import a module).
//
// Scale variables, set per screen size on .ccl-root:
//   --s   the backdrop's integer pixel scale (world px → screen px),
//   --hs  the hero chest's pixel scale,
//   --lp  one pixel of the logo's font (its size / 8), for the outline and the extrusion,
//   --fs  small text (tagline, hints, links) — a multiple of 8, as the font wants.
// Motion: the reel, the bobbing cases, the turning coins, the floating chest and a glow whose alpha
// changes by less than 0.1 — no flashing; prefers-reduced-motion stops all of it.

const INK = "#120e10";
const CREAM = "#fff6d5";
const TEXT = "#f2e9dc";
const DIM = "#a89a8c";
const GOLD = "#ffd34d";

const bevel = (
  fill: string,
  light: string,
  dark: string,
  press = false,
): string =>
  `background-color: ${fill}; box-shadow: inset 0 ${press ? -2 : -4}px 0 ${dark}, inset 0 2px 0 ${light}, 0 0 0 2px ${INK};`;

export const LOGIN_CSS = `
.ccl-root { position: absolute; inset: 0; overflow: hidden; background: ${INK}; color: ${TEXT};
  font-family: "Press Start 2P", monospace; font-size: 16px; line-height: 1.5; -webkit-font-smoothing: none;
  --s: 2; --p: calc(var(--s) * 1px); --hs: 4; --lp: 3; --fs: 8px; --gap: 16px; --panel: 380px; --top: calc(var(--s) * 50px); }
.ccl-root *, .ccl-root *::before, .ccl-root *::after { box-sizing: border-box; }

/* ---- backdrop */
.ccl-bg { position: absolute; inset: 0; pointer-events: none; user-select: none; }
.ccl-room { position: absolute; inset: 0; background-size: cover; background-position: center top; image-rendering: pixelated;
  filter: brightness(0.42) saturate(0.85); }
.ccl-lamp { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 55% at 50% 38%, rgba(255, 186, 102, 0.2), transparent 70%); }
.ccl-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(8, 5, 6, 0.78) 100%); }
.ccl-sprite { display: block; background-repeat: no-repeat; image-rendering: pixelated; }
.ccl-strip { animation: ccl-strip 2s steps(4) infinite; }
@keyframes ccl-strip { from { background-position: 0 0; } to { background-position: calc(var(--sheet-w) * -1) 0; } }

.ccl-reel { position: absolute; left: 0; right: 0; top: calc(var(--s) * 8px); height: calc(var(--s) * 40px); opacity: 0.85; }
.ccl-reel-window { position: absolute; inset: 0; overflow: hidden; background: rgba(18, 14, 16, 0.72);
  box-shadow: inset 0 var(--p) 0 #4a3328, inset 0 calc(var(--s) * -1px) 0 #4a3328;
  border-block: var(--p) solid ${INK};
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.ccl-reel-track { display: flex; width: max-content; padding: calc(var(--s) * 2px) 0; animation: ccl-reel 90s linear infinite; }
@keyframes ccl-reel { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ccl-card { flex: none; position: relative; display: grid; place-items: center;
  width: calc(var(--s) * 30px); height: calc(var(--s) * 32px); margin-right: calc(var(--s) * 2px);
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--rarity) 28%, transparent), transparent 72%), #1d1517;
  box-shadow: inset 0 0 0 var(--p) #2b1f1c; }
.ccl-card-bar { position: absolute; left: var(--p); right: var(--p); bottom: var(--p); height: calc(var(--s) * 2px); background: var(--rarity); }
.ccl-reel-marker { position: absolute; left: 50%; top: calc(var(--s) * -3px); bottom: calc(var(--s) * -3px);
  width: calc(var(--s) * 2px); transform: translateX(-50%); background: ${GOLD};
  box-shadow: 0 0 0 var(--p) ${INK}, 0 0 calc(var(--s) * 6px) rgba(255, 211, 77, 0.45); }

.ccl-bench { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--s) * 23px); }
.ccl-table { position: absolute; inset: 0; background-repeat: repeat-x; background-size: calc(var(--s) * 240px) 100%;
  image-rendering: pixelated; filter: brightness(0.85); }
.ccl-bench-item { position: absolute; bottom: calc(var(--s) * 18px); transform: translateX(-50%); line-height: 0; }
.ccl-coin { bottom: calc(var(--s) * 17px); }
.ccl-wide { display: none; }
@media (min-width: 700px) { .ccl-wide { display: block; } }
.ccl-bob { animation: ccl-bob 3s step-end infinite; }
@keyframes ccl-bob { 50% { transform: translateY(calc(var(--s) * -1px)); } }

/* ---- the column */
.ccl-scroll { position: absolute; inset: 0; overflow-x: hidden; overflow-y: auto; display: grid;
  padding: var(--top) 16px calc(var(--s) * 24px); }
.ccl-col { margin: auto; max-width: 100%; display: grid; justify-items: center; gap: var(--gap); position: relative; }
.ccl-brand, .ccl-side { display: grid; justify-items: center; gap: var(--gap); max-width: 100%; }
.ccl-side { width: 100%; }

.ccl-hero { position: relative; display: grid; place-items: center; margin-top: calc(var(--hs) * 4px); }
.ccl-glow { position: absolute; left: 50%; top: 55%; width: calc(var(--hs) * 96px); height: calc(var(--hs) * 64px);
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 211, 77, 0.34), rgba(255, 160, 60, 0.1) 60%, transparent);
  animation: ccl-glow 5s ease-in-out infinite alternate; }
@keyframes ccl-glow { from { opacity: 0.8; } to { opacity: 1; } }
.ccl-float { animation: ccl-float 4s ease-in-out infinite alternate; }
@keyframes ccl-float { from { transform: translateY(0); } to { transform: translateY(calc(var(--hs) * -3px)); } }
.ccl-chest { position: relative; }
.ccl-key { position: absolute; right: calc(var(--hs) * -7px); bottom: calc(var(--hs) * -1px); }
.ccl-shadow { position: absolute; left: 50%; bottom: calc(var(--hs) * -2px); width: calc(var(--hs) * 48px); height: calc(var(--hs) * 5px);
  transform: translateX(-50%); border-radius: 50%; background: rgba(0, 0, 0, 0.5); }

.ccl-logo { margin: 0; font-size: calc(var(--lp) * 8px); line-height: 1.25; font-weight: 400; white-space: nowrap; text-align: center;
  filter: drop-shadow(0 calc(var(--lp) * 1px) 0 #8a4b2a) drop-shadow(0 calc(var(--lp) * 1px) 0 #4a2416)
    drop-shadow(calc(var(--lp) * 1px) 0 0 ${INK}) drop-shadow(calc(var(--lp) * -1px) 0 0 ${INK})
    drop-shadow(0 calc(var(--lp) * 1px) 0 ${INK}) drop-shadow(0 calc(var(--lp) * -1px) 0 ${INK}); }
.ccl-logo span { -webkit-background-clip: text; background-clip: text; color: transparent; }
.ccl-logo-case { background-image: linear-gradient(#ffb3a8, #eb4b4b 55%, #a8262b); }
.ccl-logo-rest { background-image: linear-gradient(#fff3b0, ${GOLD} 55%, #c98a12); }
.ccl-tagline { margin: 0; font-size: var(--fs); line-height: 2; color: ${TEXT}; text-align: center; text-shadow: 0 2px 0 ${INK}; }

/* ---- the panel */
.ccl-panel { width: 100%; max-width: var(--panel); display: grid; gap: 10px; padding: 12px; background: #1d1517;
  border: 4px solid #4a3328; box-shadow: 0 0 0 2px ${INK}, inset 0 0 0 2px ${INK}, 0 8px 0 rgba(0, 0, 0, 0.45); }
.ccl-panel-title { margin: 2px 0 4px; font-size: var(--fs); color: ${GOLD}; text-align: center; text-shadow: 0 2px 0 ${INK};
  display: flex; align-items: center; gap: 10px; }
.ccl-panel-title::before, .ccl-panel-title::after { content: ""; flex: 1; height: 2px; background: #4a3328; }
.ccl-stack { display: grid; gap: 10px; }

.ccl-btn, .ccl-wallet > button { position: relative; width: 100%; min-height: 48px; padding: 10px 40px; border: 0; border-radius: 0;
  font: inherit; font-size: 16px; line-height: 1.4; color: ${CREAM}; cursor: pointer; text-shadow: 0 2px 0 #4a2416;
  ${bevel("#8a4b2a", "#c27a4a", "#4a2416")} }
.ccl-primary, .ccl-wallet > button { color: ${INK}; text-shadow: none; ${bevel(GOLD, "#fff3b0", "#c98a12")} }
.ccl-btn:hover:not(:disabled), .ccl-wallet > button:hover:not(:disabled) { filter: brightness(1.12); }
.ccl-btn:active:not(:disabled) { transform: translateY(2px); ${bevel("#8a4b2a", "#c27a4a", "#4a2416", true)} }
.ccl-primary:active:not(:disabled), .ccl-wallet > button:active:not(:disabled) { transform: translateY(2px); ${bevel(GOLD, "#fff3b0", "#c98a12", true)} }
.ccl-btn:disabled { filter: grayscale(1) brightness(0.6); cursor: default; }
.ccl-btn:focus-visible, .ccl-wallet > button:focus-visible, .ccl-link:focus-visible, .ccl-lang button:focus-visible,
.ccl-remember input:focus-visible + .ccl-tick { outline: 2px solid ${GOLD}; outline-offset: 3px; }
.ccl-btn-icon { position: absolute; left: 12px; top: 50%; width: 20px; height: 20px; transform: translateY(-50%); image-rendering: pixelated; }
.ccl-wallet { display: grid; }
.ccl-wallet > span[role="alert"] { font-family: inherit; font-size: var(--fs) !important; line-height: 1.8; color: #ff7a6b !important; }

.ccl-link { justify-self: center; padding: 6px; border: 0; background: none; font: inherit; font-size: var(--fs); line-height: 1.8;
  color: ${DIM}; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ccl-link:hover:not(:disabled) { color: ${TEXT}; }
.ccl-link:disabled { opacity: 0.5; cursor: default; }
.ccl-guest { text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }

.ccl-input { width: 100%; padding: 12px; border: 0; border-radius: 0; outline: none; font: inherit; font-size: 16px; color: ${TEXT};
  background: ${INK}; box-shadow: inset 0 2px 0 #000, 0 0 0 2px #4a3328; }
.ccl-input:focus { box-shadow: inset 0 2px 0 #000, 0 0 0 2px ${GOLD}; }
.ccl-input::placeholder { color: #6f6158; opacity: 1; }
.ccl-input:disabled { opacity: 0.6; }

.ccl-remember { position: relative; justify-self: center; display: flex; align-items: center; gap: 10px; padding: 4px;
  font-size: var(--fs); color: ${DIM}; cursor: pointer; }
.ccl-remember input { position: absolute; opacity: 0; width: 0; height: 0; }
.ccl-tick { color: ${DIM}; line-height: 0; }
.ccl-tick.on { color: ${GOLD}; }
.ccl-hint, .ccl-error { margin: 0; font-size: var(--fs); line-height: 1.9; text-align: center; overflow-wrap: anywhere; }
.ccl-hint { color: ${DIM}; }
.ccl-hint strong { color: ${TEXT}; font-weight: 400; }
.ccl-error { color: #ff7a6b; }

.ccl-lang { display: flex; gap: 6px; }
.ccl-lang button { min-width: 44px; padding: 6px 8px; border: 0; border-radius: 0; font: inherit; font-size: var(--fs); cursor: pointer;
  color: ${DIM}; background: rgba(18, 14, 16, 0.8); box-shadow: 0 0 0 2px #4a3328; }
.ccl-lang button[aria-pressed="true"] { color: ${INK}; background: ${GOLD}; box-shadow: 0 0 0 2px ${INK}; }

/* Layout tiers. Narrow (phones, portrait): one column under the reel; a short one drops the reel and
   shrinks the chest. Wide with limited height (laptops, a 1080p browser window): the brand left, the
   panel right. Wide and tall (a full 1080p screen): one big column. */
@media (max-width: 899px) and (max-height: 720px) { .ccl-root { --hs: 3; --gap: 10px; --top: 16px; } .ccl-reel { display: none; } }
@media (min-width: 900px) { .ccl-root { --lp: 4; } .ccl-col { grid-template-columns: auto minmax(0, var(--panel)); column-gap: 56px; align-items: center; } }
@media (min-width: 900px) and (min-height: 760px) { .ccl-root { --s: 3; --hs: 5; } }
@media (min-width: 900px) and (max-height: 560px) { .ccl-root { --hs: 3; --top: 16px; } .ccl-reel { display: none; } }
@media (min-width: 1200px) { .ccl-root { --lp: 5; --panel: 420px; } .ccl-col { column-gap: 72px; } }
@media (min-width: 1200px) and (min-height: 760px) { .ccl-root { --fs: 16px; --panel: 460px; } }
@media (min-width: 1200px) and (min-height: 1000px) { .ccl-root { --s: 4; --hs: 6; --lp: 6; --fs: 16px; --panel: 480px; }
  .ccl-col { grid-template-columns: none; } }

@media (prefers-reduced-motion: reduce) {
  .ccl-root *, .ccl-root *::before, .ccl-root *::after { animation: none !important; transition: none !important; }
}
`;
