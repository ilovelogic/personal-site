/**
 * loader — the content script proper.
 *
 * Manifest V3 will not load a content script as an ES module, but it will let
 * one dynamically import a web-accessible module. That one line of indirection
 * buys real modules for the entire codebase: named imports, no globals, and a
 * model layer that plain Node can import and test without a browser anywhere
 * in sight.
 */

import(chrome.runtime.getURL('src/content/main.js')).catch((error) => {
  console.warn('[PR Pets] failed to load:', error);
});
