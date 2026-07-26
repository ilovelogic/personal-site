import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * store.js is the one module that talks to chrome.storage, so it is the one
 * module that needs a fake chrome to be testable at all. The fake is a plain
 * object: the point of keeping the adapter this thin is that there is nothing
 * else to mock.
 *
 * These cover the write queue, which is the only real logic in the file and is
 * invisible until two writes overlap or one of them fails.
 */

const bag = {};
let setCalls = 0;
let failNextSet = false;

globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        return key in bag ? { [key]: bag[key] } : {};
      },
      async set(entry) {
        setCalls += 1;
        if (failNextSet) {
          failNextSet = false;
          throw new Error('storage is full');
        }
        Object.assign(bag, entry);
      },
    },
    onChanged: { addListener() {}, removeListener() {} },
  },
};

const Store = await import('../src/storage/store.js');
const App = await import('../src/model/appState.js');

test('a fresh read creates and persists a starting document', async () => {
  const app = await Store.read();
  assert.equal(app.enabled, true);
  assert.deepEqual(Object.keys(app.pets).sort(), ['jibble', 'toby']);
  assert.equal(app.pets.toby.feedings.length, 0, 'nothing is bundled with the install');
});

test('a transition that throws does not wedge every later write', async () => {
  await Store.read();

  await assert.rejects(
    Store.update(() => {
      throw new Error('a bad transition');
    }),
    /a bad transition/,
    'the caller is told about its own failure'
  );

  // The bug this pins: `queue = queue.then(...)` left a *rejected* promise as
  // the tail of the chain, so every later update rejected with the stale error
  // without running. The pets could never be fed again for the life of the tab.
  const after = await Store.update((app) => App.renamePet(app, 'toby', 'Rex'));
  assert.equal(after.pets.toby.name, 'Rex');
});

test('a failed write is reported, and the next one still lands', async () => {
  await Store.update((app) => App.renamePet(app, 'toby', 'Toby'));

  failNextSet = true;
  await assert.rejects(
    Store.update((app) => App.renamePet(app, 'toby', 'Nope')),
    /storage is full/
  );

  const after = await Store.update((app) => App.renamePet(app, 'toby', 'Biscuit'));
  assert.equal(after.pets.toby.name, 'Biscuit');
});

test('overlapping feedings are serialised rather than interleaved', async () => {
  await Store.update((app) => App.setEnabled(app, true));
  const start = (await Store.read()).pets.toby.feedings.length;

  // Fired together, without awaiting in between — the case the queue exists
  // for. Without it, two read-modify-write pairs interleave and one treat is
  // silently lost.
  const now = Date.now();
  const writes = [1, 2, 3, 4, 5].map((n) =>
    Store.update((app) => App.recordFeeding(app, 'toby', `opened:acme/web#${n}`, now + n).app)
  );
  await Promise.all(writes);

  const end = (await Store.read()).pets.toby.feedings.length;
  assert.equal(end - start, 5, 'every distinct event landed');
});

test('a transition that returns the document unchanged writes nothing', async () => {
  const before = setCalls;
  await Store.update((app) => app);
  assert.equal(setCalls, before, 'no write was issued');
});
