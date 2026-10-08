import { PIXEL_FONT } from "../fx/hd/font";

// The overlay's stylesheet. Sizes come from two CSS variables set on the root: --px (the pixel
// world's integer scale) and --fs (the text size, a multiple of 8). Buttons use the sliced
// ui-button art when it exists (--btn-normal / --btn-hover / --btn-pressed), else a pixel bevel.

export const UI_CSS = `
.cc-root { font-family: ${PIXEL_FONT}; color: #f2e9dc; font-size: var(--fs); line-height: 1.5; -webkit-font-smoothing: none; }
.cc-root * { box-sizing: border-box; }
.cc-panel { position: absolute; pointer-events: auto; display: flex; flex-direction: column; gap: calc(var(--px) * 3px); overflow: hidden; }
.cc-title { color: #ffd34d; text-align: center; text-shadow: 0 calc(var(--px) * 1px) 0 #120e10; }
.cc-dim { color: #a89a8c; }
.cc-scroll { overflow-y: auto; display: flex; flex-direction: column; gap: calc(var(--px) * 3px); min-height: 0; }
.cc-row { display: grid; gap: calc(var(--px) * 1px); padding: calc(var(--px) * 1px); background: rgba(18, 14, 16, 0.55); box-shadow: 0 0 0 var(--px) #120e10 inset; }
.cc-row-line { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--px) * 2px); }
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
`;
