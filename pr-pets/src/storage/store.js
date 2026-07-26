/**
 * store — the only module in the extension that talks to chrome.storage.
 *
 * It deliberately contains no rules. Everything it can do is: read the
 * document, hand it to a pure function from appState.js, and write the result
 * back. Keeping the adapter this thin is what lets the entire model be tested
 * in plain Node with no browser and no mocks.
 */

import * as App from '../model/appState.js';

const KEY = 'prpets/v1';

/**
 * Writes are serialised through this chain.
 *
 * Two events can land in the same millisecond — a review submitted just as a
 * mood tick fires — and chrome.storage offers no compare-and-swap. Without the
 * queue, a read-modify-write pair can interleave and silently drop a feeding.
 * (This orders writes within one tab; cross-tab, `subscribe` reconciles.)
 *
 * The chain holds only *settled* promises, never a rejected one: see `update`.
 */
let queue = Promise.resolve();

/** @returns {Promise<object>} the current document, always valid */
export async function read() {
  const now = Date.now();
  const bag = await chrome.storage.local.get(KEY);
  const raw = bag?.[KEY];
  if (!raw) {
    const fresh = App.createApp(now);
    await chrome.storage.local.set({ [KEY]: fresh });
    return fresh;
  }
  return App.fromJSON(raw, now);
}

/**
 * Apply a pure transformation to the stored document.
 *
 * @param {(app: object) => object} mutate  must be pure and must return a
 *        document; returning the same reference skips the write entirely
 * @returns {Promise<object>} the document after the change
 */
export function update(mutate) {
  const result = queue.then(async () => {
    const before = await read();
    const after = mutate(before);
    if (after === before) return before;
    await chrome.storage.local.set({ [KEY]: after });
    return after;
  });

  // The queue must carry on after a failed write. `queue = queue.then(...)`
  // alone would leave a *rejected* promise as the tail, and every later write
  // would then reject with that same stale error without ever running — one
  // corrupt record and the pets could never be fed again for the life of the
  // page. Swallowing the rejection here keeps the chain alive; the caller
  // still sees the failure, because that is what `result` is.
  queue = result.catch(() => {});
  return result;
}

/**
 * Watch for changes, including those made by other tabs.
 *
 * Two GitHub tabs open on the same PR must not disagree about whether Toby has
 * eaten, so every tab renders from storage rather than from its own memory.
 *
 * @param {(app: object) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  const handler = (changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    listener(App.fromJSON(changes[KEY].newValue, Date.now()));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
