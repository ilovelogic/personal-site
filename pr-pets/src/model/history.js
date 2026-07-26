/**
 * history — turning a list of feeding instants into something chartable.
 *
 * Pure module. The caller supplies `now` and, where it matters, a timezone;
 * nothing here reads the ambient clock.
 */

/**
 * Formatters are cached because building one is by far the most expensive
 * thing in this file — `dayKey` is called once per day per chart, and the
 * chart is redrawn whenever the pet is fed.
 */
const FORMATTERS = new Map();

function formatterFor(timeZone) {
  const key = timeZone ?? '';
  let formatter = FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    FORMATTERS.set(key, formatter);
  }
  return formatter;
}

/**
 * Local calendar-day key ("2026-07-25") for an instant.
 *
 * Bucketing must be by *local* day, not UTC day: a treat at 8pm Pacific
 * belongs on the day the person experienced, not tomorrow. `en-CA` is used
 * because it formats as ISO, which sorts lexicographically — which the window
 * arithmetic below relies on.
 */
export function dayKey(ms, timeZone = undefined) {
  return formatterFor(timeZone).format(new Date(ms));
}

/**
 * Treats per day, from installation to today, with no gaps.
 *
 * Empty days are present with count 0 rather than omitted — a bar chart that
 * silently drops quiet days lies about the shape of a habit, making a week off
 * look like a week of steady feeding.
 *
 * @param {object} pet
 * @param {number} now  ms since epoch
 * @param {{timeZone?: string, maxDays?: number}} [options]
 *        maxDays trims to the most recent N days (the chart is 220px wide, not
 *        infinite); the trim is reported so the view can say so out loud
 *        rather than quietly implying the pet was never fed before that.
 * @returns {{days: Array<{key: string, count: number, date: Date}>,
 *            total: number, max: number, omittedDays: number,
 *            omittedTreats: number}}
 */
export function dailyCounts(pet, now, { timeZone, maxDays = 30 } = {}) {
  const installStart = startOfLocalDay(pet.installedAt, timeZone);
  const todayStart = startOfLocalDay(now, timeZone);
  const todayKey = dayKey(now, timeZone);

  // Only the visible window is materialised. Seeding every day back to
  // installation and then throwing all but the last `maxDays` away cost ~35ms
  // per call on a year-old install — paid on every repaint of a panel that is
  // 252px wide and shows thirty columns.
  const firstStart = Math.max(installStart, todayStart - (maxDays - 1) * DAY_MS);

  // Seed every day in the window so gaps become explicit zeroes.
  //
  // Stepping by a flat 24h from local midnight lands an hour early or late
  // across a daylight-saving boundary. That never skips a day — the short step
  // repeats a key, which `has` absorbs — but it can need one extra iteration,
  // hence the slack in the guard rather than a bare `maxDays`.
  const counts = new Map();
  for (let t = firstStart, guard = 0; guard < maxDays + 4; t += DAY_MS, guard++) {
    const key = dayKey(t, timeZone);
    if (!counts.has(key)) counts.set(key, 0);
    if (key >= todayKey) break;
  }

  let omittedTreats = 0;
  for (const t of pet.feedings) {
    // `firstStart` is the local midnight the window opens on, so anything
    // earlier is off the left of the chart by definition — countable without
    // formatting it, which matters when a pet has thousands of feedings and
    // only the last thirty days are drawn.
    if (t < firstStart) {
      omittedTreats += 1;
      continue;
    }
    // A key the window does not hold can only be in the future now, which
    // means the clock moved. Adding it would grow a column to the right of
    // today and stretch the axis; `total` still reports every treat.
    const key = dayKey(t, timeZone);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  const days = Array.from(counts.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => ({ key, count, date: new Date(`${key}T12:00:00`) }));

  return {
    days,
    total: pet.feedings.length,
    max: days.reduce((m, d) => Math.max(m, d.count), 0),
    omittedDays: Math.max(0, Math.round((firstStart - installStart) / DAY_MS)),
    omittedTreats,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight (as an instant) of the day containing `ms`. */
function startOfLocalDay(ms, timeZone) {
  const key = dayKey(ms, timeZone);
  return new Date(`${key}T12:00:00`).getTime() - 12 * 60 * 60 * 1000;
}

/** "Jul 25" — a compact axis label. */
export function shortDate(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

/** "Saturday, July 25" — the tooltip's fuller version. */
export function longDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
