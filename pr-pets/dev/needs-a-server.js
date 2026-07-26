/**
 * Every page in dev/ loads the extension's real source as ES modules. Chrome
 * fetches modules with CORS, and a file:// page has a null origin, so opening
 * one of these by double-clicking it in Finder blocks every import — the
 * static headings render, the script never runs, and the page looks simply
 * empty with the reason buried in the console.
 *
 * This is a *classic* script, not a module, which is exactly why it still runs
 * under file:// and can say so out loud.
 */
(function () {
  if (location.protocol !== 'file:') return;

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.createElement('div');
    panel.setAttribute(
      'style',
      'margin:16px;padding:16px 18px;border:1px solid #d1242f;border-radius:10px;' +
        'background:#fff5f5;color:#1f2328;font:13px/1.5 ui-sans-serif,system-ui,sans-serif;' +
        'max-width:640px'
    );
    panel.innerHTML =
      '<strong>This page needs to be served over http, not opened as a file.</strong>' +
      '<p style="margin:8px 0 0">It imports the extension&rsquo;s source as ES modules, and ' +
      'Chrome blocks module imports on <code>file://</code> pages, so nothing below ' +
      'this box will draw.</p>' +
      '<p style="margin:8px 0 0">Start the dev server from the <code>pr-pets</code> folder:</p>' +
      '<pre style="margin:6px 0 0;padding:8px 10px;background:#eff1f3;border-radius:6px;' +
      'overflow-x:auto">python3 -m http.server 4177</pre>' +
      '<p style="margin:8px 0 0">then open <a href="http://localhost:4177/dev/">' +
      'http://localhost:4177/dev/</a> and pick this page from there.</p>' +
      '<p style="margin:8px 0 0;color:#59636e">This affects the development pages only. ' +
      'The extension itself is unaffected &mdash; Chrome loads an installed extension&rsquo;s ' +
      'modules over <code>chrome-extension://</code>, which has a real origin.</p>';

    document.body.insertBefore(panel, document.body.firstChild);
  });
})();
