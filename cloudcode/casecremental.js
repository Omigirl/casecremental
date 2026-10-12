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
var KEEP_RUNS = 20;
/** Whether endRun moves best_run itself. The probe found leaderboard event tokens land in MilestoneTokensEarned, not
 *  in the BestScore, so the client submits the score (client.leaderboard.submitScore) after endRun answers. */
var SERVER_SCORE = false;
/** Makes every perk operation's Reason unique, even two in the same millisecond. */
var opSeq = 0;

function fail(reason, retry) {
  return { ok: false, reason: reason, retry: !!retry };
}
function num(x) {
  return typeof x === "number" && isFinite(x) ? x : null;
}
function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

// ---- the server API (only here) ----
// ReadUserData(["InventoryV2"]) answers the data itself (no {Success, Data}); Items are keyed by ItemID.
// GetUserCustomData() answers every bucket ({Success, Data: {ReadOnly: {key: {Value}}}}); it is read once per call.
// SetUserCustomData(bucket, key, string). ApplyResourceOperation({Operation, Reason}): Reason is required and works
// as an idempotency key, so each operation gets its own.
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
      for (var id in items) if (DATA.trophies[id] && items[id] && items[id].TotalAmount > 0) out.push(id);
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
  f.runs = Array.isArray(m.runs) ? m.runs.slice(-KEEP_RUNS) : [];
  return f;
}
function readAnti(io) {
  var a = io.readData("Internal", ANTI_KEY);
  if (!a || typeof a !== "object") return { firstSeen: io.now(), lastEndAt: null, trophyAt: 0, trophyRuns: {} };
  if (!a.trophyRuns || typeof a.trophyRuns !== "object") a.trophyRuns = {};
  return a;
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
    var t = DATA.trophies[a.skinId];
    if (!t || t.vault) return fail("not a trophy");
    var meta = readMeta(io);
    if (t.minLoops > meta.loops) return fail("case not reached yet");
    if (io.ownedTrophies().indexOf(a.skinId) >= 0) return view(io, meta);
    var anti = readAnti(io);
    var now = io.now();
    if (now - (num(anti.trophyAt) || 0) < DATA.trophyGapSec) return fail("too fast", true);
    var runId = typeof a.runId === "string" ? a.runId.slice(0, 40) : "?";
    var used = num(anti.trophyRuns[runId]) || 0;
    var allowed = Math.ceil(DATA.trophiesPerRunMinute * Math.max(1, (num(a.elapsedSec) || 0) / 60));
    if (used >= allowed) return fail("too many trophies this run");
    if (!io.apply({ Grant: { Standard: { Entries: [itemEntry(a.skinId)] } } }, "trophy:" + io.userId + ":" + a.skinId)) return fail("grant failed", true);
    anti.trophyAt = now;
    anti.trophyRuns = {};
    anti.trophyRuns[runId] = used + 1; // only the current run is kept
    io.writeData("Internal", ANTI_KEY, anti);
    return view(io, meta);
  },

  endRun: function (io, a) {
    var runId = typeof a.runId === "string" && a.runId.length > 0 && a.runId.length <= 40 ? a.runId : null;
    var earnings = num(a.lifetimeEarnings);
    var elapsed = num(a.elapsedSec);
    if (runId === null || earnings === null || earnings < 0 || elapsed === null || elapsed < 0) return fail("bad run report");
    var meta = readMeta(io);
    if (meta.runs.indexOf(runId) >= 0) {
      var dup = view(io, meta);
      dup.duplicate = true;
      dup.gained = 0;
      dup.score = 0;
      dup.capped = false;
      dup.serverScore = SERVER_SCORE;
      return dup;
    }
    var anti = readAnti(io);
    var now = io.now();
    var last = num(anti.lastEndAt);
    var endedAt = clamp(num(a.endedAt) === null ? now : a.endedAt, last === null ? 0 : last, now);
    var window = last === null ? DATA.firstRunMaxSec : endedAt - last;
    var used = Math.min(elapsed, window);
    var capped = Math.min(earnings, Math.pow(10, maxPlausibleLog10(used, meta.loops)));
    var gain = Math.min(cloutFor(capped), DATA.maxCloutPerRun);
    var score = scoreFor(capped);
    var vault = DATA.vaults[Math.min(meta.loops, DATA.vaults.length - 1)];
    var finale = a.finaleReached === true && a.trophy === vault.trophy;
    var grant = { Standard: { Entries: gain > 0 ? [cloutEntry(gain)] : [] } };
    if (finale && io.ownedTrophies().indexOf(vault.legend) < 0) grant.Standard.Entries.push(itemEntry(vault.legend));
    if (SERVER_SCORE && score > 0) grant.Standard.EventTokens = [{ Address: { Type: "Leaderboard", EntityID: LEADERBOARD }, Amount: score, Source: "casecremental:endRun" }];
    // the run's id is the Reason: a replay the meta write missed is still paid only once by the platform
    if ((grant.Standard.Entries.length > 0 || grant.Standard.EventTokens) && !io.apply({ Grant: grant }, "endRun:" + io.userId + ":" + runId))
      return fail("grant failed", true);
    if (finale) meta.loops += 1;
    meta.stats.cloutEarned += gain;
    meta.runs.push(runId);
    meta.runs = meta.runs.slice(-KEEP_RUNS);
    anti.lastEndAt = endedAt;
    io.writeData("ReadOnly", META_KEY, meta);
    io.writeData("Internal", ANTI_KEY, anti);
    var out = view(io, meta);
    out.gained = gain;
    out.score = score;
    out.capped = capped < earnings;
    out.serverScore = SERVER_SCORE;
    return out;
  },

  buyPerk: function (io, a) {
    if (!DATA.perks[a.perkId]) return fail("unknown perk");
    var meta = readMeta(io);
    var level = meta.perks[a.perkId];
    if (num(a.level) !== null && a.level !== level) {
      var stale = view(io, meta);
      stale.stale = true;
      return stale;
    }
    var cost = perkCost(a.perkId, level);
    if (cost === null) return fail("max level");
    var tag = a.perkId + ":" + level + ":" + Math.floor(io.now() * 1000) + ":" + ++opSeq; // no "." in a Reason
    if (!io.apply({ Consume: { Standard: { Entries: [cloutEntry(cost)] } } }, "perk:" + tag)) return fail("not enough CLOUT");
    meta.perks[a.perkId] = level + 1;
    if (!io.writeData("ReadOnly", META_KEY, meta)) {
      io.apply({ Grant: { Standard: { Entries: [cloutEntry(cost)] } } }, "refund:" + tag);
      return fail("save failed", true);
    }
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
