/**
 * chart — treats per day, since the extension was installed.
 *
 * A column chart, because the question is "how has this changed over time"
 * and the x-axis is days. One series, so there is no legend: the heading above
 * it already says whose treats these are, and a legend box with a single
 * swatch would just restate it in a panel that is 252px wide.
 *
 * Colours come from CSS custom properties rather than being baked in, so the
 * same markup follows GitHub between light and dark themes.
 */

import { shortDate, longDate } from '../model/history.js';

const W = 252;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 74;
const PLOT_LEFT = 20;
const PLOT_RIGHT = W - 4;
const H = 92;
const MAX_BAR_W = 20;
const GAP = 2; // surface gap between adjacent columns
const CAP_R = 4; // rounded data-end; the baseline end stays square

/**
 * @param {object} data  the result of history.dailyCounts
 * @param {string} petName
 * @returns {HTMLElement} a figure, with hover handling already wired up
 */
export function feedingChart(data, petName) {
  const figure = document.createElement('figure');
  figure.className = 'prpets-chart';

  const { days } = data;
  const yMax = Math.max(1, data.max);
  const plotW = PLOT_RIGHT - PLOT_LEFT;
  const band = plotW / Math.max(1, days.length);
  const barW = Math.max(2, Math.min(MAX_BAR_W, band - GAP));
  const scale = (count) => ((PLOT_BOTTOM - PLOT_TOP) * count) / yMax;

  const peakIndex = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);

  const bars = days
    .map((day, i) => {
      const x = PLOT_LEFT + band * i + (band - barW) / 2;
      if (day.count === 0) return '';
      const h = scale(day.count);
      const r = Math.min(CAP_R, h);
      const y = PLOT_BOTTOM - h;
      return `<path d="M${x} ${PLOT_BOTTOM} V${y + r} Q${x} ${y} ${x + r} ${y}
        H${x + barW - r} Q${x + barW} ${y} ${x + barW} ${y + r} V${PLOT_BOTTOM} Z"
        fill="var(--prpets-accent)"/>`;
    })
    .join('');

  // Exactly one direct label — on the tallest column — and only when there is
  // room above it. A number on every column is unreadable at this size, and
  // the tooltip carries the rest.
  const peak = days[peakIndex];
  const peakLabel =
    peak && peak.count > 0 && scale(peak.count) > 12
      ? `<text x="${PLOT_LEFT + band * peakIndex + band / 2}"
              y="${PLOT_BOTTOM - scale(peak.count) - 3}" text-anchor="middle"
              class="prpets-chart-value">${peak.count}</text>`
      : '';

  const xLabels = axisLabels(days, band);

  const hitAreas = days
    .map(
      (day, i) =>
        `<rect class="prpets-chart-hit" data-i="${i}" x="${PLOT_LEFT + band * i}"
           y="${PLOT_TOP}" width="${band}" height="${PLOT_BOTTOM - PLOT_TOP}"
           fill="transparent"/>`
    )
    .join('');

  figure.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
         aria-label="${escape(petName)}'s treats per day, ${data.total} in total">
      <line x1="${PLOT_LEFT}" y1="${PLOT_TOP}" x2="${PLOT_RIGHT}" y2="${PLOT_TOP}"
            stroke="var(--prpets-grid)" stroke-width="1"/>
      <line x1="${PLOT_LEFT}" y1="${PLOT_BOTTOM}" x2="${PLOT_RIGHT}" y2="${PLOT_BOTTOM}"
            stroke="var(--prpets-grid)" stroke-width="1"/>
      <text x="${PLOT_LEFT - 5}" y="${PLOT_TOP + 4}" text-anchor="end"
            class="prpets-chart-tick">${yMax}</text>
      <text x="${PLOT_LEFT - 5}" y="${PLOT_BOTTOM + 3}" text-anchor="end"
            class="prpets-chart-tick">0</text>
      ${bars}
      ${peakLabel}
      ${xLabels}
      ${hitAreas}
    </svg>
    <div class="prpets-chart-tip" hidden></div>
    ${srTable(days, petName)}`;

  wireTooltip(figure, days, band);
  return figure;
}

/**
 * First and last day always; the middle one too if it will not collide.
 * Labelling every column at 252px wide produces a grey smear.
 */
function axisLabels(days, band) {
  if (days.length === 0) return '';
  const y = PLOT_BOTTOM + 14;
  const at = (i, anchor) =>
    `<text x="${clampX(PLOT_LEFT + band * i + band / 2, anchor)}" y="${y}"
       text-anchor="${anchor}" class="prpets-chart-tick">${shortDate(days[i].date)}</text>`;

  const parts = [at(0, 'start')];
  if (days.length > 2) {
    const mid = Math.floor(days.length / 2);
    if (band * (mid - 0) > 42 && band * (days.length - 1 - mid) > 42) {
      parts.push(at(mid, 'middle'));
    }
  }
  if (days.length > 1) parts.push(at(days.length - 1, 'end'));
  return parts.join('');
}

function clampX(x, anchor) {
  if (anchor === 'start') return Math.max(PLOT_LEFT, x - 8);
  if (anchor === 'end') return Math.min(PLOT_RIGHT, x + 8);
  return x;
}

/**
 * The same numbers as text. The chart is the quick read; this is what a screen
 * reader and a "what exactly was that column" question both need.
 */
function srTable(days, petName) {
  const rows = days
    .map((d) => `<tr><th scope="row">${longDate(d.date)}</th><td>${d.count}</td></tr>`)
    .join('');
  return `<table class="prpets-sr">
    <caption>${escape(petName)}'s treats per day</caption>
    <thead><tr><th scope="col">Day</th><th scope="col">Treats</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function wireTooltip(figure, days, band) {
  const svg = figure.querySelector('svg');
  const tip = figure.querySelector('.prpets-chart-tip');

  const show = (index) => {
    const day = days[index];
    if (!day) return;
    tip.textContent = `${longDate(day.date)} — ${day.count} ${day.count === 1 ? 'treat' : 'treats'}`;
    tip.hidden = false;
    const centre = (PLOT_LEFT + band * index + band / 2) / W;
    tip.style.left = `${Math.min(0.82, Math.max(0.18, centre)) * 100}%`;
  };

  svg.addEventListener('mouseover', (event) => {
    const hit = event.target.closest?.('.prpets-chart-hit');
    if (hit) show(Number(hit.dataset.i));
  });
  svg.addEventListener('mouseleave', () => {
    tip.hidden = true;
  });
}

function escape(text) {
  return String(text).replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
  );
}
