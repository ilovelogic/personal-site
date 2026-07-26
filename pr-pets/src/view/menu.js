/**
 * menu — the panel that opens when a pet is clicked.
 *
 * Renaming, the hunger window, dressing up, and the feeding history chart.
 *
 * The panel is rebuilt from scratch whenever the stored document changes — it
 * is small, and a fresh build cannot go stale. Two costs come with that
 * choice, and both are paid for here:
 *
 *   - Anything the user is in the middle of would be thrown away, so `refresh`
 *     saves and restores the focused control, its draft text and its caret.
 *     Controls are matched by `data-field` rather than by position, so the
 *     restore survives the layout changing between builds — which it does, as
 *     the revert button comes and goes.
 *   - A mood tick is not a document change. Rebuilding on one would throw away
 *     the chart tooltip mid-hover and re-run `dailyCounts` for nothing, so a
 *     tick takes the `retouch` path and repaints only what time can alter.
 *     The document is immutable, so `app === this.lastApp` is an exact test
 *     for "nothing was stored since the last build".
 */

import {
  ACCESSORY_IDS,
  ACCESSORY_LABELS,
  MAX_NAME_LENGTH,
  MIN_HANGER_OVERRIDE_MS,
  MAX_HANGER_OVERRIDE_MS,
} from '../model/petState.js';
import { PET_DEFAULTS } from '../model/appState.js';
import { MOOD, THRESHOLD_SOURCE, moodAt, formatDuration } from '../model/mood.js';
import { dailyCounts } from '../model/history.js';
import { petSvg } from './sprites.js';
import { feedingChart } from './chart.js';

const UNIT_MS = Object.freeze({ minutes: 60 * 1000, hours: 60 * 60 * 1000 });

export class PetMenu {
  /**
   * @param {{onRename: (petId: string, name: string) => void,
   *          onToggleAccessory: (petId: string, accessoryId: string) => void,
   *          onSetHangerOverride: (petId: string, ms: number|null) => void,
   *          onClose: () => void}} handlers
   */
  constructor(handlers) {
    this.handlers = handlers;
    this.petId = null;
    this.lastApp = null;
    /** Live references into the current build, for the `retouch` path. */
    this.statusEl = null;
    this.portraitEl = null;
    this.portraitMood = null;

    /**
     * Which unit each pet's field is being shown in. This is a view
     * preference, not part of the pet — switching between "180 minutes" and
     * "3 hours" describes the same pet, so it never touches storage. It does
     * have to outlive a rebuild, though, which is why it lives here.
     */
    this.units = new Map();

    this.el = document.createElement('div');
    this.el.className = 'prpets-menu';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'false');
    this.el.hidden = true;

    this.el.addEventListener('click', (event) => event.stopPropagation());
    this.el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.handlers.onClose();
      }
    });
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open(petId, app, now) {
    this.petId = petId;
    this.el.hidden = false;
    this.build(app, now);
    // Focus the name field, since renaming is the thing most people came for.
    this.el.querySelector('[data-field="name"]')?.focus({ preventScroll: true });
  }

  close() {
    this.el.hidden = true;
    this.petId = null;
    this.lastApp = null;
    this.statusEl = null;
    this.portraitEl = null;
    this.portraitMood = null;
    this.el.replaceChildren();
  }

  /** Update an already-open menu, preserving whatever is being interacted with. */
  refresh(app, now) {
    if (!this.isOpen || !this.petId) return;

    // A mood tick changes what the clock says, not what is stored. Repaint the
    // two things time can alter and leave the rest — including the chart the
    // user may be hovering and the chip they may be tabbing through — alone.
    if (app === this.lastApp) {
      this.retouch(app, now);
      return;
    }

    const active = document.activeElement;
    const focused = this.el.contains(active) ? active?.dataset?.field ?? null : null;
    // Buttons have no meaningful `value`; only text-like controls carry a draft.
    const draft = focused && hasTextValue(active) ? active.value : null;
    // Number inputs have no selection API, so this is null for them and the
    // restore below simply skips the caret.
    const caret = draft !== null ? safeSelectionStart(active) : null;

    this.build(app, now);

    if (focused) {
      // The revert button exists only while a value is pinned, so clicking it
      // removes the very control that was focused. Falling back to the amount
      // field keeps the keyboard where the user was working instead of
      // dumping it on <body>.
      const next =
        this.el.querySelector(`[data-field="${cssEscape(focused)}"]`) ??
        (focused === 'revert' ? this.el.querySelector('[data-field="amount"]') : null);
      if (next) {
        if (draft !== null) next.value = draft;
        next.focus({ preventScroll: true });
        if (caret !== null) safeSetCaret(next, caret);
      }
    }
  }

  /**
   * Repaint only what the passing of time changes: the countdown line, and the
   * portrait when the mood behind it has actually flipped.
   */
  retouch(app, now) {
    const pet = app.pets[this.petId];
    const info = moodAt(pet, now);

    if (this.statusEl) {
      this.statusEl.textContent = statusText(pet, info, this.petId, now);
    }
    if (this.portraitEl && this.portraitMood !== info.mood) {
      this.portraitEl.innerHTML = petSvg(pet, info.mood, { size: 46, decorate: false });
      this.portraitMood = info.mood;
    }
  }

  /** The unit this pet's field is shown in, defaulting to whatever reads best. */
  unitFor(petId, thresholdMs) {
    const chosen = this.units.get(petId);
    if (chosen) return chosen;
    return thresholdMs >= UNIT_MS.hours ? 'hours' : 'minutes';
  }

  build(app, now) {
    this.lastApp = app;
    const petId = this.petId;
    const pet = app.pets[petId];
    const info = moodAt(pet, now);
    this.el.setAttribute('aria-label', `${pet.name}'s menu`);

    this.el.replaceChildren(
      this.buildHeader(pet, petId, info),
      this.buildStatus(pet, info, petId, now),
      this.buildHunger(pet, petId, info),
      this.buildWardrobe(pet, petId),
      this.buildHistory(pet, now)
    );
  }

  buildHeader(pet, petId, info) {
    const header = document.createElement('div');
    header.className = 'prpets-menu-header';
    header.innerHTML = `
      <span class="prpets-menu-portrait">${petSvg(pet, info.mood, { size: 46, decorate: false })}</span>
      <label class="prpets-field">
        <span class="prpets-field-label">Name</span>
        <input class="prpets-name-input" data-field="name" type="text"
               maxlength="${MAX_NAME_LENGTH}" spellcheck="false" autocomplete="off">
      </label>`;
    // Set through the property, not the attribute, so a name containing
    // quotes cannot break out of the markup above.
    const input = header.querySelector('[data-field="name"]');
    input.value = pet.name;
    input.addEventListener('input', () => this.handlers.onRename(petId, input.value));

    this.portraitEl = header.querySelector('.prpets-menu-portrait');
    this.portraitMood = info.mood;
    return header;
  }

  buildStatus(pet, info, petId, now) {
    const status = document.createElement('p');
    status.className = 'prpets-menu-status';
    status.textContent = statusText(pet, info, petId, now);
    this.statusEl = status;
    return status;
  }

  /**
   * "Gets hungry every [ 3 ] [hours]".
   *
   * The field always shows the value actually in force — 3 hours to begin
   * with, then this pet's own average once it has one. Typing pins it, and it
   * stays pinned until the revert button hands it back to the average. That
   * button only appears when there is something to revert, because an
   * always-present control implying a mode you are not in is just noise.
   */
  buildHunger(pet, petId, info) {
    const unit = this.unitFor(petId, info.thresholdMs);
    const perUnit = UNIT_MS[unit];
    const pinned = pet.hangerOverrideMs !== null;

    const section = document.createElement('div');
    section.className = 'prpets-section';
    section.innerHTML = `
      <h3 class="prpets-section-title">Gets hungry every</h3>
      <div class="prpets-hunger-row">
        <input class="prpets-amount-input" data-field="amount" type="number"
               inputmode="decimal"
               min="${trim(MIN_HANGER_OVERRIDE_MS / perUnit)}"
               max="${trim(MAX_HANGER_OVERRIDE_MS / perUnit)}"
               step="any">
        <select class="prpets-unit-select" data-field="unit" aria-label="Units">
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
        </select>
      </div>`;

    // `step` is deliberately "any". A stepped field validates against
    // `min + n * step`, and `min` here is 5 minutes — 0.08 of an hour — so a
    // learned average of 9 hours is not on the grid and the browser paints the
    // field red and refuses it. Marking the extension's own default invalid is
    // worse than losing the spinner arrows' fixed increment; min and max still
    // do the real work, and setHangerOverride clamps whatever arrives.
    const amount = section.querySelector('[data-field="amount"]');
    const unitSelect = section.querySelector('[data-field="unit"]');

    amount.value = trim(info.thresholdMs / perUnit);
    amount.classList.toggle('is-inherited', !pinned);
    amount.setAttribute(
      'aria-label',
      `How often ${pet.name} gets hungry, in ${unit}`
    );
    unitSelect.value = unit;

    amount.addEventListener('input', () => {
      const value = Number(amount.value);
      // Mid-typing the box is briefly empty, or "1" on the way to "180".
      // Committing those would fight the user for the caret, so nothing
      // out of range is written; the input's own min/max is what flags it.
      if (amount.value.trim() === '' || !Number.isFinite(value)) return;
      const ms = Math.round(value * UNIT_MS[unitSelect.value]);
      if (ms < MIN_HANGER_OVERRIDE_MS || ms > MAX_HANGER_OVERRIDE_MS) return;
      this.handlers.onSetHangerOverride(petId, ms);
    });

    // Switching units re-expresses the same duration rather than changing it:
    // 180 minutes becomes 3 hours, and storage is not touched.
    unitSelect.addEventListener('change', () => {
      this.units.set(petId, unitSelect.value === 'hours' ? 'hours' : 'minutes');
      if (this.lastApp) this.build(this.lastApp, Date.now());
      this.el.querySelector('[data-field="unit"]')?.focus({ preventScroll: true });
    });

    if (pinned) {
      const revert = document.createElement('button');
      revert.type = 'button';
      revert.className = 'prpets-revert';
      revert.dataset.field = 'revert';
      revert.textContent = 'Revert to my average';
      revert.addEventListener('click', () => this.handlers.onSetHangerOverride(petId, null));
      section.append(revert);
    }

    const note = document.createElement('p');
    note.className = 'prpets-menu-note';
    note.textContent = hungerNote(pet, info);
    section.append(note);

    return section;
  }

  buildWardrobe(pet, petId) {
    const wardrobe = document.createElement('div');
    wardrobe.className = 'prpets-section';
    wardrobe.innerHTML = `<h3 class="prpets-section-title">Accessories</h3>`;

    const chips = document.createElement('div');
    chips.className = 'prpets-chips';
    for (const id of ACCESSORY_IDS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'prpets-chip';
      // Named so `refresh` can put focus back on this chip after the toggle
      // rebuilds the panel. Without it a keyboard user is dropped on <body>
      // and has to tab back in for every single accessory.
      chip.dataset.field = `accessory:${id}`;
      chip.textContent = ACCESSORY_LABELS[id];
      chip.setAttribute('aria-pressed', String(pet.accessories.includes(id)));
      chip.addEventListener('click', () => this.handlers.onToggleAccessory(petId, id));
      chips.append(chip);
    }
    wardrobe.append(chips);
    return wardrobe;
  }

  buildHistory(pet, now) {
    const history = document.createElement('div');
    history.className = 'prpets-section';
    history.innerHTML = `<h3 class="prpets-section-title">Feeding history</h3>`;

    const data = dailyCounts(pet, now, { maxDays: 30 });
    history.append(feedingChart(data, pet.name));

    const note = document.createElement('p');
    note.className = 'prpets-menu-note';
    note.textContent = historyNote(data, pet);
    history.append(note);

    return history;
  }
}

/* ------------------------------------------------------------------ copy */

function statusText(pet, info, petId, now) {
  const earns = PET_DEFAULTS[petId]?.earns ?? 'helping out';
  const treats = pet.feedings.length;
  const count = treats === 1 ? '1 treat' : `${treats} treats`;

  if (treats === 0) return `No treats yet — ${pet.name} gets one for ${earns}.`;
  if (info.mood === MOOD.HANGRY) {
    return `${count} so far. Hangry since ${formatDuration(now - info.hangryAt)} ago — ` +
      `a treat for ${earns} would fix it.`;
  }
  return `${count} so far. Hungry again in about ${formatDuration(info.hangryAt - now)}.`;
}

/** Explain where the number in the field came from, in one line. */
function hungerNote(pet, info) {
  if (info.source === THRESHOLD_SOURCE.OVERRIDE) {
    const average = formatDuration(info.learnedMs);
    return pet.feedings.length < 2
      ? `You set this. ${pet.name} has no average yet — reverting would use 3h.`
      : `You set this. ${pet.name}'s own average is ${average}.`;
  }
  if (info.source === THRESHOLD_SOURCE.DEFAULT) {
    return `Starting at 3h. This becomes ${pet.name}'s own average once there are ` +
      `a couple of treats to measure. Type to set it yourself.`;
  }
  return `${pet.name}'s average time between treats. Type to set it yourself.`;
}

/**
 * Say out loud when the chart is not the whole story. A window that silently
 * drops older days reads as "this is everything", which it is not.
 */
function historyNote(data, pet) {
  if (data.omittedDays > 0) {
    return (
      `Showing the last ${data.days.length} days; ` +
      `${data.omittedTreats} earlier ${data.omittedTreats === 1 ? 'treat' : 'treats'} ` +
      `across ${data.omittedDays} older days are not shown.`
    );
  }
  return `Every day since ${pet.name} moved in.`;
}

/* --------------------------------------------------------------- helpers */

/** Round for display without leaving "2.5000000000000004" in a text field. */
function trim(value) {
  return String(Math.round(value * 100) / 100);
}

/** Does this control carry text the user could be part-way through editing? */
function hasTextValue(el) {
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Make a `data-field` value safe to drop inside a quoted attribute selector.
 * The accessory fields carry a colon, and a name could in principle carry
 * anything, so neither is pasted in raw.
 */
function cssEscape(value) {
  return String(value).replace(/(["\\])/g, '\\$1');
}

function safeSelectionStart(el) {
  try {
    return el.selectionStart;
  } catch {
    return null; // number inputs have no selection API
  }
}

function safeSetCaret(el, caret) {
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    /* not a text-like input; focus alone is enough */
  }
}
