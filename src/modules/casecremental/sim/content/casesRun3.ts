import type { CaseDef } from "../types";
import { p, skin } from "./skinHelpers";

// Run 3: cases 6–7 (space, fire) — every skin moves.

const deepspace: CaseDef = {
  id: "deepspace",
  name: "Deep Space Case",
  theme: "space",
  tier: 6,
  color: "#0a0f2a",
  skins: [
    skin("ds_stardust", "Stardust", "rifle", "milspec", p("starfield", ["#02030a", "#0b1030", "#8090c0", "#ffffff"], 6, 511), {
      pattern: "sparkle",
    }),
    skin("ds_darkmatter", "Dark Matter", "pistol", "milspec", p("nebula", ["#000000", "#0d0221", "#2a0a4a", "#7a5cff"], 4, 512), {
      pattern: "sparkle",
    }),
    skin("ds_orbit", "Orbit", "smg", "milspec", p("starfield", ["#05040f", "#1a1440", "#5e60ce", "#e0e7ff"], 7, 513), {
      pattern: "sparkle",
    }),
    skin("ds_moonrock", "Moonrock", "shotgun", "milspec", p("nebula", ["#111114", "#2e2e36", "#6e6e80", "#d0d0dc"], 5, 514), {
      pattern: "sparkle",
    }),
    skin("ds_comet", "Comet Tail", "mg", "milspec", p("aurora", ["#020414", "#06204a", "#1e90ff", "#e0f7ff"], 5, 515), {
      pattern: "sparkle",
    }),
    skin("ds_aurora", "Aurora", "rifle", "restricted", p("aurora", ["#00050f", "#003d3d", "#00ffa3", "#c48dff"], 5, 521), {
      pattern: "flow",
    }),
    skin("ds_pulsar", "Pulsar", "heavyPistol", "restricted", p("iridescent", ["#0a0a1a", "#3d5afe", "#00e5ff", "#ff4081"], 6, 522), {
      pattern: "shimmer",
    }),
    skin("ds_redgiant", "Red Giant", "sniper", "restricted", p("nebula", ["#0a0000", "#4a0a00", "#ff4500", "#ffd27f"], 4, 523), {
      pattern: "flow",
    }),
    skin("ds_nebula", "Nebula", "smg", "classified", p("nebula", ["#05000f", "#3a0060", "#ff2e97", "#40e0ff", "#fff0ff"], 4, 531), {
      pattern: "flow",
    }),
    skin(
      "ds_oilslick",
      "Oil Slick",
      "shotgun",
      "classified",
      p("iridescent", ["#0b0b12", "#2a1b5c", "#00b3a4", "#e6ff4d", "#ff5ec4"], 5, 532),
      { pattern: "shimmer" },
    ),
    skin("ds_cosmicray", "Cosmic Ray", "rifle", "covert", p("aurora", ["#000000", "#14005c", "#7a00ff", "#00ffd0", "#ffffff"], 6, 541), {
      pattern: "flow",
    }),
    skin(
      "ds_blackhole",
      "Black Hole Sun",
      "sniper",
      "covert",
      p("nebula", ["#000000", "#1a0a00", "#ff7a00", "#ffe08a", "#ffffff"], 5, 542),
      { pattern: "flow" },
    ),
    skin("ds_knife", "Starforged", "knife", "gold", p("iridescent", ["#1a0f3d", "#5b3cff", "#00e5ff", "#ffd700", "#ffffff"], 6, 551), {
      pattern: "shimmer",
      weapon: "flip",
      fps: 6,
    }),
  ],
};

const inferno: CaseDef = {
  id: "inferno",
  name: "Inferno Case",
  theme: "fire",
  tier: 7,
  color: "#3a0a00",
  skins: [
    skin("in_kindling", "Kindling", "rifle", "milspec", p("flame", ["#1a0500", "#5c1400", "#d94a00", "#ffb000"], 5, 611), {
      pattern: "rise",
    }),
    skin("in_cinder", "Cinder", "pistol", "milspec", p("ember", ["#0a0605", "#2a1a14", "#ff5a1f", "#ffd08a"], 6, 612), { pattern: "rise" }),
    skin("in_coals", "Hot Coals", "smg", "milspec", p("ember", ["#100404", "#3a0d0d", "#c2290a", "#ff8c42"], 7, 613), { pattern: "rise" }),
    skin("in_firebrand", "Firebrand", "shotgun", "milspec", p("flame", ["#140000", "#6b0000", "#ff3d00", "#ffd600"], 4, 614), {
      pattern: "rise",
    }),
    skin("in_furnace", "Furnace", "mg", "milspec", p("molten", ["#0d0a08", "#2e241e", "#ff6a00", "#ffe0a3"], 5, 615), { pattern: "flow" }),
    skin("in_wildfire", "Wildfire", "rifle", "restricted", p("flame", ["#0d0200", "#7a1f00", "#ff6f00", "#fff176"], 5, 621), {
      pattern: "rise",
    }),
    skin("in_slag", "Slag", "heavyPistol", "restricted", p("molten", ["#080808", "#262020", "#e03c00", "#ffd28a"], 6, 622), {
      pattern: "flow",
    }),
    skin("in_brimstone", "Brimstone", "sniper", "restricted", p("ember", ["#0f0700", "#3d1f00", "#ffae00", "#fff3b0"], 6, 623), {
      pattern: "rise",
    }),
    skin("in_hellfire", "Hellfire", "smg", "classified", p("flame", ["#0a0000", "#5c0011", "#ff0033", "#ff9e80", "#ffffff"], 5, 631), {
      pattern: "rise",
    }),
    skin("in_meltdown", "Meltdown", "shotgun", "classified", p("molten", ["#020a02", "#0f2e0f", "#39ff14", "#e6ffcc"], 5, 632), {
      pattern: "flow",
    }),
    skin("in_phoenix", "Phoenix", "rifle", "covert", p("flame", ["#1a0033", "#ff0055", "#ff8800", "#ffee00", "#ffffff"], 5, 641), {
      pattern: "rise",
    }),
    skin("in_dragon", "Dragon's Breath", "sniper", "covert", p("molten", ["#050008", "#2d004d", "#ff2bd6", "#ffb000", "#fff6d5"], 6, 642), {
      pattern: "flow",
    }),
    skin("in_knife", "Forgeheart", "knife", "gold", p("molten", ["#1a0a00", "#7a3b00", "#ffb000", "#fff3b0", "#ffffff"], 6, 651), {
      pattern: "flow",
      weapon: "flip",
      fps: 6,
    }),
  ],
};

export const RUN3_CASES: readonly CaseDef[] = [deepspace, inferno];
