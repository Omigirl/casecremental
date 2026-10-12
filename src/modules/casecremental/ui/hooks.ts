import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { tableLayout, type TableLayout } from "../fx/pixel/layout";
import { hdFontSize } from "../fx/pixel/screen";
import { pixelViewport, type PixelViewport } from "../fx/pixel/viewport";
import { getLang, onLangChange, type Lang } from "../i18n/index";
import { getPrefs, onPrefsChange, type Prefs } from "./prefs";
import { cashTweenAt } from "./cash";
import { buttonImages } from "./pixelFrame";

/** Re-render on a language switch (strings are read through t() during render). */
export const useLang = (): Lang => useSyncExternalStore(onLangChange, getLang);

export const usePrefs = (): Prefs => useSyncExternalStore(onPrefsChange, getPrefs);

export interface PixelUi {
  vp: PixelViewport;
  l: TableLayout;
  /** Text size in CSS px (a multiple of 8). */
  fs: number;
}

/** The same viewport and table layout the canvas uses, from the overlay's own size. */
export function usePixelUi(ref: RefObject<HTMLElement | null>): PixelUi | null {
  const [ui, setUi] = useState<PixelUi | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const vp = pixelViewport(width, height);
      setUi({ vp, l: tableLayout(vp), fs: hdFontSize(vp.scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return ui;
}

/** The ui-button sheet sliced into normal / hover / pressed images (null until ready or missing). */
export function useButtonImages(): string[] | null {
  const [images, setImages] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    void buttonImages().then((imgs) => alive && setImages(imgs));
    return () => {
      alive = false;
    };
  }, []);
  return images;
}

/** `flag`, turning on after `delayFor(wasOffSinceMount)` ms — so a screen can wait for an animation the
 *  player is watching, yet come back at once after a reload. */
export function useDelayedFlag(flag: boolean, delayFor: (wasOffSinceMount: boolean) => number): boolean {
  const wasOff = useRef(!flag);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      wasOff.current = true;
      setShown(false);
      return;
    }
    const ms = delayFor(wasOff.current);
    if (ms <= 0) {
      setShown(true);
      return;
    }
    const id = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(id);
  }, [flag]);
  return flag && shown;
}

/** `cash`, counting from its last shown value to a new one over `ms` (the HUD's number). */
export function useAnimatedCash(cash: number, ms: number): number {
  const [shown, setShown] = useState(cash);
  const current = useRef(cash);
  useEffect(() => {
    const from = current.current;
    if (from === cash) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = ms > 0 ? (now - start) / ms : 1;
      current.current = cashTweenAt(from, cash, progress);
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [cash, ms]);
  return shown;
}
