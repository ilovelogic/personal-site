/**
 * github — where are we, in GitHub's URL space?
 *
 * Pure module: a string in, a description out. Splitting this out from the DOM
 * sniffing in events.js means the "which pages get pets" rule — the part of
 * the spec most likely to be argued about — can be tested exhaustively against
 * a list of URLs, with no browser involved.
 */

/**
 * Top-level paths that are GitHub's own, not a user's. Without this,
 * "/settings/pulls" would look like the repo `pulls` owned by `settings`.
 */
const RESERVED_OWNERS = new Set([
  'about', 'account', 'apps', 'codespaces', 'collections', 'contact', 'dashboard',
  'enterprise', 'explore', 'features', 'gist', 'issues', 'login', 'logout',
  'marketplace', 'new', 'notifications', 'organizations', 'orgs', 'pricing',
  'pulls', 'search', 'security', 'sessions', 'settings', 'sponsors', 'stars',
  'topics', 'trending', 'users', 'watching',
]);

export const PAGE = Object.freeze({
  /** One pull request — Conversation, Commits, Checks or Files. */
  PULL: 'pull',
  /** A repository's pull request list. */
  PULL_LIST: 'pull-list',
  /** The cross-repo "Your pull requests" dashboard. */
  PULL_DASHBOARD: 'pull-dashboard',
  /** The compare / "Open a pull request" page — where PRs are born. */
  COMPARE: 'compare',
  /** Anywhere else on github.com. */
  OTHER: 'other',
});

/**
 * Classify a URL.
 *
 * @param {string} href  a full URL or a path
 * @returns {{page: string, owner?: string, repo?: string, number?: number}}
 */
export function classify(href) {
  let path;
  try {
    path = new URL(href, 'https://github.com').pathname;
  } catch {
    return { page: PAGE.OTHER };
  }
  const clean = path.replace(/\/+$/, '') || '/';

  if (clean === '/pulls') return { page: PAGE.PULL_DASHBOARD };

  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 3) return { page: PAGE.OTHER };

  const [owner, repo, section, ...rest] = parts;
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return { page: PAGE.OTHER };

  if (section === 'pull' && /^\d+$/.test(rest[0] ?? '')) {
    return { page: PAGE.PULL, owner, repo, number: Number(rest[0]) };
  }
  if (section === 'pulls') return { page: PAGE.PULL_LIST, owner, repo };
  if (section === 'compare') return { page: PAGE.COMPARE, owner, repo };

  return { page: PAGE.OTHER };
}

/**
 * Should the pets be on screen here?
 *
 * The brief asks for every PR page of a repo and every tab of an individual
 * PR. The compare page is included too, because that is the page where Toby's
 * treat is earned — a pet that vanishes at the exact moment you feed it would
 * be a strange thing to build.
 */
export function shouldShowPets(href) {
  const { page } = classify(href);
  return page === PAGE.PULL || page === PAGE.PULL_LIST || page === PAGE.COMPARE ||
    page === PAGE.PULL_DASHBOARD;
}

/** "acme/web#412" — the stable half of a feeding event id. */
export function prSlug(context) {
  return `${context.owner}/${context.repo}#${context.number}`;
}
