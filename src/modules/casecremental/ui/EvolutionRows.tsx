import type { ReactNode } from "react";
import type { GameView } from "../game/view";
import { evolutionDesc, evolutionName } from "../i18n/content";
import { getLang, t } from "../i18n/index";
import { formatCash } from "../sim/format";
import type { Act } from "./machineRules";
import { PixelTick, PxButton } from "./parts";
import { partText } from "./run4Rules";

// The evolutions' rows on the Machines tab (finish spec §7.3, Run 4+; hidden before): each evolution's effect and
// recipe (a line per part, its tick box filled when done; Press Start 2P has no check mark), EVOLVE once the recipe
// is complete, EVOLVED once bought.

export function EvolutionRows({ view, act }: { view: GameView; act: Act }): ReactNode {
  const ev = view.evolutions;
  const lang = getLang();
  if (!ev.available) return null;
  return (
    <>
      <div className="cc-title">{t("evo.title")}</div>
      {ev.list.map((e) => (
        <div key={e.id} className="cc-row" lang={lang}>
          <div>{evolutionName(e.id)}</div>
          <div className="cc-dim">{evolutionDesc(e.id)}</div>
          {e.parts.map((p, i) => (
            <div key={i} className={p.done ? "cc-gold" : "cc-dim"} style={{ display: "flex", gap: "0.5em", alignItems: "center" }}>
              <PixelTick on={p.done} />
              {partText(p.part, p.have)}
            </div>
          ))}
          {e.owned ? (
            <PxButton disabled on>
              {t("btn.evolved")}
            </PxButton>
          ) : (
            <PxButton disabled={!e.canBuy} onClick={() => act({ type: "buyEvolution", id: e.id })}>
              {t("btn.evolve")}
              <span className="cc-btn-sub">{formatCash(e.cost, lang)}</span>
            </PxButton>
          )}
        </div>
      ))}
    </>
  );
}
