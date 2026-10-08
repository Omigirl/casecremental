import { describe, expect, it } from "vitest";
import { Camera, cameraCss } from "./camera";

describe("camera shared with the UI overlay", () => {
  it("maps the scene camera onto a CSS transform around the same focus", () => {
    expect(cameraCss({ focusX: 0, focusY: 0, dx: 0, dy: 0, zoom: 1 })).toEqual({ transformOrigin: "0px 0px", transform: "none" });
    expect(cameraCss({ focusX: 400, focusY: 300, dx: 4, dy: -2, zoom: 1.3 })).toEqual({
      transformOrigin: "400px 300px",
      transform: "translate(4px, -2px) scale(1.3)",
    });
  });

  it("tells listeners only when the camera actually moves", () => {
    const cam = new Camera();
    const seen: number[] = [];
    const off = cam.subscribe((s) => seen.push(s.zoom));
    cam.set({ focusX: 10, focusY: 10, dx: 0, dy: 0, zoom: 1 });
    cam.set({ focusX: 10, focusY: 10, dx: 0, dy: 0, zoom: 1.2 });
    cam.set({ focusX: 10, focusY: 10, dx: 0, dy: 0, zoom: 1.2 });
    off();
    cam.set({ focusX: 10, focusY: 10, dx: 0, dy: 0, zoom: 1 });
    expect(seen).toEqual([1, 1.2]);
  });
});
