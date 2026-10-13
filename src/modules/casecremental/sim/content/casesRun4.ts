import type { CaseDef } from "../types";
import { p, skin } from "./skinHelpers";

// Run 4: cases 8–9 (glitch, fever dream), finish spec §7.1 — every skin moves. Glitch stutters (`glitch`: holds,
// then jumps); Fever Dream melts (`drip`) or turns (`flow`).

const gl = { pattern: "glitch", fps: 6 } as const; // 8 frames a loop, 4 held steps: 3 jumps a second
const drip = { pattern: "drip", fps: 6 } as const;
const flow = { pattern: "flow", fps: 6 } as const;

const glitch: CaseDef = {
  id: "glitch",
  name: "Glitch Case",
  theme: "glitch",
  tier: 8,
  color: "#0b0f14",
  skins: [
    skin("gl_deadpixel", "Dead Pixel", "rifle", "milspec", p("datamosh", ["#05070a", "#1c2430", "#3a6a7a", "#d0f0ff"], 5, 711), gl),
    skin("gl_compression", "Compression", "pistol", "milspec", p("datamosh", ["#0a0a0a", "#2b2b38", "#6a5acd", "#e6e6fa"], 6, 712), gl),
    skin("gl_static", "Static", "smg", "milspec", p("scanline", ["#080808", "#303030", "#8a8a8a", "#f0f0f0"], 6, 713), gl),
    skin("gl_buffer", "Buffer Underrun", "shotgun", "milspec", p("scanline", ["#050510", "#14143a", "#3f51b5", "#c5cae9"], 5, 714), gl),
    skin("gl_404", "Error 404", "mg", "milspec", p("rgbsplit", ["#0a0a0a", "#262626", "#ff0040", "#00e5ff"], 5, 715), gl),
    skin("gl_vhs", "VHS Rewind", "rifle", "restricted", p("scanline", ["#0d0221", "#3b0a57", "#ff2a6d", "#05d9e8"], 6, 721), gl),
    skin("gl_tear", "Screen Tear", "heavyPistol", "restricted", p("rgbsplit", ["#000000", "#1b1b2f", "#e43f5a", "#00fff0"], 6, 722), gl),
    skin("gl_corrupt", "Corrupted", "sniper", "restricted", p("datamosh", ["#020202", "#0f3d0f", "#39ff14", "#e6ffe6"], 5, 723), gl),
    skin("gl_chroma", "Chromatic", "smg", "classified", p("rgbsplit", ["#000000", "#2d0036", "#ff00c8", "#00ffea", "#ffffff"], 5, 731), gl),
    skin(
      "gl_mosh",
      "Datamosh",
      "shotgun",
      "classified",
      p("datamosh", ["#000000", "#3a0ca3", "#f72585", "#4cc9f0", "#ffffff"], 4, 732),
      gl,
    ),
    skin(
      "gl_fatal",
      "Fatal Exception",
      "rifle",
      "covert",
      p("scanline", ["#000428", "#0040ff", "#00b4ff", "#e0f7ff", "#ffffff"], 5, 741),
      gl,
    ),
    skin("gl_null", "Null Pointer", "sniper", "covert", p("rgbsplit", ["#000000", "#140014", "#ff1744", "#00e676", "#ffffff"], 6, 742), gl),
    skin("gl_knife", "Segfault", "knife", "gold", p("datamosh", ["#0a0014", "#4a00e0", "#00f0ff", "#ffd700", "#ffffff"], 6, 751), {
      ...gl,
      weapon: "flip",
      fps: 6,
    }),
  ],
};

const feverdream: CaseDef = {
  id: "feverdream",
  name: "Fever Dream Case",
  theme: "fever",
  tier: 9,
  color: "#2a0a3a",
  skins: [
    skin("fd_lullaby", "Lullaby", "rifle", "milspec", p("melt", ["#1a0b2e", "#4a2a6a", "#b892ff", "#ffe6fa"], 5, 811), drip),
    skin("fd_wax", "Candle Wax", "pistol", "milspec", p("melt", ["#1a0f05", "#5a3410", "#ffb347", "#fff4d6"], 6, 812), drip),
    skin("fd_glass", "Stained Glass", "smg", "milspec", p("kaleido", ["#0a0a1a", "#1f4e79", "#c0392b", "#f1c40f"], 5, 813), flow),
    skin("fd_sherbet", "Sherbet", "shotgun", "milspec", p("huecycle", ["#ff9a8b", "#ffd36e", "#a8e6cf", "#c3aed6"], 4, 814), flow),
    skin("fd_softclock", "Soft Clock", "mg", "milspec", p("melt", ["#2b1b0e", "#8c5a2b", "#e8c07d", "#fdf3e1"], 5, 815), drip),
    skin("fd_mirrors", "Hall of Mirrors", "rifle", "restricted", p("kaleido", ["#05050f", "#2e1a47", "#9b59b6", "#f5e6ff"], 6, 821), flow),
    skin("fd_lavalamp", "Lava Lamp", "heavyPistol", "restricted", p("melt", ["#14001f", "#5c0f4a", "#ff4f9a", "#ffd166"], 5, 822), drip),
    skin("fd_halo", "Halo", "sniper", "restricted", p("huecycle", ["#ffd6e0", "#c1fba4", "#7bf1a8", "#90f1ef"], 5, 823), flow),
    skin(
      "fd_kaleido",
      "Kaleidoscope",
      "smg",
      "classified",
      p("kaleido", ["#0b0033", "#ff006e", "#ffbe0b", "#3a86ff", "#ffffff"], 5, 831),
      flow,
    ),
    skin(
      "fd_rainbow",
      "Rainbow Road",
      "shotgun",
      "classified",
      p("huecycle", ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"], 5, 832),
      flow,
    ),
    skin("fd_lucid", "Lucid Dream", "rifle", "covert", p("kaleido", ["#000000", "#3c096c", "#ff4d6d", "#ffd60a", "#ffffff"], 6, 841), flow),
    skin(
      "fd_feverpitch",
      "Fever Pitch",
      "sniper",
      "covert",
      p("huecycle", ["#ff0054", "#ff5400", "#ffbd00", "#00f5d4", "#9b5de5"], 6, 842),
      flow,
    ),
    skin("fd_knife", "Daydream", "knife", "gold", p("kaleido", ["#1a0033", "#ff77e9", "#7af8ff", "#fff59d", "#ffffff"], 6, 851), {
      ...flow,
      weapon: "flip",
    }),
  ],
};

export const RUN4_CASES: readonly CaseDef[] = [glitch, feverdream];
