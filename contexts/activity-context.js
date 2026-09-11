import { useAuth } from '@/contexts/auth-context';
import { api, toLogDate } from '@/services/api';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ActivityContext = createContext(null);

export function ActivityProvider({ children }) {
  const { token } = useAuth();

  const [activities, setActivities] = useState([]);
  const [activeDate, setActiveDate] = useState(toLogDate());
  const [isLoading, setIsLoading] = useState(false);

  /** Minutes per day, keyed by date — backs the weekly chart. */
  const [weekly, setWeekly] = useState({});

  const loadActivities = useCallback(
    async (date = activeDate) => {
      if (!token) return;

      setActiveDate(date);
      setIsLoading(true);
      try {
        const data = await api.listActivityLogs(token, date);
        setActivities(data);
        setWeekly((prev) => ({
          ...prev,
          [date]: data.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0),
        }));
      } catch (err) {
        console.warn('Could not load activity logs', err);
      } finally {
        setIsLoading(false);
      }
    },
    [token, activeDate]
  );

  /**
   * There's no date-range endpoint for activity, so a week means seven
   * calls. Fired in parallel; a day that fails counts as zero rather than
   * failing the whole week.
   */
  const loadWeek = useCallback(
    async (endDate = toLogDate()) => {
      if (!token) return;

      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (6 - i));
        return toLogDate(d);
      });

      const results = await Promise.all(
        dates.map(async (date) => {
          try {
            const logs = await api.listActivityLogs(token, date);
            return [date, logs.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0)];
          } catch {
            return [date, 0];
          }
        })
      );

      setWeekly((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    },
    [token]
  );

  /**
   * Minutes and calories per day across N days — same approach as loadWeek
   * but wider, for the statistics screen's range picker.
   */
  const loadRange = useCallback(
    async (days = 7, endDate = toLogDate()) => {
      if (!token) return [];

      const span = Math.min(days, 90);
      const dates = Array.from({ length: span }, (_, i) => {
        const d = new Date(endDate);
        d.setDate(d.getDate() - (span - 1 - i));
        return toLogDate(d);
      });

      const rows = await Promise.all(
        dates.map(async (date) => {
          try {
            const logs = await api.listActivityLogs(token, date);
            return {
              date,
              minutes: logs.reduce((s, a) => s + (a.duration_minutes ?? 0), 0),
              calories: logs.reduce((s, a) => s + (a.calories_burned ?? 0), 0),
              count: logs.length,
            };
          } catch {
            return { date, minutes: 0, calories: 0, count: 0 };
          }
        })
      );

      setWeekly((prev) => ({
        ...prev,
        ...Object.fromEntries(rows.map((r) => [r.date, r.minutes])),
      }));
      return rows;
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setActivities([]);
      setWeekly({});
      return;
    }
    loadActivities(toLogDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addActivity = async ({
    activity_type,
    duration_minutes,
    intensity,
    calories_burned,
    notes,
    date,
  }) => {
    if (!token) return null;

    const minutes = Number(duration_minutes);
    if (!activity_type || !minutes || minutes <= 0 || minutes > 1440) {
      console.warn('Activity not saved: type or duration invalid', activity_type, minutes);
      return null;
    }

    const logDate = date ?? activeDate;

    try {
      const created = await api.createActivityLog(token, {
        activity_type,
        duration_minutes: minutes,
        intensity: intensity ?? null,
        calories_burned: calories_burned != null ? Number(calories_burned) : null,
        notes: notes ?? null,
        log_date: logDate,
      });

      if (logDate === activeDate) {
        setActivities((prev) => [...prev, created]);
      }
      setWeekly((prev) => ({
        ...prev,
        [logDate]: (prev[logDate] ?? 0) + minutes,
      }));
      return created;
    } catch (err) {
      console.warn('Could not add activity log', err);
      return null;
    }
  };

  const deleteActivity = async (logId) => {
    if (!token) return;

    const previous = activities;
    const removed = activities.find((a) => a.id === logId);
    setActivities((prev) => prev.filter((a) => a.id !== logId));

    try {
      await api.deleteActivityLog(token, logId);
      if (removed) {
        setWeekly((prev) => ({
          ...prev,
          [removed.log_date]: Math.max(
            0,
            (prev[removed.log_date] ?? 0) - (removed.duration_minutes ?? 0)
          ),
        }));
      }
    } catch (err) {
      console.warn('Could not delete activity log', err);
      setActivities(previous);
    }
  };

  /** Totals for the loaded date. */
  const totalMinutes = activities.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);
  const totalCaloriesBurned = activities.reduce((sum, a) => sum + (a.calories_burned ?? 0), 0);

  return (
    <ActivityContext.Provider
      value={{
        activities,
        activeDate,
        isLoading,
        weekly,
        totalMinutes,
        totalCaloriesBurned,
        loadActivities,
        loadWeek,
        loadRange,
        addActivity,
        deleteActivity,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export const useActivities = () => useContext(ActivityContext);