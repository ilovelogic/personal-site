/**
 * sprites — Toby and Jibble, drawn from their photographs.
 *
 * Both pets live on the same 100×100 grid and expose the same anchor points,
 * which is what lets one wardrobe in accessories.js fit both of them: a beanie
 * is drawn against `headTopY`, not against "Toby's head", so adding a third
 * pet later means supplying anchors, not redrawing seven hats.
 *
 * Drawn from the reference photos:
 *   Toby   — apricot doodle, tight curls (a bumpy silhouette rather than a
 *            smooth one), long floppy ears past the jaw, dark button nose.
 *   Jibble — white kitten, grey-brown tabby patches over the crown and one
 *            ear and across the back, pink nose and inner ears, hazel-green
 *            eyes, and the green collar she wears in every picture.
 *
 * Pure module: returns SVG strings, touches no DOM.
 */

import { SPECIES } from '../model/petState.js';
import { MOOD } from '../model/mood.js';
import { accessoryLayers } from './accessories.js';

/* ---------------------------------------------------------------- palettes */

const DOG = Object.freeze({
  furLight: '#F7DDBA',
  furMid: '#EFCA9C',
  furShade: '#DFB07A',
  ear: '#E4B888',
  muzzle: '#FDF3E5',
  ink: '#3B2A20',
  tongue: '#F0929E',
});

const CAT = Object.freeze({
  white: '#FCFAF6',
  whiteShade: '#E9E2D8',
  // Jibble is a white cat and GitHub's light theme is a white page, so her
  // silhouette has to be drawn rather than implied — without this outline she
  // is a floating face and a collar.
  outline: '#DCD3C6',
  patch: '#A99E91',
  patchDark: '#8B7F70',
  innerEar: '#F1B5B5',
  nose: '#EE9BA3',
  iris: '#93AE68',
  ink: '#2A2622',
  collar: '#4E9E52',
  tag: '#D9B44B',
});

/* ----------------------------------------------------------------- anchors */

/**
 * Where things are on each pet, in grid units. The wardrobe reads only this.
 *
 * `bodyCy`/`bodyRx`/`bodyRy` describe the body ellipse exactly as it is drawn
 * below, and `pawTopY` is where the front paws start. Clothing that covers the
 * lower body needs both: on a round, front-facing, sitting pet there are no
 * visible legs to put trousers on, so the only way trousers read as trousers
 * is to take the body's own outline as their outline and stop above the feet.
 *
 * `silhouetteRx` is how wide the pet actually *looks* at its widest, which is
 * not `bodyRx`: Toby's curls are a ring of circles sitting outside his body
 * ellipse and add six units a side. Anything meant to be seen from behind him
 * — the backpack — has to be measured against what you can see, or it hides
 * inside the fluff and only its straps come out.
 */
export const ANCHORS = Object.freeze({
  [SPECIES.DOG]: Object.freeze({
    headCx: 50, headCy: 40, headR: 24, headTopY: 16,
    eyeY: 39, eyeDx: 8.5,
    neckY: 62, torsoY: 77, torsoRx: 22, hipsY: 91,
    bodyCx: 50, bodyCy: 78, bodyRx: 21, bodyRy: 17,
    silhouetteRx: 27, pawTopY: 88.6,
  }),
  [SPECIES.CAT]: Object.freeze({
    headCx: 50, headCy: 38, headR: 22, headTopY: 16,
    eyeY: 39, eyeDx: 9,
    neckY: 58, torsoY: 75, torsoRx: 20, hipsY: 90,
    bodyCx: 50, bodyCy: 75, bodyRx: 20, bodyRy: 17,
    silhouetteRx: 21, pawTopY: 87.2,
  }),
});

/* ------------------------------------------------------------- fur helpers */

/**
 * A ring of overlapping circles just outside a shape, which is how Toby's
 * curls read at 76px: a bumpy outline says "curly" far more legibly than any
 * amount of interior texture, which just turns to mud at this size.
 */
function fluffRing(cx, cy, rx, ry, count, bump, fill, startDeg = 0) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const angle = ((startDeg + (360 / count) * i) * Math.PI) / 180;
    const x = (cx + rx * Math.cos(angle)).toFixed(2);
    const y = (cy + ry * Math.sin(angle)).toFixed(2);
    out += `<circle cx="${x}" cy="${y}" r="${bump}" fill="${fill}"/>`;
  }
  return out;
}

/* -------------------------------------------------------------------- Toby */

function dogLayers(mood, ids) {
  const c = DOG;

  const behind = `
    <path d="M68 86 C84 88 88 74 78 68" stroke="${c.furMid}" stroke-width="11"
          fill="none" stroke-linecap="round"/>
    ${fluffRing(79, 70, 6, 6, 5, 4.6, c.furMid)}`;

  const body = `
    ${fluffRing(50, 78, 21, 17, 13, 6.2, c.furMid)}
    <ellipse cx="50" cy="78" rx="21" ry="17" fill="${c.furLight}"/>
    <ellipse cx="50" cy="80" rx="12" ry="12" fill="${c.muzzle}" opacity="0.55"/>
    <ellipse cx="39" cy="94" rx="8" ry="5.4" fill="${c.furLight}"/>
    <ellipse cx="61" cy="94" rx="8" ry="5.4" fill="${c.furLight}"/>
    <path d="M36 94.5 h6 M58 94.5 h6" stroke="${c.furShade}" stroke-width="1.1"
          stroke-linecap="round" opacity="0.8"/>`;

  // Ears hang past the jaw and swing a little; the view animates .prpets-ear.
  const ears = `
    <g class="prpets-ear prpets-ear--l">
      <ellipse cx="27" cy="49" rx="9.5" ry="17" fill="${c.ear}"
               transform="rotate(-9 27 49)"/>
      ${fluffRing(27, 62, 6.5, 4, 5, 4.4, c.ear)}
    </g>
    <g class="prpets-ear prpets-ear--r">
      <ellipse cx="73" cy="49" rx="9.5" ry="17" fill="${c.ear}"
               transform="rotate(9 73 49)"/>
      ${fluffRing(73, 62, 6.5, 4, 5, 4.4, c.ear)}
    </g>`;

  const head = `
    ${fluffRing(50, 40, 23, 22, 14, 6.4, c.furMid)}
    <circle cx="50" cy="40" r="23" fill="${c.furLight}"/>`;

  const face = `
    <ellipse cx="50" cy="52" rx="13" ry="10" fill="${c.muzzle}"/>
    ${dogEyes(mood, c)}
    <path d="M44.6 45.4 q5.4 -2.2 10.8 0 q0.6 4.2 -5.4 6.6 q-6 -2.4 -5.4 -6.6 z"
          fill="${c.ink}"/>
    <ellipse cx="47.4" cy="46.6" rx="1.5" ry="1" fill="#FFFFFF" opacity="0.45"/>
    ${dogMouth(mood, c)}`;

  return { behind, body, ears, head, face, sparkleAt: [{ x: 22, y: 22 }, { x: 79, y: 26 }, { x: 68, y: 12 }] };
}

function dogEyes(mood, c) {
  if (mood === MOOD.HAPPY) {
    return `
      <path d="M37.6 40 q3.9 -4.6 7.8 0" stroke="${c.ink}" stroke-width="2.3"
            fill="none" stroke-linecap="round"/>
      <path d="M54.6 40 q3.9 -4.6 7.8 0" stroke="${c.ink}" stroke-width="2.3"
            fill="none" stroke-linecap="round"/>`;
  }
  const eye = (cx) => `
    <circle cx="${cx}" cy="39" r="3.4" fill="${c.ink}"/>
    <circle cx="${cx + 1.2}" cy="37.8" r="1.15" fill="#FFFFFF"/>`;
  if (mood === MOOD.HANGRY) {
    // Inner brow ends *raised* — the universal shorthand for "please".
    //
    // These used to run the other way, inner ends low, which is the shorthand
    // for "furious": Toby spent every overdue hour glaring at his owner. The
    // pet is meant to be quietly reproachful, and a scowl in the corner of a
    // page someone works in all day is a different thing entirely.
    return `
      ${eye(41.5)}${eye(58.5)}
      <path d="M36.4 36.6 q4.4 -2.4 8.2 -3" stroke="${c.furShade}" stroke-width="1.8"
            fill="none" stroke-linecap="round"/>
      <path d="M63.6 36.6 q-4.4 -2.4 -8.2 -3" stroke="${c.furShade}" stroke-width="1.8"
            fill="none" stroke-linecap="round"/>`;
  }
  return `<g class="prpets-blinker">${eye(41.5)}${eye(58.5)}</g>`;
}

function dogMouth(mood, c) {
  if (mood === MOOD.HAPPY) {
    return `
      <path d="M42.6 53.6 q7.4 9.6 14.8 0 z" fill="${c.ink}"/>
      <path d="M46.4 57.4 q3.6 5.4 7.2 0 z" fill="${c.tongue}"/>`;
  }
  if (mood === MOOD.HANGRY) {
    return `
      <path d="M50 52.4 v2.4" stroke="${c.ink}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M45 57.4 q5 -3.2 10 0" stroke="${c.ink}" stroke-width="1.5"
            fill="none" stroke-linecap="round"/>`;
  }
  return `
    <path d="M50 52.4 v2.2" stroke="${c.ink}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M50 54.6 q-3.6 3.4 -6.6 0.4" stroke="${c.ink}" stroke-width="1.5"
          fill="none" stroke-linecap="round"/>
    <path d="M50 54.6 q3.6 3.4 6.6 0.4" stroke="${c.ink}" stroke-width="1.5"
          fill="none" stroke-linecap="round"/>`;
}

/* ------------------------------------------------------------------ Jibble */

function catLayers(mood, ids) {
  const c = CAT;
  const headClip = `${ids}-head`;
  const bodyClip = `${ids}-body`;

  // Three passes over one path: an outline casing, the white tail, then the
  // tabby rings as a dashed overlay. The casing is what stops the rings from
  // reading as loose debris floating beside her.
  const tail = 'M66 84 C84 82 89 66 78 58';
  const behind = `
    <path d="${tail}" stroke="${c.outline}" stroke-width="10.4" fill="none"
          stroke-linecap="round"/>
    <path d="${tail}" stroke="${c.white}" stroke-width="8.4" fill="none"
          stroke-linecap="round"/>
    <path d="${tail}" stroke="${c.patch}" stroke-width="8.4" fill="none"
          stroke-linecap="butt" stroke-dasharray="4 8" stroke-dashoffset="7"
          opacity="0.88"/>`;

  const body = `
    <defs>
      <clipPath id="${bodyClip}"><ellipse cx="50" cy="75" rx="20" ry="17"/></clipPath>
    </defs>
    <ellipse cx="50" cy="75" rx="20" ry="17" fill="${c.white}"
             stroke="${c.outline}" stroke-width="1.1"/>
    <g clip-path="url(#${bodyClip})">
      <path d="M55 61 C68 62 72 72 70 82 C68 90 62 94 57 93 C49 84 49 70 55 61 Z"
            fill="${c.patch}" opacity="0.9"/>
      <path d="M59 66 q7 4 8 10 M57 76 q8 3 9 9" stroke="${c.patchDark}"
            stroke-width="1.9" fill="none" stroke-linecap="round" opacity="0.65"/>
    </g>
    <ellipse cx="41" cy="92" rx="7" ry="4.8" fill="${c.white}"
             stroke="${c.outline}" stroke-width="1.1"/>
    <ellipse cx="59" cy="92" rx="7" ry="4.8" fill="${c.white}"
             stroke="${c.outline}" stroke-width="1.1"/>
    <path d="M38.6 92.6 v2 M41 93 v2 M43.4 92.6 v2
             M56.6 92.6 v2 M59 93 v2 M61.4 92.6 v2"
          stroke="${c.whiteShade}" stroke-width="1" stroke-linecap="round"/>
    <path d="M36 56.5 q14 7.5 28 0" stroke="${c.collar}" stroke-width="4.2"
          fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="62.4" r="2.7" fill="${c.tag}"/>`;

  // Her left ear (our right) carries a patch, as in the photos.
  const ears = `
    <path d="M31 24 L34.5 6.5 L45.5 17.5 Z" fill="${c.white}"
          stroke="${c.outline}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M33.4 21.6 L35.6 11 L42 17 Z" fill="${c.innerEar}"/>
    <path d="M69 24 L65.5 6.5 L54.5 17.5 Z" fill="${c.patch}"
          stroke-linejoin="round"/>
    <path d="M66.6 21.6 L64.4 11 L58 17 Z" fill="${c.innerEar}"/>`;

  const head = `
    <defs>
      <clipPath id="${headClip}"><circle cx="50" cy="38" r="22"/></clipPath>
    </defs>
    <circle cx="50" cy="38" r="22" fill="${c.white}"
            stroke="${c.outline}" stroke-width="1.1"/>
    <g clip-path="url(#${headClip})">
      <path d="M50 16 q12 -2 18 6 q4 8 -2 12 q-8 -8 -16 -6 q-6 2 -8 -4 q2 -8 8 -8 z"
            fill="${c.patch}" opacity="0.92"/>
      <path d="M56 20 q8 1 11 6" stroke="${c.patchDark}" stroke-width="1.8"
            fill="none" stroke-linecap="round" opacity="0.6"/>
    </g>`;

  const face = `
    ${catEyes(mood, c, ids)}
    <path d="M47.4 44.4 h5.2 L50 47.8 Z" fill="${c.nose}"/>
    ${catMouth(mood, c)}
    <g stroke="${c.whiteShade}" stroke-width="0.9" stroke-linecap="round" opacity="0.95">
      <path d="M42 47 L27 44.5 M42 48.8 L27 49.6 M42 50.4 L28.5 54.4"/>
      <path d="M58 47 L73 44.5 M58 48.8 L73 49.6 M58 50.4 L71.5 54.4"/>
    </g>`;

  return { behind, body, ears, head, face, sparkleAt: [{ x: 24, y: 24 }, { x: 77, y: 28 }, { x: 33, y: 10 }] };
}

function catEyes(mood, c, ids) {
  if (mood === MOOD.HAPPY) {
    return `
      <path d="M36.4 40.4 q4.6 -5.4 9.2 0" stroke="${c.ink}" stroke-width="2.2"
            fill="none" stroke-linecap="round"/>
      <path d="M54.4 40.4 q4.6 -5.4 9.2 0" stroke="${c.ink}" stroke-width="2.2"
            fill="none" stroke-linecap="round"/>`;
  }
  const eye = (cx) => `
    <path d="M${cx - 5.6} 39 q5.6 -6.2 11.2 0 q-5.6 6.2 -11.2 0 z" fill="#FFFFFF"/>
    <circle cx="${cx}" cy="39" r="4" fill="${c.iris}"/>
    <ellipse cx="${cx}" cy="39" rx="1.7" ry="3.6" fill="${c.ink}"/>
    <circle cx="${cx + 1.5}" cy="37" r="1.05" fill="#FFFFFF"/>`;
  if (mood === MOOD.HANGRY) {
    // A half-lidded eye, built by *cutting the eye down* rather than by laying
    // a shape on top of a whole one. The earlier version drew a lid over a
    // full eye, and the lid's edge floated above the eye as a second line —
    // which read as an eyebrow rather than as a droopy lid. Here the eye is
    // a flat-topped shape, the iris is clipped to it, and the single dark
    // line along the top edge *is* the lid, touching the eye it belongs to.
    const lidded = (cx, key) => `
      <defs>
        <clipPath id="${key}">
          <path d="M${cx - 5.6} 38.4 h11.2 q-5.6 6.4 -11.2 0 z"/>
        </clipPath>
      </defs>
      <path d="M${cx - 5.6} 38.4 h11.2 q-5.6 6.4 -11.2 0 z" fill="#FFFFFF"/>
      <g clip-path="url(#${key})">
        <circle cx="${cx}" cy="39.8" r="4" fill="${c.iris}"/>
        <ellipse cx="${cx}" cy="39.8" rx="1.7" ry="3.6" fill="${c.ink}"/>
      </g>
      <path d="M${cx - 5.9} 38.4 h11.8" stroke="${c.ink}" stroke-width="1.5"
            stroke-linecap="round"/>`;
    return `${lidded(41, `${ids}-eyl`)}${lidded(59, `${ids}-eyr`)}`;
  }
  return `<g class="prpets-blinker">${eye(41)}${eye(59)}</g>`;
}

function catMouth(mood, c) {
  if (mood === MOOD.HAPPY) {
    return `
      <path d="M50 48.4 q-3.4 3.8 -6.2 0.4" stroke="${c.ink}" stroke-width="1.4"
            fill="none" stroke-linecap="round"/>
      <path d="M50 48.4 q3.4 3.8 6.2 0.4" stroke="${c.ink}" stroke-width="1.4"
            fill="none" stroke-linecap="round"/>`;
  }
  if (mood === MOOD.HANGRY) {
    return `<path d="M46.4 52 q3.6 -2.6 7.2 0" stroke="${c.ink}" stroke-width="1.4"
                  fill="none" stroke-linecap="round"/>`;
  }
  return `
    <path d="M50 47.8 v2.2" stroke="${c.ink}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M50 50 q-2.8 2.6 -5.2 0.2" stroke="${c.ink}" stroke-width="1.3"
          fill="none" stroke-linecap="round"/>
    <path d="M50 50 q2.8 2.6 5.2 0.2" stroke="${c.ink}" stroke-width="1.3"
          fill="none" stroke-linecap="round"/>`;
}

/* ----------------------------------------------------------------- assembly */

let idCounter = 0;

/**
 * One pet, as an inline SVG string.
 *
 * Layer order differs slightly between the two, and deliberately: Toby's ears
 * hang at the sides so a hat simply goes on top of everything, while Jibble's
 * ears stand up, so head-worn things are drawn *under* them and her ears poke
 * through — which is both how a beanie really sits on a cat and the only way
 * to keep the markings that make her recognisable.
 *
 * @param {object} pet    a PetState
 * @param {string} mood   a member of MOOD
 * @param {{size?: number, decorate?: boolean}} [options]
 *        decorate=false drops the happy sparkles — used by the menu preview,
 *        where a permanently sparkling pet would be noise.
 * @returns {string} SVG markup
 */
export function petSvg(pet, mood, { size = 76, decorate = true } = {}) {
  const ids = `prpets-${(idCounter = (idCounter + 1) % 100000)}`;
  const isCat = pet.species === SPECIES.CAT;
  const layers = isCat ? catLayers(mood, ids) : dogLayers(mood, ids);
  const anchors = ANCHORS[pet.species];
  const worn = accessoryLayers(pet.accessories, anchors, pet.species, ids);

  const sparkles =
    decorate && mood === MOOD.HAPPY
      ? layers.sparkleAt
          .map(
            (p, i) => `<path class="prpets-sparkle" style="--i:${i}"
              d="M${p.x} ${p.y - 4.5} L${p.x + 1.5} ${p.y - 1.5} L${p.x + 4.5} ${p.y}
                 L${p.x + 1.5} ${p.y + 1.5} L${p.x} ${p.y + 4.5} L${p.x - 1.5} ${p.y + 1.5}
                 L${p.x - 4.5} ${p.y} L${p.x - 1.5} ${p.y - 1.5} Z" fill="#F5C542"/>`
          )
          .join('')
      : '';

  const headStack = isCat
    ? `${layers.head}${worn.head}${layers.ears}${layers.face}${worn.face}`
    : `${layers.head}${layers.ears}${layers.face}${worn.face}${worn.head}`;

  return `<svg class="prpets-svg" viewBox="0 0 100 100" width="${size}" height="${size}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false">
    ${worn.behind}
    ${layers.behind}
    <g class="prpets-torso">
      ${layers.body}
      ${worn.body}
      ${worn.neck}
    </g>
    <g class="prpets-head">
      ${headStack}
    </g>
    ${sparkles}
  </svg>`;
}
