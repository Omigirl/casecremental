import { useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { AudioEngine } from "../fx/audio/AudioEngine";
import type { GameController } from "../game/controller";
import { CaseShelf } from "./CaseShelf";
import { Drawer } from "./Drawer";
import { useButtonImages, useLang, usePixelUi } from "./hooks";
import { Hud } from "./Hud";
import { comboTint } from "./juice";
import { Panel, UiEnvContext } from "./parts";
import { Settings } from "./Settings";
import { SoundBoard } from "./SoundBoard";
import { UI_CSS } from "./styles";
import { UpgradesBoard } from "./UpgradesBoard";
import { useGameView } from "./useGameView";

// The overlay over the canvas, laid out on the same world-pixel grid as the pixel world: HUD on
// top, Upgrades board left and Case shelf right (or a drawer on phones), Settings on demand. The
// layer lets pointer events through to the canvas; only the panels take them.

export function makeGamePanel(controller: GameController, audio: AudioEngine): ComponentType {
  const act = (a: Parameters<GameController["act"]>[0]) => void controller.act(a);
  return function GamePanel(): ReactNode {
    const view = useGameView(controller);
    useLang(); // re-render every string on a language switch
    const root = useRef<HTMLDivElement>(null);
    const ui = usePixelUi(root);
    const buttons = useButtonImages();
    const [settings, setSettings] = useState(false);
    const [soundBoard, setSoundBoard] = useState(false);
    const tint = comboTint(view.combo);
    const scale = ui?.vp.scale ?? 1;
    const vars = {
      "--px": scale,
      "--fs": `${ui?.fs ?? 8}px`,
      ...(buttons && buttons.length >= 3 ? { "--btn-normal": `url("${buttons[0]}")`, "--btn-hover": `url("${buttons[1]}")`, "--btn-pressed": `url("${buttons[2]}")` } : {}),
    } as CSSProperties;
    return (
      <div ref={root} className="cc-root" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...vars }}>
        <style>{UI_CSS}</style>
        <div style={{ position: "absolute", inset: 0, background: `hsla(${tint.hue}, 100%, 55%, ${tint.alpha})`, mixBlendMode: "screen", transition: "background .4s" }} />
        {ui ? (
          <UiEnvContext.Provider value={{ scale, skinnedButtons: !!buttons && buttons.length >= 3, click: () => audio.play("ui-click") }}>
            <Hud view={view} hudH={ui.l.hudH} onSettings={() => {
              audio.play("panel-open");
              setSettings(true);
            }} />
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
            {settings ? (
              <Settings
                onClose={() => setSettings(false)}
                onSoundBoard={import.meta.env.DEV ? () => (setSettings(false), setSoundBoard(true)) : undefined}
              />
            ) : null}
            {import.meta.env.DEV && soundBoard ? <SoundBoard audio={audio} stage={view.stage} onForce={(r) => controller.run.forceNextRarity(r)} onClose={() => setSoundBoard(false)} /> : null}
          </UiEnvContext.Provider>
        ) : null}
      </div>
    );
  };
}
