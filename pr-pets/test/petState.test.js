import test from 'node:test';
import assert from 'node:assert/strict';

import * as PetState from '../src/model/petState.js';

const T0 = Date.UTC(2026, 6, 1, 9, 0, 0);
const dog = () => PetState.create({ species: 'dog', name: 'Toby', installedAt: T0 });

test('a new pet satisfies the rep invariant and has never eaten', () => {
  const pet = dog();
  PetState.checkRep(pet);
  assert.equal(pet.feedings.length, 0);
  assert.equal(PetState.lastFedAt(pet), T0);
});

test('checkRep rejects each way the rep can be broken', () => {
  const pet = dog();
  const broken = [
    { ...pet, species: 'ferret' },
    { ...pet, name: '' },
    { ...pet, name: '  padded  ' },
    { ...pet, accessories: ['sombrero'] },
    { ...pet, accessories: ['beanie', 'beanie'] },
    { ...pet, installedAt: 0 },
    { ...pet, feedings: [T0 + 200, T0 + 100] }, // out of order
    { ...pet, feedings: [T0 + 100, T0 + 100] }, // not strictly increasing
    { ...pet, feedings: [T0 - 1] }, // predates installation
    { ...pet, happyUntil: -1 },
  ];
  for (const bad of broken) {
    assert.throws(() => PetState.checkRep(bad), /rep invariant/);
  }
});

test('feeding is a producer: the original pet is untouched', () => {
  const before = dog();
  const after = PetState.feed(before, T0 + 1000, () => 0.5);

  assert.equal(before.feedings.length, 0);
  assert.equal(after.feedings.length, 1);
  assert.notEqual(before, after);
  assert.ok(Object.isFrozen(after));
  assert.ok(Object.isFrozen(after.feedings));
});

test('the happy window lands between 1 and 5 minutes, driven by the rng', () => {
  const shortest = PetState.feed(dog(), T0, () => 0);
  const longest = PetState.feed(dog(), T0, () => 0.999999);

  assert.equal(shortest.happyUntil - T0, PetState.MIN_HAPPY_MS);
  assert.ok(longest.happyUntil - T0 <= PetState.MAX_HAPPY_MS);
  assert.ok(longest.happyUntil - T0 > PetState.MIN_HAPPY_MS);
});

test('two treats in the same millisecond still leave feedings increasing', () => {
  let pet = PetState.feed(dog(), T0 + 500, () => 0.5);
  pet = PetState.feed(pet, T0 + 500, () => 0.5);

  PetState.checkRep(pet);
  assert.equal(pet.feedings.length, 2);
  assert.ok(pet.feedings[1] > pet.feedings[0]);
});

test('a blank rename is refused rather than destroying the name', () => {
  const pet = dog();
  assert.equal(PetState.rename(pet, '   ').name, 'Toby');
  assert.equal(PetState.rename(pet, '').name, 'Toby');
  assert.equal(PetState.rename(pet, '  Sir  Barks  ').name, 'Sir Barks');
});

test('a long name is truncated to the cap rather than rejected', () => {
  const pet = PetState.rename(dog(), 'x'.repeat(200));
  assert.equal(pet.name.length, PetState.MAX_NAME_LENGTH);
});

test('accessories are a set: order in, canonical order out, no duplicates', () => {
  const a = PetState.setAccessories(dog(), ['hoodie', 'beanie']);
  const b = PetState.setAccessories(dog(), ['beanie', 'hoodie', 'beanie']);
  assert.deepEqual(a.accessories, b.accessories);
});

test('toggling an accessory twice returns to where it started', () => {
  const start = dog();
  const there = PetState.toggleAccessory(start, 'lanyard');
  const back = PetState.toggleAccessory(there, 'lanyard');

  assert.deepEqual(there.accessories, ['lanyard']);
  assert.deepEqual(back.accessories, []);
});

test('unknown accessories are dropped, so a downgrade degrades gracefully', () => {
  const pet = PetState.setAccessories(dog(), ['beanie', 'jetpack']);
  assert.deepEqual(pet.accessories, ['beanie']);
});

test('a retired accessory is dropped from a pet already wearing it', () => {
  // This is what lets a garment be removed from the wardrobe with no
  // migration: `sweatpants` was retired, and a pet that had them on simply
  // stops wearing them, keeping everything else. If this ever stops holding,
  // retiring an id would leave checkRep throwing on a real user's stored pet.
  const stored = {
    species: 'dog',
    name: 'Toby',
    accessories: ['beanie', 'sweatpants', 'lanyard'],
    installedAt: T0,
    feedings: [T0 + 1000],
    happyUntil: 0,
    hangerOverrideMs: null,
  };

  const pet = PetState.fromJSON(stored, {
    species: 'dog',
    name: 'Toby',
    installedAt: T0,
  });

  assert.deepEqual(pet.accessories, ['beanie', 'lanyard']);
  assert.deepEqual(pet.feedings, [T0 + 1000], 'the rest of the pet is untouched');
});

test('fromJSON repairs storage that has gone wrong', () => {
  const repaired = PetState.fromJSON(
    {
      species: 'dog',
      name: '   ',
      accessories: ['beanie', 'nonsense'],
      installedAt: T0,
      feedings: [T0 + 300, T0 + 100, T0 + 300, T0 - 5, 'nope', null],
      happyUntil: -4,
    },
    { species: 'dog', name: 'Toby', installedAt: T0 }
  );

  PetState.checkRep(repaired);
  assert.equal(repaired.name, 'Toby');
  assert.deepEqual(repaired.accessories, ['beanie']);
  assert.deepEqual(repaired.feedings, [T0 + 100, T0 + 300]);
  assert.equal(repaired.happyUntil, 0);
});

test('fromJSON on complete rubbish still produces a usable pet', () => {
  for (const rubbish of [null, undefined, 42, 'cat', []]) {
    const pet = PetState.fromJSON(rubbish, {
      species: 'cat',
      name: 'Jibble',
      installedAt: T0,
    });
    PetState.checkRep(pet);
    assert.equal(pet.name, 'Jibble');
  }
});
