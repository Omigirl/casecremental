import { useState, type ReactNode } from "react";
import { Button, outlined, v } from "@idosgames/react/ui";
import type { Action } from "../game/controller";
import type { CaseView, GameView, UpgradeView } from "../game/view";
import { formatCash } from "../sim/format";
import { SHOP_FRACTION } from "../fx/layout";

// Bottom panel: buy and unlock cases, buy upgrades. Every button sends an Action through the
// controller — the same path as the canvas and the agent.

type Tab = "cases" | "upgrades";
type Act = (a: Action) => void;

const card = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

function CaseCard({ c, act }: { c: CaseView; act: Act }): ReactNode {
  return (
    <div style={card}>
      <div style={{ width: 34, height: 24, borderRadius: 4, background: c.color, opacity: c.unlocked ? 1 : 0.35 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 14 }}>{c.name}</div>
        <div style={{ fontSize: 11, color: v.textDim }}>{c.theme}</div>
      </div>
      {c.unlocked ? (
        <Button size="sm" disabled={!c.canBuy} onClick={() => act({ type: "buyCase", caseId: c.id })}>
          Buy {formatCash(c.price)}
        </Button>
      ) : (
        <Button size="sm" tone="blue" disabled={!c.canUnlock} onClick={() => act({ type: "unlockCase", caseId: c.id })}>
          Unlock {formatCash(c.unlockCost)}
        </Button>
      )}
    </div>
  );
}

function UpgradeRow({ u, act }: { u: UpgradeView; act: Act }): ReactNode {
  return (
    <div style={card}>
      <div style={{ ...outlined, fontSize: 12, color: v.gold, minWidth: 44 }}>
        Lv {u.level}/{u.maxLevel}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 14 }}>{u.name}</div>
        <div style={{ fontSize: 11, color: v.textDim }}>{u.description}</div>
      </div>
      {u.cost === null ? (
        <Button size="sm" tone="grey" disabled>
          MAX
        </Button>
      ) : (
        <Button size="sm" disabled={!u.canBuy} onClick={() => act({ type: "buyUpgrade", id: u.id })}>
          {formatCash(u.cost)}
        </Button>
      )}
    </div>
  );
}

export function Shop({ view, act }: { view: GameView; act: Act }): ReactNode {
  const [tab, setTab] = useState<Tab>("cases");
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: `${SHOP_FRACTION * 100}%`,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, rgba(10,12,18,0.92), rgba(6,7,11,0.98))",
        borderTop: "1px solid #2a2f3d",
        paddingBottom: "var(--idos-safe-bottom, 0px)",
      }}
    >
      <div style={{ display: "flex", gap: 8, padding: "8px 12px" }}>
        <Button size="sm" tone={tab === "cases" ? undefined : "grey"} onClick={() => setTab("cases")}>
          Cases
        </Button>
        <Button size="sm" tone={tab === "upgrades" ? undefined : "grey"} onClick={() => setTab("upgrades")}>
          Upgrades
        </Button>
      </div>
      <div
        className="idos-scroll"
        style={{ overflowY: "auto", padding: "0 12px 12px", display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", alignContent: "start" }}
      >
        {tab === "cases"
          ? view.cases.map((c) => <CaseCard key={c.id} c={c} act={act} />)
          : view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />)}
      </div>
    </div>
  );
}
