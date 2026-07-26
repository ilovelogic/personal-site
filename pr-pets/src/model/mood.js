/**
 * mood — how a pet feels, derived rather than stored.
 *
 * The central design decision of this extension lives in this file: mood is a
 * *pure function of (pet, now)*. Nothing anywhere writes a `mood` field.
 *
 * Why it matters: a stored mood is a second copy of the truth, and the two
 * copies drift the moment anything goes wrong — a background timer that didn't
 * fire while the laptop was asleep, two GitHub tabs disagreeing, a reload in
 * the middle of a treat. Deriving it means a tab that has been closed for a
 * week and one opened a second ago render exactly the same pet, and the clock
 * can be lied to freely in tests.
 *
 * Pure module: no `chrome`, no DOM, no ambient clock.
 */

import { lastFedAt } from './petState.js';

export const MOOD = Object.freeze({
  /** Just fed. Bouncing, sparkling, telling you about it. */
  HAPPY: 'happy',
  /** Baseline. Fine. A little bored. Blinks at you. */
  BORED: 'bored',
  /** Overdue for a treat. Droopy and quietly reproachful. */
  HANGRY: 'hangry',
});

/** What we assume before a pet has enough history to speak for itself. */
export const DEFAULT_HANGER_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Bounds on the learned threshold.
 *
 * The lower bound matters: someone who opens six PRs in one burst has an
 * average gap of about ninety seconds, and without a floor their puppy would
 * be hangry again before it finished saying thank you. The upper bound keeps a
 * single long vacation from making a pet effectively unfeedable.
 */
export const MIN_HANGER_MS = 20 * 60 * 1000; // 20 minutes
export const MAX_HANGER_MS = 24 * 60 * 60 * 1000; // 1 day

/** How many recent gaps the average is taken over. Recent habits win. */
export const HANGER_WINDOW = 10;

/** Where a pet's hunger window came from. Shown in the menu. */
export const THRESHOLD_SOURCE = Object.freeze({
  /** The owner set it by hand. */
  OVERRIDE: 'override',
  /** Learned from this pet's own feeding history. */
  LEARNED: 'learned',
  /** Too little history to learn from yet. */
  DEFAULT: 'default',
});

/**
 * How long a pet takes to get hangry.
 *
 * A hand-set window always wins — if someone has told us what they want, the
 * average has nothing to add. Otherwise it is the mean gap between this pet's
 * own treats, over the last HANGER_WINDOW gaps so the pet tracks how you work
 * *now* rather than how you worked in March. With fewer than two feedings
 * there are no gaps to average, so it falls back to DEFAULT_HANGER_MS.
 *
 * @param {object} pet
 * @returns {number} milliseconds after a treat before hangriness begins
 */
export function hangerThresholdMs(pet) {
  if (pet.hangerOverrideMs !== null && pet.hangerOverrideMs !== undefined) {
    return pet.hangerOverrideMs;
  }
  return learnedThresholdMs(pet);
}

/**
 * What the pet *would* settle on if left to learn.
 *
 * Kept separate from `hangerThresholdMs` so the menu can show the learned
 * value beside the override — "Auto" is a meaningless label if you cannot see
 * what it currently resolves to.
 */
export function learnedThresholdMs(pet) {
  const feedings = pet.feedings;
  if (feedings.length < 2) return DEFAULT_HANGER_MS;

  const gaps = [];
  for (let i = Math.max(1, feedings.length - HANGER_WINDOW); i < feedings.length; i++) {
    gaps.push(feedings[i] - feedings[i - 1]);
  }
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return clamp(Math.round(mean), MIN_HANGER_MS, MAX_HANGER_MS);
}

/** Which of the three rules above produced this pet's current threshold. */
export function thresholdSource(pet) {
  if (pet.hangerOverrideMs !== null && pet.hangerOverrideMs !== undefined) {
    return THRESHOLD_SOURCE.OVERRIDE;
  }
  return pet.feedings.length < 2 ? THRESHOLD_SOURCE.DEFAULT : THRESHOLD_SOURCE.LEARNED;
}

/**
 * How the pet is doing at instant `now`.
 *
 * The timeline after a treat at time T, with threshold H:
 *
 *   T ──── happy ────► happyUntil ──── bored ────► T+H ──── hangry ────►
 *          (1–5 min, rolled at feeding time)         intensity 0 → 1 over
 *                                                    a further H, then held
 *
 * Hangriness is deliberately a continuous ramp rather than a switch, because
 * the brief is "subtle but noticeable": the view maps `intensity` onto a very
 * small droop and a slow sway, so a pet that is ten minutes overdue looks
 * *slightly* off and one that is a day overdue looks properly sad, with no
 * jarring moment of transition in between.
 *
 * @param {object} pet
 * @param {number} now  ms since epoch
 * @returns {{mood: string, intensity: number, thresholdMs: number,
 *            source: string, learnedMs: number, sinceFedMs: number,
 *            hangryAt: number, fedAt: number}}
 */
export function moodAt(pet, now) {
  const fedAt = lastFedAt(pet);
  const thresholdMs = hangerThresholdMs(pet);
  const hangryAt = fedAt + thresholdMs;
  const sinceFedMs = Math.max(0, now - fedAt);
  const common = {
    thresholdMs,
    source: thresholdSource(pet),
    learnedMs: learnedThresholdMs(pet),
    sinceFedMs,
    hangryAt,
    fedAt,
  };

  if (now < pet.happyUntil) return { mood: MOOD.HAPPY, intensity: 0, ...common };
  if (now < hangryAt) return { mood: MOOD.BORED, intensity: 0, ...common };
  return {
    mood: MOOD.HANGRY,
    intensity: clamp((now - hangryAt) / thresholdMs, 0, 1),
    ...common,
  };
}

/**
 * The next instant at which `moodAt` could return something different.
 *
 * The view uses this to schedule one precise repaint instead of polling hard.
 * While a pet is hangry the ramp is continuous, so we ask for a coarse repaint
 * — the droop moves far too slowly for anyone to catch it mid-step.
 *
 * @returns {number} ms from `now` to wait; always at least 1000
 */
export function msUntilNextChange(pet, now) {
  const { mood, hangryAt } = moodAt(pet, now);
  if (mood === MOOD.HAPPY) return Math.max(1000, pet.happyUntil - now);
  if (mood === MOOD.BORED) return Math.max(1000, hangryAt - now);
  return 60 * 1000;
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Render a duration the way a person would say it: "2h 10m", "40m", "in a
 * moment". Used for the "hungry again in ~…" line in the menu.
 */
export function formatDuration(ms) {
  if (ms <= 0) return 'now';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'a moment';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}
