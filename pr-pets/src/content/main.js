/**
 * main — the controller. The only module that is allowed to know about all
 * three of storage, the DOM, and the clock.
 *
 * Everything it does is a loop of the same four steps: notice something, ask a
 * pure function what that means, hand the result to the store, and re-render
 * from whatever the store now says. It never keeps its own copy of the truth
 * — `this.app` is a cache of the last thing storage told us, replaced whole
 * on every change, so a second tab feeding Jibble updates this one for free.
 */

import * as Store from '../storage/store.js';
import * as App from '../model/appState.js';
import { msUntilNextChange } from '../model/mood.js';
import { shouldShowPets } from './github.js';
import { detectOpenedPr, detectReviewSubmit, detectCreatePrClick } from './events.js';
import { PetCard } from '../view/petCard.js';
import { PetMenu } from '../view/menu.js';

/**
 * GitHub renders a freshly created PR's header asynchronously, so the check
 * for "did you just open this?" is retried on a short ladder rather than run
 * once and given up on.
 */
const OPEN_CHECK_DELAYS_MS = [0, 700, 1800, 3600];

/** How often to notice a single-page-app navigation. */
const URL_POLL_MS = 700;

/** Debounce on the name field: one write per pause, not one per keystroke. */
const RENAME_DEBOUNCE_MS = 250;

const PENDING_OPEN_KEY = 'prpets:pendingOpen';

class Controller {
  constructor() {
    this.app = null;
    this.mounted = false;
    this.url = location.href;
    this.tickTimer = null;
    /**
     * Debounce timers, keyed by `${field}:${petId}`. One timer per field per
     * pet: a single shared timer meant that starting to edit Jibble while
     * Toby's rename was still pending cancelled Toby's write outright.
     */
    this.debounces = new Map();
    this.openChecks = [];

    this.root = document.createElement('div');
    this.root.className = 'prpets-root';
    this.root.dataset.prpets = 'root';

    this.stack = document.createElement('div');
    this.stack.className = 'prpets-stack';

    this.cards = new Map();
    for (const petId of App.PET_IDS) {
      const card = new PetCard(petId, { onActivate: (id) => this.toggleMenu(id) });
      this.cards.set(petId, card);
      this.stack.append(card.el);
    }

    this.menu = new PetMenu({
      onRename: (petId, name) => this.renamePet(petId, name),
      onToggleAccessory: (petId, accessoryId) =>
        this.write((app) => App.toggleAccessory(app, petId, accessoryId)),
      onSetHangerOverride: (petId, ms) => this.setHangerOverride(petId, ms),
      onClose: () => this.closeMenu(),
    });

    this.root.append(this.stack, this.menu.el);
  }

  async start() {
    this.app = await Store.read();
    Store.subscribe((app) => {
      this.app = app;
      this.syncMounted();
      this.render();
    });

    this.listen();
    this.syncMounted();
    this.render();
    this.checkForOpenedPr();
  }

  /* ------------------------------------------------------------ mounting */

  /** Pets belong on PR pages, and only while the extension is switched on. */
  syncMounted() {
    const wanted = Boolean(this.app?.enabled) && shouldShowPets(location.href);
    if (wanted === this.mounted) return;

    if (wanted) {
      document.body.append(this.root);
      this.mounted = true;
    } else {
      this.closeMenu();
      this.root.remove();
      this.mounted = false;
    }
  }

  render() {
    if (!this.mounted || !this.app) return;
    const now = Date.now();
    for (const card of this.cards.values()) card.render(this.app, now);
    this.menu.refresh(this.app, now);
    this.scheduleTick(now);
  }

  /**
   * Re-render at the next instant a mood could change, rather than on a timer.
   *
   * `msUntilNextChange` knows when that is — the end of a happy window, or the
   * moment hangriness begins — so a pet that is three hours from its next
   * change costs nothing until then, and one that is two seconds away is
   * exact.
   */
  scheduleTick(now) {
    clearTimeout(this.tickTimer);
    const next = Math.min(
      ...App.PET_IDS.map((id) => msUntilNextChange(this.app.pets[id], now))
    );
    this.tickTimer = setTimeout(() => this.render(), Math.max(1000, Math.min(next, 60_000)));
  }

  /* -------------------------------------------------------------- events */

  listen() {
    // Capture phase: GitHub's own handlers sometimes stop propagation, and a
    // treat should not depend on losing that race.
    document.addEventListener('click', (event) => this.onClick(event), true);
    document.addEventListener('submit', (event) => this.onSubmit(event), true);

    // Clicking anywhere else closes the menu; the menu itself stops its own
    // clicks from reaching here.
    document.addEventListener('click', () => this.closeMenu());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeMenu();
    });

    // GitHub is a single-page app in some places and a full page load in
    // others, so watch for both.
    document.addEventListener('turbo:load', () => this.onNavigate());
    window.addEventListener('popstate', () => this.onNavigate());
    setInterval(() => {
      if (location.href !== this.url) this.onNavigate();
    }, URL_POLL_MS);
  }

  onNavigate() {
    if (location.href === this.url) return;
    this.url = location.href;
    this.closeMenu();
    this.syncMounted();
    this.render();
    this.checkForOpenedPr();
  }

  onClick(event) {
    const now = Date.now();

    const created = detectCreatePrClick(event.target, location.href);
    if (created) this.leaveOpenHint(created, now);

    const reviewEvent = detectReviewSubmit(event.target, document, location.href, now);
    if (reviewEvent) this.feed('jibble', reviewEvent);
  }

  onSubmit(event) {
    // The classic review form can be submitted from the keyboard, which never
    // produces a click on the button.
    const action = event.target?.getAttribute?.('action') ?? '';
    if (/\/pull\/\d+\/reviews\b/.test(action)) {
      const now = Date.now();
      const reviewEvent = detectReviewSubmit(
        event.target.querySelector('button[type="submit"], button') ?? event.target,
        document,
        location.href,
        now
      );
      if (reviewEvent) this.feed('jibble', reviewEvent);
    }
  }

  /**
   * Look for "you just opened this PR", several times, because the header may
   * not have rendered yet.
   *
   * Running the check repeatedly is safe: every run produces the same event id
   * for the same PR, and recordFeeding counts an id at most once.
   */
  checkForOpenedPr() {
    for (const timer of this.openChecks) clearTimeout(timer);
    this.openChecks = OPEN_CHECK_DELAYS_MS.map((delay) =>
      setTimeout(() => {
        const eventId = detectOpenedPr(document, location.href, Date.now(), this.readOpenHint());
        if (eventId) {
          this.clearOpenHint();
          this.feed('toby', eventId);
        }
      }, delay)
    );
  }

  /* --------------------------------------------------------------- state */

  /**
   * Every write goes through here so that a storage failure is reported once
   * and then dropped. Nothing in this extension is worth an unhandled
   * rejection in the console of the page someone is trying to work on.
   */
  write(mutate) {
    return Store.update(mutate).catch((error) => {
      console.warn('[PR Pets] could not save:', error);
      return this.app;
    });
  }

  /** Run `fn` once the user has paused, per field and per pet. */
  debounce(key, fn) {
    clearTimeout(this.debounces.get(key));
    this.debounces.set(key, setTimeout(fn, RENAME_DEBOUNCE_MS));
  }

  async feed(petId, eventId) {
    // `recordFeeding` reports whether the id was new. Ask it, rather than
    // comparing documents before and after: `Store.update` resolves with a
    // document rebuilt by `fromJSON`, so it is a fresh object every time and
    // never compares equal — which made the old check always say "changed"
    // and re-render on all four rungs of the opened-PR ladder.
    let fed = false;
    this.app = await this.write((app) => {
      const result = App.recordFeeding(app, petId, eventId, Date.now());
      fed = result.fed;
      return result.app;
    });
    if (fed) this.render();
  }

  renamePet(petId, name) {
    this.debounce(`name:${petId}`, () =>
      this.write((app) => App.renamePet(app, petId, name))
    );
  }

  /** Debounced for the same reason as renaming: one write per pause. */
  setHangerOverride(petId, ms) {
    this.debounce(`hanger:${petId}`, () =>
      this.write((app) => App.setHangerOverride(app, petId, ms))
    );
  }

  /* ---------------------------------------------------------------- menu */

  toggleMenu(petId) {
    if (this.menu.isOpen && this.menu.petId === petId) {
      this.closeMenu();
      return;
    }
    this.menu.el.dataset.petId = petId;
    this.menu.open(petId, this.app, Date.now());
    for (const [id, card] of this.cards) card.setMenuOpen(id === petId);
  }

  closeMenu() {
    if (!this.menu.isOpen) return;
    this.menu.close();
    for (const card of this.cards.values()) card.setMenuOpen(false);
  }

  /* ------------------------------------------------------ the open "hint" */

  /**
   * A note left on the compare page and read on the PR page it redirects to.
   *
   * sessionStorage is the right lifetime here: the hint is meaningful only for
   * this tab and only for the next few seconds, and it should not outlive the
   * tab the way chrome.storage would.
   */
  leaveOpenHint({ owner, repo }, at) {
    try {
      sessionStorage.setItem(PENDING_OPEN_KEY, JSON.stringify({ owner, repo, at }));
    } catch {
      /* Private mode, quota, a page that blocks it — the DOM path still works. */
    }
  }

  readOpenHint() {
    try {
      const raw = sessionStorage.getItem(PENDING_OPEN_KEY);
      if (!raw) return null;
      const hint = JSON.parse(raw);
      return typeof hint?.owner === 'string' && Number.isFinite(hint?.at) ? hint : null;
    } catch {
      return null;
    }
  }

  clearOpenHint() {
    try {
      sessionStorage.removeItem(PENDING_OPEN_KEY);
    } catch {
      /* nothing to do */
    }
  }
}

new Controller().start().catch((error) => {
  // Never let a failure here interfere with the page the user is working on.
  console.warn('[PR Pets] could not start:', error);
});
