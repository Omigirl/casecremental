import { Texture } from "pixi.js";

// The vault scene's drawn textures (no art): soft glows, spark dots and a crisp four-point pixel star.

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return Texture.from(c);
}

function radial(size: number, mid: number): Texture {
  return canvasTexture(size, size, (g) => {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, `rgba(255,255,255,${mid})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
}

/** The plus-shaped star, 5×5 pixels. */
const STAR = ["..#..", "..#..", "#####", "..#..", "..#.."];

export interface VaultTextures {
  soft: Texture;
  dot: Texture;
  star: Texture;
}

export function vaultTextures(): VaultTextures {
  const star = canvasTexture(20, 20, (g) => {
    g.fillStyle = "#fff";
    STAR.forEach((row, y) => [...row].forEach((c, x) => c === "#" && g.fillRect(x * 4, y * 4, 4, 4)));
  });
  star.source.scaleMode = "nearest"; // crisp at any spark size
  return { soft: radial(128, 0.45), dot: radial(16, 0.6), star };
}
