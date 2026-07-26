/**
 * petCard — one pet on screen, and its speech bubble.
 *
 * The card owns a small amount of mutable DOM and is careful about *when* it
 * rewrites it. Re-rendering an SVG restarts every CSS animation attached to
 * it, so a naive "redraw on every tick" makes a happy pet bounce in place
 * forever and a hangry one twitch once a second. The fix is to redraw only
 * when the thing that determines the drawing actually changes, and to push
 * everything continuous — the hangriness ramp — through a CSS variable
 * instead.
 */

import { MOOD, moodAt } from '../model/mood.js';
import { petSvg } from './sprites.js';
import { bufoSvg } from './bufo.js';

const SPECIES_NOUN = { dog: 'puppy', cat: 'kitten' };

const MOOD_DESCRIPTION = {
  [MOOD.HAPPY]: 'delighted',
  [MOOD.BORED]: 'a bit bored',
  [MOOD.HANGRY]: 'getting hangry',
};

export class PetCard {
  /**
   * @param {string} petId
   * @param {{onActivate: (petId: string) => void}} handlers
   */
  constructor(petId, handlers) {
    this.petId = petId;
    this.handlers = handlers;
    this.lastDrawKey = null;

    this.el = document.createElement('div');
    this.el.className = 'prpets-pet';
    this.el.dataset.petId = petId;
    this.el.innerHTML = `
      <div class="prpets-bubble" role="status" aria-live="polite" hidden></div>
      <button type="button" class="prpets-button" aria-haspopup="dialog" aria-expanded="false">
        <span class="prpets-sprite-slot"></span>
        <span class="prpets-hunger" aria-hidden="true">${emptyBowlSvg()}</span>
        <span class="prpets-sr prpets-button-label"></span>
      </button>`;

    this.bubble = this.el.querySelector('.prpets-bubble');
    this.button = this.el.querySelector('.prpets-button');
    this.slot = this.el.querySelector('.prpets-sprite-slot');
    this.label = this.el.querySelector('.prpets-button-label');

    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.handlers.onActivate(this.petId);
    });
  }

  /**
   * Bring the card up to date.
   *
   * @param {object} app  the whole document
   * @param {number} now
   */
  render(app, now) {
    const pet = app.pets[this.petId];
    const { mood, intensity } = moodAt(pet, now);

    // Redraw the pet only when its *appearance* changes. Accessories and
    // species-plus-mood are the whole of it; the name and the hangriness ramp
    // are handled without touching the SVG.
    const drawKey = `${mood}|${pet.accessories.join(',')}`;
    if (drawKey !== this.lastDrawKey) {
      this.slot.innerHTML = petSvg(pet, mood);
      this.lastDrawKey = drawKey;
    }

    this.el.classList.toggle('is-happy', mood === MOOD.HAPPY);
    this.el.classList.toggle('is-hangry', mood === MOOD.HANGRY);
    this.el.style.setProperty('--hangry', intensity.toFixed(3));

    const noun = SPECIES_NOUN[pet.species] ?? 'pet';
    this.label.textContent =
      `${pet.name} the ${noun}, ${MOOD_DESCRIPTION[mood]}. Open ${pet.name}'s menu.`;
    this.button.title = `${pet.name} — ${MOOD_DESCRIPTION[mood]}`;

    const speech = app.speech[this.petId];
    if (mood === MOOD.HAPPY && speech) {
      // Only rewrite when the words change, so the pop-in animation does not
      // replay on every tick while the pet is still chewing.
      if (this.bubble.dataset.text !== speech.text) {
        this.bubble.dataset.text = speech.text;
        this.bubble.innerHTML =
          `<span class="prpets-bubble-text"></span>${bufoSvg(speech.bufo, 18)}`;
        this.bubble.querySelector('.prpets-bubble-text').textContent = speech.text;
      }
      this.bubble.hidden = false;
    } else {
      this.bubble.hidden = true;
      delete this.bubble.dataset.text;
    }
  }

  setMenuOpen(open) {
    this.button.setAttribute('aria-expanded', String(open));
    this.el.classList.toggle('is-open', open);
  }
}

/**
 * The hangriness tell: an empty bowl at the pet's feet, faded almost to
 * nothing at first and never quite loud. The brief asked for subtle but
 * noticeable, and an empty bowl says "feed me" without any text to read.
 */
function emptyBowlSvg() {
  return `<svg viewBox="0 0 24 16" width="20" height="14" aria-hidden="true" focusable="false">
    <path d="M2.5 6 h19 a1.5 1.5 0 0 1 1.4 2 l-2.2 5.4 a2.4 2.4 0 0 1 -2.2 1.4 h-13
             a2.4 2.4 0 0 1 -2.2 -1.4 l-2.2 -5.4 a1.5 1.5 0 0 1 1.4 -2 z"
          fill="#B8B0A4"/>
    <ellipse cx="12" cy="6.2" rx="9.6" ry="2.3" fill="#D6CFC4"/>
  </svg>`;
}
