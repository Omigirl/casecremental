import { useContext, useState, type ReactNode } from "react";
import type { AudioEngine } from "../fx/audio/AudioEngine";
import { SOUNDS, type SoundId } from "../fx/audio/sounds";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import type { RarityId } from "../sim/types";
import { PxButton, UiEnvContext } from "./parts";

// Dev builds only (Settings shows it when import.meta.env.DEV): every generated sound with one
// button per variant, played exactly as generated, and the stage loops (every loop of every playlist, the finale
// and the credits, with a skip to hear each hand-over) — for listening through
// the audio before re-rolling any of it — and a forced next drop, to see the big moments on
// demand. English only; players never see it.

export function SoundBoard({
  audio,
  stage,
  onForce,
  onCheat,
  onClose,
}: {
  audio: AudioEngine;
  stage: number;
  /** A rarity for the next drop, or "fake": an ordinary drop with a fake tease. */
  onForce: (r: RarityId | "fake") => void;
  /** Dev cheats to reach the vault quickly. */
  onCheat?: (c: "cash" | "unlockAll") => void;
  onClose: () => void;
}): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const [armed, setArmed] = useState<RarityId | "fake" | null>(null);
  const [credits, setCredits] = useState(false);
  const force = (r: RarityId | "fake") => {
    onForce(r);
    setArmed(r);
  };
  const close = () => {
    if (credits) audio.setTrack(null); // the credits were the board's; hand the music back
    audio.setStage(stage); // back to the game's own loop
    onClose();
  };
  /** The credits were the board's track: drop it (and its highlight) so a stage button or Off takes over. */
  const leaveCredits = () => {
    if (credits) (audio.setTrack(null), setCredits(false));
  };
  const playStage = (s: number) => {
    leaveCredits();
    audio.setMusicOn(true);
    audio.setStage(s);
  };
  /** One loop of a stage's playlist, held (the credits stop first). */
  const audition = (s: number, i: number) => {
    leaveCredits();
    audio.setMusicOn(true);
    audio.auditionLoop(s, i);
  };
  return (
    <div className="cc-modal" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        role="dialog"
        aria-label="Sound board"
        style={{
          display: "grid",
          gap: 2 * scale,
          padding: 4 * scale,
          maxHeight: "90%",
          overflowY: "auto",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-title">SOUND BOARD (DEV)</div>
        <div className="cc-row-line">
          <span>Music</span>
          <span className="cc-tabs">
            <PxButton onClick={() => playStage(1)}>Sober</PxButton>
            <PxButton onClick={() => playStage(2)}>Buzzed</PxButton>
            <PxButton onClick={() => playStage(3)}>High</PxButton>
            <PxButton onClick={() => playStage(4)}>Tripping</PxButton>
            <PxButton onClick={() => playStage(5)}>Unhinged</PxButton>
            <PxButton onClick={() => audio.skipLoop()}>Next loop</PxButton>
            <PxButton on={credits} onClick={() => (audio.setMusicOn(true), audio.setTrack("credits", { loop: false }), setCredits(true))}>
              Credits
            </PxButton>
            <PxButton
              onClick={() => {
                leaveCredits();
                audio.setMusicOn(false);
              }}
            >
              Off
            </PxButton>
          </span>
        </div>
        <div className="cc-row-line">
          <span>Loops</span>
          <span className="cc-tabs">
            {[3, 4, 5].flatMap((s) =>
              Array.from({ length: audio.loopCount(s) }, (_, i) => (
                <PxButton key={`${s}-${i}`} onClick={() => audition(s, i)}>
                  {s === 5 && i === audio.loopCount(5) - 1 ? "5·F" : `${s}·${i + 1}`}
                </PxButton>
              )),
            )}
          </span>
        </div>
        <div className="cc-row-line">
          <span>Next drop</span>
          <span className="cc-tabs">
            <PxButton on={armed === "classified"} onClick={() => force("classified")}>
              Pink
            </PxButton>
            <PxButton on={armed === "covert"} onClick={() => force("covert")}>
              Covert
            </PxButton>
            <PxButton on={armed === "gold"} onClick={() => force("gold")}>
              ★
            </PxButton>
            <PxButton on={armed === "fake"} onClick={() => force("fake")}>
              Fake
            </PxButton>
          </span>
        </div>
        {onCheat ? (
          <div className="cc-tabs">
            <PxButton onClick={() => onCheat("cash")}>+$100K (DEV)</PxButton>
            <PxButton onClick={() => onCheat("unlockAll")}>UNLOCK ALL (DEV)</PxButton>
          </div>
        ) : null}
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
