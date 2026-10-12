import { PIXEL_FONT } from "../fx/hd/font";
import { NO_SELECT } from "../fx/noSelect";
import { BUBBLE_CHARS } from "./tutorialPlace";

// The overlay's stylesheet. Sizes come from two CSS variables set on the root: --px (the pixel
// world's integer scale) and --fs (the text size, a multiple of 8). Buttons use the sliced
// ui-button art when it exists (--btn-normal / --btn-hover / --btn-pressed), else a pixel bevel.
// The scroll areas never flash a scrollbar (F1: a gutter always reserved, no sideways overflow, room for a pressed button),
// and the game's text is not selectable.
// The tutorial's bubble lets drags through (only its buttons take the pointer); its arrow bobs a world pixel, motion only.

const noSelect = NO_SELECT.map(([k, v]) => `${k}: ${v};`).join(" ");

export const UI_CSS = `
.cc-root { font-family: ${PIXEL_FONT}; color: #f2e9dc; font-size: var(--fs); line-height: 1.5; -webkit-font-smoothing: none; ${noSelect} }
.cc-root * { box-sizing: border-box; }
.cc-root input, .cc-root textarea, .cc-root select, .cc-root [contenteditable="true"] { user-select: text; -webkit-user-select: text; -webkit-touch-callout: default; }
.cc-panel { position: absolute; pointer-events: auto; display: flex; flex-direction: column; gap: calc(var(--px) * 3px); overflow: hidden; }
.cc-title { color: #ffd34d; text-align: center; text-shadow: 0 calc(var(--px) * 1px) 0 #120e10; }
.cc-dim { color: #a89a8c; }
.cc-scroll { overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable both-edges; padding-block: calc(var(--px) * 2px); display: flex; flex-direction: column; gap: calc(var(--px) * 3px); min-height: 0; }
.cc-row { display: grid; gap: calc(var(--px) * 1px); padding: calc(var(--px) * 1px); background: rgba(18, 14, 16, 0.55); box-shadow: 0 0 0 var(--px) #120e10 inset; }
.cc-row-line { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--px) * 2px); }
.cc-pick { position: relative; flex: none; font: inherit; color: #fff6d5; background: none; border: 0; padding: 0; cursor: pointer; line-height: 0; }
.cc-pick:disabled { cursor: default; filter: grayscale(1) brightness(0.6); }
.cc-pick-box { position: absolute; right: calc(var(--px) * -1px); bottom: calc(var(--px) * -1px); display: block; padding: calc(var(--px) * 1px); background: #120e10; color: #a89a8c; line-height: 0; }
.cc-pick-box.on { color: #ffd34d; }
.cc-btn { font: inherit; color: #fff6d5; background: #8a4b2a; border: 0; cursor: pointer; white-space: nowrap;
  padding: calc(var(--px) * 2px) calc(var(--px) * 1px);
  box-shadow: inset 0 calc(var(--px) * -2px) 0 #4a2416, inset 0 var(--px) 0 #c27a4a, 0 0 0 var(--px) #120e10; }
.cc-btn.skinned { background: none; box-shadow: none; border-style: solid; border-width: calc(var(--px) * 4px);
  border-image: var(--btn-normal) 4 fill / calc(var(--px) * 4px) stretch; image-rendering: pixelated; padding: 0 calc(var(--px) * 1px); }
.cc-btn:hover:not(:disabled) { filter: brightness(1.15); }
.cc-btn.skinned:hover:not(:disabled) { filter: none; border-image-source: var(--btn-hover); }
.cc-btn:active:not(:disabled) { transform: translateY(calc(var(--px) * 1px)); }
.cc-btn.skinned:active:not(:disabled) { border-image-source: var(--btn-pressed); }
.cc-btn:disabled { filter: grayscale(1) brightness(0.55); cursor: default; }
.cc-btn.on { color: #120e10; background: #ffd34d; }
.cc-tabs { display: flex; gap: calc(var(--px) * 1px); }
.cc-tabs .cc-btn { flex: 1; padding-left: 0; padding-right: 0; }
.cc-btn .cc-btn-sub { display: block; }
.cc-bar { height: calc(var(--px) * 3px); background: #120e10; box-shadow: 0 0 0 var(--px) #120e10; }
.cc-bar > div { height: 100%; background: #ffd34d; transition: width .2s steps(6); }
.cc-bar.done > div { background: #3ddc84; }
.cc-gold { background: linear-gradient(#fff3b0, #ffd34d 55%, #c98a12); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 calc(var(--px) * 1px) 0 #120e10); }
.cc-modal { position: absolute; inset: 0; pointer-events: auto; display: grid; place-items: center; background: rgba(7, 8, 12, 0.6); }
.cc-slider { width: 100%; accent-color: #ffd34d; }
.cc-tut { position: absolute; display: grid; width: max-content; max-width: min(calc(${BUBBLE_CHARS}em + var(--px) * 18px), calc(100% - var(--px) * 4px)); pointer-events: none; }
.cc-tut .cc-btn { pointer-events: auto; }
.cc-tut .cc-row-line { flex-wrap: wrap; justify-content: flex-end; }
.cc-tut-arrow { position: absolute; pointer-events: none; color: #ffd34d; line-height: 0; animation: cc-tut-bob 1s step-end infinite; }
@keyframes cc-tut-bob { 50% { translate: var(--bob-x) var(--bob-y); } }
@media (prefers-reduced-motion: reduce) { .cc-tut-arrow { animation: none; } }
.cc-hot { position: relative; }
.cc-hot::after { content: ""; position: absolute; left: 0; right: 0; bottom: 100%; height: calc(var(--px) * 4px); pointer-events: none;
  background: linear-gradient(0deg, #e8362a, #ff8a1e 50%, #ffd34d 80%, transparent);
  clip-path: polygon(0 100%, 8% 30%, 16% 100%, 26% 10%, 36% 100%, 48% 25%, 58% 100%, 70% 5%, 80% 100%, 90% 35%, 100% 100%);
  transform-origin: bottom; animation: cc-flame 0.4s steps(2) infinite alternate; }
@keyframes cc-flame { from { opacity: 0.86; transform: scaleY(0.9); } to { opacity: 0.94; transform: scaleY(1.05); } }
@media (prefers-reduced-motion: reduce) { .cc-hot::after { animation: none; } }
`;
