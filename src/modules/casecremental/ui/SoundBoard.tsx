import { useContext, useState, type ReactNode } from "react";
import type { AudioEngine } from "../fx/audio/AudioEngine";
import { SOUNDS, type SoundId } from "../fx/audio/sounds";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import type { RarityId } from "../sim/types";
import { PxButton, UiEnvContext } from "./parts";

// Dev builds only (Settings shows it when import.meta.env.DEV): every generated sound with one
// button per variant, played exactly as generated, and the stage loops — for listening through
// the audio before re-rolling any of it — and a forced next drop, to see the big moments on
// demand. English only; players never see it.

export function SoundBoard({ audio, stage, onForce, onClose }: { audio: AudioEngine; stage: number; onForce: (r: RarityId) => void; onClose: () => void }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const [armed, setArmed] = useState<RarityId | null>(null);
  const force = (r: RarityId) => {
    onForce(r);
    setArmed(r);
  };
  const close = () => {
    audio.setStage(stage); // back to the game's own loop
    onClose();
  };
  return (
    <div className="cc-modal" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label="Sound board" style={{ display: "grid", gap: 2 * scale, padding: 4 * scale, maxHeight: "90%", overflowY: "auto", ...frameCss(uiSpriteUrl("ui-frame"), scale) }}>
        <div className="cc-title">SOUND BOARD (DEV)</div>
        <div className="cc-row-line">
          <span>Music</span>
          <span className="cc-tabs">
            <PxButton onClick={() => (audio.setMusicOn(true), audio.setStage(1))}>Sober</PxButton>
            <PxButton onClick={() => (audio.setMusicOn(true), audio.setStage(2))}>Buzzed</PxButton>
            <PxButton onClick={() => audio.setMusicOn(false)}>Off</PxButton>
          </span>
        </div>
        <div className="cc-row-line">
          <span>Next drop</span>
          <span className="cc-tabs">
            <PxButton on={armed === "classified"} onClick={() => force("classified")}>Pink</PxButton>
            <PxButton on={armed === "covert"} onClick={() => force("covert")}>Covert</PxButton>
            <PxButton on={armed === "gold"} onClick={() => force("gold")}>★</PxButton>
          </span>
        </div>
        {(Object.keys(SOUNDS) as SoundId[]).map((id) => (
          <div key={id} className="cc-row-line">
            <span>{id}</span>
            <span className="cc-tabs">
              {Array.from({ length: audio.variantCount(id) }, (_, n) => (
                <PxButton key={n} onClick={() => audio.playVariant(id, n)}>
                  {n + 1}
                </PxButton>
              ))}
            </span>
          </div>
        ))}
        <PxButton onClick={close}>CLOSE</PxButton>
      </div>
    </div>
  );
}
