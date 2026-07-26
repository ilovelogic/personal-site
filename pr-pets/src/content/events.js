/**
 * events — noticing that a treat has been earned.
 *
 * This is the one genuinely hostile part of the extension: GitHub's markup is
 * not an API, it is re-skinned regularly, and half of it is now React with
 * different class names than the half that isn't. Two defences are used
 * throughout:
 *
 *   1. Every detector tries several selectors and gives up gracefully. A
 *      missing element means "I don't know", never a thrown error on a page
 *      the user is trying to work on.
 *   2. Every detector returns a *stable event id* rather than a boolean. Two
 *      different code paths noticing the same PR opening produce the same
 *      string, so appState.recordFeeding collapses them into one treat. This
 *      is what makes it safe to be aggressive about detection: a false
 *      positive on a PR already counted is simply a no-op.
 *
 * DOM in, string or null out — no storage access, no rendering.
 */

import { classify, PAGE, prSlug } from './github.js';

/**
 * How recently a PR must have been created for landing on its page to count
 * as "you just opened it".
 *
 * The window exists because the redirect after clicking "Create pull request"
 * is the most reliable signal available, but merely *reading* an old PR must
 * never feed Toby — otherwise he would never be hungry and the whole thing
 * stops meaning anything.
 */
export const OPEN_GRACE_MS = 3 * 60 * 1000;

/** The signed-in user's login, or null if we cannot tell. */
export function currentUser(doc) {
  return (
    doc.querySelector('meta[name="user-login"]')?.content ||
    doc.querySelector('meta[name="octolytics-actor-login"]')?.content ||
    null
  );
}

/**
 * Is this pull request open?
 *
 * Returns true when the state cannot be determined. Guessing "open" risks an
 * extra treat on a closed PR; guessing "closed" risks a pet that can never be
 * fed again after GitHub renames a class. The first failure is much cheaper.
 */
export function prIsOpen(doc) {
  const el = doc.querySelector(
    '[data-testid="header-state"], .gh-header-meta .State, .gh-header-title .State, .State'
  );
  if (!el) return true;
  return /open|draft/i.test(el.textContent ?? '');
}

/**
 * The instant this PR was opened, from the header's <relative-time>.
 *
 * The header carries several timestamps once there are comments, so the
 * earliest one is taken: the PR cannot have been opened after its own first
 * comment.
 */
export function prOpenedAt(doc) {
  const scope =
    doc.querySelector('.gh-header-meta') ||
    doc.querySelector('[data-testid="issue-metadata-fixed"]') ||
    doc.querySelector('.gh-header') ||
    doc;

  const times = Array.from(scope.querySelectorAll('relative-time[datetime], time[datetime]'))
    .map((el) => Date.parse(el.getAttribute('datetime')))
    .filter((t) => Number.isFinite(t));

  return times.length > 0 ? Math.min(...times) : null;
}

/** Did the signed-in user open this PR? Null when it cannot be determined. */
export function prAuthoredByViewer(doc) {
  const me = currentUser(doc);
  if (!me) return null;

  const scope = doc.querySelector('.gh-header-meta') || doc.querySelector('.gh-header') || doc;
  const author =
    scope.querySelector('.author')?.textContent?.trim() ||
    scope.querySelector('a[data-hovercard-type="user"]')?.textContent?.trim() ||
    null;

  if (!author) return null;
  return author.toLowerCase() === me.toLowerCase();
}

/**
 * "You just opened this pull request" — Toby's treat.
 *
 * Two independent paths lead here, because neither alone is reliable:
 *
 *   a) DOM evidence — the header says this PR is minutes old and authored by
 *      you. Works for PRs opened from the web UI, from `gh pr create`, from an
 *      IDE, or from a push that GitHub turned into a PR link you clicked.
 *   b) A hint left behind when the "Create pull request" form was submitted on
 *      this repo's compare page, consumed on arrival at the new PR. Covers the
 *      case where GitHub has renamed the header markup out from under path (a).
 *
 * Both produce the same id, so belt and braces cost nothing.
 *
 * @param {Document} doc
 * @param {string} href
 * @param {number} now
 * @param {{owner: string, repo: string, at: number}|null} pendingOpen
 * @returns {string|null} an event id, or null if no treat was earned
 */
export function detectOpenedPr(doc, href, now, pendingOpen = null) {
  const context = classify(href);
  if (context.page !== PAGE.PULL) return null;

  const id = `opened:${prSlug(context)}`;

  const hinted =
    pendingOpen &&
    pendingOpen.owner === context.owner &&
    pendingOpen.repo === context.repo &&
    now - pendingOpen.at < OPEN_GRACE_MS;
  if (hinted) return id;

  const openedAt = prOpenedAt(doc);
  if (openedAt === null || now - openedAt > OPEN_GRACE_MS) return null;

  // Freshness alone is not enough — a teammate's brand-new PR is not your
  // treat. Unknown authorship (null) is allowed through: the timestamp has
  // already done most of the filtering.
  if (prAuthoredByViewer(doc) === false) return null;

  return id;
}

/**
 * Was the compare page's "Create pull request" button just pressed?
 *
 * @returns {{owner: string, repo: string}|null} the repo to leave a hint for
 */
export function detectCreatePrClick(target, href) {
  const context = classify(href);
  if (context.page !== PAGE.COMPARE) return null;

  const button = closestButton(target);
  if (!button) return null;
  if (!/create pull request|create draft pull request/i.test(buttonLabel(button))) return null;

  return { owner: context.owner, repo: context.repo };
}

/**
 * How wide a window collapses repeated review submissions into one treat.
 *
 * The old value was 5 seconds, which was too narrow to do its job: the same
 * submission arrives here up to three ways — the click, the form's `submit`,
 * and a retry after GitHub rejects the form — and any two of those more than
 * five seconds apart fed Jibble twice. That is not just a spurious treat: a
 * near-zero gap drags the learned average down, so a phantom treat makes the
 * pet hangrier for good. Ninety seconds swallows every repeat of one
 * submission while still leaving two genuinely separate reviews — which take
 * minutes to write — a treat each.
 */
export const REVIEW_DEDUPE_MS = 90 * 1000;

/**
 * "You just submitted a review" — Jibble's treat.
 *
 * Note the deliberate asymmetry with Toby: reviewing the same PR twice is a
 * normal thing to do and should earn a second treat, so the id carries a
 * coarse time bucket rather than being one-per-PR forever.
 *
 * Bucketing by division means two submissions can still straddle a boundary
 * and count twice. That is the cheap failure and it is the right way round:
 * the alternative — remembering the last submission time per PR — puts a
 * second copy of "when was Jibble last fed" next to the feedings list, and
 * those two would drift.
 *
 * @param {EventTarget} target  what was clicked
 * @param {Document} doc
 * @param {string} href
 * @param {number} now
 * @returns {string|null}
 */
export function detectReviewSubmit(target, doc, href, now) {
  const context = classify(href);
  if (context.page !== PAGE.PULL) return null;
  if (!prIsOpen(doc)) return null;

  const button = closestButton(target);
  if (!button) return null;
  if (!isReviewSubmitButton(button)) return null;

  const bucket = Math.floor(now / REVIEW_DEDUPE_MS);
  return `review:${prSlug(context)}:${bucket}`;
}

const REVIEW_BUTTON_TEXT = /^(submit review|submit your review|submit feedback)$/i;

function isReviewSubmitButton(button) {
  if (REVIEW_BUTTON_TEXT.test(buttonLabel(button))) return true;

  const testId = button.getAttribute('data-testid') ?? '';
  if (/submit-review|review-submit/i.test(testId)) return true;

  // The classic review form posts to /pull/<n>/reviews. Matching the form's
  // action catches the button whatever it happens to be called this month.
  const action = button.form?.getAttribute('action') ?? '';
  if (/\/pull\/\d+\/reviews\b/.test(action)) return true;

  return false;
}

function closestButton(target) {
  if (!target || typeof target.closest !== 'function') return null;
  return target.closest('button, input[type="submit"], [role="button"]');
}

function buttonLabel(button) {
  return (
    button.getAttribute('aria-label') ||
    button.value ||
    button.textContent ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}
