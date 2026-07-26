import test from 'node:test';
import assert from 'node:assert/strict';

import * as PetState from '../src/model/petState.js';
import * as App from '../src/model/appState.js';
import {
  MOOD,
  DEFAULT_HANGER_MS,
  MIN_HANGER_MS,
  MAX_HANGER_MS,
  hangerThresholdMs,
  learnedThresholdMs,
  thresholdSource,
  THRESHOLD_SOURCE,
  moodAt,
  msUntilNextChange,
  formatDuration,
} from '../src/model/mood.js';

const T0 = Date.UTC(2026, 6, 1, 9, 0, 0);
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** A pet fed at each of the given offsets from T0. rng is fixed for determinism. */
function petFedAt(offsets, species = 'dog') {
  let pet = PetState.create({ species, name: 'Test', installedAt: T0 });
  for (const offset of offsets) pet = PetState.feed(pet, T0 + offset, () => 0);
  return pet;
}

test('a pet with no history uses the 3 hour default', () => {
  assert.equal(hangerThresholdMs(petFedAt([])), DEFAULT_HANGER_MS);
});

test('one treat is still not enough to learn from — there is no gap yet', () => {
  assert.equal(hangerThresholdMs(petFedAt([0])), DEFAULT_HANGER_MS);
});

test('a fresh install ships no history: both pets start on the 3 hour default', () => {
  // The threshold is learned per pet, per browser profile, from that profile's
  // own feedings. Nothing is bundled with the extension and nothing is shared
  // between users — a new install genuinely starts from zero.
  const app = App.createApp(T0);
  for (const petId of App.PET_IDS) {
    assert.equal(app.pets[petId].feedings.length, 0, petId);
    assert.equal(hangerThresholdMs(app.pets[petId]), DEFAULT_HANGER_MS, petId);
  }
});

test('each pet learns from its own feedings alone', () => {
  // Toby fed hourly, Jibble every six hours, in the same document.
  let app = App.createApp(T0);
  for (let i = 1; i <= 4; i++) {
    app = App.recordFeeding(app, 'toby', `t${i}`, T0 + i * HOUR, () => 0.5).app;
    app = App.recordFeeding(app, 'jibble', `j${i}`, T0 + i * 6 * HOUR, () => 0.5).app;
  }

  assert.equal(hangerThresholdMs(app.pets.toby), HOUR);
  assert.equal(hangerThresholdMs(app.pets.jibble), 6 * HOUR);
});

test('two users with different habits get different thresholds', () => {
  // The same code, two histories: someone opening a PR every half hour and
  // someone opening one every eight hours must not end up with the same pet.
  const busy = petFedAt([0, 30 * 60_000, 60 * 60_000, 90 * 60_000]);
  const steady = petFedAt([0, 8 * HOUR, 16 * HOUR, 24 * HOUR]);

  assert.equal(hangerThresholdMs(busy), 30 * MINUTE, 'above the floor, so used as-is');
  assert.equal(hangerThresholdMs(steady), 8 * HOUR);
  assert.ok(hangerThresholdMs(busy) > MIN_HANGER_MS);
  assert.notEqual(hangerThresholdMs(busy), hangerThresholdMs(steady));
});

test('the threshold becomes the average gap between treats', () => {
  // Gaps of 2h and 4h: the average is 3h.
  const pet = petFedAt([0, 2 * HOUR, 6 * HOUR]);
  assert.equal(hangerThresholdMs(pet), 3 * HOUR);
});

test('a burst of treats cannot drive the threshold below the floor', () => {
  // Six PRs opened a minute apart: the raw average is 60s.
  const pet = petFedAt([0, MINUTE, 2 * MINUTE, 3 * MINUTE, 4 * MINUTE, 5 * MINUTE]);
  assert.equal(hangerThresholdMs(pet), MIN_HANGER_MS);
});

test('a long absence cannot drive the threshold above the ceiling', () => {
  const pet = petFedAt([0, 40 * 24 * HOUR]);
  assert.equal(hangerThresholdMs(pet), MAX_HANGER_MS);
});

test('only the recent window counts, so old habits fade', () => {
  // Eleven treats: one huge gap long ago, then ten hourly ones. The window is
  // ten gaps, so the ancient gap must not be in the average.
  const offsets = [0, 30 * HOUR];
  for (let i = 1; i <= 10; i++) offsets.push(30 * HOUR + i * HOUR);
  assert.equal(hangerThresholdMs(petFedAt(offsets)), HOUR);
});

test('a hand-set window overrides the average, and survives new treats', () => {
  // Toby averages one hour, but has been told to expect a treat every 20 min.
  let pet = petFedAt([0, HOUR, 2 * HOUR, 3 * HOUR]);
  assert.equal(hangerThresholdMs(pet), HOUR);

  pet = PetState.setHangerOverride(pet, 20 * MINUTE);
  assert.equal(hangerThresholdMs(pet), 20 * MINUTE);

  // More history arrives; the hand-set value must not be quietly reverted.
  pet = PetState.feed(pet, T0 + 4 * HOUR, () => 0);
  assert.equal(hangerThresholdMs(pet), 20 * MINUTE);
  assert.equal(learnedThresholdMs(pet), HOUR, 'the average is still tracked underneath');
});

test('reverting hands the pet back to its own average', () => {
  let pet = petFedAt([0, HOUR, 2 * HOUR, 3 * HOUR]);
  pet = PetState.setHangerOverride(pet, 20 * MINUTE);
  pet = PetState.setHangerOverride(pet, null);

  assert.equal(pet.hangerOverrideMs, null);
  assert.equal(hangerThresholdMs(pet), HOUR);
});

test('an override on a pet with no history still beats the 3 hour default', () => {
  const pet = PetState.setHangerOverride(petFedAt([]), 45 * MINUTE);
  assert.equal(hangerThresholdMs(pet), 45 * MINUTE);
  assert.equal(learnedThresholdMs(pet), DEFAULT_HANGER_MS);
});

test('the menu can tell where the number came from', () => {
  assert.equal(thresholdSource(petFedAt([])), THRESHOLD_SOURCE.DEFAULT);
  assert.equal(thresholdSource(petFedAt([0, HOUR, 2 * HOUR])), THRESHOLD_SOURCE.LEARNED);
  assert.equal(
    thresholdSource(PetState.setHangerOverride(petFedAt([]), HOUR)),
    THRESHOLD_SOURCE.OVERRIDE
  );
});

test('an override outside the allowed range is clamped, not rejected', () => {
  const tiny = PetState.setHangerOverride(petFedAt([]), 1000);
  const huge = PetState.setHangerOverride(petFedAt([]), 400 * 24 * HOUR);

  assert.equal(tiny.hangerOverrideMs, PetState.MIN_HANGER_OVERRIDE_MS);
  assert.equal(huge.hangerOverrideMs, PetState.MAX_HANGER_OVERRIDE_MS);
});

test('a hand-set window is honoured below the floor the average is clamped to', () => {
  // The 20-minute floor protects against a degenerate *learned* value. An
  // explicit choice of 5 minutes is a choice, and is kept.
  const pet = PetState.setHangerOverride(petFedAt([]), 5 * MINUTE);
  assert.equal(hangerThresholdMs(pet), 5 * MINUTE);
  assert.ok(5 * MINUTE < MIN_HANGER_MS);
});

test('an override drives the mood, not just the label', () => {
  const pet = PetState.setHangerOverride(petFedAt([0]), 30 * MINUTE);
  assert.equal(moodAt(pet, T0 + 20 * MINUTE).mood, MOOD.BORED);
  assert.equal(moodAt(pet, T0 + 31 * MINUTE).mood, MOOD.HANGRY);
});

test('an override round-trips through storage', () => {
  let app = App.createApp(T0);
  app = App.setHangerOverride(app, 'toby', 90 * MINUTE);
  const restored = App.fromJSON(JSON.parse(JSON.stringify(app)), T0);

  assert.equal(restored.pets.toby.hangerOverrideMs, 90 * MINUTE);
  assert.equal(restored.pets.jibble.hangerOverrideMs, null);
});

test('a corrupt override falls back to learning rather than breaking the pet', () => {
  for (const junk of ['soon', NaN, Infinity, -5, 1e15]) {
    const pet = PetState.fromJSON(
      { species: 'dog', name: 'Toby', installedAt: T0, feedings: [], hangerOverrideMs: junk },
      { species: 'dog', name: 'Toby', installedAt: T0 }
    );
    PetState.checkRep(pet);
    assert.equal(pet.hangerOverrideMs, null, String(junk));
  }
});

test('the mood timeline runs happy, then bored, then hangry', () => {
  const pet = PetState.feed(
    PetState.create({ species: 'cat', name: 'Jibble', installedAt: T0 }),
    T0,
    () => 0 // shortest happy window: exactly one minute
  );

  assert.equal(moodAt(pet, T0 + 30 * 1000).mood, MOOD.HAPPY);
  assert.equal(moodAt(pet, T0 + 90 * 1000).mood, MOOD.BORED);
  assert.equal(moodAt(pet, T0 + 2 * HOUR).mood, MOOD.BORED);
  assert.equal(moodAt(pet, T0 + DEFAULT_HANGER_MS + 1).mood, MOOD.HANGRY);
});

test('a pet that has never been fed starts bored and gets hangry on schedule', () => {
  const pet = petFedAt([]);
  assert.equal(moodAt(pet, T0).mood, MOOD.BORED);
  assert.equal(moodAt(pet, T0 + DEFAULT_HANGER_MS + 1).mood, MOOD.HANGRY);
});

test('hangriness ramps from 0 to 1 rather than switching on', () => {
  const pet = petFedAt([]);
  const at = (ms) => moodAt(pet, T0 + ms).intensity;

  assert.equal(at(DEFAULT_HANGER_MS), 0);
  assert.ok(at(DEFAULT_HANGER_MS + HOUR) > 0);
  assert.ok(at(DEFAULT_HANGER_MS + HOUR) < 0.5);
  assert.ok(at(DEFAULT_HANGER_MS + 2 * HOUR) < 1);
  assert.equal(at(DEFAULT_HANGER_MS * 2), 1);
  assert.equal(at(DEFAULT_HANGER_MS * 10), 1, 'intensity is capped, not unbounded');
});

test('mood is a pure function of time — asking twice gives the same answer', () => {
  const pet = petFedAt([0, 2 * HOUR]);
  assert.deepEqual(moodAt(pet, T0 + 3 * HOUR), moodAt(pet, T0 + 3 * HOUR));
});

test('the next repaint is scheduled for the moment the mood actually changes', () => {
  const pet = PetState.feed(petFedAt([]), T0, () => 0); // happy for 1 minute

  assert.equal(msUntilNextChange(pet, T0 + 10 * 1000), 50 * 1000);

  const bored = msUntilNextChange(pet, T0 + 2 * MINUTE);
  assert.equal(bored, DEFAULT_HANGER_MS - 2 * MINUTE);

  assert.ok(msUntilNextChange(pet, T0 + 10 * HOUR) <= 60 * 1000);
});

test('durations read the way a person would say them', () => {
  assert.equal(formatDuration(0), 'now');
  assert.equal(formatDuration(10 * 1000), 'a moment');
  assert.equal(formatDuration(45 * 1000), '1m');
  assert.equal(formatDuration(40 * MINUTE), '40m');
  assert.equal(formatDuration(2 * HOUR), '2h');
  assert.equal(formatDuration(2 * HOUR + 10 * MINUTE), '2h 10m');
  assert.equal(formatDuration(26 * HOUR), '1 day');
  assert.equal(formatDuration(72 * HOUR), '3 days');
});
