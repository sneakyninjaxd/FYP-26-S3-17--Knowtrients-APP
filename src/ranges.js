/**
 * Time ranges for the statistics screens.
 *
 * `days` is what gets sent to the API, so these are real lookback windows
 * rather than calendar months — "Past Month" means the last 30 days, not
 * October.
 *
 * Anything beyond a week is premium: it's the depth of history that the
 * subscription buys, not the features themselves.
 */
export const RANGES = [
  { id: 'week',  label: 'Past Week',  days: 7,   premium: false },
  { id: 'month', label: 'Past Month', days: 30,  premium: true  },
  { id: 'year',  label: 'Past Year',  days: 365, premium: true  },
];

/**
 * The sleep, activity-range and device-metrics endpoints all accept up to
 * 365 days, so a year-long range is served in full by one request.
 *
 * The exception is the Nutrition screen: there's no range endpoint for daily
 * summaries, so it fetches one request per day and caps its own sample.
 */
export const MAX_API_DAYS = 365;

/** Local YYYY-MM-DD. `toISOString` would shift UTC+8 mornings back a day. */
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

/**
 * Buckets for a range's chart, oldest first.
 *
 * 365 bars don't fit on a phone, so longer ranges are grouped: a week is one
 * bar per night, a month one bar per week, a year one bar per month. Each
 * bucket carries the set of dates that fall in it, so a caller can average
 * whatever it holds without repeating the date arithmetic.
 */
export function bucketsFor(days) {
  const today = new Date();

  // A week: one bar per day.
  if (days <= 7) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        sub: String(d.getDate()),
        keys: [dayKey(d)],
      };
    });
  }

  // Up to a quarter: one bar per week, labelled by the week's start date.
  if (days <= 92) {
    const weeks = Math.ceil(days / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const end = new Date(today);
      end.setDate(end.getDate() - (weeks - 1 - i) * 7);

      const keys = Array.from({ length: 7 }, (_, j) => {
        const d = new Date(end);
        d.setDate(d.getDate() - j);
        return dayKey(d);
      });

      const start = new Date(end);
      start.setDate(start.getDate() - 6);

      return {
        label: start.toLocaleDateString('en-GB', { day: 'numeric' }),
        sub: start.toLocaleDateString('en-GB', { month: 'short' }),
        keys,
      };
    });
  }

  // Longer: one bar per calendar month.
  const months = Math.min(12, Math.ceil(days / 30));
  return Array.from({ length: months }, (_, i) => {
    const m = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();

    return {
      label: m.toLocaleDateString('en-GB', { month: 'short' }),
      sub: String(m.getFullYear()).slice(2),
      keys: Array.from({ length: daysInMonth }, (_, j) =>
        dayKey(new Date(m.getFullYear(), m.getMonth(), j + 1))
      ),
    };
  });
}