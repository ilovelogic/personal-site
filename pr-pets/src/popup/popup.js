/**
 * popup — the on/off switch, plus a glance at how the pets are doing.
 *
 * Uses exactly the same store and the same pure transitions as the content
 * script, so switching the extension off here and a pet being fed there are
 * the same kind of operation and cannot disagree.
 */

import * as Store from '../storage/store.js';
import * as App from '../model/appState.js';
import { MOOD, moodAt, formatDuration } from '../model/mood.js';
import { petSvg } from '../view/sprites.js';

const enabledInput = document.getElementById('enabled');

enabledInput.addEventListener('change', () => {
  Store.update((app) => App.setEnabled(app, enabledInput.checked));
});

Store.subscribe(paint);
Store.read().then(paint);

function paint(app) {
  enabledInput.checked = app.enabled;

  const now = Date.now();
  document.getElementById('portraits').innerHTML = App.PET_IDS.map((id) =>
    petSvg(app.pets[id], moodAt(app.pets[id], now).mood, { size: 34, decorate: false })
  ).join('');

  document.getElementById('subtitle').textContent = app.enabled
    ? 'Watching your pull requests.'
    : 'Paused — no pets on GitHub right now.';

  document.getElementById('rules').replaceChildren(
    ...App.PET_IDS.map((id) => row(app, id, now))
  );
}

function row(app, petId, now) {
  const pet = app.pets[petId];
  const info = moodAt(pet, now);
  const treats = pet.feedings.length;
  const earns = App.PET_DEFAULTS[petId]?.earns ?? 'helping out';

  const li = document.createElement('li');

  const text = document.createElement('span');
  const name = document.createElement('b');
  name.textContent = pet.name;
  const state = document.createElement('span');
  state.className = 'state';
  state.textContent = describe(pet, info, now);
  text.append(name, ` — a treat for ${earns}`, document.createElement('br'), state);

  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = treats === 1 ? '1 treat' : `${treats} treats`;

  li.append(text, count);
  return li;
}

function describe(pet, info, now) {
  if (info.mood === MOOD.HAPPY) return 'Just fed, and very pleased about it.';
  if (info.mood === MOOD.HANGRY) return `Hangry for ${formatDuration(now - info.hangryAt)}.`;
  if (pet.feedings.length === 0) return 'Waiting for a first treat.';
  return `Hungry again in about ${formatDuration(info.hangryAt - now)}.`;
}
