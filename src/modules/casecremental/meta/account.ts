// Local storage per account (F7 review): the local save and the server call queue live under the signed-in player's
// own keys, so a second account on the same browser neither sees the first one's campaign nor sends its queued
// calls. Before F7's fix both lived under one key per browser: the first account that loads after the update adopts
// them (they were most likely its own), and the unkeyed copies are removed.

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** `base` for one account; the bare `base` when no one is signed in (tests, a blocked auth context). */
export const accountKey = (base: string, userId: string | null): string => (userId ? `${base}.${userId}` : base);

/** Moves the browser's unkeyed `base` to this account's key, unless the account already has its own. */
export function adoptLegacy(store: Store | null, base: string, userId: string | null): void {
  if (!store || !userId) return;
  try {
    const legacy = store.getItem(base);
    if (legacy === null) return;
    const key = accountKey(base, userId);
    if (store.getItem(key) === null) store.setItem(key, legacy);
    store.removeItem(base);
  } catch {
    // storage blocked: nothing to move
  }
}
