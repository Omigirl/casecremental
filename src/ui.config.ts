import { defineUiConfig } from "@idosgames/react/ui";

// The game's interface in ONE place: colours, animations and sounds of every module built on
// @idosgames/react/ui (shop, inventory, heroes, rewards, marketplace, …). Change them here — never in
// a module: an edited catalog module is marked "customized" and stops getting catalog updates.
//
// Everything is optional; what you leave out keeps its default. Uncomment and edit.
export default defineUiConfig({
  // Casecremental's workshop palette (the game's src/modules/casecremental/ui/styles.ts): the host's
  // loading screen, the play-access screen and the lobby share it with the game. The sign-in screen
  // draws its own pixel look (src/base/login/loginCss.ts) in the same colours.
  theme: {
    bgTop: "#2a1d19", // screen background, top of the gradient
    bgBottom: "#120e10", // … and bottom
    panel: "#2b1f1c", // cards and popups
    panelDeep: "#1d1517",
    panelEdge: "#4a3328", // their frame
    text: "#f2e9dc",
    textDim: "#a89a8c",
    gold: "#ffd34d", // prices, highlights, the "claim" button
    goldDeep: "#c98a12",
    shadow: "rgba(10, 6, 8, 0.6)",
    backdrop: "rgba(10, 6, 8, 0.75)",
    well: "rgba(18, 14, 16, 0.6)",
    glow: "rgba(255, 186, 102, 0.22)",
    panelShadow:
      "0 6px 0 rgba(10, 6, 8, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.08)",
    // green: "#59d35b",          // main action buttons
    // radius: 18,                // corner radius of cards, px
    // buttonRadius: 14,          // corner radius of buttons, px
    // font: "'Baloo 2', 'Nunito', system-ui, sans-serif",
    // rarity: { Mythic: "#ff3df5" },   // frame colour of a rarity id (adds to Common…Legendary)
  },
  motion: {
    // enabled: true,             // false — no animations at all
    // speed: 1,                  // 2 — twice as fast, 0.5 — twice as slow
    // intensity: 1,              // bounce/overshoot strength: 0 none … 2 cartoonish
    // rewardFlight: true,        // reward icons fly to the balance counters
    // particles: true,           // particle bursts on claims and purchases
    // stagger: true,             // lists appear item by item
    // respectReducedMotion: true,// follow the system "reduce motion" setting
  },
  sound: {
    // enabled: true,             // false — a silent interface
    // volume: 0.6,               // master volume 0..1 (the player's own volume multiplies it)
    events: {
      // Built-in sounds are synthesized in code (no files). Per event:
      //   "coin"                         — the built-in sound of another event
      //   { url: "https://…/click.mp3" } — your own file (optional volume: 0..1)
      //   { synth: { notes: [{ freq: 880, dur: 0.08, wave: "triangle" }] } } — your own synth
      //   false                          — silence
      // Events: click, tab, open, close, reward, coin, purchase, claim, error, notify, lootbox,
      // levelUp, countTick.
      // click: "tab",
      // countTick: false,
    },
  },
});
