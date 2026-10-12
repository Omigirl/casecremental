import type { FeatureScreenProps } from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import { useEffect, useState, type ReactNode } from "react";
import { getLang, t } from "../../i18n/index";
import { LEADERBOARD_ID } from "../../meta/clientPort";
import { formatCash } from "../../sim/format";
import { useLang } from "../hooks";
import { boardRows, shortAddress, type BoardRow } from "./lobbyRules";

// The lobby's Leaderboard (plan F7): best_run, whose score is floor(log10(lifetime earnings) × 1000), shown as
// money again. Read once when the tab opens; a failed read says so and nothing else breaks.

type Load = { kind: "loading" } | { kind: "offline" } | { kind: "ok"; rows: BoardRow[] };

export function Leaderboard(_: FeatureScreenProps): ReactNode {
  useLang(); // labels and money follow the language
  const client = useIDosGamesClient();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await client.leaderboard.getLeaderboard(LEADERBOARD_ID);
      if (!live) return;
      if (!r.ok) return setLoad({ kind: "offline" });
      const top = r.data.TopUsers ?? [];
      const wallets: Record<string, string> = {}; // plan F8 fills these from the Public key cc_wallet
      setLoad({ kind: "ok", rows: boardRows(top, wallets, client.auth.context?.userID ?? null) });
    })();
    return () => {
      live = false;
    };
  }, [client]);
  if (load.kind === "loading") return <p style={{ padding: 16 }}>{t("lobby.loading")}</p>;
  if (load.kind === "offline") return <p style={{ padding: 16 }}>{t("lobby.offline")}</p>;
  if (load.rows.length === 0) return <p style={{ padding: 16 }}>{t("lobby.empty")}</p>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 16, display: "grid", gap: 6 }}>
      {load.rows.map((r) => (
        <li key={r.userId} style={{ display: "grid", gridTemplateColumns: "3em 1fr auto", gap: 8, fontWeight: r.me ? 700 : 400 }}>
          <span>#{r.rank}</span>
          <span style={{ overflowWrap: "anywhere" }}>
            {r.me ? `${t("lobby.you")} · ` : ""}
            {r.name ?? (r.wallet ? `◎ ${shortAddress(r.wallet)}` : t("lobby.player"))}
          </span>
          <span title={t("lobby.best")}>{formatCash(r.earnings, getLang())}</span>
        </li>
      ))}
    </ol>
  );
}
