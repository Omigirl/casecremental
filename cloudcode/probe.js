// Throwaway probe (plan F7 Task 2): learns the server.* call shapes on ZVKC34TR-DEV, because no document we can read
// gives them. Published as handler `probe` (revisions 1–5 on DEV, 2026-10-13), run from a signed-in guest session
// in headless Chrome, then replaced by casecremental.bundle.js (Task 3). This is the last version (v5); the findings
// of all five runs are at the bottom of this file.
handlers.probe = function (args, context) {
  var out = { tries: {} };
  var n = 0;
  function attempt(label, fn) {
    try {
      var v = fn();
      var s;
      try {
        s = JSON.stringify(v);
      } catch (e) {
        s = "unserializable: " + e;
      }
      out.tries[label] = { ok: true, result: String(s).slice(0, 1500) };
    } catch (e) {
      out.tries[label] = { ok: false, error: String(e) };
    }
  }
  function op(o) {
    n++;
    return server.ApplyResourceOperation({ Operation: o, Reason: "casecremental probe " + n + " " + Date.now() });
  }
  attempt("inv-before", function () { return server.ReadUserData(["InventoryV2"]); });
  attempt("grant clout 5", function () { return op({ Grant: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "CLOUT", Amount: 5 }] } } }); });
  attempt("grant trophy item", function () { return op({ Grant: { Standard: { Entries: [{ Type: "Item", CatalogID: "Trophies", ItemID: "bc_knife", Amount: 1 }] } } }); });
  attempt("consume clout 2", function () { return op({ Consume: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "CLOUT", Amount: 2 }] } } }); });
  attempt("leaderboard tokens 1234", function () {
    return op({ Grant: { Standard: { EventTokens: [{ Address: { Type: "Leaderboard", EntityID: "best_run" }, Amount: 1234, Source: "probe" }] } } });
  });
  attempt("inv-after", function () { return server.ReadUserData(["InventoryV2"]); });
  attempt("same reason twice", function () {
    var g = { Grant: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "CLOUT", Amount: 1 }] } } };
    var a = server.ApplyResourceOperation({ Operation: g, Reason: "fixed-reason" });
    var b = server.ApplyResourceOperation({ Operation: g, Reason: "fixed-reason" });
    return [a.Success, b.Success, b.Error];
  });
  attempt("inv-final", function () {
    var d = server.ReadUserData(["InventoryV2"]);
    return d.InventoryV2 && d.InventoryV2.VirtualCurrencies;
  });
  return out;
};

/* Findings (2026-10-13, ZVKC34TR-DEV, guest CTLGIIQITSQZUCFAZVKC34TR-DEV):
 *
 * context keys: UserID, FunctionName, Revision, InvokedAt.
 * server keys: ReadUserData, GetTitleConfig, GetUserCustomData, GetPublicUserCustomDataOf, SetUserCustomData,
 *   DeleteUserCustomData, Batch(Set|Delete)UserCustomData, (Get|Set|Increment|Delete|BatchSet|BatchDelete)TitleCustomData,
 *   GetIntegrationVariable, HttpRequest, AddQuestProgress, LogEvent, ApplyResourceOperation, (Start|Get|List)AIGeneration,
 *   SendMail, the DataItems family, GetDataCounter, (Get|Set)UserRoles.
 *
 * ReadUserData(["InventoryV2"]) → NO {Success, Data} wrapper; the data itself:
 *   { InventoryV2: { VirtualCurrencies: { CLOUT: { Amount: 3, Daily: {…} } },
 *                    Items: { bc_knife: { StackableAmount: 0, UnstackableAmount: 1, TotalAmount: 1 } },   ← keyed by ItemID,
 *                    UnstackableItems: null, CryptoCurrencies: null } }                                     no CatalogID
 *   ReadUserData() / ReadUserData({Fields}) / ReadUserData("InventoryV2") → an empty object.
 * GetUserCustomData() → { Success, Error, Data: { Version, Private, Public, ReadOnly: { key: { Value: "<json string>",
 *   UpdatedAt, Version, LastWriter: "Server" } }, Internal } }. Arguments are ignored (always every bucket).
 * SetUserCustomData("ReadOnly", key, "<string>") → { Success: true, Data: { Bucket, KeyID, Version } }.
 *   The object form ({Bucket, KeyID, Value}) fails: "Unknown value '[object Object]'".
 * ApplyResourceOperation({ Operation: <ResourceOperation>, Reason: "<string>" }) → { Success, Error, Data }.
 *   Without Reason (any shape): "Reason is required.". (op, "reason") and ("reason", op) fail too.
 *   Over-consume → Success: false, Error "VC CLOUT: insufficient balance (have 1, need 1000000000, min 0).".
 *   Item grant → the trophy appears in the inventory (client: UnstackableItems[instanceId] with CatalogID "Trophies").
 *   The SAME Reason twice in one execution: both answer Success, but only the first is applied — Reason works as an
 *   idempotency key, so every op gets its own Reason.
 * Leaderboard event tokens (Address { Type: "Leaderboard", EntityID: "best_run" }) → applied to "best_run:all" as
 *   MilestoneTokensEarned (1234); CurrentScore stays 0 → tokens do NOT move the BestScore → SERVER_SCORE = false
 *   (the client submits the score with client.leaderboard.submitScore after endRun answers).
 * FunctionResult must not contain object keys with '.' or '$' (Error "InvalidFieldName") — the handlers' views use
 *   only skin ids, perk ids and plain field names.
 * A publish takes a while to reach "Live" executions; execute(name, args, "Specific", rev) reaches it at once.
 * Date.now() and Math.log10 exist.
 *
 * Found after the handlers went live (revisions 6–8, probe v6 at revision 7):
 * - A Reason with a '.' in it (a fractional Date.now()/1000) makes ApplyResourceOperation fail → buyPerk uses integer
 *   milliseconds. Colons are fine.
 * - A publish changes the handler whitelist only after a few minutes ("HandlerNotFound … not declared in CloudCode
 *   whitelist" meanwhile); the client port treats HandlerNotFound as "try again later".
 * - CloudCode's resource operations are NOT visible to the client's own state reads: for a fresh guest
 *   (PMEUP7QNEWOGLIFOZVKC34TR-DEV) four CLOUT grants and an endRun showed in ReadUserData inside CloudCode (CLOUT 11,
 *   two trophies) while client.user.getClientState() / getUserState(["InventoryV2"]) — even with the SDK's stored
 *   snapshot removed — kept answering CLOUT 0 and no items for 5+ minutes, though StateVersions.InventoryV2 went up.
 *   (One earlier run, probe v5, did show up on the client.) So the game takes CLOUT and trophies from the handlers'
 *   views (loadMeta etc.), never from client.data.user's inventory alone. Reported to the user as a platform issue.
 */
