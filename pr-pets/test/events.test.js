import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPEN_GRACE_MS,
  REVIEW_DEDUPE_MS,
  detectOpenedPr,
  detectReviewSubmit,
  detectCreatePrClick,
  prIsOpen,
  prAuthoredByViewer,
} from '../src/content/events.js';

/**
 * These fakes stand in for GitHub's DOM.
 *
 * What they can prove is the *decision logic*: the grace window, the
 * authorship rule, the open-state rule, and — most importantly — that two
 * different routes to the same event produce the same id. What they cannot
 * prove is that the selector strings still match GitHub's markup; only a real
 * page can say that, which is why every detector is written to fall back
 * rather than to trust one selector.
 */
function fakeDoc({ user = 'anne', state = 'Open', openedAt = null, author = null } = {}) {
  const times = openedAt === null ? [] : [].concat(openedAt).map((t) => ({
    getAttribute: () => new Date(t).toISOString(),
  }));

  const header = {
    querySelector: (sel) => {
      if (sel.includes('.author')) return author ? { textContent: author } : null;
      if (sel.includes('hovercard')) return author ? { textContent: author } : null;
      return null;
    },
    querySelectorAll: () => times,
  };

  return {
    querySelector: (sel) => {
      if (sel.includes('user-login') || sel.includes('actor-login')) {
        return user ? { content: user } : null;
      }
      if (sel === '.gh-header-meta') return header;
      if (sel.includes('header-state')) return state ? { textContent: state } : null;
      return null;
    },
    querySelectorAll: () => [],
  };
}

function fakeButton({ label = '', testId = null, formAction = null } = {}) {
  const button = {
    textContent: label,
    value: '',
    getAttribute: (name) => (name === 'data-testid' ? testId : null),
    form: formAction ? { getAttribute: (name) => (name === 'action' ? formAction : null) } : null,
  };
  button.closest = () => button;
  return button;
}

const PR_URL = 'https://github.com/acme/web/pull/412';
const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

/* ------------------------------------------------------------ opening a PR */

test('landing on a pull request you just opened earns Toby a treat', () => {
  const doc = fakeDoc({ user: 'anne', author: 'anne', openedAt: NOW - 20_000 });
  assert.equal(detectOpenedPr(doc, PR_URL, NOW), 'opened:acme/web#412');
});

test('reading an old pull request does not', () => {
  const doc = fakeDoc({ user: 'anne', author: 'anne', openedAt: NOW - 5 * 24 * 3600 * 1000 });
  assert.equal(detectOpenedPr(doc, PR_URL, NOW), null);
});

test('the grace window is the boundary, and it is exclusive on the far side', () => {
  const inside = fakeDoc({ author: 'anne', openedAt: NOW - (OPEN_GRACE_MS - 1000) });
  const outside = fakeDoc({ author: 'anne', openedAt: NOW - (OPEN_GRACE_MS + 1000) });

  assert.ok(detectOpenedPr(inside, PR_URL, NOW));
  assert.equal(detectOpenedPr(outside, PR_URL, NOW), null);
});

test("a teammate's brand-new pull request is not your treat", () => {
  const doc = fakeDoc({ user: 'anne', author: 'someone-else', openedAt: NOW - 10_000 });
  assert.equal(detectOpenedPr(doc, PR_URL, NOW), null);
});

test('unknown authorship still counts — freshness has already done the work', () => {
  const doc = fakeDoc({ user: 'anne', author: null, openedAt: NOW - 10_000 });
  assert.ok(detectOpenedPr(doc, PR_URL, NOW));
});

test('the compare-page hint feeds Toby even when the header cannot be read', () => {
  const blind = fakeDoc({ user: null, author: null, openedAt: null });
  const hint = { owner: 'acme', repo: 'web', at: NOW - 4000 };

  assert.equal(detectOpenedPr(blind, PR_URL, NOW), null, 'no DOM evidence on its own');
  assert.equal(detectOpenedPr(blind, PR_URL, NOW, hint), 'opened:acme/web#412');
});

test('a stale or mismatched hint is ignored', () => {
  const blind = fakeDoc({ user: null, author: null, openedAt: null });
  const old = { owner: 'acme', repo: 'web', at: NOW - OPEN_GRACE_MS - 1 };
  const elsewhere = { owner: 'other', repo: 'repo', at: NOW - 1000 };

  assert.equal(detectOpenedPr(blind, PR_URL, NOW, old), null);
  assert.equal(detectOpenedPr(blind, PR_URL, NOW, elsewhere), null);
});

test('both routes agree on the id, so they can never double-feed', () => {
  const viaDom = detectOpenedPr(
    fakeDoc({ author: 'anne', openedAt: NOW - 5000 }),
    `${PR_URL}/files`,
    NOW
  );
  const viaHint = detectOpenedPr(fakeDoc({ user: null }), PR_URL, NOW, {
    owner: 'acme',
    repo: 'web',
    at: NOW - 5000,
  });
  assert.equal(viaDom, viaHint);
});

test('pages that are not a pull request never earn a treat', () => {
  const doc = fakeDoc({ author: 'anne', openedAt: NOW - 1000 });
  for (const url of [
    'https://github.com/acme/web/pulls',
    'https://github.com/acme/web/issues/412',
    'https://github.com/acme/web',
  ]) {
    assert.equal(detectOpenedPr(doc, url, NOW), null, url);
  }
});

test('the earliest header timestamp wins — a PR predates its own comments', () => {
  const doc = fakeDoc({
    author: 'anne',
    openedAt: [NOW - 10 * 24 * 3600 * 1000, NOW - 5000],
  });
  assert.equal(detectOpenedPr(doc, PR_URL, NOW), null, 'the old one is the opening time');
});

/* ---------------------------------------------------------- creating a PR */

test('pressing "Create pull request" on the compare page leaves a hint', () => {
  const button = fakeButton({ label: 'Create pull request' });
  const url = 'https://github.com/acme/web/compare/main...topic';
  assert.deepEqual(detectCreatePrClick(button, url), { owner: 'acme', repo: 'web' });
});

test('draft pull requests count as opening one too', () => {
  const button = fakeButton({ label: 'Create draft pull request' });
  const url = 'https://github.com/acme/web/compare/main...topic';
  assert.ok(detectCreatePrClick(button, url));
});

test('other buttons on the compare page are left alone', () => {
  const url = 'https://github.com/acme/web/compare/main...topic';
  assert.equal(detectCreatePrClick(fakeButton({ label: 'Cancel' }), url), null);
});

/* ------------------------------------------------------ submitting review */

test('submitting a review earns Jibble a treat', () => {
  const doc = fakeDoc();
  const id = detectReviewSubmit(fakeButton({ label: 'Submit review' }), doc, PR_URL, NOW);
  assert.match(id, /^review:acme\/web#412:/);
});

test('the button is found by text, by test id, or by the form it posts to', () => {
  const doc = fakeDoc();
  const variants = [
    fakeButton({ label: 'Submit review' }),
    fakeButton({ label: 'SUBMIT REVIEW' }),
    fakeButton({ testId: 'submit-review-button' }),
    fakeButton({ label: 'Go', formAction: '/acme/web/pull/412/reviews' }),
  ];
  for (const button of variants) {
    assert.ok(detectReviewSubmit(button, doc, PR_URL, NOW), JSON.stringify(button.textContent));
  }
});

test('unrelated buttons on a pull request page are left alone', () => {
  const doc = fakeDoc();
  for (const label of ['Comment', 'Merge pull request', 'Close pull request', 'Add a suggestion']) {
    assert.equal(detectReviewSubmit(fakeButton({ label }), doc, PR_URL, NOW), null, label);
  }
});

test('every way one submission arrives is one treat, but two reviews are two', () => {
  const doc = fakeDoc();
  const button = fakeButton({ label: 'Submit review' });
  // NOW sits exactly on a bucket boundary, so these gaps are unambiguous.
  const at = (offset) => detectReviewSubmit(button, doc, PR_URL, NOW + offset);

  const click = at(0);

  assert.equal(at(200), click, 'a stray second click collapses into the same event');
  assert.equal(at(3_000), click, "the form's own submit event is not a second treat");
  // The old 5-second window let this one through, and a treat 30 seconds after
  // the last one drags the learned average toward zero permanently.
  assert.equal(at(30_000), click, 'a retry after a rejected form is not a second treat');

  assert.notEqual(at(REVIEW_DEDUPE_MS), click, 'a genuine second review is its own event');
});

test('a closed or merged pull request cannot feed the kitten', () => {
  const button = fakeButton({ label: 'Submit review' });
  assert.equal(detectReviewSubmit(button, fakeDoc({ state: 'Merged' }), PR_URL, NOW), null);
  assert.equal(detectReviewSubmit(button, fakeDoc({ state: 'Closed' }), PR_URL, NOW), null);
  assert.ok(detectReviewSubmit(button, fakeDoc({ state: 'Draft' }), PR_URL, NOW));
});

test('an unreadable state is treated as open, not as permanently closed', () => {
  assert.equal(prIsOpen(fakeDoc({ state: null })), true);
});

test('authorship is unknown, not false, when there is nothing to compare', () => {
  assert.equal(prAuthoredByViewer(fakeDoc({ user: null, author: 'anne' })), null);
  assert.equal(prAuthoredByViewer(fakeDoc({ user: 'anne', author: null })), null);
  assert.equal(prAuthoredByViewer(fakeDoc({ user: 'Anne', author: 'anne' })), true);
});
