import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { AudioEngine } from "../fx/audio/AudioEngine";
import { cameraCss, type Camera } from "../fx/camera";
import type { GameController } from "../game/controller";
import type { SimEvent } from "../sim/run";
import { CaseShelf } from "./CaseShelf";
import { Drawer } from "./Drawer";
import { useButtonImages, useDelayedFlag, useLang, usePixelUi } from "./hooks";
import { Hud } from "./Hud";
import { comboTint } from "./juice";
import { Panel, UiEnvContext } from "./parts";
import { Prestige } from "./Prestige";
import { LIGHTS_UP_SECONDS } from "../fx/vault/lights";
import { prestigeDelayMs } from "./prestigeRules";
import { Settings } from "./Settings";
import { SoundBoard } from "./SoundBoard";
import { Tutorial } from "./Tutorial";
import { UI_CSS } from "./styles";
import { UpgradesBoard } from "./UpgradesBoard";
import { useGameView } from "./useGameView";

// The overlay over the canvas, laid out on the same world-pixel grid as the pixel world: HUD on
// top, Upgrades board left and Case shelf right (or a drawer on phones), Settings on demand, and the tutorial's bubbles
// and new-run cards over everything but Settings. The
// layer lets pointer events through to the canvas; only the panels take them.

/** The HUD and the panels come back as the workshop's lights finish coming on (rework spec §4). */
const UI_BACK_S = Math.round(LIGHTS_UP_SECONDS * 0.8 * 10) / 10;

export function makeGamePanel(controller: GameController, audio: AudioEngine, camera: Camera): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
  const onEvent = (fn: (e: SimEvent) => void) => controller.onEvent(fn);
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    useLang(); // re-render every string on a language switch
    const root = useRef<HTMLDivElement>(null);
    const lens = useRef<HTMLDivElement>(null);
    // the canvas camera's zoom and shake, applied to the HUD and panels without a React render
    useEffect(() => {
      const apply = () => {
        if (lens.current) Object.assign(lens.current.style, cameraCss(camera.current));
      };
      apply();
      return camera.subscribe(apply);
    }, []);
    const ui = usePixelUi(root);
    const buttons = useButtonImages();
    const [settings, setSettings] = useState(false);
    const [soundBoard, setSoundBoard] = useState(false);
    const openSettings = () => {
      audio.play("panel-open");
      setSettings(true);
    };
    const tint = comboTint(view.combo);
    const prestigeShown = useDelayedFlag(view.prestige !== null, prestigeDelayMs);
    // the vault takes the screen (rework spec §4): the HUD, the panels and the drawer fade away until the next run
    const hidden = view.vault.phase !== null || view.over;
    // the tutorial comes back after the panels do (a new run's lights), at once on a reload
    const tutorialBack = useDelayedFlag(!hidden, (wasOff) => (wasOff ? (UI_BACK_S + 0.6) * 1000 : 0));
    const scale = ui?.vp.scale ?? 1;
    const vars = {
      "--px": scale,
      "--fs": `${ui?.fs ?? 8}px`,
      ...(buttons && buttons.length >= 3
        ? { "--btn-normal": `url("${buttons[0]}")`, "--btn-hover": `url("${buttons[1]}")`, "--btn-pressed": `url("${buttons[2]}")` }
        : {}),
    } as CSSProperties;
    return (
      <div ref={root} className="cc-root" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...vars }}>
        <style>{UI_CSS}</style>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `hsla(${tint.hue}, 100%, 55%, ${tint.alpha})`,
            mixBlendMode: "screen",
            transition: "background .4s",
          }}
        />
        {ui ? (
          <UiEnvContext.Provider value={{ scale, skinnedButtons: !!buttons && buttons.length >= 3, click: () => audio.play("ui-click") }}>
            <div ref={lens} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: hidden ? 0 : 1,
                  // visibility (not pointer-events: the panels set their own) takes them out of reach; it flips
                  // at the end of the fade going out; coming back (the next run) they wait for the lights
                  visibility: hidden ? "hidden" : "visible",
                  transition: hidden ? "opacity .5s, visibility .5s" : `opacity .6s ${UI_BACK_S}s, visibility 0s ${UI_BACK_S}s`,
                  pointerEvents: "none",
                }}
              >
                <Hud view={view} hudH={ui.l.hudH} onSettings={openSettings} />
                {ui.l.panelL ? (
                  <Panel rect={ui.l.panelL}>
                    <UpgradesBoard view={view} act={act} />
                  </Panel>
                ) : null}
                {ui.l.panelR ? (
                  <Panel rect={ui.l.panelR}>
                    <CaseShelf view={view} act={act} />
                  </Panel>
                ) : null}
                {ui.vp.portrait ? <Drawer view={view} act={act} top={ui.vp.areaH} /> : null}
              </div>
            </div>
            <Tutorial
              view={view}
              ui={ui}
              camera={camera}
              root={root}
              onEvent={onEvent}
              visible={tutorialBack && !settings && !soundBoard}
            />
            {prestigeShown && view.prestige ? (
              <Prestige p={view.prestige} vault={view.vault.id} act={act} onSettings={openSettings} />
            ) : null}
            {settings ? (
              <Settings
                onClose={() => setSettings(false)}
                onSoundBoard={import.meta.env.DEV ? () => (setSettings(false), setSoundBoard(true)) : undefined}
                onReset={
                  import.meta.env.DEV
                    ? () => {
                        controller.resetProgress();
                        setSettings(false);
                      }
                    : undefined
                }
                onDevRun={
                  import.meta.env.DEV
                    ? (run) => {
                        controller.devStartRun(run);
                        setSettings(false);
                      }
                    : undefined
                }
                onDevCash={
                  import.meta.env.DEV ? () => controller.devAddCash(Math.max(1_000_000, 10 * controller.run.state.cash)) : undefined
                }
              />
            ) : null}
            {import.meta.env.DEV && soundBoard ? (
              <SoundBoard
                audio={audio}
                stage={view.stage}
                onForce={(r) => (r === "fake" ? controller.run.forceFakeTease() : controller.run.forceNextRarity(r))}
                onCheat={(c) => {
                  // dev only: straight into the run's state, like the forced drops
                  if (c === "cash") controller.run.state.cash += 100_000;
                  else controller.run.state.unlocked = controller.run.runCases();
                }}
                onClose={() => setSoundBoard(false)}
              />
            ) : null}
          </UiEnvContext.Provider>
        ) : null}
      </div>
    );
  };
}
