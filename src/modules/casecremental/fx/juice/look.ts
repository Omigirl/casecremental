// Targets of each intensity stage's look. Stage 1 (Sober): muted colors, no glow. Stage 2 (Buzzed):
// full color and bloom. Stages 3–5 arrive in milestone 2.

export function lookFor(stage: number): { saturation: number; bloom: number } {
  return stage >= 2 ? { saturation: 0.15, bloom: 0.9 } : { saturation: -0.35, bloom: 0 };
}

/** The bloom pass is full-screen and expensive: run it only while it is visible. */
export function bloomActive(bloomScale: number): boolean {
  return bloomScale > 0.01;
}
