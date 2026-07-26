/**
 * phrases — what a pet says when it is handed a treat.
 *
 * Each line carries the bufo that belongs with it, so the frog is *picked to
 * match the sentiment* rather than drawn from the hat independently: a line
 * about being starving gets the one mid-chew, a soppy line gets the one with
 * heart eyes. Pairing them at the data level is what keeps that promise —
 * there is no way to write a new line and forget to think about its frog.
 *
 * Pure module.
 */

import { SPECIES } from './petState.js';

/** The bufo cast, drawn in view/bufo.js. */
export const BUFO = Object.freeze({
  LOVE: 'love', // heart eyes
  THANKS: 'thanks', // holding a little heart
  HAPPY: 'happy', // plain delighted grin
  YUM: 'yum', // mid-snack, tongue out
  MELT: 'melt', // overcome, blushing
});

const DOG_LINES = Object.freeze([
  { text: 'thank you, my human', bufo: BUFO.THANKS },
  { text: 'thanks, me was hungry', bufo: BUFO.YUM },
  { text: 'my human is so good to me', bufo: BUFO.MELT },
  { text: 'me happy now', bufo: BUFO.HAPPY },
  { text: 'best human!! best treat!!', bufo: BUFO.LOVE },
  { text: 'tail going very fast', bufo: BUFO.HAPPY },
  { text: 'me knew you would come back', bufo: BUFO.MELT },
  { text: 'om nom. me love you.', bufo: BUFO.YUM },
  { text: 'good ship it. good treat.', bufo: BUFO.HAPPY },
  { text: 'me was being SO patient', bufo: BUFO.THANKS },
]);

const CAT_LINES = Object.freeze([
  { text: 'mrrp. acceptable.', bufo: BUFO.HAPPY },
  { text: 'thank you, my human', bufo: BUFO.THANKS },
  { text: 'me was hungry. me forgive you.', bufo: BUFO.YUM },
  { text: 'you may pet me now', bufo: BUFO.MELT },
  { text: 'me happy now', bufo: BUFO.HAPPY },
  { text: 'purr. good human.', bufo: BUFO.LOVE },
  { text: 'me approves this review', bufo: BUFO.THANKS },
  { text: 'om nom nom nom', bufo: BUFO.YUM },
  { text: 'my human has excellent taste', bufo: BUFO.MELT },
  { text: 'me will allow the sitting near me', bufo: BUFO.LOVE },
]);

/**
 * Pick a thank-you.
 *
 * @param {string} species          SPECIES.DOG or SPECIES.CAT
 * @param {string|null} avoidText   the previous line, so the pet does not say
 *                                  the same thing twice running
 * @param {() => number} rng
 * @returns {{text: string, bufo: string}}
 */
export function thankYou(species, avoidText = null, rng = Math.random) {
  const all = species === SPECIES.CAT ? CAT_LINES : DOG_LINES;
  const pool = all.filter((line) => line.text !== avoidText);
  const choices = pool.length > 0 ? pool : all;
  return choices[Math.floor(rng() * choices.length) % choices.length];
}

/** Everything the pet might say — handy for tests and for the README. */
export function allLines(species) {
  return species === SPECIES.CAT ? CAT_LINES : DOG_LINES;
}
