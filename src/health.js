/**
 * Health Connect — reads steps and active calories from the device.
 *
 * Health Connect is an Android-only store that other apps write into: the
 * phone's own health app, or a paired wearable's companion app. We only
 * read. If nothing is writing to it, the reads return zero — which is a
 * valid state, not an error.
 */
import { Platform } from 'react-native';

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

/** Lazily required so importing this file doesn't break web or iOS. */
function getModule() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

/**
 * Prepares Health Connect and requests permission.
 * Returns one of: 'ready' | 'unsupported' | 'unavailable' | 'denied'.
 */
export async function initHealth() {
  const HC = getModule();
  if (!HC) return 'unsupported';

  try {
    const initialised = await HC.initialize();
    if (!initialised) return 'unavailable';

    // Already granted from a previous run?
    const existing = await HC.getGrantedPermissions();
    const hasAll = PERMISSIONS.every((p) =>
      existing.some(
        (g) => g.recordType === p.recordType && g.accessType === p.accessType
      )
    );
    if (hasAll) return 'ready';

    const granted = await HC.requestPermission(PERMISSIONS);
    return granted?.length ? 'ready' : 'denied';
  } catch (err) {
    console.warn('Health Connect init failed', err);
    return 'unavailable';
  }
}

/** Local midnight-to-midnight bounds for a date, as ISO strings. */
function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    operator: 'between',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

/**
 * Totals for one day. Returns null when Health Connect isn't usable, and
 * zeroes when it is but holds no data — the caller needs to tell those apart.
 */
/**
 * Totals for one day. Returns null when Health Connect isn't usable, and
 * zeroes when it is but holds no data — the caller needs to tell those apart.
 *
 * Uses aggregateRecord rather than summing readRecords: several apps may
 * each write records for the same physical steps, and only the aggregate
 * deduplicates them by source priority the way Health Connect's own UI does.
 */
export async function readDay(date = new Date()) {
  const HC = getModule();
  if (!HC) return null;

  try {
    const timeRangeFilter = dayRange(date);

    const [stepsAgg, caloriesAgg] = await Promise.all([
      HC.aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
      HC.aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter }).catch(() => null),
    ]);

    return {
      steps: Math.round(stepsAgg?.COUNT_TOTAL ?? 0),
      calories: Math.round(caloriesAgg?.ENERGY_TOTAL?.inKilocalories ?? 0),
    };
  } catch (err) {
    console.warn('Health Connect read failed', err);
    return null;
  }
}

/**
 * Daily totals for the seven days ending on `endDate`, oldest first.
 * Returns null when Health Connect isn't usable; individual days may be
 * null if a single read failed.
 */
export async function readWeek(endDate = new Date()) {
  const HC = getModule();
  if (!HC) return null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  // Reads are local and cheap, so seven in parallel is fine here.
  return Promise.all(days.map((d) => readDay(d)));
}

/**
 * Daily totals across N days ending on `endDate`, oldest first — for the
 * statistics screen's range picker.
 */
export async function readRange(days = 7, endDate = new Date()) {
  const HC = getModule();
  if (!HC) return null;

  const span = Math.max(1, Math.min(days, 90));

  const dates = Array.from({ length: span }, (_, i) => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - (span - 1 - i));
    return d;
  });

  return Promise.all(dates.map((d) => readDay(d)));
}