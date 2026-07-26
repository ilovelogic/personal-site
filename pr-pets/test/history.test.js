import test from 'node:test';
import assert from 'node:assert/strict';

import * as PetState from '../src/model/petState.js';
import { dailyCounts, dayKey } from '../src/model/history.js';

/**
 * Timestamps are built from a *local* Date so these tests mean the same thing
 * wherever they run — the bucketing under test is local-day bucketing, so
 * hard-coded UTC instants would pass or fail depending on the machine.
 */
function localTime(year, month, day, hour = 12) {
  return new Date(year, month, day, hour, 0, 0, 0).getTime();
}

const INSTALL = localTime(2026, 6, 1, 9);

function petFedOn(days) {
  let pet = PetState.create({ species: 'dog', name: 'Toby', installedAt: INSTALL });
  for (const [day, hour] of days) pet = PetState.feed(pet, localTime(2026, 6, day, hour), () => 0);
  return pet;
}

test('quiet days are present as zeroes, not dropped', () => {
  const pet = petFedOn([[1, 10], [4, 10]]);
  const { days } = dailyCounts(pet, localTime(2026, 6, 5));

  assert.equal(days.length, 5, 'Jul 1 through Jul 5 inclusive');
  assert.deepEqual(days.map((d) => d.count), [1, 0, 0, 1, 0]);
});

test('several treats on one day land in one bucket', () => {
  const pet = petFedOn([[2, 9], [2, 13], [2, 21]]);
  const { days, max, total } = dailyCounts(pet, localTime(2026, 6, 2));

  assert.equal(days.at(-1).count, 3);
  assert.equal(max, 3);
  assert.equal(total, 3);
});

test('a late-evening treat belongs to the day the person lived, not to UTC', () => {
  const lateLocal = localTime(2026, 6, 3, 23);
  assert.equal(dayKey(lateLocal), '2026-07-03');
});

test('the chart window trims to the most recent days and says how much it hid', () => {
  const pet = petFedOn([[1, 10], [2, 10], [20, 10]]);
  const data = dailyCounts(pet, localTime(2026, 6, 20), { maxDays: 5 });

  assert.equal(data.days.length, 5);
  assert.equal(data.total, 3, 'the total is every treat, not just the visible ones');
  assert.equal(data.omittedTreats, 2);
  assert.ok(data.omittedDays > 0);
});

test('an unfed pet still has a row for every day it has been here', () => {
  const pet = PetState.create({ species: 'cat', name: 'Jibble', installedAt: INSTALL });
  const { days, total, max } = dailyCounts(pet, localTime(2026, 6, 3));

  assert.equal(days.length, 3);
  assert.equal(total, 0);
  assert.equal(max, 0);
  assert.ok(days.every((d) => d.count === 0));
});

test('installed today gives exactly one day, not zero and not two', () => {
  const pet = PetState.create({ species: 'dog', name: 'Toby', installedAt: INSTALL });
  const { days } = dailyCounts(pet, INSTALL + 60_000);
  assert.equal(days.length, 1);
});

test('a long-lived install materialises the window, not its whole history', () => {
  // The chart shows thirty columns however old the install is. Building a row
  // for every day since installation and then discarding all but the last
  // thirty cost ~35ms per call after a year — paid on every repaint of the
  // menu, on a page the user is trying to work on.
  const DAY = 86400000;
  const installedAt = INSTALL - 400 * DAY;
  let pet = PetState.create({ species: 'dog', name: 'Toby', installedAt });
  for (let i = 0; i < 300; i++) {
    pet = PetState.feed(pet, installedAt + i * DAY + 3600000, () => 0);
  }

  const data = dailyCounts(pet, INSTALL, { maxDays: 30 });

  assert.equal(data.days.length, 30);
  assert.equal(data.total, 300, 'the total still counts every treat ever');
  assert.equal(
    data.omittedTreats + data.days.reduce((sum, d) => sum + d.count, 0),
    300,
    'every treat is either shown or declared as omitted'
  );
  // 401 days from installation to today inclusive, of which 30 are drawn.
  assert.equal(data.omittedDays, 371);
});

test('a treat dated in the future does not grow a column past today', () => {
  // Clocks get wound back. A stray future key used to be added to the map,
  // putting a column to the right of today's and stretching the axis.
  const pet = petFedOn([[3, 10], [9, 10]]);
  const { days, total } = dailyCounts(pet, localTime(2026, 6, 5));

  assert.equal(days.at(-1).key, '2026-07-05', 'the axis still ends today');
  assert.equal(total, 2, 'but the treat is not lost from the count');
});

test('days come back in chronological order', () => {
  const pet = petFedOn([[1, 10], [3, 10], [2, 10]]);
  const { days } = dailyCounts(pet, localTime(2026, 6, 6));
  const keys = days.map((d) => d.key);
  assert.deepEqual(keys, [...keys].sort());
});
