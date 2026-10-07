// Synthesized sound effects (WebAudio, no files). Browsers start audio suspended until a user
// gesture, so the World calls unlock() on the first pointerdown anywhere on the page.

type Webkit = { webkitAudioContext?: typeof AudioContext };

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.5;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as Webkit).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  tick(combo: number): void {
    this.tone(900 + Math.min(combo, 50) * 12, 0.03, "square", 0.05);
  }

  click(): void {
    this.tone(500, 0.05, "triangle", 0.08);
  }

  thump(strength: number): void {
    this.tone(90, 0.35, "sine", 0.5 * strength, 40);
  }

  coin(combo: number): void {
    const f = 1200 * (1 + Math.min(combo, 50) * 0.02);
    this.tone(f, 0.08, "triangle", 0.12);
    setTimeout(() => this.tone(f * 1.5, 0.12, "triangle", 0.1), 60);
  }

  /** 0 = Mil-Spec … 4 = ★: higher rarities ring higher and longer. */
  reveal(rarityIndex: number): void {
    const base = 440 * 2 ** (rarityIndex / 4);
    [0, 4, 7].slice(0, 1 + Math.min(2, rarityIndex)).forEach((semi, i) =>
      setTimeout(() => this.tone(base * 2 ** (semi / 12), 0.25, "triangle", 0.12), i * 70),
    );
  }

  jackpot(): void {
    [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) =>
      setTimeout(() => this.tone(523 * 2 ** (semi / 12), 0.4, "sawtooth", 0.08), i * 90),
    );
    this.thump(1);
  }

  stageUp(): void {
    this.tone(220, 0.6, "sawtooth", 0.1, 880);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number): void {
    const c = this.ctx;
    const m = this.master;
    if (!c || !m || c.state !== "running") return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(m);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
}
