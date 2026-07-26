/**
 * bufo — the little frogs that punctuate a thank-you.
 *
 * These are drawn from scratch in the spirit of the bufo emoji packs rather
 * than copied from them; the originals are community artwork and this
 * extension ships no image files at all. Same job, same energy, our own lines.
 *
 * Every export returns an SVG string on a 32×32 grid. Pure module — no DOM.
 */

import { BUFO } from '../model/phrases.js';

const SKIN = '#7CC24A';
const SKIN_SHADE = '#63A838';
const BELLY = '#CFE9A8';
const INK = '#243B16';
const HEART = '#E8617D';
const TONGUE = '#F08CA0';
const BLUSH = '#F2A0A8';

/** Head, body and eye-domes: identical in every pose. */
function base() {
  return `
    <ellipse cx="16" cy="20" rx="12.5" ry="10.5" fill="${SKIN}"/>
    <ellipse cx="16" cy="23.5" rx="8.5" ry="6.5" fill="${BELLY}"/>
    <circle cx="8.5" cy="10.5" r="5.2" fill="${SKIN}"/>
    <circle cx="23.5" cy="10.5" r="5.2" fill="${SKIN}"/>
    <path d="M3.5 24 q-2 2 0.5 3.5" stroke="${SKIN_SHADE}" stroke-width="2"
          stroke-linecap="round" fill="none"/>
    <path d="M28.5 24 q2 2 -0.5 3.5" stroke="${SKIN_SHADE}" stroke-width="2"
          stroke-linecap="round" fill="none"/>`;
}

function eyeWhites() {
  return `
    <circle cx="8.5" cy="10.5" r="3.6" fill="#FFFFFF"/>
    <circle cx="23.5" cy="10.5" r="3.6" fill="#FFFFFF"/>`;
}

function pupils(dy = 0) {
  return `
    <circle cx="8.9" cy="${11 + dy}" r="1.9" fill="${INK}"/>
    <circle cx="23.9" cy="${11 + dy}" r="1.9" fill="${INK}"/>
    <circle cx="9.6" cy="${10.2 + dy}" r="0.7" fill="#FFFFFF"/>
    <circle cx="24.6" cy="${10.2 + dy}" r="0.7" fill="#FFFFFF"/>`;
}

function heartShape(cx, cy, size, fill) {
  const s = size / 10;
  return `<path transform="translate(${cx} ${cy}) scale(${s})"
    d="M0 4.2 C-5.4 0.4 -4.2 -4.4 -1.2 -4.4 C0 -4.4 0 -3.2 0 -3.2
       C0 -3.2 0 -4.4 1.2 -4.4 C4.2 -4.4 5.4 0.4 0 4.2 Z" fill="${fill}"/>`;
}

function blush() {
  return `
    <ellipse cx="6" cy="18.5" rx="2.6" ry="1.7" fill="${BLUSH}" opacity="0.75"/>
    <ellipse cx="26" cy="18.5" rx="2.6" ry="1.7" fill="${BLUSH}" opacity="0.75"/>`;
}

const POSES = {
  /** Heart eyes, wide smile. For "best human!!". */
  [BUFO.LOVE]: () => `
    ${base()}
    ${eyeWhites()}
    ${heartShape(8.7, 10.5, 5.4, HEART)}
    ${heartShape(23.7, 10.5, 5.4, HEART)}
    <path d="M10 18.5 q6 5.5 12 0" stroke="${INK}" stroke-width="1.6"
          stroke-linecap="round" fill="none"/>
    ${blush()}`,

  /** Holding a heart up to you. For a plain, sincere thank-you. */
  [BUFO.THANKS]: () => `
    ${base()}
    ${eyeWhites()}
    ${pupils(0.4)}
    <path d="M11 18.8 q5 4 10 0" stroke="${INK}" stroke-width="1.6"
          stroke-linecap="round" fill="none"/>
    ${heartShape(16, 25.5, 7, HEART)}
    ${blush()}`,

  /** Eyes squeezed shut, grinning. Plain delight. */
  [BUFO.HAPPY]: () => `
    ${base()}
    ${eyeWhites()}
    <path d="M6.2 10.8 q2.3 -2.6 4.6 0" stroke="${INK}" stroke-width="1.7"
          stroke-linecap="round" fill="none"/>
    <path d="M21.2 10.8 q2.3 -2.6 4.6 0" stroke="${INK}" stroke-width="1.7"
          stroke-linecap="round" fill="none"/>
    <path d="M10 18.4 q6 6 12 0" stroke="${INK}" stroke-width="1.6"
          stroke-linecap="round" fill="none"/>
    ${blush()}`,

  /** Mid-chew, tongue out. For the lines about being hungry. */
  [BUFO.YUM]: () => `
    ${base()}
    ${eyeWhites()}
    ${pupils(0.8)}
    <path d="M10.5 18.2 q5.5 5 11 0" stroke="${INK}" stroke-width="1.6"
          stroke-linecap="round" fill="none"/>
    <path d="M14 21.6 q2 3.6 4 0 z" fill="${TONGUE}"/>
    ${blush()}`,

  /** Overcome. Upturned eyes, tiny hearts floating off. */
  [BUFO.MELT]: () => `
    ${base()}
    ${eyeWhites()}
    <path d="M6.4 11.6 q2.1 -3 4.2 0" stroke="${INK}" stroke-width="1.7"
          stroke-linecap="round" fill="none"/>
    <path d="M21.4 11.6 q2.1 -3 4.2 0" stroke="${INK}" stroke-width="1.7"
          stroke-linecap="round" fill="none"/>
    <path d="M12 18.6 q4 3.4 8 0" stroke="${INK}" stroke-width="1.6"
          stroke-linecap="round" fill="none"/>
    ${heartShape(28.5, 5.5, 5, HEART)}
    ${heartShape(3.6, 4.2, 3.4, HEART)}
    ${blush()}`,
};

/**
 * One bufo as an inline SVG string.
 *
 * @param {string} pose  a member of BUFO; anything unknown falls back to HAPPY
 *                       rather than rendering an empty box
 * @param {number} size  pixels
 */
export function bufoSvg(pose, size = 20) {
  const draw = POSES[pose] ?? POSES[BUFO.HAPPY];
  return `<svg class="prpets-bufo" viewBox="0 0 32 32" width="${size}" height="${size}"
    role="img" aria-hidden="true" focusable="false">${draw()}</svg>`;
}
