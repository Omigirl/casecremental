import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Coins } from "../juice/coins";
import { Particles } from "../juice/particles";
import type { Pt, TableLayout } from "../pixel/layout";
import { hdFontSize } from "../pixel/screen";
import type { PixelViewport } from "../pixel/viewport";
import { binLight, lampFlicker, makeMotes, stepMotes, type Box, type Mote } from "./ambience";
import { pixelStyle } from "./font";
import type { LightLevels } from "../vault/lights";

// The full-resolution layer over the pixel world (spec §2): the lamp's warm light, a vignette, dust
// drifting in the light, the glow under the case / reveal, the sleeping bot's Z's, the powered-off
// auto-seller's standby LED, sparks and coins. Everything here is in screen (CSS) px.

const MOTES = 36;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return Texture.from(c);
}

function radial(size: number, stops: Array<[number, string]>): Texture {
  return canvasTexture(size, size, (g) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
}

export class HdLayer {
  readonly root = new Container();
  /** Vignette and flash: over everything, outside the camera zoom. */
  readonly overlay = new Container();
  readonly particles: Particles;
  readonly coins: Coins;
  private readonly textures: Texture[];
  private readonly lamp: Sprite;
  private readonly vignette: Sprite;
  private readonly dust = new Container();
  private readonly glowSprite: Sprite;
  /** Keeps the sell bin findable in the dark bottom corner; brighter while a card waits. */
  private readonly binGlow: Sprite;
  private binCalling = false;
  private readonly zs: Text[] = [];
  private readonly led = new Graphics();
  private readonly flashRect = new Graphics();
  /** Black over the whole scene: 1 - lights.room (blackout and power-up). */
  private readonly veil = new Graphics();
  private lights: LightLevels = { room: 1, lamp: 1, reels: 1, bin: 1, leds: 1 };
  private motes: Mote[] = [];
  private moteBox: Box = { x: 0, y: 0, w: 1, h: 1 };
  private vp: PixelViewport | null = null;
  private l: TableLayout | null = null;
  private t = 0;
  private glowColor = 0xffffff;
  private glowTarget = 0;
  private asleep = true;
  private flashAlpha = 0;
  private sellerOn = false;

  constructor(coinFrames: readonly Texture[]) {
    const cone = canvasTexture(256, 256, (g) => {
      const grad = g.createRadialGradient(128, 0, 0, 128, 0, 256);
      grad.addColorStop(0, "rgba(255,214,150,0.55)");
      grad.addColorStop(0.45, "rgba(255,190,120,0.18)");
      grad.addColorStop(1, "rgba(255,170,100,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    });
    const vignette = radial(256, [
      [0, "rgba(0,0,0,0)"],
      [0.7, "rgba(0,0,0,0.1)"],
      [1, "rgba(0,0,0,0.55)"],
    ]);
    const soft = radial(64, [
      [0, "rgba(255,255,255,1)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    const dot = radial(16, [
      [0, "rgba(255,255,255,1)"],
      [0.5, "rgba(255,255,255,0.6)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    this.textures = [cone, vignette, soft, dot];

    this.lamp = new Sprite({ texture: cone, anchor: { x: 0.5, y: 0 }, blendMode: "add" });
    this.glowSprite = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.binGlow = new Sprite({ texture: soft, anchor: 0.5, blendMode: "add", alpha: 0 });
    this.vignette = new Sprite(vignette);
    for (let i = 0; i < MOTES; i++) this.dust.addChild(new Sprite({ texture: dot, anchor: 0.5, tint: 0xffe2b0 }));
    for (let i = 0; i < 3; i++) {
      const z = new Text({ text: "z", style: pixelStyle(8, 0xbfe8ff) });
      z.anchor.set(0.5);
      this.zs.push(z);
    }
    this.particles = new Particles(dot);
    this.coins = new Coins(coinFrames);
    this.flashRect.alpha = 0;
    this.root.addChild(
      this.lamp,
      this.binGlow,
      this.glowSprite,
      this.dust,
      ...this.zs,
      this.led,
      this.particles.container,
      this.coins.container,
    );
    this.veil.alpha = 0;
    this.overlay.addChild(this.veil, this.vignette, this.flashRect);
  }

  /** The auto-seller's LED: blinking red on standby, steady green once it is on. */
  setSellerOn(on: boolean): void {
    if (on === this.sellerOn) return;
    this.sellerOn = on;
    const k = this.vp?.scale ?? 1;
    this.led
      .clear()
      .circle(0, 0, Math.max(1.5, k * 0.6))
      .fill({ color: on ? 0x3ddc84 : 0xff3b30 });
  }

  layout(l: TableLayout, vp: PixelViewport, screenW: number, screenH: number): void {
    this.l = l;
    this.vp = vp;
    const k = vp.scale;
    this.lamp.position.set(l.lamp.x * k, 0);
    this.lamp.width = l.table.w * k * 1.3;
    this.lamp.height = vp.worldH * k;
    this.vignette.width = screenW;
    this.vignette.height = screenH;
    this.flashRect.clear().rect(0, 0, screenW, screenH).fill({ color: 0xffffff });
    this.veil.clear().rect(0, 0, screenW, screenH).fill({ color: 0x000000 });
    this.moteBox = { x: (l.lamp.x - l.table.w * 0.4) * k, y: 0, w: l.table.w * 0.8 * k, h: (l.table.y + 50) * k };
    this.motes = makeMotes(MOTES, this.moteBox, Math.random);
    this.dust.children.forEach((s) => (s as Sprite).scale.set(Math.max(0.25, k / 16)));
    this.glowSprite.position.set(l.you.reveal.x * k, l.you.reveal.y * k);
    this.glowSprite.width = this.glowSprite.height = 70 * k;
    this.binGlow.position.set(l.bin.x * k, (l.bin.y - 4) * k);
    this.binGlow.width = this.binGlow.height = l.binR * 5 * k;
    for (const z of this.zs) z.style.fontSize = hdFontSize(k);
    this.led
      .clear()
      .circle(0, 0, Math.max(1.5, k * 0.6))
      .fill({ color: this.sellerOn ? 0x3ddc84 : 0xff3b30 });
    this.led.position.set(l.seller.x * k, (l.seller.y - 26) * k);
    this.coins.setScale(k, hdFontSize(k, 16));
  }

  /** Glow under the reveal in the rarity's colour (null fades it out). */
  setGlow(color: number | null): void {
    if (color !== null) this.glowColor = color;
    this.glowTarget = color === null ? 0 : 0.85;
  }

  /** A full-screen flash that fades out (★ drops, stage-ups). */
  flash(color: number, strength = 0.8): void {
    this.flashRect.tint = color;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }

  /** A card is up and waiting to be sold: the bin's light calls for it. */
  setBinCalling(on: boolean): void {
    this.binCalling = on;
  }

  /** The blackout and the power-up drive these (rework spec §4). */
  setLights(l: LightLevels): void {
    this.lights = l;
  }

  setBotAsleep(on: boolean): void {
    this.asleep = on;
  }

  /** World px → screen px. */
  toScreen(p: Pt): Pt {
    const k = this.vp?.scale ?? 1;
    return { x: p.x * k, y: p.y * k };
  }

  update(dt: number): void {
    this.t += dt;
    const flicker = lampFlicker(this.t);
    this.lamp.alpha = 0.75 * flicker * this.lights.lamp;
    stepMotes(this.motes, dt * (this.vp?.scale ?? 1), this.moteBox, this.t);
    this.motes.forEach((m, i) => {
      const s = this.dust.children[i] as Sprite;
      s.position.set(m.x, m.y);
      s.alpha = (0.18 + 0.14 * Math.sin(this.t * 1.3 + m.phase)) * flicker;
    });
    this.glowSprite.tint = this.glowColor;
    this.glowSprite.alpha += (this.glowTarget * (0.85 + 0.15 * Math.sin(this.t * 5)) - this.glowSprite.alpha) * Math.min(1, dt * 6);
    this.led.alpha = (this.sellerOn ? 1 : Math.sin(this.t * Math.PI) > 0 ? 1 : 0.15) * this.lights.leds;
    this.binGlow.tint = this.binCalling ? 0xb8ff8a : 0xffc870;
    this.binGlow.alpha += (binLight(this.binCalling, this.t) * this.lights.bin - this.binGlow.alpha) * Math.min(1, dt * 6);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    this.flashRect.alpha = this.flashAlpha;
    this.veil.alpha = 1 - this.lights.room;
    this.updateZs();
    this.particles.update(dt);
    this.coins.update(dt);
  }

  destroy(): void {
    this.coins.destroy();
    this.root.destroy({ children: true });
    this.overlay.destroy({ children: true });
    for (const t of this.textures) t.destroy(true);
  }

  private updateZs(): void {
    const l = this.l;
    const k = this.vp?.scale ?? 1;
    this.zs.forEach((z, i) => {
      z.visible = this.asleep && !!l;
      if (!l) return;
      const phase = (this.t / 2.4 + i / 3) % 1;
      z.position.set((l.bot.spot.x + 8 + phase * 10) * k, (l.bot.spot.y - 44 - phase * 16) * k);
      z.alpha = Math.sin(phase * Math.PI);
    });
  }
}
