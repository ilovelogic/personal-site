import test from 'node:test';
import assert from 'node:assert/strict';

import * as App from '../src/model/appState.js';
import { allLines } from '../src/model/phrases.js';

const T0 = Date.UTC(2026, 6, 1, 9, 0, 0);
const rng = () => 0.5;

test('a fresh install has Toby the dog and Jibble the cat, both unfed', () => {
  const app = App.createApp(T0);
  assert.deepEqual([...App.PET_IDS], ['toby', 'jibble']);
  assert.equal(app.pets.toby.species, 'dog');
  assert.equal(app.pets.jibble.species, 'cat');
  assert.equal(app.pets.toby.name, 'Toby');
  assert.equal(app.pets.jibble.name, 'Jibble');
  assert.ok(app.enabled);
  assert.equal(app.pets.toby.feedings.length, 0);
});

test('an event feeds a pet exactly once, however many times it is reported', () => {
  const app = App.createApp(T0);
  const first = App.recordFeeding(app, 'toby', 'opened:acme/web#1', T0 + 100, rng);
  assert.ok(first.fed);

  const again = App.recordFeeding(first.app, 'toby', 'opened:acme/web#1', T0 + 5000, rng);
  assert.equal(again.fed, false);
  assert.equal(again.app, first.app, 'a duplicate must not produce a new document');
  assert.equal(again.app.pets.toby.feedings.length, 1);
});

test('distinct events each earn their own treat', () => {
  let app = App.createApp(T0);
  app = App.recordFeeding(app, 'toby', 'opened:acme/web#1', T0 + 100, rng).app;
  app = App.recordFeeding(app, 'toby', 'opened:acme/web#2', T0 + 200, rng).app;
  assert.equal(app.pets.toby.feedings.length, 2);
});

test('feeding one pet leaves the other alone', () => {
  const app = App.recordFeeding(App.createApp(T0), 'jibble', 'review:acme/web#1:0', T0, rng).app;
  assert.equal(app.pets.jibble.feedings.length, 1);
  assert.equal(app.pets.toby.feedings.length, 0);
});

test('a fed pet says something in character, with a matching bufo', () => {
  const app = App.recordFeeding(App.createApp(T0), 'jibble', 'e1', T0, rng).app;
  const speech = app.speech.jibble;

  const catLines = allLines('cat').map((l) => l.text);
  assert.ok(catLines.includes(speech.text), 'the kitten says kitten things');
  const matching = allLines('cat').find((l) => l.text === speech.text);
  assert.equal(speech.bufo, matching.bufo, 'the bufo is the one paired with the line');
});

test('a pet does not repeat itself twice running', () => {
  let app = App.createApp(T0);
  // An rng that always picks the first option would repeat without the guard.
  app = App.recordFeeding(app, 'toby', 'e1', T0, () => 0).app;
  const first = app.speech.toby.text;
  app = App.recordFeeding(app, 'toby', 'e2', T0 + 1000, () => 0).app;
  assert.notEqual(app.speech.toby.text, first);
});

test('the handled-event list stays bounded', () => {
  let app = App.createApp(T0);
  for (let i = 0; i < App.MAX_HANDLED_EVENTS + 50; i++) {
    app = App.recordFeeding(app, 'toby', `event-${i}`, T0 + i * 1000, rng).app;
  }
  assert.equal(app.handledEvents.length, App.MAX_HANDLED_EVENTS);
  assert.ok(app.handledEvents.includes(`event-${App.MAX_HANDLED_EVENTS + 49}`));
});

test('renaming and dressing are independent of each other', () => {
  let app = App.createApp(T0);
  app = App.renamePet(app, 'toby', 'Tobias');
  app = App.toggleAccessory(app, 'toby', 'beanie');

  assert.equal(app.pets.toby.name, 'Tobias');
  assert.deepEqual(app.pets.toby.accessories, ['beanie']);
  assert.equal(app.pets.jibble.name, 'Jibble');
});

test('the document survives a round trip through storage', () => {
  let app = App.createApp(T0);
  app = App.recordFeeding(app, 'toby', 'e1', T0 + 500, rng).app;
  app = App.renamePet(app, 'jibble', 'Jib');
  app = App.toggleAccessory(app, 'jibble', 'lanyard');

  const restored = App.fromJSON(JSON.parse(JSON.stringify(app)), T0 + 10_000);

  assert.equal(restored.pets.jibble.name, 'Jib');
  assert.deepEqual(restored.pets.jibble.accessories, ['lanyard']);
  assert.deepEqual(restored.pets.toby.feedings, app.pets.toby.feedings);
  assert.deepEqual(restored.handledEvents, ['e1']);
  assert.equal(restored.speech.toby.text, app.speech.toby.text);
});

test('a corrupt document is repaired instead of crashing the extension', () => {
  const app = App.fromJSON({ pets: { toby: 'not a pet' }, handledEvents: 'nope' }, T0);
  assert.equal(app.pets.toby.name, 'Toby');
  assert.deepEqual(app.handledEvents, []);
  assert.equal(app.enabled, true);
});

test('being switched off is remembered; everything else is a separate concern', () => {
  const off = App.setEnabled(App.createApp(T0), false);
  assert.equal(off.enabled, false);
  assert.equal(App.fromJSON(JSON.parse(JSON.stringify(off)), T0).enabled, false);
});
