import type { FeatureScreenProps } from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { renderSkinFrame } from "../../fx/skins/motion";
import { caseName, skinName } from "../../i18n/content";
import { t } from "../../i18n/index";
import { parseDoc } from "../../meta/bridge";
import { clientPort } from "../../meta/clientPort";
import { TROPHIES } from "../../meta/trophies";
import { useLang } from "../hooks";
import { ownedTrophyIds, trophyGroups } from "./lobbyRules";

// The lobby's Trophy Case (plan F7): every Covert and ★ trophy, found ones in their colours, the rest as shadows.
// The source is the Trophies catalog — the client's inventory plus what loadMeta answers when the tab opens (the
// client's inventory can lag behind CloudCode's grants). The art is the game's own skin renderer.

const SKINS = new Map(TROPHIES.map((x) => [x.id, x.skin]));
const GOLD = "#ffd34d";
const RED = "#eb4b4b";

function SkinArt({ id, owned }: { id: string; owned: boolean }): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const skin = SKINS.get(id);
    const c = ref.current;
    if (!skin || !c) return;
    const img = renderSkinFrame(skin, 0);
    c.width = img.w;
    c.height = img.h;
    const g = c.getContext("2d");
    if (!g) return;
    const data = g.createImageData(img.w, img.h);
    data.data.set(img.data);
    g.putImageData(data, 0, 0);
  }, [id]);
  return (
    <canvas ref={ref} style={{ width: "100%", imageRendering: "pixelated", filter: owned ? "none" : "brightness(0) opacity(0.35)" }} />
  );
}

/** The trophies loadMeta answers, once per opening of the tab; empty while offline. */
function useServerTrophies(): string[] {
  const client = useIDosGamesClient();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void clientPort(client)
      .call("loadMeta", {})
      .then((r) => {
        const doc = r.kind === "ok" ? parseDoc(r.data) : null;
        if (live && doc) setIds(doc.trophies);
      });
    return () => {
      live = false;
    };
  }, [client]);
  return ids;
}

export function TrophyCase(_: FeatureScreenProps): ReactNode {
  useLang(); // names follow the language
  const state = useUserState();
  const fromServer = useServerTrophies();
  const owned = useMemo(() => ownedTrophyIds(state?.InventoryV2?.UnstackableItems, fromServer), [state, fromServer]);
  const groups = useMemo(() => trophyGroups(owned), [owned]);
  return (
    <div style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ fontWeight: 700 }}>{t("lobby.count", { n: owned.size, total: TROPHIES.length })}</div>
      {groups.map((g) => (
        <section key={g.source}>
          <h3 style={{ margin: "0 0 8px" }}>{g.source === "vaults" ? t("lobby.vaults") : caseName(g.source)}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {g.cells.map((c) => (
              <figure
                key={c.id}
                title={c.owned ? skinName(c.id) : t("lobby.locked")}
                style={{
                  margin: 0,
                  padding: 6,
                  borderRadius: 6,
                  border: `2px solid ${c.rarity === "gold" ? GOLD : RED}`,
                  opacity: c.owned ? 1 : 0.6,
                }}
              >
                <SkinArt id={c.id} owned={c.owned} />
                <figcaption style={{ fontSize: 11, textAlign: "center", overflowWrap: "break-word" }}>
                  {c.owned ? skinName(c.id) : "?"}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
