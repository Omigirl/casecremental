import type { CaseDef } from "../types";
import { p, skin } from "./skinHelpers";

// Run 2: cases 4–5 (tech, neon) — animated patterns, one technique per case.

const mainframe: CaseDef = {
  id: "mainframe",
  name: "Mainframe Case",
  theme: "tech",
  tier: 4,
  color: "#1c2b3a",
  skins: [
    skin("mf_busline", "Bus Line", "rifle", "milspec", p("circuit", ["#0b1a14", "#12402b", "#1f7a4d", "#7dffb0"], 5, 311)),
    skin("mf_heatsink", "Heatsink", "pistol", "milspec", p("hex", ["#15181c", "#2c333b", "#56616e", "#9aa7b5"], 4, 312)),
    skin("mf_weave", "Carbon Weave", "smg", "milspec", p("carbon", ["#0a0a0c", "#1d1f24", "#3a3e46", "#6b717c"], 6, 313)),
    skin("mf_board", "Motherboard", "shotgun", "milspec", p("circuit", ["#0a1020", "#16305a", "#2c5fa8", "#9cc4ff"], 5, 314)),
    skin("mf_firewall", "Firewall", "mg", "milspec", p("hex", ["#1a0b05", "#4a1d0a", "#a84a16", "#ffb36b"], 4, 315)),
    skin("mf_overclock", "Overclocked", "rifle", "restricted", p("circuit", ["#100818", "#3a1260", "#8a2be2", "#e0b0ff"], 6, 321)),
    skin("mf_hexcore", "Hex Core", "heavyPistol", "restricted", p("hex", ["#03141a", "#06404f", "#0aa3c2", "#a8f4ff"], 5, 322)),
    skin("mf_blackcarbon", "Black Carbon", "sniper", "restricted", p("carbon", ["#050505", "#141414", "#2b2b2b", "#c9a227"], 7, 323)),
    skin("mf_panic", "Kernel Panic", "smg", "classified", p("circuit", ["#1a0000", "#4d0000", "#d40000", "#ff9090"], 6, 331), {
      pattern: "pulse",
    }),
    skin("mf_lattice", "Quantum Lattice", "shotgun", "classified", p("hex", ["#05001a", "#1a0a5c", "#5b3cff", "#d6ccff"], 6, 332), {
      pattern: "pulse",
    }),
    skin("mf_root", "Root Access", "rifle", "covert", p("circuit", ["#000a02", "#003d10", "#00ff41", "#d0ffd8"], 7, 341), {
      pattern: "pulse",
    }),
    skin("mf_zeroday", "Zero Day", "sniper", "covert", p("hex", ["#0d0010", "#3d0047", "#ff00c8", "#ffe0fa"], 6, 342), {
      pattern: "pulse",
    }),
    skin("mf_knife", "Blue Screen", "knife", "gold", p("circuit", ["#000a2e", "#0033a0", "#3d7bff", "#ffffff"], 8, 351), {
      pattern: "pulse",
      weapon: "flip",
      fps: 5,
    }),
  ],
};

const neon: CaseDef = {
  id: "neon",
  name: "Neon Nights Case",
  theme: "neon",
  tier: 5,
  color: "#2a0a3a",
  skins: [
    skin("nn_drive", "Night Drive", "pistol", "milspec", p("synthgrid", ["#0a0014", "#2b0a4a", "#ff2bd6", "#ffd36b"], 4, 411)),
    skin("nn_glow", "Afterglow", "rifle", "milspec", p("neonline", ["#05000a", "#1a0630", "#ff4fd8", "#7ff7ff"], 5, 412)),
    skin("nn_arcade", "Arcade", "smg", "milspec", p("hueflow", ["#140028", "#ff2b8a", "#ffcc00", "#2bd9ff"], 4, 413)),
    skin("nn_strip", "Strip Light", "shotgun", "milspec", p("neonline", ["#020208", "#101030", "#2b6bff", "#c8f0ff"], 6, 414)),
    skin("nn_retro", "Retrowave", "mg", "milspec", p("synthgrid", ["#05001a", "#3a0a5c", "#00e5ff", "#ff6ad5"], 5, 415)),
    skin("nn_sunset", "Sunset Grid", "rifle", "restricted", p("synthgrid", ["#12001f", "#5c0a6b", "#ff5e3a", "#ffe66b"], 5, 421), {
      pattern: "flow",
    }),
    skin("nn_lasertag", "Laser Tag", "heavyPistol", "restricted", p("neonline", ["#000000", "#0a1a0a", "#39ff14", "#e8ffe0"], 6, 422), {
      pattern: "flow",
    }),
    skin("nn_vapor", "Vaporhaze", "sniper", "restricted", p("hueflow", ["#ff71ce", "#01cdfe", "#05ffa1", "#b967ff", "#fffb96"], 3, 423), {
      pattern: "flow",
    }),
    skin("nn_hotpink", "Hot Pink", "smg", "classified", p("neonline", ["#0a0008", "#3d0030", "#ff1493", "#ffd1ec"], 7, 431), {
      pattern: "flow",
    }),
    skin("nn_outrun", "Outrun", "shotgun", "classified", p("synthgrid", ["#000010", "#24004a", "#ff0080", "#00f0ff", "#fff2a8"], 6, 432), {
      pattern: "flow",
    }),
    skin("nn_demon", "Neon Demon", "rifle", "covert", p("hueflow", ["#2b0010", "#ff003c", "#ff9e00", "#ff00e6"], 5, 441), {
      pattern: "flow",
    }),
    skin(
      "nn_racer",
      "Midnight Racer",
      "sniper",
      "covert",
      p("synthgrid", ["#00000a", "#0a0a3a", "#7a00ff", "#00ffd5", "#ffffff"], 6, 442),
      { pattern: "flow" },
    ),
    skin("nn_knife", "Prism", "knife", "gold", p("hueflow", ["#ff0040", "#ffb300", "#40ff00", "#00c8ff", "#b000ff"], 4, 451), {
      pattern: "flow",
      weapon: "flip",
      fps: 6,
    }),
  ],
};

export const RUN2_CASES: readonly CaseDef[] = [mainframe, neon];
