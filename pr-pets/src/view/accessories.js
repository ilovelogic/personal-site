/**
 * accessories — the wardrobe, drawn against anchors rather than against a
 * particular pet.
 *
 * Every accessory is a function of `anchors` (see sprites.js) and returns
 * markup for exactly one *layer*. The layers exist because clothing has a
 * z-order that has nothing to do with the order the checkboxes appear in: a
 * lanyard goes over a hoodie, glasses go over a face, a backpack goes behind
 * everything. Sorting that out here — once — means the caller can hand over an
 * arbitrary set of ids in any order and still get a dressed pet.
 *
 * Pure module.
 */

import { SPECIES } from '../model/petState.js';

/** Layer names, in the order they are painted. */
const LAYERS = ['behind', 'body', 'neck', 'face', 'head'];

const C = {
  knit: '#5C7FD6',
  knitBand: '#4060A9',
  pom: '#F4F1E9',
  hoodie: '#3C4453',
  hoodieDark: '#2E3542',
  hoodieTrim: '#E8E6E1',
  /** The event print. Shared with the happy sparkles, to keep the palette tight. */
  hoodiePrint: '#F5C542',
  hoodieLining: '#E8A33D',
  hoodiePatch: '#5FBFA8',
  hub: '#B9BFC7',
  hubEdge: '#8E959E',
  hubSheen: '#E4E8ED',
  port: '#2B3038',
  portC: '#3E4650',
  cable: '#D8DCE2',
  frame: '#2E3440',
  lens: '#BBD9F2',
  can: '#2B2F38',
  cushion: '#4A505C',
  strap: '#2C3E6B',
  badge: '#FBFAF7',
  badgeEdge: '#C9C4BA',
  badgeLine: '#B9B4AA',
  pack: '#3E4A63',
  buckle: '#D9B44B',
};

/* ------------------------------------------------------------- the garments */

function beanie(a) {
  const w = a.headR * 1.72;
  const brimY = a.headCy - a.headR + 13;
  const domeH = a.headR * 0.72;
  const left = a.headCx - w / 2;
  const ribs = [-0.3, -0.1, 0.1, 0.3]
    .map((f) => {
      const x = a.headCx + w * f;
      return `<path d="M${x.toFixed(1)} ${brimY - 4.4} v7.4"
        stroke="${C.knit}" stroke-width="1.1" opacity="0.55" stroke-linecap="round"/>`;
    })
    .join('');

  return {
    head: `
      <path d="M${left} ${brimY} a ${w / 2} ${domeH} 0 0 1 ${w} 0 z" fill="${C.knit}"/>
      <circle cx="${a.headCx}" cy="${brimY - domeH - 2.5}" r="4.6" fill="${C.pom}"/>
      <rect x="${left - 1}" y="${brimY - 4.6}" width="${w + 2}" height="8"
            rx="4" fill="${C.knitBand}"/>
      ${ribs}`,
  };
}

/**
 * Not a dark hoodie, but a hoodie somebody was *given* — which is a different
 * garment, and the difference is all print.
 *
 * Event merch has three tells, and none of them is the shape: a bright screen
 * print on the chest big enough to read across a room, a contrast hood lining
 * the print colour, and a sponsor patch. A plain navy pullover with a small
 * `</>` on it, which is what this was, is just a hoodie. The crest is a bolt
 * inside a disc — hackathons brand themselves on the all-nighter, and a bolt
 * survives being nine pixels wide in a way that a wordmark does not — with the
 * event's name below it as two printed bars, legible as *text* at 76px without
 * pretending to be letters nobody could read.
 */
function hoodie(a) {
  const rx = a.torsoRx * 0.99;
  const cy = a.torsoY + 1;
  const crestY = a.torsoY - 3.5;
  const crestR = 5.4;
  const hoodRx = a.torsoRx * 0.74;

  return {
    body: `
      <ellipse cx="${a.headCx}" cy="${a.neckY - 1}" rx="${hoodRx}" ry="9"
               fill="${C.hoodieDark}"/>
      <path d="M${a.headCx - hoodRx * 0.9} ${a.neckY - 2}
               a${hoodRx * 0.9} 4.2 0 0 0 ${hoodRx * 1.8} 0 z"
            fill="${C.hoodieLining}"/>
      <path d="M${a.headCx - hoodRx * 0.9} ${a.neckY - 2}
               a${hoodRx * 0.9} 2.1 0 0 0 ${hoodRx * 1.8} 0 z"
            fill="${C.hoodieDark}"/>
      <ellipse cx="${a.headCx}" cy="${cy}" rx="${rx}" ry="16" fill="${C.hoodie}"/>
      <path d="M${a.headCx - rx * 0.55} ${cy + 6} q${rx * 0.55} 5.5 ${rx * 1.1} 0
               v6 q-${rx * 0.55} 5.5 -${rx * 1.1} 0 z"
            fill="${C.hoodieDark}" opacity="0.75"/>
      <path d="M${a.headCx - 4} ${a.neckY + 3} v8 M${a.headCx + 4} ${a.neckY + 3} v8"
            stroke="${C.hoodieTrim}" stroke-width="1.6" stroke-linecap="round"/>

      <circle cx="${a.headCx}" cy="${crestY}" r="${crestR}" fill="${C.hoodiePrint}"/>
      <circle cx="${a.headCx}" cy="${crestY}" r="${crestR - 1.15}" fill="none"
              stroke="${C.hoodie}" stroke-width="0.7" opacity="0.55"/>
      <path d="M${a.headCx + 1.5} ${crestY - 3.4} L${a.headCx - 2.4} ${crestY + 0.5}
               h2.2 L${a.headCx - 1.4} ${crestY + 3.5} L${a.headCx + 2.5} ${crestY - 0.6}
               h-2.2 z"
            fill="${C.hoodie}"/>
      <path d="M${a.headCx - 5.2} ${crestY + 8} h10.4 M${a.headCx - 3.2} ${crestY + 10.4} h6.4"
            stroke="${C.hoodiePrint}" stroke-width="1.5" stroke-linecap="round"
            opacity="0.9"/>
      <rect x="${a.headCx - rx * 0.82}" y="${a.torsoY + 1}" width="5.2" height="3.6"
            rx="1" fill="${C.hoodiePatch}"/>`,
  };
}

/**
 * The dongle every laptop in the room needs and nobody has brought: a little
 * aluminium slab of ports, held against the pet's front, its captive USB-C
 * cable curling away over one shoulder.
 *
 * This replaced sweatpants. Trousers were the wrong idea for this pet rather
 * than a badly drawn one — a round animal sitting face-on has no legs on show,
 * so every version came out as a grey slab across its middle, and splitting
 * that slab in two only added a gap with belly behind it. An object the pet is
 * *holding* has no such problem: it is meant to be a rectangle, so reading as
 * one is the point.
 */
function usbhub(a) {
  const w = a.bodyRx * 1.25;
  const h = 9.2;
  const left = a.bodyCx - w / 2;
  // Held against the front: below the lanyard badge, above the paws.
  const top = a.bodyCy + a.bodyRy * 0.02;
  const portY = top + 3.4;
  const portH = 3.2;

  /**
   * Ports at uneven widths with one gap in the middle, as fractions of the
   * face: two USB-A, a break, HDMI, USB-C, a card slot. Evenly spaced slots of
   * equal width read as a tiny keyboard; it is the irregular rhythm that says
   * "sockets". Positions are fractional so both pets get the same hub at
   * their own scale.
   */
  const slot = (xf, wf, fill, round = 1) =>
    `<rect x="${(left + w * xf).toFixed(2)}" y="${portY}" width="${(w * wf).toFixed(2)}"
           height="${portH}" rx="${round}" fill="${fill}"/>`;
  const ports = [
    slot(0.08, 0.15, C.port),
    slot(0.27, 0.15, C.port),
    slot(0.5, 0.17, C.port),
    slot(0.71, 0.1, C.portC, 1.6),
    slot(0.85, 0.09, C.port),
  ].join('');

  return {
    body: `
      <path d="M${left + 1.5} ${top + h - 2.4}
               C${left - 6.5} ${top + h + 0.5} ${left - 5.5} ${top + h + 5.5}
                ${left + 2.5} ${top + h + 4.2}"
            stroke="${C.cable}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <rect x="${left + 2.2}" y="${top + h + 2.8}" width="3.6" height="2.8" rx="1.2"
            fill="${C.hubEdge}"/>
      <rect x="${left}" y="${top}" width="${w}" height="${h}" rx="2.4"
            fill="${C.hub}" stroke="${C.hubEdge}" stroke-width="0.9"/>
      <rect x="${left + 1.4}" y="${top + 1}" width="${w - 2.8}" height="1.3" rx="0.65"
            fill="${C.hubSheen}" opacity="0.8"/>
      <rect x="${left + 1.4}" y="${portY - 0.7}" width="${w - 2.8}" height="${portH + 1.4}"
            rx="1.4" fill="${C.hubEdge}" opacity="0.35"/>
      ${ports}`,
  };
}

function glasses(a) {
  const lens = (cx) => `
    <rect x="${cx - 6.6}" y="${a.eyeY - 5.4}" width="13.2" height="10.8" rx="4.6"
          fill="${C.lens}" opacity="0.32"/>
    <rect x="${cx - 6.6}" y="${a.eyeY - 5.4}" width="13.2" height="10.8" rx="4.6"
          fill="none" stroke="${C.frame}" stroke-width="1.7"/>`;
  return {
    face: `
      ${lens(a.headCx - a.eyeDx)}
      ${lens(a.headCx + a.eyeDx)}
      <path d="M${a.headCx - 2.4} ${a.eyeY - 1.5} h4.8" stroke="${C.frame}"
            stroke-width="1.7" stroke-linecap="round"/>
      <path d="M${a.headCx - a.eyeDx - 6.6} ${a.eyeY - 2.6} l-5 -1.4"
            stroke="${C.frame}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M${a.headCx + a.eyeDx + 6.6} ${a.eyeY - 2.6} l5 -1.4"
            stroke="${C.frame}" stroke-width="1.7" stroke-linecap="round"/>`,
  };
}

function headphones(a) {
  const span = a.headR * 1.84;
  const startX = a.headCx - span / 2;
  const cup = (cx) => `
    <rect x="${cx - 4.6}" y="${a.headCy - 8.5}" width="9.2" height="17" rx="4.6"
          fill="${C.can}"/>
    <rect x="${cx - 2.6}" y="${a.headCy - 6}" width="5.2" height="12" rx="2.6"
          fill="${C.cushion}"/>`;
  return {
    head: `
      <path d="M${startX} ${a.headCy - 6} q0 -${a.headR * 1.42} ${span} 0"
            stroke="${C.can}" stroke-width="4.4" fill="none" stroke-linecap="round"/>
      ${cup(a.headCx - a.headR - 1.5)}
      ${cup(a.headCx + a.headR + 1.5)}`,
  };
}

function lanyard(a) {
  const badgeY = a.neckY + 12;
  return {
    neck: `
      <path d="M${a.headCx - 8.5} ${a.neckY - 3} L${a.headCx - 3.5} ${badgeY}"
            stroke="${C.strap}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M${a.headCx + 8.5} ${a.neckY - 3} L${a.headCx + 3.5} ${badgeY}"
            stroke="${C.strap}" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="${a.headCx - 7.5}" y="${badgeY}" width="15" height="11.5" rx="2"
            fill="${C.badge}" stroke="${C.badgeEdge}" stroke-width="0.9"/>
      <rect x="${a.headCx - 7.5}" y="${badgeY}" width="15" height="3.6" rx="2"
            fill="${C.strap}"/>
      <path d="M${a.headCx - 5} ${badgeY + 6.4} h10 M${a.headCx - 5} ${badgeY + 8.8} h6.5"
            stroke="${C.badgeLine}" stroke-width="1.1" stroke-linecap="round"/>`,
  };
}

function backpack(a) {
  // A pack peeking over the shoulders, plus a strap curving over each one.
  //
  // Two things have to be true at once, which is why this is measured against
  // the silhouette rather than the body ellipse. It has to be *wider* than the
  // pet where it shows, or it hides inside Toby's curls and the straps read as
  // dungarees; and it has to sit high and stop well above the paws, or it
  // becomes the navy holdall the pet appears to be sitting in — which is what
  // `bodyRx * 2 + 20`, running past the hem of the body, used to produce.
  // Confining it to the shoulder band satisfies both: that is where the pet is
  // narrowest, and it is the only part of a backpack you can see from in front.
  const w = a.silhouetteRx * 2.5;
  const left = a.headCx - w / 2;
  const top = a.neckY - 3;
  const height = a.torsoY - a.neckY + 8;

  const strap = (dx) => `
    <path d="M${a.headCx + dx} ${a.neckY - 1}
             C${a.headCx + dx * 1.14} ${a.neckY + 7}
              ${a.headCx + dx * 1.02} ${a.torsoY}
              ${a.headCx + dx * 0.84} ${a.torsoY + 6}"
          stroke="${C.pack}" stroke-width="4.6" fill="none" stroke-linecap="round"/>
    <rect x="${a.headCx + dx * 0.96 - 2.3}" y="${a.torsoY - 4}" width="4.6" height="3.4"
          rx="1" fill="${C.buckle}"/>`;

  return {
    behind: `
      <rect x="${left}" y="${top}" width="${w}" height="${height}" rx="9" fill="${C.pack}"/>
      <rect x="${left + w * 0.22}" y="${top + 3}" width="${w * 0.56}"
            height="${height * 0.36}" rx="3.5" fill="${C.strap}" opacity="0.9"/>`,
    body: `${strap(-11)}${strap(11)}`,
  };
}

const GARMENTS = {
  beanie,
  hoodie,
  usbhub,
  glasses,
  headphones,
  lanyard,
  backpack,
};

/**
 * Paint order within a layer. Independent of the order ids arrive in, so
 * "hoodie then backpack" and "backpack then hoodie" dress the pet identically
 * — a nice property to have when the state is a set and the UI is checkboxes.
 */
// The hub is held, so it goes over the hoodie but under the lanyard: a badge
// on a neck strap hangs in front of whatever you are carrying.
const DRAW_ORDER = ['backpack', 'hoodie', 'usbhub', 'lanyard', 'glasses', 'headphones', 'beanie'];

/**
 * Build the five accessory layers for a pet.
 *
 * @param {readonly string[]} worn   accessory ids (any order; unknown ids ignored)
 * @param {object} anchors           ANCHORS[species]
 * @param {string} species           SPECIES.DOG or SPECIES.CAT
 * @param {string} ids               prefix for any element id this markup
 *                                   defines; unique per rendered sprite, so
 *                                   two pets on screen cannot share a clip path
 * @returns {{behind: string, body: string, neck: string, face: string, head: string}}
 */
export function accessoryLayers(worn, anchors, species, ids = 'prpets') {
  const out = Object.fromEntries(LAYERS.map((l) => [l, '']));
  const anchorsForSpecies = tweak(anchors, species);

  for (const id of DRAW_ORDER) {
    if (!worn.includes(id)) continue;
    const parts = GARMENTS[id]?.(anchorsForSpecies, ids) ?? {};
    for (const layer of LAYERS) {
      if (parts[layer]) out[layer] += parts[layer];
    }
  }
  return out;
}

/**
 * Per-species nudges.
 *
 * Toby's head is a ball of curls whose visual edge sits a little outside the
 * circle the anchors describe, so anything head-worn is pushed out slightly to
 * clear the fluff. Without this the beanie looks swallowed.
 */
function tweak(anchors, species) {
  if (species !== SPECIES.DOG) return anchors;
  return { ...anchors, headR: anchors.headR + 1.5, headTopY: anchors.headTopY - 1.5 };
}
