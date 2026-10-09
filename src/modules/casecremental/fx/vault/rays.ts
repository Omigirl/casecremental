import { BEAT_LIGHT_AMPLITUDES } from "./beat";
import { Container, Sprite, type Texture } from "pixi.js";
import type { Pt } from "../pixel/layout";
import { VAULT_CUES, type VaultCues } from "./cues";
import { canvasTexture } from "./textures";

// The light behind the beams (spec 2026-10-09 §1-2, §5): a slowly rotating starburst, the impact's vertical shaft
// and a soft glow at the chest's mouth, strongest while the beams spin and softening in the celebration. The
// beams themselves are the colour (VaultBeams). While the key waits, only the starburst turns, devilish red. Once
// the drop hits, the starburst spins faster and pulses on its beat (the chaos layer's).

/** ~6°/s. */
const STARBURST_SPIN = (6 * Math.PI) / 180;
const SHAFT_SECONDS = 1.6;
/** The light's strength once the celebration has softened it (cues.rays rests here). */
const RESTING = 0.3;
/** At full chaos the starburst spins this many times faster, and swells and brightens this much on a beat. */
const CHAOS_SPIN = 6;
const BEAT_SWELL = 0.08;
const BEAT_LIGHT = BEAT_LIGHT_AMPLITUDES.starburst;

/** The chaos layer's beat (its pulse at the chaos's strength) and strength, 0-1. */
export interface RaysBeat {
  beat: number;
  level: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The opening's light at sim `t`, by the rays' strength (cues.rays) and the chaos's beat: the starburst charging
 *  up to the impact, then following the rays (softened in the celebration) and pulsing on the beat; the impact's
 *  shaft fading out over SHAFT_SECONDS (before its flicker); the glow behind the beams, brightest once the
 *  celebration softens the starburst. */
export function raysLight(t: number, rays: number, beat: number): { starburst: number; shaft: number; glow: number } {
  const celebrating = t >= VAULT_CUES.celebrateFrom;
  const light = celebrating ? clamp01((rays - RESTING) / (1 - RESTING)) : rays;
  const since = t - VAULT_CUES.impact;
  return {
    starburst: since < 0 ? 0.1 * clamp01(t / VAULT_CUES.impact) : 0.12 + 0.3 * light + (celebrating ? 0.1 : 0) + BEAT_LIGHT * beat,
    shaft: since >= 0 ? 0.95 * clamp01(1 - since / SHAFT_SECONDS) : 0,
    glow: since < 0 ? 0 : celebrating ? 0.35 + 0.25 * (1 - light) : 0.35 * rays,
  };
}

export class Rays {
  readonly root = new Container();
  private readonly starburst: Sprite;
  private readonly shaft: Sprite;
  private readonly glow: Sprite;
  private readonly textures: Texture[];
  private burstScale = 1;

  constructor(soft: Texture) {
    // spokes from the centre, fading outward
    const spokes = canvasTexture(512, 512, (g) => {
      const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const w = (Math.PI / n) * (i % 2 ? 0.35 : 0.6);
        g.beginPath();
        g.moveTo(256, 256);
        g.arc(256, 256, 256, a - w, a + w);
        g.closePath();
        g.fill();
      }
    });
    // a vertical shaft: bright in the middle, soft at the edges, fading toward the top
    const shaft = canvasTexture(64, 256, (g) => {
      const h = g.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, "rgba(255,255,255,0)");
      h.addColorStop(0.35, "rgba(255,255,255,0.55)");
      h.addColorStop(0.5, "rgba(255,255,255,1)");
      h.addColorStop(0.65, "rgba(255,255,255,0.55)");
      h.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = h;
      g.fillRect(0, 0, 64, 256);
      g.globalCompositeOperation = "destination-in";
      const v = g.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(0.5, "rgba(0,0,0,0.7)");
      v.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
    });
    this.textures = [spokes, shaft];

    this.starburst = new Sprite({ texture: spokes, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.shaft = new Sprite({ texture: shaft, anchor: { x: 0.5, y: 1 }, blendMode: "add", alpha: 0, tint: 0xfff2c0 });
    this.glow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0, tint: 0xffd34d });
    this.root.addChild(this.starburst, this.glow, this.shaft);
  }

  layout(screen: { w: number; h: number }, chestS: number): void {
    this.starburst.width = this.starburst.height = Math.max(screen.w, screen.h) * 1.2;
    this.burstScale = this.starburst.scale.x;
    this.shaft.width = 26 * chestS;
    this.shaft.height = screen.h * 1.1;
    this.glow.width = this.glow.height = 120 * chestS;
  }

  /** `t` is null while the key waits; `at` is the chest's mouth (open) or middle (waiting). */
  update(dt: number, clock: number, t: number | null, c: VaultCues, at: Pt, chaos: RaysBeat): void {
    this.starburst.position.set(at.x, at.y);
    this.starburst.rotation += dt * STARBURST_SPIN * (1 + CHAOS_SPIN * chaos.level);
    this.starburst.scale.set(this.burstScale * (1 + BEAT_SWELL * chaos.beat));
    if (t === null) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3.1);
      this.starburst.tint = 0xff3020;
      this.starburst.alpha = 0.1 + 0.05 * pulse;
      this.shaft.alpha = this.glow.alpha = 0;
      return;
    }
    const a = raysLight(t, c.rays, chaos.beat);
    this.starburst.tint = 0xffe08a;
    this.starburst.alpha = a.starburst;
    // the impact's shaft of light, handing over to the beams (flickering)
    this.shaft.position.set(at.x, at.y);
    this.shaft.alpha = a.shaft * (0.85 + 0.15 * Math.sin(clock * 9));
    // the soft glow behind the beams
    this.glow.position.set(at.x, at.y);
    this.glow.alpha = a.glow;
  }

  /** Its drawn textures; its root goes with the scene's tree (VaultScene.destroy), once. */
  destroy(): void {
    for (const tex of this.textures) tex.destroy(true);
  }
}
