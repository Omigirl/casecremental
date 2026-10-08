import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { AudioEngine } from "../fx/audio/AudioEngine";
import { cameraCss, type Camera } from "../fx/camera";
import { CASES } from "../sim/content/cases";
import type { GameController } from "../game/controller";
import { CaseShelf } from "./CaseShelf";
import { Drawer } from "./Drawer";
import { useButtonImages, useDelayedFlag, useLang, usePixelUi } from "./hooks";
import { Hud } from "./Hud";
import { comboTint } from "./juice";
import { Panel, UiEnvContext } from "./parts";
import { Prestige } from "./Prestige";
import { prestigeDelayMs } from "./prestigeRules";
import { Settings } from "./Settings";
import { SoundBoard } from "./SoundBoard";
import { UI_CSS } from "./styles";
import { UpgradesBoard } from "./UpgradesBoard";
import { useGameView } from "./useGameView";

// The overlay over the canvas, laid out on the same world-pixel grid as the pixel world: HUD on
// top, Upgrades board left and Case shelf right (or a drawer on phones), Settings on demand. The
// layer lets pointer events through to the canvas; only the panels take them.

export function makeGamePanel(controller: GameController, audio: AudioEngine, camera: Camera): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
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
    const tint = comboTint(view.combo);
    const prestigeShown = useDelayedFlag(view.prestige !== null, prestigeDelayMs);
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
              <Hud
                view={view}
                hudH={ui.l.hudH}
                onSettings={() => {
                  audio.play("panel-open");
                  setSettings(true);
                }}
              />
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
              />
            ) : null}
            {prestigeShown && view.prestige ? <Prestige p={view.prestige} act={act} /> : null}
            {import.meta.env.DEV && soundBoard ? (
              <SoundBoard
                audio={audio}
                stage={view.stage}
                onForce={(r) => (r === "fake" ? controller.run.forceFakeTease() : controller.run.forceNextRarity(r))}
                onCheat={(c) => {
                  // dev only: straight into the run's state, like the forced drops
                  if (c === "cash") controller.run.state.cash += 100_000;
                  else controller.run.state.unlocked = CASES.map((x) => x.id);
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
