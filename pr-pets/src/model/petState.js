/**
 * PetState — the persistent state of a single pet.
 *
 * This is a pure module in the sense of 6.031: it must not reference `chrome`,
 * `window`, `document`, `Date.now()`, or `Math.random()` implicitly. Time and
 * randomness are *parameters*, which is what makes every rule in this file
 * testable without a browser and without waiting three hours.
 *
 * ------------------------------------------------------------------------
 * Abstraction function
 *   AF(r) = a pet of species r.species named r.name, wearing exactly the
 *           accessories in r.accessories, that has been given a treat at
 *           precisely the instants listed in r.feedings, has been cared for
 *           since r.installedAt, and is visibly delighted until r.happyUntil.
 *
 * Representation invariant
 *   - r.species is a member of SPECIES
 *   - r.name is a trimmed, non-empty string of at most MAX_NAME_LENGTH chars
 *   - r.accessories is an array of distinct ids drawn from ACCESSORY_IDS
 *   - r.installedAt is a positive finite integer (ms since epoch)
 *   - r.feedings is strictly increasing, every element finite and >= installedAt
 *   - r.feedings.length <= MAX_FEEDINGS_KEPT
 *   - r.happyUntil is a non-negative finite integer
 *   - r.hangerOverrideMs is either null or an integer within
 *     [MIN_HANGER_OVERRIDE_MS, MAX_HANGER_OVERRIDE_MS]
 *
 * Safety from rep exposure
 *   Every value produced here is deep-frozen, and every producer copies the
 *   arrays it is handed. A caller therefore cannot reach in and corrupt a pet,
 *   which is the whole reason the mood logic elsewhere can be trusted.
 * ------------------------------------------------------------------------
 */

export const SPECIES = Object.freeze({ DOG: 'dog', CAT: 'cat' });

export const MAX_NAME_LENGTH = 24;
export const MAX_FEEDINGS_KEPT = 4000;

/**
 * Wardrobe, drawn from the standard-issue CS-student uniform.
 *
 * An id that disappears from this list is dropped from any pet already wearing
 * it — see `setAccessories` and `fromJSON` — so retiring a garment needs no
 * migration. `sweatpants` was retired that way: on a round, front-facing,
 * sitting pet there is nothing for trousers to sit on, and every version of
 * them read as a grey slab across the belly.
 */
export const ACCESSORY_IDS = Object.freeze([
  'beanie',
  'hoodie',
  'usbhub',
  'glasses',
  'headphones',
  'lanyard',
  'backpack',
]);

export const ACCESSORY_LABELS = Object.freeze({
  beanie: 'Beanie',
  hoodie: 'Hackathon hoodie',
  usbhub: 'USB-C hub',
  glasses: 'Blue-light glasses',
  headphones: 'Headphones',
  lanyard: 'Conference lanyard',
  backpack: 'Backpack',
});

/** How long a pet stays visibly delighted after a treat. */
export const MIN_HAPPY_MS = 60 * 1000; //  1 minute
export const MAX_HAPPY_MS = 5 * 60 * 1000; //  5 minutes

/**
 * Bounds on a *hand-set* hunger window.
 *
 * These are deliberately wider than the bounds mood.js puts on the learned
 * average. The learned clamp exists to stop a degenerate history producing an
 * absurd pet; someone who deliberately types "10 minutes" into the menu has
 * said what they want, and the job here is to honour it rather than to
 * second-guess it. The bounds that remain only keep the rep sane.
 */
export const MIN_HANGER_OVERRIDE_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_HANGER_OVERRIDE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Deep-freeze a pet record. Called by every producer, so the type is
 * immutable in fact and not merely by convention.
 */
function freezePet(pet) {
  Object.freeze(pet.accessories);
  Object.freeze(pet.feedings);
  return Object.freeze(pet);
}

/**
 * Assert the rep invariant. Cheap enough to run on every load and every
 * transition; a corrupt pet in chrome.storage (a half-written record, a
 * downgrade, a hand-edited value) fails loudly here instead of silently
 * producing a pet that is hangry forever.
 *
 * @throws {Error} if the invariant is broken
 */
export function checkRep(pet) {
  const bad = (why) => {
    throw new Error(`PetState rep invariant violated: ${why}`);
  };

  if (!pet || typeof pet !== 'object') bad('not an object');
  if (pet.species !== SPECIES.DOG && pet.species !== SPECIES.CAT) {
    bad(`unknown species ${JSON.stringify(pet.species)}`);
  }
  if (typeof pet.name !== 'string' || pet.name.length === 0) bad('empty name');
  if (pet.name.length > MAX_NAME_LENGTH) bad('name too long');
  if (pet.name !== pet.name.trim()) bad('name is not trimmed');

  if (!Array.isArray(pet.accessories)) bad('accessories is not an array');
  const seen = new Set();
  for (const id of pet.accessories) {
    if (!ACCESSORY_IDS.includes(id)) bad(`unknown accessory ${JSON.stringify(id)}`);
    if (seen.has(id)) bad(`duplicate accessory ${id}`);
    seen.add(id);
  }

  if (!Number.isInteger(pet.installedAt) || pet.installedAt <= 0) {
    bad('installedAt is not a positive integer');
  }
  if (!Array.isArray(pet.feedings)) bad('feedings is not an array');
  if (pet.feedings.length > MAX_FEEDINGS_KEPT) bad('feedings overflowed the cap');
  let previous = -Infinity;
  for (const t of pet.feedings) {
    if (!Number.isInteger(t) || !Number.isFinite(t)) bad('non-integer feeding time');
    if (t <= previous) bad('feedings are not strictly increasing');
    if (t < pet.installedAt) bad('a feeding predates installation');
    previous = t;
  }

  if (!Number.isInteger(pet.happyUntil) || pet.happyUntil < 0) {
    bad('happyUntil is not a non-negative integer');
  }

  if (pet.hangerOverrideMs !== null) {
    if (!Number.isInteger(pet.hangerOverrideMs)) bad('hangerOverrideMs is not null or an integer');
    if (
      pet.hangerOverrideMs < MIN_HANGER_OVERRIDE_MS ||
      pet.hangerOverrideMs > MAX_HANGER_OVERRIDE_MS
    ) {
      bad('hangerOverrideMs is out of range');
    }
  }
  return pet;
}

/**
 * Make a brand-new, never-fed pet.
 *
 * @param {{species: string, name: string, installedAt: number}} spec
 * @returns {object} an immutable PetState
 */
export function create({ species, name, installedAt }) {
  return freezePet(
    checkRep({
      species,
      name: normalizeName(name),
      accessories: [],
      installedAt,
      feedings: [],
      happyUntil: 0,
      hangerOverrideMs: null,
    })
  );
}

/**
 * Pin the hunger window by hand, or hand it back to the learned average.
 *
 * @param {object} pet
 * @param {number|null} ms  null returns the pet to learning from its own
 *                          history; a number is clamped into range rather than
 *                          rejected, so a stale preset from another version
 *                          degrades to the nearest legal value
 */
export function setHangerOverride(pet, ms) {
  checkRep(pet);
  const hangerOverrideMs =
    ms === null || ms === undefined
      ? null
      : Math.min(
          MAX_HANGER_OVERRIDE_MS,
          Math.max(MIN_HANGER_OVERRIDE_MS, Math.round(ms))
        );
  if (hangerOverrideMs === pet.hangerOverrideMs) return pet;
  return freezePet(checkRep({ ...pet, hangerOverrideMs }));
}

/**
 * Give the pet a treat.
 *
 * The pet becomes visibly delighted for a random span in
 * [MIN_HAPPY_MS, MAX_HAPPY_MS]. That span is *stored* rather than recomputed,
 * so re-rendering, switching tabs, or a page navigation cannot re-roll the
 * dice and leave the pet bouncing forever.
 *
 * Feeding twice within the same millisecond is impossible in the rep, so a
 * repeat timestamp is nudged forward rather than rejected — the caller is
 * responsible for real duplicate suppression (see events.js), and this only
 * protects the invariant.
 *
 * @param {object} pet    the pet before the treat
 * @param {number} atMs   when the treat was given
 * @param {() => number} rng  source of randomness in [0, 1)
 * @returns {object} a new immutable PetState; `pet` is unchanged
 */
export function feed(pet, atMs, rng = Math.random) {
  checkRep(pet);
  const last = pet.feedings[pet.feedings.length - 1] ?? -Infinity;
  const at = Math.max(Math.round(atMs), last + 1, pet.installedAt);

  const feedings = pet.feedings.concat(at);
  const trimmed =
    feedings.length > MAX_FEEDINGS_KEPT
      ? feedings.slice(feedings.length - MAX_FEEDINGS_KEPT)
      : feedings;

  const happySpan = Math.round(MIN_HAPPY_MS + rng() * (MAX_HAPPY_MS - MIN_HAPPY_MS));
  return freezePet(
    checkRep({ ...pet, feedings: trimmed, happyUntil: at + happySpan })
  );
}

/**
 * Rename the pet. A blank or whitespace-only name is rejected by returning the
 * pet unchanged, because "the text field was momentarily empty" should never
 * be able to destroy a name.
 */
export function rename(pet, newName) {
  checkRep(pet);
  const name = normalizeName(newName, pet.name);
  if (name === pet.name) return pet;
  return freezePet(checkRep({ ...pet, name }));
}

/**
 * Replace the wardrobe. Unknown ids are dropped rather than thrown, so a
 * wardrobe saved by a future version degrades gracefully in an older one.
 */
export function setAccessories(pet, ids) {
  checkRep(pet);
  const accessories = ACCESSORY_IDS.filter((id) => ids.includes(id));
  return freezePet(checkRep({ ...pet, accessories }));
}

/** Add or remove one accessory. */
export function toggleAccessory(pet, id) {
  const worn = pet.accessories.includes(id);
  return setAccessories(
    pet,
    worn ? pet.accessories.filter((a) => a !== id) : pet.accessories.concat(id)
  );
}

/** When the pet last ate — or when it moved in, if it never has. */
export function lastFedAt(pet) {
  return pet.feedings.length > 0 ? pet.feedings[pet.feedings.length - 1] : pet.installedAt;
}

/** Coerce user input into a legal name, falling back if nothing is left. */
export function normalizeName(raw, fallback = 'Pet') {
  const trimmed = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Rebuild a pet from whatever was in storage, repairing what can be repaired.
 *
 * Parsing is where untrusted data becomes a valid value of the type; doing it
 * in one place means nothing downstream has to ask "but what if feedings is
 * null?".
 */
export function fromJSON(raw, defaults) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const installedAt =
    Number.isInteger(source.installedAt) && source.installedAt > 0
      ? source.installedAt
      : defaults.installedAt;

  const feedings = Array.isArray(source.feedings)
    ? Array.from(new Set(source.feedings.filter((t) => Number.isInteger(t) && t >= installedAt)))
        .sort((a, b) => a - b)
        .slice(-MAX_FEEDINGS_KEPT)
    : [];

  return freezePet(
    checkRep({
      species: source.species === SPECIES.CAT || source.species === SPECIES.DOG
        ? source.species
        : defaults.species,
      name: normalizeName(source.name, defaults.name),
      accessories: ACCESSORY_IDS.filter((id) =>
        Array.isArray(source.accessories) ? source.accessories.includes(id) : false
      ),
      installedAt,
      feedings,
      happyUntil:
        Number.isInteger(source.happyUntil) && source.happyUntil >= 0 ? source.happyUntil : 0,
      hangerOverrideMs: readOverride(source.hangerOverrideMs),
    })
  );
}

/** An unreadable or out-of-range override falls back to "learn it". */
function readOverride(raw) {
  if (!Number.isFinite(raw)) return null;
  const ms = Math.round(raw);
  if (ms < MIN_HANGER_OVERRIDE_MS || ms > MAX_HANGER_OVERRIDE_MS) return null;
  return ms;
}
