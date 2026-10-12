import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { Camera } from "../fx/camera";
import { popElement } from "../fx/hd/tween";
import type { Rect } from "../fx/pixel/layout";
import type { GameView } from "../game/view";
import { t } from "../i18n/index";
import type { SimEvent } from "../sim/run";
import { usePrefs, type PixelUi } from "./hooks";
import { NewRunCard } from "./NewRunCard";
import { PixelArrow, PxButton } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { getPrefs, setPrefs } from "./prefs";
import { arrowLook, placeBubble, samePlace, type Placement } from "./tutorialPlace";
import {
  acknowledge,
  afterEvent,
  closeCard,
  seed,
  settle,
  skip,
  whatToShow,
  type ShownStep,
  type TargetId,
  type TutorialProgress,
} from "./tutorialRules";
import { firstPresent, isWorldTarget, scrollDelta, worldTargetRect, worldToOverlay } from "./tutorialTargets";

// The tutorial on screen (finish spec §4): a speech bubble with a pixel arrow at the thing to touch, or a new run's
// "what's new" card. tutorialRules decides what shows and when a step ends; this finds the target every frame (a DOM
// element marked data-tut, or a prop on the table through the pixel scale and the camera) and places the bubble
// beside it, never over it. It sits outside the camera's lens: DOM rects already include the camera.
// The progress keeps settling and hearing sim events while nothing shows (Settings open, the vault, a prestige), so a
// step the player finishes behind a hidden bubble still ends.

type OnEvent = (fn: (e: SimEvent) => void) => () => void;

/** Change the stored progress; no write when nothing changed. */
function update(change: (p: TutorialProgress) => TutorialProgress): void {
  const cur = getPrefs().tutorial;
  if (!cur) return;
  const next = change(cur);
  if (next !== cur) setPrefs({ tutorial: next });
}

export function Tutorial({
  view,
  ui,
  camera,
  root,
  onEvent,
  visible,
}: {
  view: GameView;
  ui: PixelUi;
  camera: Camera;
  root: RefObject<HTMLDivElement | null>;
  onEvent: OnEvent;
  /** False while Settings is open or the panels are fading back in. */
  visible: boolean;
}): ReactNode {
  const p = usePrefs().tutorial;
  useEffect(() => {
    if (getPrefs().tutorial === null) setPrefs({ tutorial: seed(view) }); // F3's first load in this browser: from the save
  }, []);
  useEffect(() => update((cur) => settle(cur, view)), [view]);
  useEffect(() => onEvent((e) => update((cur) => afterEvent(cur, e))), []);
  if (!p || !visible) return null;
  const show = whatToShow(p, view);
  if (!show) return null;
  if (show.kind === "card") return <NewRunCard run={show.run} onClose={() => update((cur) => closeCard(cur, show.run))} />;
  return <Bubble key={show.step.id} step={show.step} view={view} ui={ui} camera={camera} root={root} />;
}

/** The arrow's box: 7/8 of a character (the glyph is 7 cells of an 8-px font cell). */
const arrowSize = (ui: PixelUi) => (ui.fs * 7) / 8;

/** The DOM target's element if it is on screen (a closed tab's rows are not rendered; a hidden one has no size). */
function shownMark(host: HTMLElement, id: TargetId): HTMLElement | null {
  const el = host.querySelector<HTMLElement>(`[data-tut="${id}"]`);
  return el && el.offsetWidth > 0 && el.offsetHeight > 0 ? el : null;
}

/** Scroll the row's list (never the overflow-hidden panels, as scrollIntoView would) so the row shows whole. */
function showInList(el: HTMLElement): void {
  const list = el.closest<HTMLElement>(".cc-scroll");
  if (!list) return;
  const a = el.getBoundingClientRect();
  const b = list.getBoundingClientRect();
  list.scrollTop += scrollDelta({ top: a.top, bottom: a.bottom }, { top: b.top, bottom: b.bottom });
}

function Bubble({
  step,
  view,
  ui,
  camera,
  root,
}: {
  step: ShownStep;
  view: GameView;
  ui: PixelUi;
  camera: Camera;
  root: RefObject<HTMLDivElement | null>;
}): ReactNode {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef({ step, view, ui });
  latest.current = { step, view, ui };
  const [place, setPlace] = useState<Placement | null>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  // every frame: the target moves with the camera, a resize, a scroll, a tab switch or a language switch. The bubble's
  // size is measured each frame too (OK button, Russian wrapping), so a taller bubble is re-placed, never over its target.
  useEffect(() => {
    let raf = 0;
    let scrolledTo: TargetId | null = null;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const host = root.current;
      const el = box.current;
      if (!host || !el) return;
      const { step, view, ui } = latest.current;
      const origin = host.getBoundingClientRect();
      const id = firstPresent(step.targets, (x) => isWorldTarget(x) || shownMark(host, x) !== null);
      let target: Rect | null = null;
      if (id && isWorldTarget(id)) {
        const r = worldTargetRect(id, ui.l, view.benchCards);
        target = r && worldToOverlay(r, ui.vp.scale, camera.current);
      } else if (id) {
        const mark = shownMark(host, id)!;
        if (scrolledTo !== id) {
          scrolledTo = id; // once per target: the player may scroll the list themselves afterwards
          showInList(mark);
        }
        const r = mark.getBoundingClientRect();
        target = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
      }
      const k = ui.vp.scale;
      const next = target
        ? placeBubble(
            target,
            { w: el.offsetWidth, h: el.offsetHeight },
            { w: origin.width, h: origin.height },
            { gap: arrowSize(ui) + 2 * k, arrow: arrowSize(ui), margin: 2 * k, portrait: ui.vp.portrait },
          )
        : null;
      setPlace((prev) => (samePlace(prev, next) ? prev : next));
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);
  const k = ui.vp.scale;
  const look = place ? arrowLook(place.side, k) : null;
  return (
    <>
      <div
        ref={box}
        className="cc-tut"
        role="status"
        style={{
          left: place?.x ?? 0,
          top: place?.y ?? 0,
          visibility: place ? "visible" : "hidden", // measured before it is placed
          gap: 2 * k,
          padding: 3 * k,
          ...frameCss(uiSpriteUrl("ui-frame"), k),
        }}
      >
        <div>{t(step.text)}</div>
        <div className="cc-row-line">
          <PxButton onClick={() => update(skip)}>{t("tut.skip")}</PxButton>
          {step.ok ? <PxButton onClick={() => update((cur) => acknowledge(cur, step.id))}>{t("tut.ok")}</PxButton> : null}
        </div>
      </div>
      {place && look ? (
        <div
          className="cc-tut-arrow"
          style={
            {
              left: place.arrowX,
              top: place.arrowY,
              width: arrowSize(ui),
              height: arrowSize(ui),
              rotate: look.rotate,
              "--bob-x": `${look.bobX}px`,
              "--bob-y": `${look.bobY}px`,
            } as CSSProperties
          }
        >
          <PixelArrow />
        </div>
      ) : null}
    </>
  );
}
