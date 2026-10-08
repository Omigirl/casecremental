# Casecremental M2b-B — Run 1 on screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put everything Plan M2b-A built underneath on screen, so Run 1 plays from the first case to the vault, prestige and the next run: the Bot tab and the bot walking and carrying cards, the claim tray, the day job, Vault Case I with its finale cinematic, and the prestige screen — in English and Russian.

**Architecture:** React panels read `GameView` (already built in M2b-A) and send `Action`s; the canvas reads the sim state every frame (so a reload or a trip to the lobby redraws everything from state) and reacts to sim events for the juice. New logic that can be tested without a renderer lives in small pure modules (`fx/pixel/botPath.ts`, `fx/pixel/traySlots.ts`, `fx/finale.ts`, `fx/hd/rain.ts`, `ui/botBoard.ts`, `ui/prestige.ts`); the Pixi/React classes that use them stay thin and are checked in the browser.

**Tech Stack:** TypeScript (strict), React 19, PixiJS 8, Vitest. Commands: `npx vitest run <path>`, `npm run typecheck`, `npm run build`, `npm run dev` (http://localhost:5180).

**Spec:** `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md` (§3 bot, §4 tray, §6 day job, §7 vault, §8 prestige, §9 saving). Plan M2b-A (`docs/superpowers/plans/2026-10-08-casecremental-m2b-a-run-logic.md`) is the code this plan builds on.

**Not in this plan (→ Plan M2b-C):** multi-open ×2 with stacked reels (spec §5). It changes the sim's single bench, the reel and the bot together, so it gets its own plan once this one has made the run playable.

## Global Constraints

- Every player-visible string goes through `t()` (`i18n/en.ts` + `i18n/ru.ts`) or `i18n/content.ts`, in English and Russian, inside its character budget (`i18n/budgets.ts`; buttons ≤ 8). Dev-only controls are English literals marked `(DEV)`.
- Parody names only — never real CS names. Charms are "charms" / "талисманы"; CLOUT is "CLOUT" / "ХАЙП".
- The canvas reads `controller.run.state` every frame; it never keeps game state of its own that a reload would lose. Sim events only trigger one-shot juice.
- Every input goes through `controller.act` (the one input path). During the vault finale the player's clicks only add sparks.
- Whole-pixel motion in the pixel world (`Actor.place` rounds); smooth motion only in the HD layer.
- No new art or sound files: the bot uses `bot-open` / `bot-sleep`, the rain uses the case sprites, sounds use the existing ids (`bot-beep`, `bot-servo`, `jackpot-swell`, `coin-clink`, `reel-stop`, …).
- Commit trailers: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013MA8Fp47Lkjiuq8tVoGPyt`.

## Review Focus

1. **Reload or a trip to the lobby in the middle of things** (bot mid-walk carrying a card, the finale building, the prestige screen up) → the bot is drawn on its current leg with the card over its head, the finale picks up at its current intensity, and the prestige screen comes back at once without replaying the showcase. Pinned in Task 4 (`botTarget` from a mid-carry job) and Task 7 (`prestigeDelayMs`).
2. **A tray card grabbed while the bot stores another** → releasing it on the bin claims exactly the card that was grabbed. Pinned in Task 5.
3. **Small and portrait screens** → tray slots stay inside the tray and the bot's stations stay on the table at every layout size, with up to 24 tray slots. Pinned in Tasks 4 and 5.
4. **Clicking around during the finale** → nothing can be bought, unlocked or sold; buttons show disabled; a Ricochet case never lands on the bench mid-cinematic. Pinned in Tasks 3 and 6.
5. **Russian text** → every new string fits its budget in both languages. Pinned in Task 1 (the existing budget tests run over every key).

---

## File Structure

All paths are relative to `src/modules/casecremental/` unless they start with `docs/`.

- Modify `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/content.ts` (+ `content.test.ts`) — new strings and content names.
- Create `ui/botBoard.ts` (+ test) — threshold cycling, speed text, CSS colours. Modify `ui/UpgradesBoard.tsx` (Bot tab).
- Modify `ui/dayJob.ts` (+ test), `ui/CaseShelf.tsx` (day job + vault rows), `ui/Hud.tsx` (vault goal), `game/view.ts` (+ test: buttons off while the vault is open).
- Create `fx/pixel/botPath.ts` (+ test), `fx/pixel/BotSprite.ts`. Modify `fx/pixel/anims.ts`, `fx/pixel/Room.ts` (the bot moves out), `fx/World.ts`.
- Create `fx/pixel/traySlots.ts` (+ test), `fx/pixel/cardFace.ts`, `fx/pixel/Tray.ts`. Modify `fx/pixel/Bench.ts` (uses `cardFace`, `swallow()`), `fx/World.ts`.
- Create `fx/finale.ts` (+ test), `fx/hd/rain.ts` (+ test). Modify `sim/run.ts` (+ `sim/vault.test.ts`), `fx/World.ts`.
- Create `ui/prestige.ts` (+ test), `ui/Prestige.tsx`. Modify `ui/hooks.ts`, `ui/GamePanel.tsx`.
- Modify `game/controller.ts` (+ test: `saveNow`), `module.ts`, `ui/Settings.tsx`, `ui/SoundBoard.tsx`, `ui/GamePanel.tsx`.
- Create `docs/feature-history/casecremental-run1.md`; modify `docs/feature-history/README.md`.

---

### Task 1: Strings and content names

**Files:** Modify `i18n/en.ts`, `i18n/ru.ts`, `i18n/budgets.ts`, `i18n/content.ts`, `i18n/content.test.ts`.

**Interfaces:**
- Produces: string keys `btn.wake`, `btn.change`, `btn.dayjob`, `btn.pick`, `btn.picked`, `bot.asleep`, `bot.awake`, `bot.speed` ({n}), `bot.sells`, `bot.waiting`, `float.nopay`, `prestige.title`, `prestige.gained` ({n}), `prestige.total` ({n}), `prestige.trophy`, `prestige.charms` ({n}), `prestige.perks`, `prestige.cost` ({n}), `prestige.level` ({n}, {max}), `prestige.next`; content helpers `charmName(id)`, `charmDesc(id)`, `perkName(id)`, `perkDesc(id)`; `caseName("vault1")`.

- [ ] **Step 1: Write the failing test** — in `i18n/content.test.ts`, extend the imports (`charmDesc, charmName, perkDesc, perkName` from `./content`; `RUN1_CHARMS` from `../sim/charms`; `PERK_IDS` from `../sim/meta`) and add inside `describe("content names", …)`:

```ts
  it("names every Run 1 charm and perk, and the vault, in both languages", () => {
    for (const lang of ["en", "ru"] as const) {
      setLang(lang);
      for (const id of RUN1_CHARMS) {
        expect(charmName(id)).not.toBe("");
        expect(charmDesc(id)).not.toBe("");
      }
      for (const id of PERK_IDS) {
        expect(perkName(id)).not.toBe("");
        expect(perkDesc(id)).not.toBe("");
      }
      expect(caseName("vault1")).not.toBe("");
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/i18n`
Expected: FAIL — `charmName` is not exported.

- [ ] **Step 3: Implement**

`i18n/budgets.ts` — add to `BY_PREFIX` (before the content-name block):

```ts
  ["bot.", 20],
  ["float.", 12],
  ["prestige.", 24],
```

and in the content-name block:

```ts
  ["charm.name.", 18],
  ["charm.desc.", 32],
  ["perk.name.", 18],
  ["perk.desc.", 32],
```

`i18n/en.ts` — add before `} as const;`:

```ts
  "btn.wake": "WAKE",
  "btn.change": "CHANGE",
  "btn.dayjob": "DAY JOB",
  "btn.pick": "PICK",
  "btn.picked": "PICKED",
  "bot.asleep": "Asleep",
  "bot.awake": "Sells for you",
  "bot.speed": "Speed x{n}",
  "bot.sells": "Sells up to:",
  "bot.waiting": "Tray full!",
  "float.nopay": "NO PAY",
  "prestige.title": "VAULT I OPENED",
  "prestige.gained": "+{n} CLOUT",
  "prestige.total": "CLOUT: {n}",
  "prestige.trophy": "★ Vault I trophy",
  "prestige.charms": "CHARMS: PICK {n}",
  "prestige.perks": "PERKS",
  "prestige.cost": "{n} CLOUT",
  "prestige.level": "LV {n}/{max}",
  "prestige.next": "START NEXT RUN",
```

`i18n/ru.ts` — add before `};`:

```ts
  "btn.wake": "РАЗБУДИ",
  "btn.change": "СМЕНИТЬ",
  "btn.dayjob": "ШАБАШКА",
  "btn.pick": "ВЗЯТЬ",
  "btn.picked": "ВЗЯТ",
  "bot.asleep": "Спит",
  "bot.awake": "Продаёт за тебя",
  "bot.speed": "Скорость x{n}",
  "bot.sells": "Продаёт до:",
  "bot.waiting": "Лоток полон!",
  "float.nopay": "НЕ ЗАПЛАТИЛИ",
  "prestige.title": "СЕЙФ I ВСКРЫТ",
  "prestige.gained": "+{n} ХАЙПА",
  "prestige.total": "ХАЙП: {n}",
  "prestige.trophy": "★ Трофей «Сейф I»",
  "prestige.charms": "ТАЛИСМАНЫ: {n}",
  "prestige.perks": "ПЕРКИ",
  "prestige.cost": "{n} ХАЙПА",
  "prestige.level": "УР {n}/{max}",
  "prestige.next": "НОВЫЙ ЗАБЕГ",
```

`i18n/content.ts`:
- imports: add `import type { CharmId } from "../sim/charms";` and `import type { PerkId } from "../sim/meta";`.
- in `CASES` add `vault1: { en: "Vault Case I", ru: "Сейф-кейс I" },`.
- add after `UPGRADES`:

```ts
const CHARMS: Record<CharmId, { name: Pair; desc: Pair }> = {
  luckySeven: {
    name: { en: "Lucky Seven", ru: "Счастливая семёрка" },
    desc: { en: "Every 7th case: Classified+", ru: "Каждый 7-й: засекреч. и выше" },
  },
  rustBucket: {
    name: { en: "Rust Bucket", ru: "Ржавое ведро" },
    desc: { en: "Battle-Scarred pays like FN", ru: "Закалённое платит как новое" },
  },
  pityJar: {
    name: { en: "Pity Jar", ru: "Банка жалости" },
    desc: { en: "+1% Luck per Mil-Spec in a row", ru: "+1% удачи за армейское подряд" },
  },
  doubleTap: {
    name: { en: "Double Tap", ru: "Дабл-тап" },
    desc: { en: "StatTrak drops 3x as often", ru: "StatTrak в 3 раза чаще" },
  },
  ricochet: {
    name: { en: "Ricochet", ru: "Рикошет" },
    desc: { en: "A Covert gives a free case", ru: "Тайное даёт кейс бесплатно" },
  },
  goldRush: {
    name: { en: "Gold Rush", ru: "Золотая лихорадка" },
    desc: { en: "★ pays x10 + a golden hour", ru: "★ платит x10 + золотой час" },
  },
  insider: {
    name: { en: "Insider", ru: "Инсайдер" },
    desc: { en: "Cases cost 30% less", ru: "Кейсы на 30% дешевле" },
  },
  milSpecManiac: {
    name: { en: "Mil-Spec Maniac", ru: "Армейский маньяк" },
    desc: { en: "Mil-Spec x4, the rest x0.5", ru: "Армейское x4, прочее x0,5" },
  },
};

const PERKS: Record<PerkId, { name: Pair; desc: Pair }> = {
  startCash: { name: { en: "Starting Cash", ru: "Стартовый капитал" }, desc: { en: "+$20 at the start of a run", ru: "+$20 в начале забега" } },
  luck: { name: { en: "Four-Leaf", ru: "Клевер" }, desc: { en: "+1 Luck level every run", ru: "+1 уровень удачи в забеге" } },
  charmSlot: { name: { en: "Charm Slot", ru: "Слот талисмана" }, desc: { en: "Carry 2 charms", ru: "Носить 2 талисмана" } },
  botAwake: { name: { en: "Early Bird", ru: "Ранняя пташка" }, desc: { en: "The bot starts awake", ru: "Бот просыпается сразу" } },
  biggerTray: { name: { en: "Bigger Tray", ru: "Большой лоток" }, desc: { en: "+4 claim tray slots", ru: "+4 места в лотке" } },
};
```

- add the helpers after `stageName`:

```ts
export const charmName = (id: CharmId): string => pick(CHARMS[id]?.name);
export const charmDesc = (id: CharmId): string => pick(CHARMS[id]?.desc);
export const perkName = (id: PerkId): string => pick(PERKS[id]?.name);
export const perkDesc = (id: PerkId): string => pick(PERKS[id]?.desc);
```

- in `CONTENT_KEYS`, before `STAGES.forEach(…)`:

```ts
  for (const [k, c] of Object.entries(CHARMS)) {
    rows.push(["charm.name." + k, c.name.en, c.name.ru]);
    rows.push(["charm.desc." + k, c.desc.en, c.desc.ru]);
  }
  for (const [k, p] of Object.entries(PERKS)) {
    rows.push(["perk.name." + k, p.name.en, p.name.ru]);
    rows.push(["perk.desc." + k, p.desc.en, p.desc.ru]);
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental/i18n && npm run typecheck`
Expected: PASS — including every new key's budget test in both languages; typecheck clean. If a budget test fails, shorten the string (never raise the budget of an existing prefix).

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/i18n
git commit -m "feat(i18n): strings for the bot, the day job, the vault and prestige; charm and perk names (EN/RU)"
```

### Task 2: The Bot tab and the day-job button

**Files:** Create `ui/botBoard.ts`, `ui/botBoard.test.ts`; Modify `ui/UpgradesBoard.tsx`, `ui/dayJob.ts`, `ui/dayJob.test.ts`, `ui/CaseShelf.tsx`.

**Interfaces:**
- Consumes: `GameView.bot`, `GameView.dayJob` (M2b-A); Task 1 strings.
- Produces: `SELL_THRESHOLDS: readonly RarityId[]`, `nextThreshold(r)`, `formatSpeed(speed, lang)`, `cssColor(n)`; `dayJobButton(view)` → `{ enabled; progress } | null` (unchanged shape).

- [ ] **Step 1: Write the failing test** — `ui/botBoard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cssColor, formatSpeed, nextThreshold, SELL_THRESHOLDS } from "./botBoard";

describe("the Bot tab helpers", () => {
  it("cycles the sell threshold through every rarity and back", () => {
    let r = SELL_THRESHOLDS[0]!;
    const seen = [r];
    for (let i = 0; i < SELL_THRESHOLDS.length; i++) seen.push((r = nextThreshold(r)));
    expect(seen.slice(0, SELL_THRESHOLDS.length)).toEqual([...SELL_THRESHOLDS]);
    expect(seen[SELL_THRESHOLDS.length]).toBe(SELL_THRESHOLDS[0]);
  });

  it("writes the speed with one decimal at most, in the player's language", () => {
    expect(formatSpeed(1, "en")).toBe("1");
    expect(formatSpeed(8, "en")).toBe("8");
    expect(formatSpeed(1.5157, "en")).toBe("1.5");
    expect(formatSpeed(1.5157, "ru")).toBe("1,5");
  });

  it("turns a Pixi colour into CSS", () => {
    expect(cssColor(0xffd700)).toBe("#ffd700");
    expect(cssColor(0x0000ff)).toBe("#0000ff");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/ui/botBoard`
Expected: FAIL — `Cannot find module './botBoard'`.

- [ ] **Step 3: Implement**

`ui/botBoard.ts`:

```ts
import type { Lang } from "../i18n/index";
import { RARITY_ORDER } from "../sim/rarity";
import type { RarityId } from "../sim/types";

// Small helpers for the Bot tab: the sell threshold cycles through the rarities, the speed reads "x1.5".

export const SELL_THRESHOLDS: readonly RarityId[] = RARITY_ORDER;

export function nextThreshold(r: RarityId): RarityId {
  const i = SELL_THRESHOLDS.indexOf(r);
  return SELL_THRESHOLDS[(i + 1) % SELL_THRESHOLDS.length]!;
}

export function formatSpeed(speed: number, lang: Lang): string {
  const s = String(Math.round(speed * 10) / 10);
  return lang === "ru" ? s.replace(".", ",") : s;
}

export const cssColor = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
```

`ui/UpgradesBoard.tsx`:
- imports: add `import { rarityName } from "../i18n/content";` (merge with the existing content import), `import { RARITY_INFO } from "../sim/rarity";`, `import { cssColor, formatSpeed, nextThreshold } from "./botBoard";`.
- update the header comment's second sentence to: `The bot's tab wakes it and tunes it (M2b); the machines arrive in later runs, so their tab shows LOCKED.`
- add above `UpgradesBoard`:

```tsx
function BotPanel({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = view.bot;
  const lang = getLang();
  if (!b.awake)
    return (
      <div className="cc-row">
        <div>{t("bot.asleep")}</div>
        <div className="cc-dim">{t("bot.awake")}</div>
        <PxButton disabled={!b.canWake} onClick={() => act({ type: "wakeBot" })}>
          {t("btn.wake")}
          <span className="cc-btn-sub">{formatCash(b.wakeCost, lang)}</span>
        </PxButton>
      </div>
    );
  return (
    <>
      <div className="cc-row">
        <div>{t("bot.speed", { n: formatSpeed(b.speed, lang) })}</div>
        <div className="cc-dim">{t("label.level", { n: b.speedLevel })}</div>
        {b.speedCost === null ? (
          <PxButton disabled>{t("btn.max")}</PxButton>
        ) : (
          <PxButton disabled={!b.canBuySpeed} onClick={() => act({ type: "buyBotSpeed" })}>
            {formatCash(b.speedCost, lang)}
          </PxButton>
        )}
      </div>
      <div className="cc-row">
        <div>{t("bot.sells")}</div>
        <div style={{ color: cssColor(RARITY_INFO[b.threshold].color) }}>{rarityName(b.threshold)}</div>
        <PxButton onClick={() => act({ type: "setBotThreshold", rarity: nextThreshold(b.threshold) })}>{t("btn.change")}</PxButton>
      </div>
      {b.waiting ? <div style={{ color: "#ffd34d" }}>{t("bot.waiting")}</div> : null}
    </>
  );
}
```

- in `UpgradesBoard`, the tab buttons: `disabled={id === "machines"}` and `title={id === "machines" ? t("tab.locked") : undefined}`; the body:

```tsx
      <div className="cc-scroll">
        {tab === "you" ? (
          view.upgrades.map((u) => <UpgradeRow key={u.id} u={u} act={act} />)
        ) : tab === "bot" ? (
          <BotPanel view={view} act={act} />
        ) : (
          <div className="cc-dim">{t("tab.locked")}</div>
        )}
      </div>
```

`ui/dayJob.ts` — replace the comment block with:

```ts
// The day job's button (campaign spec §6.1): shown when broke with an empty bench and while the shift
// runs, so a broke player is never stuck.
```

`ui/dayJob.test.ts` — rename the describe to `"the day-job button"`.

`ui/CaseShelf.tsx` — replace the temporary `DayJobRow` with:

```tsx
/** Broke with an empty bench → a ~3 s day job: 90 % +$2, 10 % nothing (campaign spec §6.1). */
function DayJobRow({ view, act }: { view: GameView; act: Act }): ReactNode {
  const b = dayJobButton(view);
  if (!b) return null;
  return (
    <div className="cc-row">
      <PxButton disabled={!b.enabled} onClick={() => act({ type: "startDayJob" })}>
        {t("btn.dayjob")}
      </PxButton>
      {b.enabled ? null : <Bar progress={b.progress} />}
    </div>
  );
}
```

and import `Bar` from `./parts` (with `PxButton, UiEnvContext`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental/ui && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Browser check** — `npm run dev` (or the running server), open the game. Bot tab: asleep with WAKE $22; with cash, WAKE → the tab shows Speed x1, LV 0, a price, "Sells up to: Classified" in its colour, CHANGE cycles it. Switch to RU: every label fits. Spend down to $0 with an empty bench → DAY JOB appears; press it → a progress bar fills for ~3 s → +$2 (or nothing).

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/ui
git commit -m "feat(ui): the Bot tab (wake, speed, sell threshold) and the day-job button"
```

### Task 3: Vault Case I on the shelf

**Files:** Modify `game/view.ts`, `game/view.test.ts`, `ui/CaseShelf.tsx`, `ui/Hud.tsx`.

**Interfaces:**
- Consumes: `GameView.vault`, `run.locked()` (M2b-A); `caseName("vault1")` (Task 1).
- Produces: `CaseView.canBuy` / `canUnlock` and `UpgradeView.canBuy` are false while the vault is open or the run is over.

- [ ] **Step 1: Write the failing test** — append to `game/view.test.ts` inside `describe("buildView — M2b", …)`:

```ts
  it("turns every buy button off while the vault is open and after the run (review minor)", () => {
    const run = new Run(1);
    run.state.unlocked = CASES.map((c) => c.id);
    run.state.cash = DEFAULT_SETUP.vaultPrice + 1e6;
    run.buyVault();
    const v = buildView(run);
    expect(v.cases.some((c) => c.canBuy || c.canUnlock)).toBe(false);
    expect(v.upgrades.some((u) => u.canBuy)).toBe(false);
    expect(v.vault.canBuy).toBe(false);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/game/view`
Expected: FAIL — a case still shows `canBuy: true`.

- [ ] **Step 3: Implement**

`game/view.ts` — in `buildView`, add `const open = !run.locked();` after `const benchFree = …`, and use it:

```ts
      canBuy: open && unlocked && benchFree && s.cash >= run.casePrice(c.id),
      canUnlock: open && !unlocked && previousUnlocked && s.cash >= unlockCostOf(c.id),
```

```ts
      canBuy: open && cost !== null && s.cash >= cost,
```

`ui/Hud.tsx` — in `goalName`, replace the temporary line with:

```ts
  if (goal.kind === "vault") return caseName("vault1");
```

`ui/CaseShelf.tsx` — add the vault row component:

```tsx
/** Vault Case I (M2b spec §7): shown once every case is unlocked; buying it starts the finale. */
function VaultRow({ view, act }: { view: GameView; act: Act }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const v = view.vault;
  if (!v.shown) return null;
  const k = Math.max(1, Math.floor(scale / 2));
  const css = stripFrameCss(spriteIndex().get("case-bedrock"), 0, k, CASE_ICON_ROWS);
  const icon = css ?? { width: 13 * k, height: 10 * k, background: "#ffd34d" };
  return (
    <div className="cc-row" style={{ boxShadow: `0 0 0 ${scale}px #ffd34d inset` }}>
      <div className="cc-row-line">
        <div style={{ ...icon, flex: "none", filter: "sepia(1) saturate(4) brightness(1.15)" }} />
        <span style={{ flex: 1, color: "#ffd34d" }}>{caseName("vault1")}</span>
      </div>
      <PxButton disabled={!v.canBuy} onClick={() => act({ type: "buyVault" })}>
        {t("btn.buy")}
        <span className="cc-btn-sub">{formatCash(v.price, getLang())}</span>
      </PxButton>
    </div>
  );
}
```

and render it in `CaseShelf` after the cases, before `DayJobRow`: `<VaultRow view={view} act={act} />`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental/game src/modules/casecremental/ui
git commit -m "feat(ui): Vault Case I on the shelf and as the HUD goal; buttons off while the vault is open"
```

### Task 4: The bot on the table

**Files:** Create `fx/pixel/botPath.ts`, `fx/pixel/botPath.test.ts`, `fx/pixel/BotSprite.ts`; Modify `fx/pixel/anims.ts`, `fx/pixel/Room.ts`, `fx/World.ts`.

**Interfaces:**
- Consumes: `BotState`, `BotJob`, `botSpeed`, `BOT_STEP_SECONDS` (`sim/botSeller.ts`); `TableLayout`.
- Produces: `interface BotStations { y; home; bench; bin; tray }`, `botStations(l)`, `botTarget(st, job, speed)` → `{ x; pxPerSec }`, `stepToward(x, target, maxStep)`; `class BotSprite { root; layout(l); update(ms, bot); wake(); setFrenzy(on); head(): Pt }`; anims `botIdle`, `botWake`, `botFrenzy`.

- [ ] **Step 1: Write the failing test** — `fx/pixel/botPath.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOT_STEP_SECONDS, type BotJob } from "../../sim/botSeller";
import { botStations, botTarget, stepToward } from "./botPath";
import { tableLayout } from "./layout";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];
const job = (over: Partial<BotJob>): BotJob => ({ step: "toBench", t: 0, drop: null, dest: null, ...over });

describe("the bot's path along the table front", () => {
  it.each(SIZES)("keeps every station on the table at %ix%i", (w, h) => {
    const l = tableLayout(pixelViewport(w, h));
    const st = botStations(l);
    for (const x of [st.home, st.bench, st.bin, st.tray]) {
      expect(x).toBeGreaterThanOrEqual(l.table.x);
      expect(x).toBeLessThanOrEqual(l.table.x + l.table.w);
    }
    expect(st.bench).toBeGreaterThan(l.you.mat.x + l.you.mat.w);
  });

  it("heads for the station each step needs", () => {
    const st = botStations(tableLayout(pixelViewport(1920, 1080)));
    expect(botTarget(st, null, 1).x).toBe(st.home);
    expect(botTarget(st, job({ step: "toBench" }), 1).x).toBe(st.bench);
    expect(botTarget(st, job({ step: "wait" }), 1).x).toBe(st.bench);
    expect(botTarget(st, job({ step: "carry", dest: "tray" }), 1).x).toBe(st.tray);
    expect(botTarget(st, job({ step: "drop", dest: "bin" }), 1).x).toBe(st.bin);
    expect(botTarget(st, job({ step: "back", dest: "bin" }), 1).x).toBe(st.home);
  });

  it("walks each leg in the sim's time for it, faster with Speed", () => {
    const st = botStations(tableLayout(pixelViewport(1920, 1080)));
    for (const speed of [1, 8]) {
      const t = botTarget(st, job({ step: "toBench" }), speed);
      let x = st.home;
      const dt = 1 / 60;
      let secs = 0;
      while (x !== t.x && secs < 10) {
        x = stepToward(x, t.x, t.pxPerSec * dt);
        secs += dt;
      }
      expect(secs).toBeCloseTo(BOT_STEP_SECONDS.toBench / speed, 1);
    }
  });

  it("never overshoots", () => {
    expect(stepToward(10, 12, 5)).toBe(12);
    expect(stepToward(10, 4, 5)).toBe(5);
    expect(stepToward(10, 10, 5)).toBe(10);
  });

  it("after a reload mid-carry, puts the bot on its carry leg toward the tray (Review Focus 1)", () => {
    const st = botStations(tableLayout(pixelViewport(1280, 720)));
    const carrying = job({ step: "carry", t: 0.6, dest: "tray", drop: { id: 1, caseId: "bootcamp", skinId: "bc_woodland", rarity: "covert", float: 0.2, wear: "FT", statTrak: false, value: 1 } });
    const t = botTarget(st, carrying, 1);
    expect(t.x).toBe(st.tray);
    expect(t.pxPerSec).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/fx/pixel/botPath`
Expected: FAIL — `Cannot find module './botPath'`.

- [ ] **Step 3: Write `fx/pixel/botPath.ts`**

```ts
import { BOT_STEP_SECONDS, type BotJob } from "../../sim/botSeller";
import type { TableLayout } from "./layout";

// Where the bot walks (M2b spec §3): one line along the table front — its station (home), just right of
// your mat (the bench), beside the SELL bin, and the middle of the claim tray. Each leg is walked in the
// sim's time for that step, so the bot arrives as the sim's step ends.

export interface BotStations {
  /** The table-front line it walks on (feet), world px. */
  y: number;
  home: number;
  bench: number;
  bin: number;
  tray: number;
}

export function botStations(l: TableLayout): BotStations {
  const lo = l.table.x + 6;
  const hi = l.table.x + l.table.w - 6;
  const clampX = (x: number) => Math.round(Math.min(hi, Math.max(lo, x)));
  return {
    y: l.bot.spot.y,
    home: clampX(l.bot.spot.x),
    bench: clampX(l.you.mat.x + l.you.mat.w + 12),
    bin: clampX(l.bin.x - 18),
    tray: clampX(l.tray.x + l.tray.w / 2),
  };
}

/** The station this step heads for, and the walking speed that covers its leg in the step's time. */
export function botTarget(st: BotStations, job: BotJob | null, speed: number): { x: number; pxPerSec: number } {
  const dest = job?.dest === "tray" ? st.tray : job?.dest === "bin" ? st.bin : st.bench;
  const leg = (from: number, to: number, seconds: number) => (Math.max(Math.abs(to - from), 1) / seconds) * speed;
  if (!job) return { x: st.home, pxPerSec: leg(st.bench, st.home, BOT_STEP_SECONDS.back) };
  switch (job.step) {
    case "toBench":
    case "wait":
    case "pickUp":
      return { x: st.bench, pxPerSec: leg(st.home, st.bench, BOT_STEP_SECONDS.toBench) };
    case "carry":
    case "drop":
      return { x: dest, pxPerSec: leg(st.bench, dest, BOT_STEP_SECONDS.carry) };
    case "back":
      return { x: st.home, pxPerSec: leg(dest, st.home, BOT_STEP_SECONDS.back) };
  }
}

export const stepToward = (x: number, target: number, maxStep: number): number =>
  x < target ? Math.min(target, x + maxStep) : Math.max(target, x - maxStep);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental/fx/pixel/botPath`
Expected: PASS.

- [ ] **Step 5: The bot's animations** — in `fx/pixel/anims.ts`, add after `botSleep`:

```ts
  // the awake bot (bot-open sheet: 0 standing, 1–7 the crouch-and-hop)
  botIdle: [
    { frame: 0, ms: 1900 },
    { frame: 0, ms: 140, dy: 1 },
    { frame: 0, ms: 1100 },
  ],
  botWake: [
    { frame: 1, ms: 140, eyes: "half" },
    { frame: 2, ms: 120 },
    { frame: 3, ms: 110, dy: -1, event: "beep" },
    { frame: 4, ms: 120, dy: -2 },
    { frame: 5, ms: 140, dy: -1 },
    { frame: 6, ms: 120 },
    { frame: 7, ms: 160, eyes: "happy" },
    { frame: 0, ms: 200 },
  ],
  botFrenzy: [
    { frame: 4, ms: 60, dx: 1 },
    { frame: 5, ms: 60, dx: -1, eyes: "happy" },
    { frame: 6, ms: 60, dx: 1 },
    { frame: 7, ms: 60, dx: -1 },
  ],
```

and in `ANIM_SPRITE`: `botIdle: "bot-open", botWake: "bot-open", botFrenzy: "bot-open",`.

- [ ] **Step 6: Write `fx/pixel/BotSprite.ts`**

```ts
import { Container, Graphics } from "pixi.js";
import { botSpeed, type BotState } from "../../sim/botSeller";
import { RARITY_INFO } from "../../sim/rarity";
import { Actor } from "./Actor";
import { Animated } from "./Animated";
import { ANIMS } from "./anims";
import { botStations, botTarget, stepToward, type BotStations } from "./botPath";
import type { Pt, TableLayout } from "./layout";
import type { SpriteLibrary } from "./sprites";

// The bot on the table (M2b spec §3): asleep at its station until woken; then it walks along the table
// front in whole-pixel steps, carries the card over its head to the SELL bin or the claim tray, and walks
// back. Its leg and its card come from the sim's bot state every frame, so a reload puts it where it was.

/** A footstep every this many ms (the bob). */
const STEP_MS = 120;
const CARD = { w: 10, h: 7 };

export class BotSprite {
  readonly root = new Container();
  private readonly sleep: Animated;
  private readonly awake: Animated;
  private readonly card = new Graphics();
  private st: BotStations | null = null;
  private x = 0;
  private facing: 1 | -1 = 1;
  private walkMs = 0;
  private frenzy = false;

  constructor(lib: SpriteLibrary) {
    this.sleep = new Animated(new Actor(lib.get("bot-sleep", { w: 51, h: 62, frames: 4 })), ANIMS.botSleep);
    this.awake = new Animated(new Actor(lib.get("bot-open", { w: 51, h: 62, frames: 8 })), ANIMS.botIdle);
    this.card.visible = false;
    this.root.addChild(this.sleep.actor, this.awake.actor, this.card);
  }

  layout(l: TableLayout): void {
    const first = this.st === null;
    this.st = botStations(l);
    if (first) this.x = this.st.home;
    this.sleep.actor.place(this.st.home, this.st.y);
  }

  /** Above its head, in world px (the "tray full" text sits here). */
  head(): Pt {
    return { x: Math.round(this.x), y: (this.st?.y ?? 0) - this.awake.actor.meta.ground - 4 };
  }

  /** The wake-up: a stretch and a hop (the station reveal). */
  wake(): void {
    this.awake.play(ANIMS.botWake);
  }

  /** The vault finale: it can't stand still. */
  setFrenzy(on: boolean): void {
    if (on === this.frenzy) return;
    this.frenzy = on;
    this.awake.setIdle(on ? ANIMS.botFrenzy : ANIMS.botIdle);
  }

  update(ms: number, bot: BotState): void {
    const st = this.st;
    if (!st) return;
    this.sleep.actor.visible = !bot.awake;
    this.awake.actor.visible = bot.awake;
    if (!bot.awake) {
      this.x = st.home;
      this.facing = 1;
      this.card.visible = false;
      this.mirror(st.home);
      this.sleep.update(ms);
      return;
    }
    const target = botTarget(st, bot.job, botSpeed(bot.speedLevel));
    const before = this.x;
    this.x = stepToward(this.x, target.x, (target.pxPerSec * ms) / 1000);
    const moving = this.x !== before;
    if (moving) this.facing = this.x < before ? -1 : 1;
    this.walkMs = moving ? this.walkMs + ms : 0;
    const bob = moving && Math.floor(this.walkMs / STEP_MS) % 2 === 1 ? -1 : 0;
    const x = Math.round(this.x);
    this.awake.actor.place(x, st.y + bob);
    this.awake.update(ms);
    const drop = bot.job?.drop ?? null;
    this.card.visible = !!drop;
    if (drop) {
      const top = st.y + bob - this.awake.actor.meta.ground - CARD.h - 1;
      const left = x - CARD.w / 2;
      this.card
        .clear()
        .rect(left, top, CARD.w, CARD.h)
        .fill({ color: 0x120e10 })
        .rect(left + 1, top + 1, CARD.w - 2, CARD.h - 2)
        .fill({ color: RARITY_INFO[drop.rarity].color });
    }
    this.mirror(x);
  }

  /** The sheet faces right; walking left mirrors the bot (and its card) around its own feet. */
  private mirror(x: number): void {
    this.root.pivot.x = x;
    this.root.x = x;
    this.root.scale.x = this.facing;
  }
}
```

- [ ] **Step 7: Move the bot out of the Room** — in `fx/pixel/Room.ts`: delete the `bot` field, its construction line (`this.bot = new Animated(… "bot-sleep" …)`), `this.bot.actor` from the `front` children list, `this.bot.actor.place(…)` in `layout`, and `this.bot.update(ms)` in `update`; remove the then-unused `ANIMS`/`Animated`/`Actor` imports only if nothing else in the file uses them (the lamp still does). Update the header comment: `… the claim tray and the powered-off auto-seller (spec §3). The bot is drawn by BotSprite.`

- [ ] **Step 8: Wire it into `fx/World.ts`**
- import `BotSprite` from `./pixel/BotSprite`;
- field `private readonly bot: BotSprite;` and `private readonly botText = new Text({ text: "", style: pixelStyle(8, 0xffd34d) });`;
- constructor: `this.bot = new BotSprite(lib);` before the `addChild` calls; change the pixel world line to `this.pixel.world.addChild(this.room.back, this.room.front, this.reel, this.bench.root, this.bot.root);`; add `this.botText` to the `hd.root.addChild(…)` list and to both `for (const txt of [...])` lists (anchor and font size);
- `applyLayout`: `this.bot.layout(this.l);`;
- `update`, after `this.bench.update(gameMs, b);`:

```ts
    const bot = run.state.bot;
    this.bot.update(gameMs, bot);
    this.hd.setBotAsleep(!bot.awake);
```

- `updateText`, at its end:

```ts
    const bot = this.controller.run.state.bot;
    const waiting = bot.job?.step === "wait" ? t("bot.waiting") : "";
    if (this.botText.text !== waiting) this.botText.text = waiting;
    if (waiting) {
      const h = this.bot.head();
      const k = this.vp.scale;
      this.botText.position.set(h.x * k, h.y * k - this.botText.height);
    }
```

- `onEvent`, new cases:

```ts
      case "botWoke":
        this.bot.wake();
        this.hd.flash(0xffd28a, 0.15); // the station's lamp flickers on
        this.audio.play("bot-servo");
        this.audio.play("bot-beep", { delay: 0.35 });
        break;
      case "botUpgraded":
        this.audio.play("bot-servo", { rate: 1.2 });
        break;
      case "botWaiting":
        this.audio.play("bot-beep", { rate: 0.8 });
        break;
      case "dayJobDone": {
        const tb = this.l.table;
        const at = this.screenPt({ x: tb.x + tb.w / 2, y: tb.y + 12 });
        this.hd.coins.floatText(at, e.amount > 0 ? `+${formatCash(e.amount, getLang())}` : t("float.nopay"));
        if (e.amount > 0) this.audio.play("coin-clink");
        break;
      }
```

and in the existing `case "botPickedUp":` add `this.audio.play("bot-servo", { rate: 1.1 });`.

- [ ] **Step 9: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS (the anims tests check the new frames against `bot-open`'s 8); typecheck clean.

- [ ] **Step 10: Browser check** — wake the bot (Bot tab): it hops up with a beep, the Z's stop. Open a Mil-Spec and wait: it walks left to the bench in steps, the card leaves the bench and rides over its head to the bin (coins from the bin), then it walks home. Force a Covert (dev board): it carries it to the tray. Grab the card while it walks over: it turns back. Reload mid-walk: it is drawn on the same leg.

- [ ] **Step 11: Commit**

```bash
git add src/modules/casecremental/fx
git commit -m "feat(fx): the bot wakes, walks the table front and carries cards to the bin or the tray"
```

### Task 5: The claim tray on the table

**Files:** Create `fx/pixel/traySlots.ts`, `fx/pixel/traySlots.test.ts`, `fx/pixel/cardFace.ts`, `fx/pixel/Tray.ts`; Modify `fx/pixel/Bench.ts`, `fx/World.ts`, `sim/botSeller.test.ts`.

**Interfaces:**
- Consumes: `RunState.tray`, `run.setup.trayCapacity`, `Action { type: "claim"; index }`.
- Produces: `traySlots(r: Rect, capacity): Rect[]`, `slotAt(slots, p): number`; `cardFace(art: Texture | null, drop: Drop): Container`; `class TrayView { root; layout(l); update(items, capacity); pointerDown(p): boolean; pointerMove(p); pointerUp(p); cancelDrag(); lifted(): LiftInfo | null; destroy() }`; `Bench.swallow()`.

- [ ] **Step 1: Write the failing tests** — `fx/pixel/traySlots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tableLayout } from "./layout";
import { slotAt, traySlots } from "./traySlots";
import { pixelViewport } from "./viewport";

const SIZES: Array<[number, number]> = [
  [1920, 1080],
  [1280, 720],
  [1024, 768],
  [1000, 1000],
  [390, 844],
  [360, 640],
];

describe("claim tray slots", () => {
  it.each(SIZES)("fit inside the tray without overlapping at %ix%i, up to 24 slots (Review Focus 3)", (w, h) => {
    const r = tableLayout(pixelViewport(w, h)).tray;
    for (const capacity of [12, 16, 24]) {
      const slots = traySlots(r, capacity);
      expect(slots).toHaveLength(capacity);
      for (const s of slots) {
        expect(s.w).toBeGreaterThanOrEqual(3);
        expect(s.x).toBeGreaterThanOrEqual(r.x);
        expect(s.y).toBeGreaterThanOrEqual(r.y);
        expect(s.x + s.w).toBeLessThanOrEqual(r.x + r.w);
        expect(s.y + s.h).toBeLessThanOrEqual(r.y + r.h);
      }
      for (let i = 0; i < slots.length; i++)
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i]!,
            b = slots[j]!;
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart).toBe(true);
        }
    }
  });

  it("finds the slot under the pointer", () => {
    const slots = traySlots({ x: 0, y: 0, w: 80, h: 18 }, 12);
    const s = slots[7]!;
    expect(slotAt(slots, { x: s.x + 1, y: s.y + 1 })).toBe(7);
    expect(slotAt(slots, { x: -5, y: -5 })).toBe(-1);
  });
});
```

and append to `sim/botSeller.test.ts` inside `describe("the bot as a seller", …)`:

```ts
  it("a claim takes the card at its slot even after the bot stores another (Review Focus 2)", () => {
    const run = awake();
    reveal(run, "covert");
    tickFor(run, 10);
    const first = run.state.tray[0]!;
    reveal(run, "gold");
    tickFor(run, 10);
    expect(run.state.tray).toHaveLength(2);
    const cash = run.state.cash;
    run.claim(0);
    expect(run.state.cash - cash).toBeCloseTo(run.payout(first, false) * 1.02);
    expect(run.state.tray[0]!.rarity).toBe("gold");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/pixel/traySlots src/modules/casecremental/sim/botSeller`
Expected: FAIL — `Cannot find module './traySlots'` (the sim test already passes: it pins the contract that stores append).

- [ ] **Step 3: Write `fx/pixel/traySlots.ts`**

```ts
import type { Pt, Rect } from "./layout";

// The claim tray's slots (M2b spec §4): two rows of small cards centred in the tray, as wide as the
// capacity allows (12 base, up to 24 with perks).

export function traySlots(r: Rect, capacity: number): Rect[] {
  const cols = Math.max(1, Math.ceil(capacity / 2));
  const cw = Math.max(3, Math.min(10, Math.floor((r.w - 4) / cols) - 1));
  const ch = Math.max(3, Math.min(7, Math.floor((r.h - 3) / 2)));
  const x0 = Math.round(r.x + (r.w - (cols * cw + (cols - 1))) / 2);
  const y0 = Math.round(r.y + (r.h - (2 * ch + 1)) / 2);
  const out: Rect[] = [];
  for (let i = 0; i < capacity; i++) out.push({ x: x0 + (i % cols) * (cw + 1), y: y0 + Math.floor(i / cols) * (ch + 1), w: cw, h: ch });
  return out;
}

export const slotAt = (slots: readonly Rect[], p: Pt): number =>
  slots.findIndex((s) => p.x >= s.x && p.y >= s.y && p.x < s.x + s.w && p.y < s.y + s.h);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental/fx/pixel/traySlots src/modules/casecremental/sim/botSeller`
Expected: PASS. If a 24-slot portrait tray is too narrow for `w >= 3`, it fails here: then make `traySlots` use three rows when `capacity > 16` (rows = 3, `ch = floor((r.h - 4) / 3)`) and re-run.

- [ ] **Step 5: Extract the card face** — `fx/pixel/cardFace.ts`:

```ts
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import { ITEM_SIZE } from "./layout";

// A skin card at reveal size: a dark frame, a rarity border, the skin's art centred, the StatTrak mark.
// The reveal card and a lifted tray card bake it into a texture.

export function cardFace(art: Texture | null, drop: Drop): Container {
  const { w, h } = ITEM_SIZE.reveal;
  const face = new Container();
  face.addChild(
    new Graphics()
      .rect(0, 0, w, h)
      .fill({ color: 0x120e10 })
      .rect(1, 1, w - 2, h - 2)
      .fill({ color: RARITY_INFO[drop.rarity].color })
      .rect(2, 2, w - 4, h - 4)
      .fill({ color: 0x15161d }),
  );
  if (art) {
    const s = new Sprite(art);
    s.position.set(Math.floor((w - s.width) / 2), Math.floor((h - s.height) / 2));
    face.addChild(s);
  }
  if (drop.statTrak) face.addChild(new Graphics().rect(3, 3, 4, 2).fill({ color: 0xff8a00 }));
  return face;
}
```

In `fx/pixel/Bench.ts`, replace the body of `showReveal` up to `this.knifeFlying = false;` with:

```ts
    for (const t of this.cardFrames) t.destroy(true);
    this.cardFrames = this.skins.frames(skin).map((tex) => {
      const face = cardFace(tex, drop);
      const baked = this.bake(face);
      face.destroy({ children: true });
      return baked;
    });
    this.cardEmpty?.destroy(true);
    const empty = cardFace(null, drop);
    this.cardEmpty = this.bake(empty);
    empty.destroy({ children: true });
```

(the StatTrak mark now also shows on the empty card while a knife is out — harmless), import `cardFace` from `./cardFace`, drop the now-unused `Graphics`/`RARITY_INFO` imports if nothing else uses them, and add:

```ts
  /** The bin swallows a card the bot or a tray claim sold. */
  swallow(): void {
    this.bin.play(ANIMS.binSwallow);
  }
```

- [ ] **Step 6: Write `fx/pixel/Tray.ts`**

```ts
import { Container, Graphics, type Texture } from "pixi.js";
import type { GameController } from "../../game/controller";
import { skinById } from "../../sim/content/cases";
import { RARITY_INFO } from "../../sim/rarity";
import type { Drop } from "../../sim/types";
import type { LiftInfo } from "../hd/Lifted";
import type { SkinTextures } from "../skins/pixelSkin";
import { cardFace } from "./cardFace";
import { DragTracker } from "./drag";
import type { Pt, Rect, TableLayout } from "./layout";
import { slotAt, traySlots } from "./traySlots";

// The claim tray (M2b spec §4): the good drops the bot set aside, one small card per slot. Drag one to
// the SELL bin (or tap it) to claim it — a sale by hand, so it feeds the combo. Dragged, it lifts at
// full card size.

export class TrayView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly drag = new DragTracker();
  private slots: Rect[] = [];
  private items: readonly Drop[] = [];
  private l: TableLayout | null = null;
  private drawn = "";
  private liftTex: Texture | null = null;

  constructor(
    private readonly skins: SkinTextures,
    private readonly controller: GameController,
    private readonly bake: (c: Container) => Texture,
  ) {
    this.root.addChild(this.g);
  }

  layout(l: TableLayout): void {
    this.l = l;
    this.drawn = "";
  }

  update(items: readonly Drop[], capacity: number): void {
    const l = this.l;
    if (!l) return;
    this.items = items;
    const dragging = this.drag.dragging;
    const key = `${capacity}|${items.map((d) => d.id).join(",")}|${dragging ?? ""}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.slots = traySlots(l.tray, capacity);
    this.g.clear();
    this.slots.forEach((r, i) => {
      const d = items[i];
      if (!d || dragging === `tray:${i}`) {
        this.g.rect(r.x, r.y, r.w, r.h).fill({ color: 0x120e10, alpha: 0.35 });
        return;
      }
      this.g
        .rect(r.x, r.y, r.w, r.h)
        .fill({ color: 0x120e10 })
        .rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
        .fill({ color: RARITY_INFO[d.rarity].color });
      if (r.w > 4 && r.h > 4) this.g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4).fill({ color: 0x15161d });
    });
  }

  pointerDown(p: Pt): boolean {
    const i = slotAt(this.slots, p);
    const d = i >= 0 ? this.items[i] : undefined;
    if (!d) return false;
    this.drag.down(p, [{ id: `tray:${i}`, rect: this.slots[i]! }]);
    this.liftTex?.destroy(true);
    const face = cardFace(this.skins.frames(skinById(d.skinId))[0] ?? null, d);
    this.liftTex = this.bake(face);
    face.destroy({ children: true });
    return true;
  }

  pointerMove(p: Pt): void {
    this.drag.move(p);
  }

  pointerUp(p: Pt): void {
    const id = this.drag.dragging;
    const end = this.drag.up(p);
    const l = this.l;
    if (!id || !l) return;
    const index = Number(id.slice("tray:".length));
    const onBin = end.kind === "drop" && Math.hypot(end.at.x - l.bin.x, end.at.y - l.bin.y) <= l.binR + 8;
    if (end.kind === "tap" || onBin) this.controller.act({ type: "claim", index });
  }

  cancelDrag(): void {
    this.drag.cancel();
  }

  lifted(): LiftInfo | null {
    const p = this.drag.exactPosition;
    const id = this.drag.dragging;
    const r = id ? this.slots[Number(id.slice("tray:".length))] : undefined;
    if (!p || !id || !r || !this.liftTex) return null;
    return { id, texture: this.liftTex, center: { x: p.x + r.w / 2, y: p.y + r.h / 2 } };
  }

  destroy(): void {
    this.liftTex?.destroy(true);
    this.liftTex = null;
  }
}
```

- [ ] **Step 7: Wire it into `fx/World.ts`**
- import `TrayView` from `./pixel/Tray`; field `private readonly tray: TrayView;`;
- constructor: hoist the bake function — `const bake = (c: Container) => { const tex = app.renderer.generateTexture({ target: c, resolution: 1 }); tex.source.scaleMode = "nearest"; return tex; };` — pass `bake` to `new Bench(lib, skins, controller, bake)` and create `this.tray = new TrayView(skins, controller, bake);`; pixel world: `addChild(this.room.back, this.room.front, this.tray.root, this.reel, this.bench.root, this.bot.root)`;
- pointer routing replaces the three `app.stage.on(…)` input lines:

```ts
    app.stage.on("pointerdown", (e: FederatedPointerEvent) => this.pointerDown(e));
    app.stage.on("globalpointermove", (e: FederatedPointerEvent) => {
      const p = this.worldPt(e);
      this.tray.pointerMove(p);
      this.bench.pointerMove(p);
    });
    const up = (e: FederatedPointerEvent) => {
      const p = this.worldPt(e);
      this.tray.pointerUp(p);
      this.bench.pointerUp(p);
    };
    app.stage.on("pointerup", up);
    app.stage.on("pointerupoutside", up);
```

with the method:

```ts
  private pointerDown(e: FederatedPointerEvent): void {
    const p = this.worldPt(e);
    if (!this.tray.pointerDown(p)) void this.bench.pointerDown(p);
  }
```

- `applyLayout`: `this.tray.layout(this.l);`; the resize branch in `update`: also `this.tray.cancelDrag();`;
- `update`: after the bot lines, `this.tray.update(run.state.tray, run.setup.trayCapacity);` and change the lifted line to `this.lifted.update(this.tray.lifted() ?? this.bench.lifted(), k, realSeconds);`;
- `onEvent`: in `case "sold":` add `if (!fromBench) this.bench.swallow();`; in `case "runStarted":` and in `case "vaultBought":` add `this.tray.cancelDrag();` (and `this.bench.cancelDrag();` in `vaultBought`);
- `destroy`: `this.tray.destroy();`.

- [ ] **Step 8: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 9: Browser check** — with the bot awake, force two Coverts: two small red cards sit in the tray. Drag one onto the bin: it lifts at full card size and sells (combo grows, the bin swallows). Tap the other: it sells too. Drag one and drop it on the bench: it goes back to its slot.

- [ ] **Step 10: Commit**

```bash
git add src/modules/casecremental/fx src/modules/casecremental/sim/botSeller.test.ts
git commit -m "feat(fx): the claim tray shows the set-aside cards; drag one to the bin (or tap) to claim it"
```

### Task 6: The vault finale

**Files:** Create `fx/finale.ts`, `fx/finale.test.ts`, `fx/hd/rain.ts`, `fx/hd/rain.test.ts`; Modify `sim/run.ts`, `sim/vault.test.ts`, `fx/World.ts`.

**Interfaces:**
- Consumes: `RunState.finale`, `FINALE_SECONDS`, `vaultOpened { drop }` (M2b-A); `BotSprite.setFrenzy` (Task 4); `STAGE_NAMES` (`sim/intensity.ts`).
- Produces: `FINALE_SILENCE_AT`, `finaleKnobs(p)` → `{ phase: "build" | "silence"; intensity; rainPerSecond; shakePerSecond; flashEvery }`; `RainDrop`, `RAIN_LIFE`, `stepRain(drops, dt, gravity)`, `class CaseRain { container; spawn(texture, x, floorY, scale, random); update(dt, gravity); clear() }`.

- [ ] **Step 1: Write the failing tests**

`fx/finale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FINALE_SILENCE_AT, finaleKnobs } from "./finale";

describe("the vault finale's schedule", () => {
  it("builds to everything at once, then falls silent before the vault opens", () => {
    const early = finaleKnobs(0.1);
    const late = finaleKnobs(0.8);
    expect(early.phase).toBe("build");
    expect(late.intensity).toBeGreaterThan(early.intensity);
    expect(late.rainPerSecond).toBeGreaterThan(early.rainPerSecond);
    expect(late.flashEvery).toBeLessThan(early.flashEvery);
    expect(finaleKnobs(FINALE_SILENCE_AT).phase).toBe("silence");
    expect(finaleKnobs(1.4)).toMatchObject({ phase: "silence", rainPerSecond: 0, shakePerSecond: 0 });
  });
});
```

`fx/hd/rain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RAIN_LIFE, stepRain, type RainDrop } from "./rain";

const drop = (): RainDrop => ({ x: 10, y: -20, floorY: 100, vy: 0, rot: 0, vr: 2, age: 0, landed: false });

describe("raining cases", () => {
  it("fall, spin and land on their floor", () => {
    let drops = [drop()];
    for (let i = 0; i < 60; i++) drops = stepRain(drops, 1 / 60, 900);
    const d = drops[0]!;
    expect(d.landed).toBe(true);
    expect(d.y).toBe(100);
    const rot = d.rot;
    drops = stepRain(drops, 0.1, 900);
    expect(drops[0]!.rot).toBe(rot); // a landed case stops turning
  });

  it("are gone after their life", () => {
    let drops = [drop()];
    drops = stepRain(drops, RAIN_LIFE + 0.01, 900);
    expect(drops).toHaveLength(0);
  });
});
```

and append to `sim/vault.test.ts` inside `describe("Vault Case I", …)`:

```ts
  it("never drops a Ricochet case on the bench during the finale (review minor)", () => {
    const run = new Run(1, { ...DEFAULT_SETUP, charms: ["ricochet"] });
    allUnlocked(run);
    run.state.cash = 1e9;
    run.forceNextRarity("covert");
    run.buyCase("bootcamp");
    run.insertKey();
    for (let i = 0; i < 900 && run.state.bench.phase !== "revealed"; i++) run.tick(DT);
    expect(run.sell().ok).toBe(true);
    expect(run.state.freeCases).toEqual(["bootcamp"]); // queued, not yet on the bench
    expect(run.buyVault().ok).toBe(true);
    tickFor(run, 1);
    expect(run.state.bench.phase).toBe("empty");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/modules/casecremental/fx/finale src/modules/casecremental/fx/hd/rain src/modules/casecremental/sim/vault`
Expected: FAIL — missing modules; the vault test fails with the bench `locked`.

- [ ] **Step 3: Implement**

`sim/run.ts` — the Ricochet block's condition becomes:

```ts
    if (s.bench.phase === "empty" && s.freeCases.length > 0 && !this.locked()) {
```

`fx/finale.ts`:

```ts
// Vault Case I's finale (M2b spec §7): ~20 s, hands-off. It builds to everything at once — the reel
// spinning, cases raining onto the table, the bot frenzied, flashes, the top stage's look and music —
// then falls silent just before the vault opens on its one legendary drop.

/** Where the noise stops (share of FINALE_SECONDS). */
export const FINALE_SILENCE_AT = 0.85;
/** One spin of the reel during the finale, seconds. */
export const FINALE_SPIN_SECONDS = 1.8;
export const FINALE_COLORS = [0xff7ad9, 0x7affc1, 0xffd34d, 0x6ab0ff] as const;

export interface FinaleKnobs {
  phase: "build" | "silence";
  /** 0 → 1 over the build. */
  intensity: number;
  rainPerSecond: number;
  /** Shake trauma added per second. */
  shakePerSecond: number;
  /** Seconds between flashes. */
  flashEvery: number;
}

export function finaleKnobs(p: number): FinaleKnobs {
  if (p >= FINALE_SILENCE_AT) return { phase: "silence", intensity: 0, rainPerSecond: 0, shakePerSecond: 0, flashEvery: Infinity };
  const i = Math.min(1, Math.max(0, p / FINALE_SILENCE_AT));
  return { phase: "build", intensity: i, rainPerSecond: 2 + 18 * i, shakePerSecond: 0.3 + 1.2 * i, flashEvery: 1.6 - 1.2 * i };
}
```

`fx/hd/rain.ts`:

```ts
import { Container, Sprite, type Texture } from "pixi.js";

// Cases raining onto the table during the vault finale: HD sprites that fall, tumble, land on the
// table and fade. stepRain is the pure part.

export interface RainDrop {
  x: number;
  y: number;
  /** Where this one lands (screen px). */
  floorY: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
  landed: boolean;
}

/** Seconds a raining case lives (falling, then lying there fading). */
export const RAIN_LIFE = 1.6;

export function stepRain<T extends RainDrop>(drops: T[], dt: number, gravity: number): T[] {
  for (const d of drops) {
    d.age += dt;
    if (d.landed) continue;
    d.vy += gravity * dt;
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    if (d.y >= d.floorY) {
      d.y = d.floorY;
      d.vy = 0;
      d.landed = true;
    }
  }
  return drops.filter((d) => d.age < RAIN_LIFE);
}

export class CaseRain {
  readonly container = new Container();
  private drops: Array<RainDrop & { s: Sprite }> = [];

  spawn(texture: Texture, x: number, floorY: number, scale: number, random: () => number): void {
    const s = new Sprite(texture);
    s.anchor.set(0.5, 1);
    s.scale.set(scale);
    this.container.addChild(s);
    this.drops.push({ s, x, y: -texture.height * scale, floorY, vy: 0, rot: (random() - 0.5) * 0.6, vr: (random() - 0.5) * 6, age: 0, landed: false });
  }

  update(dt: number, gravity: number): void {
    const alive = stepRain(this.drops, dt, gravity);
    for (const d of this.drops) if (!alive.includes(d)) d.s.destroy();
    this.drops = alive;
    for (const d of this.drops) {
      d.s.position.set(d.x, d.y);
      d.s.rotation = d.rot;
      d.s.alpha = Math.min(1, (RAIN_LIFE - d.age) / 0.4);
    }
  }

  clear(): void {
    for (const d of this.drops) d.s.destroy();
    this.drops = [];
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/modules/casecremental/fx/finale src/modules/casecremental/fx/hd/rain src/modules/casecremental/sim`
Expected: PASS.

- [ ] **Step 5: Wire the finale into `fx/World.ts`**
- imports: `CASES` (with `caseById, skinById`) from `../sim/content/cases`; `STAGE_NAMES` from `../sim/intensity`; `FINALE_SECONDS` from `../sim/tuning`; `FINALE_COLORS, FINALE_SPIN_SECONDS, finaleKnobs` from `./finale`; `CaseRain` from `./hd/rain`; `type ReelMotion` from `./reel/motion`; `Texture` (type) from `pixi.js`;
- fields:

```ts
  private readonly rain = new CaseRain();
  private readonly caseTextures = new Map<string, Texture>();
  private finalePhase: "none" | "build" | "silence" = "none";
  private finaleRain = 0;
  private finaleFlash = 0;
  private finaleSpin = 0;
```

- constructor: `this.hd.root.addChild(this.rain.container, this.hint, …)` (the rain first, under the texts);
- the pointer-down method gains, first: 

```ts
    if (this.controller.run.locked()) {
      // the finale is hands-off: a click only adds sparks
      const at = this.hd.root.toLocal(e.global);
      this.hd.particles.burst({ x: at.x, y: at.y }, this.rng.pick(FINALE_COLORS), 14, 220 * (this.vp.scale / 6));
      return;
    }
```

- `update`: replace the reel line with

```ts
    const finaleReel = this.updateFinale(realSeconds);
    this.reel.update(finaleReel ?? (b.phase === "spinning" ? { elapsed: b.elapsed, fullDuration: b.fullDuration, crawl } : null));
```

and after `this.hd.update(realSeconds);` add `this.rain.update(realSeconds, 300 * this.vp.scale);`;
- methods:

```ts
  /** The vault's finale, read from the sim each frame (a reload picks it up where it is). Returns the
   *  reel's motion while it spins for the show. */
  private updateFinale(dt: number): ReelMotion | null {
    const f = this.controller.run.state.finale;
    if (f === null) {
      if (this.finalePhase !== "none") {
        this.finalePhase = "none";
        this.bot.setFrenzy(false);
        this.rain.clear();
        this.audio.setMusicOn(true);
      }
      return null;
    }
    const knobs = finaleKnobs(f / FINALE_SECONDS);
    if (knobs.phase !== this.finalePhase) {
      this.finalePhase = knobs.phase;
      if (knobs.phase === "build") {
        const top = STAGE_NAMES.length;
        this.look.setStage(top);
        this.audio.setStage(top);
        this.lastStage = top;
        this.bot.setFrenzy(true);
      } else {
        this.audio.setMusicOn(false); // silence before the vault opens
        this.bot.setFrenzy(false);
        this.hd.setGlow(null);
      }
    }
    if (knobs.phase !== "build") return null;
    const k = this.vp.scale;
    const tb = this.l.table;
    this.shake.add(knobs.shakePerSecond * dt);
    for (this.finaleRain += knobs.rainPerSecond * dt; this.finaleRain >= 1; this.finaleRain -= 1) {
      const floor = (tb.y + 12 + this.rng.next() * (tb.h - 30)) * k;
      this.rain.spawn(this.caseTexture(this.rng.pick(CASES).id), (tb.x + this.rng.next() * tb.w) * k, floor, k, () => this.rng.next());
    }
    this.finaleFlash += dt;
    if (this.finaleFlash >= knobs.flashEvery) {
      this.finaleFlash = 0;
      this.hd.flash(this.rng.pick(FINALE_COLORS), 0.2 + 0.3 * knobs.intensity);
    }
    this.finaleSpin -= dt;
    if (this.finaleSpin <= 0) {
      this.finaleSpin = FINALE_SPIN_SECONDS;
      const c = this.rng.pick(CASES);
      this.reel.start(c, this.rng.pick(c.skins), this.rng);
      this.audio.play("reel-stop", { gain: 0.4 });
    }
    return { elapsed: FINALE_SPIN_SECONDS - this.finaleSpin, fullDuration: FINALE_SPIN_SECONDS, crawl: 0 };
  }

  private caseTexture(id: string): Texture {
    let tex = this.caseTextures.get(id);
    if (!tex) {
      tex = this.lib.get(`case-${id}`, { w: 26, h: 34, frames: 4 }).frames[0]!;
      this.caseTextures.set(id, tex);
    }
    return tex;
  }
```

- `onEvent` — new case:

```ts
      case "vaultOpened": {
        // the vault opens on one legendary drop, shown with the b-roll showcase: the Vault I ★ trophy
        const skin = skinById(e.drop.skinId);
        this.bench.showReveal(skin, e.drop);
        const at = this.screenPt(this.bench.revealCentre());
        const v = this.vp.scale / 6;
        this.hd.setGlow(RARITY_INFO.gold.color);
        this.hd.flash(0xffd700, 0.8);
        this.shake.add(0.6);
        this.audio.play("jackpot-swell");
        this.hd.particles.burst(at, 0xffd700, 160, 420 * v);
        if (skin.motion?.weapon === "flip") this.launchKnife(skin, at, v);
        break;
      }
```

- `destroy`: `this.rain.clear();`.

- [ ] **Step 6: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: PASS; typecheck clean; build succeeds.

- [ ] **Step 7: Browser check** — dev board: +$100K is Task 8, so use the agent API or set cash in the console via the save (`localStorage` edit + reload, as in M2a-B's checks) to afford the vault with every case unlocked. Buy it: ~17 s of build-up (cases rain on the table, the reel spins, flashes, the bot jitters, the top stage's music), clicks only spark, then silence, then the vault opens on a gold card with the knife's showcase. Reload during the build: it continues at its intensity.

- [ ] **Step 8: Commit**

```bash
git add src/modules/casecremental/fx src/modules/casecremental/sim
git commit -m "feat(fx): the vault finale - raining cases, a spinning reel, a frenzied bot, silence, then the legendary"
```

### Task 7: The prestige screen

**Files:** Create `ui/prestige.ts`, `ui/prestige.test.ts`, `ui/Prestige.tsx`; Modify `ui/hooks.ts`, `ui/GamePanel.tsx`.

**Interfaces:**
- Consumes: `GameView.prestige: PrestigeView | null` (M2b-A); actions `pickCharm`, `buyPerk`, `startNextRun`; Task 1 strings; `FLIGHT_SECONDS` (`fx/hd/knifeFlight.ts`).
- Produces: `charmChoices(p)` → `Array<{ id: CharmId; picked: boolean; enabled: boolean }>`, `PRESTIGE_DELAY_MS`, `prestigeDelayMs(sawRunEnd)`; `useDelayedFlag(flag, delayFor)`; `<Prestige p act />`.

- [ ] **Step 1: Write the failing test** — `ui/prestige.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PrestigeView } from "../game/view";
import { charmChoices, PRESTIGE_DELAY_MS, prestigeDelayMs } from "./prestige";

const view = (over: Partial<PrestigeView>): PrestigeView => ({
  clout: 10,
  gained: 10,
  loops: 1,
  perks: [],
  offer: ["insider", "ricochet", "goldRush"],
  picked: [],
  slots: 1,
  ...over,
});

describe("the prestige screen", () => {
  it("lets you pick charms up to your slots, and un-pick a picked one", () => {
    expect(charmChoices(view({})).every((c) => c.enabled && !c.picked)).toBe(true);
    const one = charmChoices(view({ picked: ["ricochet"] }));
    expect(one.find((c) => c.id === "ricochet")).toEqual({ id: "ricochet", picked: true, enabled: true });
    expect(one.filter((c) => !c.picked).every((c) => !c.enabled)).toBe(true);
    expect(charmChoices(view({ picked: ["ricochet"], slots: 2 })).every((c) => c.enabled)).toBe(true);
  });

  it("waits for the vault's showcase only when you watched the run end; after a reload it shows at once (Review Focus 1)", () => {
    expect(prestigeDelayMs(true)).toBe(PRESTIGE_DELAY_MS);
    expect(prestigeDelayMs(false)).toBe(0);
    expect(PRESTIGE_DELAY_MS).toBeGreaterThan(2400); // the knife's 2.4 s flight plays first
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/ui/prestige`
Expected: FAIL — `Cannot find module './prestige'`.

- [ ] **Step 3: Implement**

`ui/prestige.ts`:

```ts
import { FLIGHT_SECONDS } from "../fx/hd/knifeFlight";
import type { PrestigeView } from "../game/view";
import type { CharmId } from "../sim/charms";

// The prestige screen's rules (M2b spec §8): pick up to `slots` of the three offered charms; the screen
// waits for the vault's showcase when you watched the run end, and comes up at once after a reload.

export function charmChoices(p: PrestigeView): Array<{ id: CharmId; picked: boolean; enabled: boolean }> {
  return p.offer.map((id) => {
    const picked = p.picked.includes(id);
    return { id, picked, enabled: picked || p.picked.length < p.slots };
  });
}

/** The knife's showcase plus a beat. */
export const PRESTIGE_DELAY_MS = Math.round(FLIGHT_SECONDS * 1000) + 1200;

export const prestigeDelayMs = (sawRunEnd: boolean): number => (sawRunEnd ? PRESTIGE_DELAY_MS : 0);
```

`ui/hooks.ts` — add (merging `useEffect`, `useRef`, `useState` into the React import):

```ts
/** `flag`, turning on after `delayFor(wasOffSinceMount)` ms — so a screen can wait for an animation the
 *  player is watching, yet come back at once after a reload. */
export function useDelayedFlag(flag: boolean, delayFor: (wasOffSinceMount: boolean) => number): boolean {
  const wasOff = useRef(!flag);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      wasOff.current = true;
      setShown(false);
      return;
    }
    const ms = delayFor(wasOff.current);
    if (ms <= 0) {
      setShown(true);
      return;
    }
    const id = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(id);
  }, [flag]);
  return flag && shown;
}
```

`ui/Prestige.tsx`:

```tsx
import { useContext, useEffect, useRef, type ReactNode } from "react";
import { popElement } from "../fx/hd/tween";
import type { Action } from "../game/controller";
import type { PrestigeView } from "../game/view";
import { charmDesc, charmName, perkDesc, perkName } from "../i18n/content";
import { t } from "../i18n/index";
import { PxButton, UiEnvContext } from "./parts";
import { frameCss, uiSpriteUrl } from "./pixelFrame";
import { charmChoices } from "./prestige";

// After the vault (M2b spec §8): the CLOUT it paid, the Vault I trophy, three charms to pick for the next
// run, the perks to buy with CLOUT, and "Start next run".

type Act = (a: Action) => void;

export function Prestige({ p, act }: { p: PrestigeView; act: Act }): ReactNode {
  const { scale } = useContext(UiEnvContext);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) popElement(box.current);
  }, []);
  return (
    <div className="cc-modal">
      <div
        ref={box}
        role="dialog"
        aria-label={t("prestige.title")}
        style={{
          display: "grid",
          gap: 3 * scale,
          padding: 4 * scale,
          width: "min(92vw, 36em)",
          maxHeight: "92%",
          overflowY: "auto",
          ...frameCss(uiSpriteUrl("ui-frame"), scale),
        }}
      >
        <div className="cc-title">{t("prestige.title")}</div>
        <div className="cc-row-line">
          <span className="cc-gold">{t("prestige.gained", { n: p.gained })}</span>
          <span className="cc-dim">{t("prestige.total", { n: p.clout })}</span>
        </div>
        <div style={{ color: "#ffd34d" }}>{t("prestige.trophy")}</div>
        <div className="cc-title">{t("prestige.charms", { n: p.slots })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10em, 1fr))", gap: 2 * scale }}>
          {charmChoices(p).map((c) => (
            <div key={c.id} className="cc-row">
              <div>{charmName(c.id)}</div>
              <div className="cc-dim">{charmDesc(c.id)}</div>
              <PxButton on={c.picked} disabled={!c.enabled} onClick={() => act({ type: "pickCharm", id: c.id })}>
                {c.picked ? t("btn.picked") : t("btn.pick")}
              </PxButton>
            </div>
          ))}
        </div>
        <div className="cc-title">{t("prestige.perks")}</div>
        {p.perks.map((k) => (
          <div key={k.id} className="cc-row">
            <div className="cc-row-line">
              <span>{perkName(k.id)}</span>
              <span className="cc-dim">{t("prestige.level", { n: k.level, max: k.maxLevel })}</span>
            </div>
            <div className="cc-dim">{perkDesc(k.id)}</div>
            {k.cost === null ? (
              <PxButton disabled>{t("btn.max")}</PxButton>
            ) : (
              <PxButton disabled={!k.canBuy} onClick={() => act({ type: "buyPerk", id: k.id })}>
                {t("prestige.cost", { n: k.cost })}
              </PxButton>
            )}
          </div>
        ))}
        <PxButton onClick={() => act({ type: "startNextRun" })}>{t("prestige.next")}</PxButton>
      </div>
    </div>
  );
}
```

`ui/GamePanel.tsx` — imports: `Prestige` from `./Prestige`, `prestigeDelayMs` from `./prestige`, `useDelayedFlag` (with the other hooks from `./hooks`); inside `GamePanel` after `const tint = …`:

```ts
    const prestigeShown = useDelayedFlag(view.prestige !== null, prestigeDelayMs);
```

and render, after the `{settings ? … : null}` block:

```tsx
            {prestigeShown && view.prestige ? <Prestige p={view.prestige} act={act} /> : null}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/modules/casecremental && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Browser check** — finish a vault: ~3.6 s after the vault opens, the prestige screen pops up: +CLOUT, total, the trophy line, three charms (PICK one; the others go grey; PICKED un-picks), perks with CLOUT prices, START NEXT RUN → a fresh run with the music back, the table clear, the bot asleep (or awake with Early Bird). Reload while the prestige screen is up: it is back at once. Switch to RU: everything fits.

- [ ] **Step 6: Commit**

```bash
git add src/modules/casecremental/ui
git commit -m "feat(ui): the prestige screen - CLOUT, the Vault I trophy, charms, perks and the next run"
```

### Task 8: Dev tools and saving on close

**Files:** Modify `game/controller.ts`, `game/controller.test.ts`, `module.ts`, `ui/Settings.tsx`, `ui/SoundBoard.tsx`, `ui/GamePanel.tsx`.

**Interfaces:**
- Produces: `GameController.saveNow(): void`; `Settings` prop `onReset?: () => void`; `SoundBoard` prop `onCheat?: (c: "cash" | "unlockAll") => void`.

- [ ] **Step 1: Write the failing test** — append to `game/controller.test.ts` inside `describe("GameController — the campaign", …)`:

```ts
  it("saves on demand (the page is closing) — even between autosaves", () => {
    const slot = memorySlot();
    const a = new GameController(1, slot);
    a.run.state.cash = 77;
    a.saveNow();
    expect(new GameController(2, slot).run.state.cash).toBe(77);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/casecremental/game/controller`
Expected: FAIL — `a.saveNow is not a function`.

- [ ] **Step 3: Implement**

`game/controller.ts` — add after `resetProgress`:

```ts
  /** Save now (the page is closing): autosave runs only about once a second. */
  saveNow(): void {
    this.save();
  }
```

`module.ts` — after the controller is created:

```ts
    window.addEventListener("pagehide", () => controller.saveNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") controller.saveNow();
    });
```

`ui/Settings.tsx` — add the prop `onReset?: () => void` and, after the sound-board button:

```tsx
        {onReset ? <PxButton onClick={onReset}>RESET PROGRESS (DEV)</PxButton> : null}
```

`ui/SoundBoard.tsx` — add the prop `onCheat?: (c: "cash" | "unlockAll") => void` (documented `/** Dev cheats to reach the vault quickly. */`) and, in the board's button area next to the forced-drop buttons:

```tsx
        {onCheat ? (
          <div className="cc-tabs">
            <PxButton onClick={() => onCheat("cash")}>+$100K (DEV)</PxButton>
            <PxButton onClick={() => onCheat("unlockAll")}>UNLOCK ALL (DEV)</PxButton>
          </div>
        ) : null}
```

`ui/GamePanel.tsx` — import `CASES` from `../sim/content/cases`; pass to `Settings`:

```tsx
                onReset={
                  import.meta.env.DEV
                    ? () => {
                        controller.resetProgress();
                        setSettings(false);
                      }
                    : undefined
                }
```

and to `SoundBoard`:

```tsx
                onCheat={(c) => {
                  // dev only: straight into the run's state, like the forced drops
                  if (c === "cash") controller.run.state.cash += 100_000;
                  else controller.run.state.unlocked = CASES.map((x) => x.id);
                }}
```

- [ ] **Step 4: Run every check**

Run: `npx vitest run src/modules/casecremental && npm run typecheck && npm run build`
Expected: PASS; typecheck clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/modules/casecremental
git commit -m "feat(dev): reset progress, +cash and unlock-all on the dev boards; save when the page closes"
```

### Task 9: Play Run 1 through, and record it

**Files:** Create `docs/feature-history/casecremental-run1.md`; Modify `docs/feature-history/README.md`.

- [ ] **Step 1: Play it** — in the browser, from Settings → RESET PROGRESS (DEV):
  1. Open cases by hand; spend down to $0 → DAY JOB works.
  2. Unlock Wildwood; wake the bot (Bot tab) → it carries Mil-Specs to the bin and Coverts to the tray; claim one by drag, one by tap.
  3. Dev board: +$100K and UNLOCK ALL → the vault row and the HUD goal show; buy the vault → the finale, the silence, the legendary showcase, the prestige screen.
  4. Pick a charm, buy a perk, START NEXT RUN → a fresh run with that charm, the music back.
  5. Reload in each state (bot carrying, finale building, prestige up): each resumes as it was.
  6. Switch to RU and check every new screen fits. Check the console has no errors.
  Write down anything off. Fix only what breaks the run (with a test where the fix is logic); note the rest for the user.

- [ ] **Step 2: Record the feature** — `docs/feature-history/casecremental-run1.md`:

```markdown
# Casecremental — Run 1 complete (M2b)

What a full Run 1 is and the calls behind it. Spec: `docs/superpowers/specs/2026-10-08-casecremental-m2b-run1-design.md`;
plans M2b-A (logic) and M2b-B (on screen).

## The loop
Open by hand → wake the bot (it sells ordinary drops at the bin and sets the good ones aside in the claim
tray) → unlock Wildwood and Bedrock → Vault Case I → a ~20 s hands-off finale → the vault opens on one ★
(the Vault I trophy) → prestige: CLOUT, pick a charm (3 offered from 8), buy perks → a fresh, boosted Run 1.

## Decisions worth knowing
- **The bot is the seller** (user, M2b brainstorm): it walks to the bench, carries the card, and never feeds
  the combo; grabbing the card turns it back. It is a state machine in the sim (deterministic, saved), and the
  canvas only draws it from state — a reload puts it on the same leg with the same card.
- **Content is split across the four runs** (user): Run 1 has the bot as seller (Speed ×1 → ×8), the tray, 8 of
  14 charms, multi-open ×2 (plan M2b-C). Later runs bring the bot's own reel, the locker, the auto-buyer grid.
- **The finale is a cinematic** (user): nothing in it depends on input, so a player who sits back still sees it.
- **The day job replaced the free case** (user): broke with an empty bench → a 3 s shift, 90 % +$2.
- **Tuning (pacing tests, medians of 5 greedy players):** bot awake ~2.2 min, first vault ~7.9 min, a
  boosted second run unlocks everything in ~1.4 min and vaults again at ~5.9 min. Wildwood's unlock went
  $40 → $30 so the bot can be woken right after it. Change numbers only in `sim/tuning.ts`.
- **Saving:** one versioned localStorage key; a bad save is dropped or filled in from defaults, never
  thrown; a held card is never restored as held.
```

and add to `docs/feature-history/README.md`:

```markdown
- [Casecremental Run 1 (M2b)](casecremental-run1.md) — bot as seller + claim tray, day job, Vault I finale, prestige (CLOUT, charms, perks), local save
```

- [ ] **Step 3: Run every check and commit**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS.

```bash
git add docs/feature-history src/modules/casecremental
git commit -m "docs(feature-history): Casecremental Run 1 (M2b)"
```
