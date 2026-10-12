import { runCaseIds } from "./campaign";
import { caseById, priceOf } from "./content/cases";
import { vaultFor } from "./content/vaults";
import { STAGE_NAMES } from "./intensity";
import { rollDrop } from "./roll";
import { fail, OK, type ActionResult, type RunCtx } from "./runTypes";
import { VAULT_LAND_TIMES, VAULT_OPENING_SECONDS, VAULT_REEL_RARITIES, VAULT_REEL_SHARES } from "./tuning";

// The run's vault (rework spec §4): bought once every case is unlocked, opened with the devil key; its five reels
// land on a timeline, then the run ends (the tray and the locker are sold with it).

export const vaultShown = (ctx: RunCtx): boolean => runCaseIds(ctx.setup.run).every((id) => ctx.state.unlocked.includes(id));

export function buyVault(ctx: RunCtx): ActionResult {
  const s = ctx.state;
  if (ctx.locked()) return fail("the vault is open");
  if (!vaultShown(ctx)) return fail("unlock every case first");
  if (s.bench.phase !== "empty") return fail("bench is busy");
  if (s.cash < ctx.setup.vaultPrice) return fail("not enough cash");
  s.cash -= ctx.setup.vaultPrice;
  // the bot's waiting cards and its spin in flight are cashed in as machine sales; then it freezes
  [...s.bot.cards, ...(s.bot.spin?.drops ?? [])].forEach((d, slot) => {
    if (!d) return;
    const amount = ctx.payout(d, false);
    ctx.earn(amount);
    ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "seller", from: "bot", slot });
  });
  s.bot.cards = [];
  s.bot.spin = null;
  if (s.held === "bot") ctx.release();
  // so are the locker's waiting results and a running press's; its items stay until the run ends
  [...s.locker.cards, ...(s.locker.press?.results ?? [])].forEach((d, slot) => {
    if (!d) return;
    const amount = ctx.payout(d, false);
    ctx.earn(amount);
    ctx.emit({ type: "sold", drop: d, amount, combo: s.combo, source: "locker", from: "locker", slot });
  });
  s.locker.cards = [];
  s.locker.press = null;
  if (s.held === "locker") ctx.release();
  s.dayJob = null; // a shift still running has no bench to come back to
  s.vault = { phase: "key" };
  ctx.emit({ type: "vaultBought", price: ctx.setup.vaultPrice });
  // the vault holds the top stage from its first frame to the end (M2b spec §7)
  s.stage = STAGE_NAMES.length;
  ctx.emit({ type: "stageChanged", stage: s.stage });
  return OK;
}

/** The player turns the devil key: five drops are rolled and the opening timeline starts. */
export function turnVaultKey(ctx: RunCtx): ActionResult {
  const s = ctx.state;
  if (!s.vault) return fail("no vault to open");
  if (s.vault.phase !== "key") return fail("the key has turned");
  const def = vaultFor(ctx.setup.run);
  const top = caseById(def.sourceCase);
  const drops = VAULT_REEL_RARITIES.map((rarity, i) => {
    const d = rollDrop(top, priceOf(top.id), 0, ctx.rng, s.nextDropId++, rarity);
    const value = ctx.setup.vaultPrice * VAULT_REEL_SHARES[i]!;
    return i === VAULT_REEL_RARITIES.length - 1 ? { ...d, skinId: def.legend.id, caseId: def.id, value } : { ...d, value };
  });
  s.vault = { phase: "opening", t: 0, drops, landed: 0 };
  ctx.emit({ type: "vaultKeyTurned", drops });
  return OK;
}

/** The vault's opening timeline: each reel lands (and pays) at its time; then the run ends. */
export function tickVault(ctx: RunCtx, dt: number): void {
  const s = ctx.state;
  const v = s.vault;
  if (v?.phase !== "opening") return;
  v.t += dt;
  while (v.landed < v.drops.length && v.t >= VAULT_LAND_TIMES[v.landed]!) {
    const drop = v.drops[v.landed]!;
    ctx.earn(drop.value);
    ctx.emit({ type: "vaultReelLanded", index: v.landed, drop, amount: drop.value });
    v.landed++;
  }
  if (v.t < VAULT_OPENING_SECONDS) return;
  for (const d of [...s.tray, ...s.locker.items]) ctx.earn(ctx.payout(d, false));
  s.tray = [];
  s.locker.items = [];
  s.vault = null;
  s.over = true;
  ctx.emit({
    type: "vaultOpened",
    trophy: vaultFor(ctx.setup.run).trophy,
    drop: v.drops[v.drops.length - 1]!,
    lifetimeEarnings: s.lifetimeEarnings,
  });
}
