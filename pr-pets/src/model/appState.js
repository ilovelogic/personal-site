/**
 * appState — the whole persisted document, as one immutable value.
 *
 * PetState knows about one pet; this knows about the household: which pets
 * exist, whether the extension is switched on, what each pet is currently
 * saying, and — importantly — which feeding events have already been counted.
 *
 * Pure module. Every operation is (document, inputs) → new document, which is
 * what lets storage.js be a dumb read/write adapter with no rules in it.
 */

import * as PetState from './petState.js';
import { thankYou } from './phrases.js';

export const SCHEMA_VERSION = 1;

/** Stable internal keys. The *display* name is user-editable; these are not. */
export const PET_IDS = Object.freeze(['toby', 'jibble']);

export const PET_DEFAULTS = Object.freeze({
  toby: Object.freeze({
    species: PetState.SPECIES.DOG,
    name: 'Toby',
    /** What earns this pet a treat, in words, for the menu. */
    earns: 'opening a pull request',
  }),
  jibble: Object.freeze({
    species: PetState.SPECIES.CAT,
    name: 'Jibble',
    earns: 'submitting a review',
  }),
});

/**
 * How many past event ids to remember for duplicate suppression.
 *
 * This is the mechanism that makes feeding idempotent: reloading a PR page,
 * opening it in a second tab, or bouncing through the Files/Commits tabs all
 * produce the *same* event id, and only the first one feeds the pet. 300 is
 * far more than a session's worth of PRs and costs a few KB.
 */
export const MAX_HANDLED_EVENTS = 300;

/** A fresh install. */
export function createApp(installedAt) {
  return freeze({
    schemaVersion: SCHEMA_VERSION,
    enabled: true,
    installedAt,
    pets: Object.fromEntries(
      PET_IDS.map((id) => [
        id,
        PetState.create({
          species: PET_DEFAULTS[id].species,
          name: PET_DEFAULTS[id].name,
          installedAt,
        }),
      ])
    ),
    speech: Object.fromEntries(PET_IDS.map((id) => [id, null])),
    handledEvents: [],
  });
}

/**
 * Rebuild the document from whatever chrome.storage returned.
 *
 * Anything unreadable is replaced rather than thrown on: a corrupt record
 * should cost you a pet's history, not leave every GitHub page with a broken
 * extension on it.
 */
export function fromJSON(raw, now) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const installedAt =
    Number.isInteger(source.installedAt) && source.installedAt > 0 ? source.installedAt : now;

  return freeze({
    schemaVersion: SCHEMA_VERSION,
    enabled: source.enabled !== false,
    installedAt,
    pets: Object.fromEntries(
      PET_IDS.map((id) => [
        id,
        PetState.fromJSON(source.pets?.[id], {
          species: PET_DEFAULTS[id].species,
          name: PET_DEFAULTS[id].name,
          installedAt,
        }),
      ])
    ),
    speech: Object.fromEntries(
      PET_IDS.map((id) => [id, readSpeech(source.speech?.[id])])
    ),
    handledEvents: Array.isArray(source.handledEvents)
      ? source.handledEvents.filter((e) => typeof e === 'string').slice(-MAX_HANDLED_EVENTS)
      : [],
  });
}

function readSpeech(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.text !== 'string' || typeof raw.bufo !== 'string') return null;
  return Object.freeze({ text: raw.text, bufo: raw.bufo });
}

/**
 * Give a pet a treat for a specific event, at most once per event.
 *
 * @param {object} app
 * @param {string} petId
 * @param {string} eventId  a stable id for the thing that happened, e.g.
 *                          "opened:acme/web#412" — the *same* string must be
 *                          produced by every code path that notices that event
 * @param {number} now
 * @param {() => number} rng
 * @returns {{app: object, fed: boolean}} `fed` is false when the event was
 *          already counted, so the caller knows not to animate anything
 */
export function recordFeeding(app, petId, eventId, now, rng = Math.random) {
  if (app.handledEvents.includes(eventId)) return { app, fed: false };

  const pet = app.pets[petId];
  const line = thankYou(pet.species, app.speech[petId]?.text ?? null, rng);
  const handled = app.handledEvents.concat(eventId).slice(-MAX_HANDLED_EVENTS);

  return {
    app: freeze({
      ...app,
      pets: { ...app.pets, [petId]: PetState.feed(pet, now, rng) },
      speech: { ...app.speech, [petId]: Object.freeze({ text: line.text, bufo: line.bufo }) },
      handledEvents: handled,
    }),
    fed: true,
  };
}

export function renamePet(app, petId, name) {
  return freeze({
    ...app,
    pets: { ...app.pets, [petId]: PetState.rename(app.pets[petId], name) },
  });
}

/**
 * Pin a pet's hunger window by hand, or (with null) hand it back to the
 * learned average.
 */
export function setHangerOverride(app, petId, ms) {
  const pet = PetState.setHangerOverride(app.pets[petId], ms);
  if (pet === app.pets[petId]) return app;
  return freeze({ ...app, pets: { ...app.pets, [petId]: pet } });
}

export function toggleAccessory(app, petId, accessoryId) {
  return freeze({
    ...app,
    pets: { ...app.pets, [petId]: PetState.toggleAccessory(app.pets[petId], accessoryId) },
  });
}

export function setEnabled(app, enabled) {
  return freeze({ ...app, enabled: Boolean(enabled) });
}

/** Shallow-freeze the document; the pets inside are already deep-frozen. */
function freeze(app) {
  Object.freeze(app.pets);
  Object.freeze(app.speech);
  Object.freeze(app.handledEvents);
  return Object.freeze(app);
}
