import test from 'node:test';
import assert from 'node:assert/strict';

import { classify, shouldShowPets, prSlug, PAGE } from '../src/content/github.js';

test('a pull request page is recognised, on every tab', () => {
  for (const suffix of ['', '/files', '/commits', '/checks', '/files#diff-abc']) {
    const result = classify(`https://github.com/acme/web/pull/412${suffix}`);
    assert.equal(result.page, PAGE.PULL, suffix || '(conversation)');
    assert.equal(result.owner, 'acme');
    assert.equal(result.repo, 'web');
    assert.equal(result.number, 412);
  }
});

test('a repository pull request list is recognised, filters and all', () => {
  assert.equal(classify('https://github.com/acme/web/pulls').page, PAGE.PULL_LIST);
  assert.equal(
    classify('https://github.com/acme/web/pulls?q=is%3Aopen+is%3Apr').page,
    PAGE.PULL_LIST
  );
});

test('the compare page is recognised — it is where pull requests are born', () => {
  assert.equal(classify('https://github.com/acme/web/compare').page, PAGE.COMPARE);
  assert.equal(classify('https://github.com/acme/web/compare/main...topic').page, PAGE.COMPARE);
});

test('the cross-repo dashboard is its own thing', () => {
  assert.equal(classify('https://github.com/pulls').page, PAGE.PULL_DASHBOARD);
});

test("GitHub's own pages are never mistaken for a repo", () => {
  const notRepos = [
    'https://github.com/settings/pulls',
    'https://github.com/notifications',
    'https://github.com/marketplace/actions/thing',
    'https://github.com/orgs/acme/pulls',
    'https://github.com/explore',
  ];
  for (const url of notRepos) {
    assert.notEqual(classify(url).page, PAGE.PULL_LIST, url);
    assert.notEqual(classify(url).page, PAGE.PULL, url);
  }
});

test('other repository pages get no pets', () => {
  const quiet = [
    'https://github.com/acme/web',
    'https://github.com/acme/web/issues',
    'https://github.com/acme/web/issues/412',
    'https://github.com/acme/web/blob/main/README.md',
    'https://github.com/acme/web/pull/abc',
    'https://github.com/acme',
    'https://github.com/',
  ];
  for (const url of quiet) {
    assert.equal(shouldShowPets(url), false, url);
  }
});

test('pets appear on exactly the pages the brief asks for', () => {
  const noisy = [
    'https://github.com/acme/web/pulls',
    'https://github.com/acme/web/pull/1',
    'https://github.com/acme/web/pull/1/files',
    'https://github.com/acme/web/compare/main...topic',
    'https://github.com/pulls',
  ];
  for (const url of noisy) {
    assert.equal(shouldShowPets(url), true, url);
  }
});

test('a trailing slash changes nothing', () => {
  assert.equal(classify('https://github.com/acme/web/pull/9/').page, PAGE.PULL);
  assert.equal(classify('https://github.com/acme/web/pulls/').page, PAGE.PULL_LIST);
});

test('rubbish input is classified, not thrown at', () => {
  for (const bad of ['', 'not a url', '::::']) {
    assert.doesNotThrow(() => classify(bad));
  }
});

test('the slug is stable — it is what makes feeding idempotent', () => {
  const a = classify('https://github.com/acme/web/pull/412');
  const b = classify('https://github.com/acme/web/pull/412/files?w=1');
  assert.equal(prSlug(a), prSlug(b));
  assert.equal(prSlug(a), 'acme/web#412');
});
