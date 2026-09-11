import { useAuth } from '@/contexts/auth-context';
import { api, sleepHours, toLogDate } from '@/services/api';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const SleepContext = createContext(null);

/** How much history the statistics screen pulls. Server caps at 90. */
const DEFAULT_DAYS = 7;

export function SleepProvider({ children }) {
  const { token } = useAuth();

  const [sleepLogs, setSleepLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSleep = useCallback(
    async (days = DEFAULT_DAYS) => {
      if (!token) return;

      setIsLoading(true);
      try {
        const data = await api.listSleepLogs(token, days);
        setSleepLogs(data);
      } catch (err) {
        console.warn('Could not load sleep logs', err);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setSleepLogs([]);
      return;
    }
    loadSleep();
  }, [token, loadSleep]);

  /**
   * Upsert for one night. `hours` is required by the API — if it isn't
   * given, it's derived from bedtime and wake_time, wrapping past midnight.
   *
   * log_date is the *wake* date by convention, so last night's sleep shows
   * on today's dashboard, matching what /logs/summary returns for a date.
   */
  const addSleep = async ({ date, hours, bedtime, wake_time, quality, notes } = {}) => {
    if (!token) return null;

    let value = hours;
    if (value == null && bedtime && wake_time) {
      value = sleepHours(bedtime, wake_time);
    }
    if (value == null || Number.isNaN(value) || value < 0 || value > 24) {
      console.warn('Sleep not saved: hours missing or out of range', value);
      return null;
    }

    try {
      const saved = await api.setSleepLog(token, {
        hours: value,
        log_date: date ?? toLogDate(),
        bedtime: bedtime ?? null,
        wake_time: wake_time ?? null,
        quality: quality ?? null,
        notes: notes ?? null,
      });

      // One row per date server-side, so replace any local row for that date.
      setSleepLogs((prev) => [
        ...prev.filter((s) => s.log_date !== saved.log_date),
        saved,
      ]);
      return saved;
    } catch (err) {
      console.warn('Could not save sleep log', err);
      return null;
    }
  };

  /** Convenience for the entry screen, which works in wheel-picker times. */
  const addSleepFromTimes = (bedtime, wakeTime, extras = {}) =>
    addSleep({ bedtime, wake_time: wakeTime, ...extras });

  /** The night logged for a given date, or null. */
  const sleepForDate = useCallback(
    (date = toLogDate()) => sleepLogs.find((s) => s.log_date === date) ?? null,
    [sleepLogs]
  );

  /**
   * No DELETE endpoint for sleep — overwrite the night with a new PUT
   * instead. Kept so callers don't break; adding DELETE /logs/sleep/{id}
   * on the backend would make this real.
   */
  const deleteSleep = async () => {
    console.warn('deleteSleep: the API has no sleep delete endpoint');
    return false;
  };

  return (
    <SleepContext.Provider
      value={{
        sleepLogs,
        isLoading,
        loadSleep,
        addSleep,
        addSleepFromTimes,
        sleepForDate,
        deleteSleep,
      }}
    >
      {children}
    </SleepContext.Provider>
  );
}

export const useSleep = () => useContext(SleepContext);