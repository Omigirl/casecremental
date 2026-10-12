// Casecremental CloudCode — bundled by tools/cloud/bundle.mjs from cloudcode/data.json + cloudcode/casecremental.js.
var DATA = {"v":1,"trophies":{"bc_commander":{"rarity":"covert","source":"bootcamp","minLoops":0,"vault":false},"bc_warlord":{"rarity":"covert","source":"bootcamp","minLoops":0,"vault":false},"bc_knife":{"rarity":"gold","source":"bootcamp","minLoops":0,"vault":false},"ww_spirit":{"rarity":"covert","source":"wildwood","minLoops":0,"vault":false},"ww_elder":{"rarity":"covert","source":"wildwood","minLoops":0,"vault":false},"ww_knife":{"rarity":"gold","source":"wildwood","minLoops":0,"vault":false},"br_magma":{"rarity":"covert","source":"bedrock","minLoops":0,"vault":false},"br_diamond":{"rarity":"covert","source":"bedrock","minLoops":0,"vault":false},"br_knife":{"rarity":"gold","source":"bedrock","minLoops":0,"vault":false},"mf_root":{"rarity":"covert","source":"mainframe","minLoops":1,"vault":false},"mf_zeroday":{"rarity":"covert","source":"mainframe","minLoops":1,"vault":false},"mf_knife":{"rarity":"gold","source":"mainframe","minLoops":1,"vault":false},"nn_demon":{"rarity":"covert","source":"neon","minLoops":1,"vault":false},"nn_racer":{"rarity":"covert","source":"neon","minLoops":1,"vault":false},"nn_knife":{"rarity":"gold","source":"neon","minLoops":1,"vault":false},"ds_cosmicray":{"rarity":"covert","source":"deepspace","minLoops":2,"vault":false},"ds_blackhole":{"rarity":"covert","source":"deepspace","minLoops":2,"vault":false},"ds_knife":{"rarity":"gold","source":"deepspace","minLoops":2,"vault":false},"in_phoenix":{"rarity":"covert","source":"inferno","minLoops":2,"vault":false},"in_dragon":{"rarity":"covert","source":"inferno","minLoops":2,"vault":false},"in_knife":{"rarity":"gold","source":"inferno","minLoops":2,"vault":false},"gl_fatal":{"rarity":"covert","source":"glitch","minLoops":3,"vault":false},"gl_null":{"rarity":"covert","source":"glitch","minLoops":3,"vault":false},"gl_knife":{"rarity":"gold","source":"glitch","minLoops":3,"vault":false},"fd_lucid":{"rarity":"covert","source":"feverdream","minLoops":3,"vault":false},"fd_feverpitch":{"rarity":"covert","source":"feverdream","minLoops":3,"vault":false},"fd_knife":{"rarity":"gold","source":"feverdream","minLoops":3,"vault":false},"vault1_legend":{"rarity":"gold","source":"vault1","minLoops":0,"vault":true},"vault2_legend":{"rarity":"gold","source":"vault2","minLoops":1,"vault":true},"vault3_legend":{"rarity":"gold","source":"vault3","minLoops":2,"vault":true},"lastcase_legend":{"rarity":"gold","source":"lastcase","minLoops":3,"vault":true}},"vaults":[{"trophy":"vault1","legend":"vault1_legend"},{"trophy":"vault2","legend":"vault2_legend"},{"trophy":"vault3","legend":"vault3_legend"},{"trophy":"lastcase","legend":"lastcase_legend"}],"perks":{"startCash":{"baseCost":3,"growth":1.8,"maxLevel":5},"luck":{"baseCost":5,"growth":2,"maxLevel":5},"charmSlot":{"baseCost":15,"growth":2,"maxLevel":2},"botAwake":{"baseCost":8,"growth":1,"maxLevel":1},"biggerTray":{"baseCost":4,"growth":2,"maxLevel":3}},"charms":["luckySeven","rustBucket","pityJar","doubleTap","ricochet","goldRush","insider","milSpecManiac","chainReaction","contractKiller","hoarder","fever","collectorsEye","loadedDice"],"cloutDivisor":105,"maxCloutPerRun":100000000000,"cap":{"baseLog10":3,"perSqrtSecond":0.3,"perLoop":4,"ceilLog10":300},"minRunSec":[120,45,60,80],"minReplaySec":25,"trophyGapSec":2,"trophiesPerMinute":2,"trophyBurst":3,"maxOpensPerSecond":2000};
// Casecremental CloudCode (plan F7). The platform runs this with the globals `handlers`, `server` and `log`; each
// handler is (args, context) and its return value is the client's FunctionResult. `DATA` (trophies, perks, caps,
// charms) is prepended by tools/cloud/bundle.mjs from cloudcode/data.json, which is generated from the game's
// content tables. No async, no imports, 10 s per call. The rules never touch `server`: they talk to the `io` that
// makeIo builds, in the call shapes cloudcode/probe.js confirmed on ZVKC34TR-DEV — so Vitest runs them with a fake.
// A handler never throws: it answers { ok: false, reason, retry } and the client's queue decides.
// FunctionResult keys must not contain '.' or '$' (the platform refuses them): views use ids and plain names only.

var CATALOG = "Trophies";
var CURRENCY = "CLOUT";
var LEADERBOARD = "best_run";
var META_KEY = "cc_meta";
var ANTI_KEY = "cc_anti";
/** Public String key: the player's verified Solana wallet, shown on the leaderboard (plan F8). */
var WALLET_KEY = "cc_wallet";
/** The Titles' Solana network key (cfg.Blockchain.Networks; src/walletLogin.tsx SOLANA_NETWORK_ID). */
var SOLANA = "solana";
var KEEP_RUNS = 20;
/** Whether endRun moves best_run itself. The probe found leaderboard event tokens land in MilestoneTokensEarned, not
 *  in the BestScore, so the client submits the score (client.leaderboard.submitScore) after endRun answers. */
var SERVER_SCORE = false;

function fail(reason, retry) {
  return { ok: false, reason: reason, retry: !!retry };
}
function num(x) {
  return typeof x === "number" && isFinite(x) ? x : null;
}
function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}
/** An own key of a plain table (never "constructor" or "__proto__" through the prototype). */
function has(table, key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key);
}
/** A base58 Solana address (32-44 characters, no 0, O, I or l) - the client's isSolanaAddress. */
function isSolanaAddress(s) {
  return typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

// ---- the server API (only here) ----
// ReadUserData(["InventoryV2"]) answers the data itself (no {Success, Data}); Items are keyed by ItemID.
// GetUserCustomData() answers every bucket ({Success, Data: {ReadOnly: {key: {Value}}}}); it is read once per call.
// SetUserCustomData(bucket, key, string). ApplyResourceOperation({Operation, Reason}): Reason is required and is an
// idempotency key per player ACROSS executions (DEV probe, 2026-10-13: the same Reason in three executions applied
// once, even with another amount; an op that FAILED does not use its Reason up; a replay of an applied consume is still
// checked against the balance first). So a retried endRun / reportTrophy / buyPerk never pays or charges twice.
// ReadUserData(["Blockchain"]) is read the same way as the inventory (plan F8): the platform's UserBlockchainState,
// whose LastWalletLogin / LinkedWallets the platform fills only after the wallet signed its challenge.
function makeIo(server, context) {
  var custom = null;
  var inv = null;
  function customData() {
    if (custom === null) {
      var r = server.GetUserCustomData();
      custom = r && r.Success && r.Data ? r.Data : {};
    }
    return custom;
  }
  function inventory() {
    if (inv === null) {
      var r = server.ReadUserData(["InventoryV2"]);
      inv = r && r.InventoryV2 ? r.InventoryV2 : {};
    }
    return inv;
  }
  return {
    userId: context && context.UserID,
    now: function () {
      return Date.now() / 1000;
    },
    readData: function (bucket, key) {
      var b = customData()[bucket];
      var rec = b && b[key];
      if (!rec || typeof rec.Value !== "string") return null;
      try {
        return JSON.parse(rec.Value);
      } catch (e) {
        return null;
      }
    },
    /** A String key's value as stored (no JSON parse), or null. */
    readRaw: function (bucket, key) {
      var b = customData()[bucket];
      var rec = b && b[key];
      return rec && typeof rec.Value === "string" ? rec.Value : null;
    },
    /** The account's Solana address, proven by a signed challenge (a wallet sign-in or a signature link), or null. */
    walletAddress: function () {
      var r = server.ReadUserData(["Blockchain"]);
      var b = r && (r.Blockchain || (r.Data && r.Data.Blockchain));
      if (!b || typeof b !== "object") return null;
      var last = b.LastWalletLogin;
      if (last && last.NetworkID === SOLANA && isSolanaAddress(last.Address)) return last.Address;
      var linked = b.LinkedWallets && typeof b.LinkedWallets === "object" ? b.LinkedWallets : {};
      for (var key in linked) {
        var w = has(linked, key) ? linked[key] : null;
        if (w && w.NetworkID === SOLANA && isSolanaAddress(w.Address) && (w.IsSignatureVerified === true || w.LinkType === "SignatureVerified")) return w.Address;
      }
      return null;
    },
    writeData: function (bucket, key, value) {
      var s = typeof value === "string" ? value : JSON.stringify(value);
      var r = server.SetUserCustomData(bucket, key, s);
      if (!(r && r.Success)) return false;
      var d = customData();
      if (!d[bucket]) d[bucket] = {};
      d[bucket][key] = { Value: s };
      return true;
    },
    clout: function () {
      var c = (inventory().VirtualCurrencies || {})[CURRENCY];
      return c && typeof c.Amount === "number" ? c.Amount : 0;
    },
    ownedTrophies: function () {
      var items = inventory().Items || {};
      var out = [];
      for (var id in items) if (has(DATA.trophies, id) && items[id] && items[id].TotalAmount > 0) out.push(id);
      return out;
    },
    apply: function (op, reason) {
      var r = server.ApplyResourceOperation({ Operation: op, Reason: reason });
      inv = null;
      return !!(r && r.Success);
    },
  };
}

// ---- the game's rules (mirrors of sim/meta.ts and meta/plausibility.ts, tested against them) ----
function maxPlausibleLog10(elapsedSec, loops) {
  var c = DATA.cap;
  return Math.min(c.ceilLog10, c.baseLog10 + c.perSqrtSecond * Math.sqrt(Math.max(0, elapsedSec)) + c.perLoop * Math.max(0, loops));
}
function scoreFor(e) {
  return e > 1 ? Math.floor(Math.log10(e) * 1000) : 0;
}
function cloutFor(e) {
  return Math.floor(Math.sqrt(Math.max(0, e)) / DATA.cloutDivisor);
}
function perkCost(id, level) {
  var p = DATA.perks[id];
  return level >= p.maxLevel ? null : Math.ceil(p.baseCost * Math.pow(p.growth, level));
}
/** The least a run takes before its vault (index k of DATA.vaults) counts; a replay of the last uses minReplaySec. */
function minRunSec(k, loops) {
  return loops >= DATA.vaults.length ? DATA.minReplaySec : DATA.minRunSec[k];
}
function vaultIndex(trophy) {
  for (var k = 0; k < DATA.vaults.length; k++) if (DATA.vaults[k].trophy === trophy) return k;
  return -1;
}
function cloutEntry(n) {
  return { Type: "VirtualCurrency", CurrencyID: CURRENCY, Amount: n };
}
function itemEntry(id) {
  return { Type: "Item", CatalogID: CATALOG, ItemID: id, Amount: 1 };
}

function freshMeta() {
  var perks = {};
  for (var id in DATA.perks) perks[id] = 0;
  return { v: 1, perks: perks, loops: 0, stats: { playSeconds: 0, opened: 0, best: null, cloutEarned: 0 }, picked: [], runs: [] };
}
function readMeta(io) {
  var m = io.readData("ReadOnly", META_KEY);
  var f = freshMeta();
  if (!m || typeof m !== "object") return f;
  for (var id in f.perks) f.perks[id] = clamp(Math.floor(num(m.perks && m.perks[id]) || 0), 0, DATA.perks[id].maxLevel);
  f.loops = Math.max(0, Math.floor(num(m.loops) || 0));
  var s = m.stats || {};
  f.stats.playSeconds = Math.max(0, num(s.playSeconds) || 0);
  f.stats.opened = Math.max(0, num(s.opened) || 0);
  f.stats.cloutEarned = Math.max(0, num(s.cloutEarned) || 0);
  f.stats.best = s.best && typeof s.best.skinId === "string" && num(s.best.value) !== null ? { skinId: s.best.skinId, value: s.best.value } : null;
  f.picked = Array.isArray(m.picked)
    ? m.picked.filter(function (c) {
        return DATA.charms.indexOf(c) >= 0;
      })
    : [];
  // each paid run: { id, score, gained } (revision 9 kept bare ids)
  f.runs = (Array.isArray(m.runs) ? m.runs.slice(-KEEP_RUNS) : []).map(function (r) {
    return typeof r === "string" ? { id: r, score: 0, gained: 0 } : { id: String(r && r.id), score: num(r && r.score) || 0, gained: num(r && r.gained) || 0 };
  });
  return f;
}
function findRun(meta, runId) {
  for (var i = 0; i < meta.runs.length; i++) if (meta.runs[i].id === runId) return meta.runs[i];
  return null;
}
/** The anti-cheat clock (Internal: the client never sees it) - when the server first saw the player, when the last run
 *  ended and the last counted vault, and the trophy token bucket. */
function readAnti(io) {
  var a = io.readData("Internal", ANTI_KEY);
  var now = io.now();
  if (!a || typeof a !== "object") a = {};
  var firstSeen = num(a.firstSeen);
  return {
    firstSeen: firstSeen === null ? now : Math.min(firstSeen, now),
    lastEndAt: num(a.lastEndAt),
    finaleAt: num(a.finaleAt),
    trophyAt: num(a.trophyAt) || 0,
    trophyTokens: num(a.trophyTokens),
  };
}
/** Puts the verified wallet (or nothing) in the Public key the leaderboard reads. The player can write their own Public
 *  keys, so this runs on every endRun and replaces whatever is there. Cosmetic: a failed write never fails the run. */
function publishWallet(io) {
  var wallet = io.walletAddress();
  var stored = io.readRaw("Public", WALLET_KEY);
  if (wallet) {
    if (stored !== wallet) io.writeData("Public", WALLET_KEY, wallet);
  } else if (stored) io.writeData("Public", WALLET_KEY, "");
}
function view(io, meta) {
  return { ok: true, clout: io.clout(), trophies: io.ownedTrophies(), perks: meta.perks, loops: meta.loops, stats: meta.stats, picked: meta.picked };
}

var RULES = {
  loadMeta: function (io) {
    var meta = readMeta(io);
    if (io.readData("Internal", ANTI_KEY) === null) io.writeData("Internal", ANTI_KEY, readAnti(io));
    return view(io, meta);
  },

  reportTrophy: function (io, a) {
    var t = has(DATA.trophies, a.skinId) ? DATA.trophies[a.skinId] : null;
    if (!t || t.vault) return fail("not a trophy");
    var meta = readMeta(io);
    if (t.minLoops > meta.loops) return fail("case not reached yet");
    if (io.ownedTrophies().indexOf(a.skinId) >= 0) return view(io, meta);
    var anti = readAnti(io);
    var now = io.now();
    if (now - anti.trophyAt < DATA.trophyGapSec) return fail("too fast", true);
    // a token bucket in server time (the client's clock and run id are not trusted): trophiesPerMinute, trophyBurst at once
    var since = Math.max(0, now - (anti.trophyAt || anti.firstSeen));
    var tokens = Math.min(DATA.trophyBurst, (anti.trophyTokens === null ? DATA.trophyBurst : anti.trophyTokens) + (since * DATA.trophiesPerMinute) / 60);
    if (tokens < 1) return fail("too many trophies, later", true);
    if (!io.apply({ Grant: { Standard: { Entries: [itemEntry(a.skinId)] } } }, "trophy:" + io.userId + ":" + a.skinId)) return fail("grant failed", true);
    anti.trophyAt = now;
    anti.trophyTokens = tokens - 1;
    io.writeData("Internal", ANTI_KEY, anti);
    return view(io, meta);
  },

  endRun: function (io, a) {
    var runId = typeof a.runId === "string" && a.runId.length > 0 && a.runId.length <= 40 ? a.runId : null;
    var earnings = num(a.lifetimeEarnings);
    var elapsed = num(a.elapsedSec);
    if (runId === null || earnings === null || earnings < 0 || elapsed === null || elapsed < 0) return fail("bad run report");
    var meta = readMeta(io);
    var paid = findRun(meta, runId);
    if (paid) {
      publishWallet(io);
      var dup = view(io, meta);
      dup.duplicate = true;
      dup.gained = paid.gained;
      dup.score = paid.score;
      dup.capped = false;
      dup.serverScore = SERVER_SCORE;
      return dup;
    }
    var anti = readAnti(io);
    var now = io.now();
    // The run's time is bounded by the server's own clock: since the last run ended, or since the server first saw the
    // player. The end comes as "seconds ago" (no client clock skew); a bare endedAt is the revision-9 client's.
    var floor = anti.lastEndAt === null ? anti.firstSeen : Math.max(anti.firstSeen, anti.lastEndAt);
    var ago = num(a.endedAgoSec);
    var claimed = ago !== null ? now - Math.max(0, ago) : num(a.endedAt) === null ? now : a.endedAt;
    var endedAt = clamp(claimed, floor, now);
    var used = Math.min(elapsed, endedAt - floor);
    // The vault counts when it is the one the server expects - or a later one (a lost endRun is caught up) - and the
    // run took the minimum time, and every vault it stands for fits in the time since the last counted one.
    var cur = Math.min(meta.loops, DATA.vaults.length - 1);
    var k = vaultIndex(a.trophy);
    var finale = false;
    if (a.finaleReached === true && k >= cur && used >= minRunSec(k, meta.loops)) {
      var need = 0;
      for (var j = cur; j <= k; j++) need += minRunSec(j, meta.loops);
      finale = endedAt - (anti.finaleAt === null ? anti.firstSeen : Math.max(anti.firstSeen, anti.finaleAt)) >= need;
    }
    // a counted catch-up run is capped as the run it was (vault k has k vaults behind it)
    var capped = Math.min(earnings, Math.pow(10, maxPlausibleLog10(used, finale ? Math.max(meta.loops, k) : meta.loops)));
    var gain = Math.min(cloutFor(capped), DATA.maxCloutPerRun);
    var score = scoreFor(capped);
    var grant = { Standard: { Entries: gain > 0 ? [cloutEntry(gain)] : [] } };
    if (finale && io.ownedTrophies().indexOf(DATA.vaults[k].legend) < 0) grant.Standard.Entries.push(itemEntry(DATA.vaults[k].legend));
    if (SERVER_SCORE && score > 0) grant.Standard.EventTokens = [{ Address: { Type: "Leaderboard", EntityID: LEADERBOARD }, Amount: score, Source: "casecremental:endRun" }];
    // the run's id is the Reason: a retry after a failed meta write is paid only once by the platform
    if ((grant.Standard.Entries.length > 0 || grant.Standard.EventTokens) && !io.apply({ Grant: grant }, "endRun:" + io.userId + ":" + runId))
      return fail("grant failed", true);
    if (finale) {
      meta.loops = k > cur ? k + 1 : meta.loops + 1;
      anti.finaleAt = endedAt;
    }
    meta.stats.cloutEarned += gain;
    meta.runs.push({ id: runId, score: score, gained: gain });
    meta.runs = meta.runs.slice(-KEEP_RUNS);
    anti.lastEndAt = endedAt;
    if (!io.writeData("ReadOnly", META_KEY, meta)) return fail("save failed", true);
    io.writeData("Internal", ANTI_KEY, anti);
    publishWallet(io);
    var out = view(io, meta);
    out.gained = gain;
    out.score = score;
    out.capped = capped < earnings;
    out.finale = finale;
    out.serverScore = SERVER_SCORE;
    return out;
  },

  buyPerk: function (io, a) {
    if (!has(DATA.perks, a.perkId)) return fail("unknown perk");
    var meta = readMeta(io);
    var level = meta.perks[a.perkId];
    if (num(a.level) !== null && a.level !== level) {
      var stale = view(io, meta);
      stale.stale = true;
      return stale;
    }
    var cost = perkCost(a.perkId, level);
    if (cost === null) return fail("max level");
    // One Reason per perk level: two tabs buying the same level at once are charged once (the platform applies a Reason
    // once), and a retry after a failed meta write does not charge again - so there is no refund to undo it.
    if (!io.apply({ Consume: { Standard: { Entries: [cloutEntry(cost)] } } }, "perk:" + io.userId + ":" + a.perkId + ":" + level))
      return fail("not enough CLOUT");
    meta.perks[a.perkId] = level + 1;
    if (!io.writeData("ReadOnly", META_KEY, meta)) return fail("save failed", true);
    return view(io, meta);
  },

  saveMeta: function (io, a) {
    var meta = readMeta(io);
    var anti = readAnti(io);
    var s = a.stats && typeof a.stats === "object" ? a.stats : {};
    var maxPlay = io.now() - (num(anti.firstSeen) || io.now()) + 3600;
    meta.stats.playSeconds = Math.max(meta.stats.playSeconds, clamp(num(s.playSeconds) || 0, 0, maxPlay));
    meta.stats.opened = Math.max(meta.stats.opened, clamp(Math.floor(num(s.opened) || 0), 0, meta.stats.playSeconds * DATA.maxOpensPerSecond));
    if (s.best && typeof s.best.skinId === "string" && num(s.best.value) !== null && s.best.value >= 0 && (!meta.stats.best || s.best.value > meta.stats.best.value))
      meta.stats.best = { skinId: s.best.skinId.slice(0, 40), value: s.best.value };
    if (a.picked !== undefined) {
      var picked = Array.isArray(a.picked) ? a.picked : null;
      var slots = 1 + (meta.perks.charmSlot || 0);
      if (picked === null || picked.length > slots) return fail("bad charms");
      for (var i = 0; i < picked.length; i++) if (DATA.charms.indexOf(picked[i]) < 0 || picked.indexOf(picked[i]) !== i) return fail("bad charms");
      meta.picked = picked.slice();
    }
    if (!io.writeData("ReadOnly", META_KEY, meta)) return fail("save failed", true);
    return view(io, meta);
  },
};

function wrap(name) {
  return function (args, context) {
    try {
      return RULES[name](makeIo(server, context), args && typeof args === "object" ? args : {});
    } catch (e) {
      log.Error(name + ": " + e);
      return fail("server error", true);
    }
  };
}
handlers.loadMeta = wrap("loadMeta");
handlers.reportTrophy = wrap("reportTrophy");
handlers.endRun = wrap("endRun");
handlers.buyPerk = wrap("buyPerk");
handlers.saveMeta = wrap("saveMeta");
