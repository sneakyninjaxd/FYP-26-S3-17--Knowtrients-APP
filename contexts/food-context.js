import { useAuth } from '@/contexts/auth-context';
import { api, toLogDate } from '@/services/api';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const FoodContext = createContext(null);

export function FoodProvider({ children }) {
  const { token } = useAuth();

  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeDate, setActiveDate] = useState(toLogDate());
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Whole FoodResponse objects, not just ids — there's no catalogue in memory
   * to look an id back up against. Local-only: no endpoint, so this empties
   * on app restart. AsyncStorage would fix that if it's wanted.
   */
  const [favourites, setFavourites] = useState([]);

  /**
   * FoodLogResponse doesn't include food_id, so we remember which catalogue
   * item each log came from. Only covers entries added this session — see
   * updateQuantity. A ref, not state, since nothing renders from it.
   */
  const foodIdByLogId = useRef({});

  const loadEntries = useCallback(
    async (date = activeDate) => {
      if (!token) return;

      setActiveDate(date);
      setIsLoading(true);
      try {
        const data = await api.listFoodLogs(token, date);
        setEntries(data);
      } catch (err) {
        console.warn('Could not load food logs', err);
      } finally {
        setIsLoading(false);
      }
    },
    [token, activeDate]
  );

  /**
   * Server-computed totals and per-meal rows. Kept separate from `entries`
   * so the dashboard doesn't have to re-derive what the backend already did.
   */
  const loadSummary = useCallback(
    async (date = activeDate) => {
      if (!token) return;

      try {
        const data = await api.getDailySummary(token, date);
        setSummary(data);
      } catch (err) {
        console.warn('Could not load daily summary', err);
      }
    },
    [token, activeDate]
  );

  useEffect(() => {
    if (!token) {
      setEntries([]);
      setSummary(null);
      setFavourites([]);
      foodIdByLogId.current = {};
      return;
    }
    const date = toLogDate();
    loadEntries(date);
    loadSummary(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** Passthrough so screens don't each need the token. Returns FoodResponse[]. */
  const searchFoods = useCallback(
    async (q, limit = 20) => {
      if (!token || !q?.trim()) return [];
      return api.searchFoods(token, q.trim(), limit);
    },
    [token]
  );

  /** Quick-add: no catalogue entry, so nutrition is supplied by the caller. */
  const addCustomEntry = useCallback(
    async ({ meal, name, quantity = 1, unit = 'serving', nutrition = {} }) => {
      if (!token) return null;

      try {
        const created = await api.createFoodLog(token, {
          meal_type: meal,
          log_date: activeDate,
          food_name: name,
          quantity,
          unit,
          ...nutrition,
        });
        setEntries((prev) => [...prev, created]);
        loadSummary(activeDate);
        return created;
      } catch (err) {
        console.warn('Could not add custom food log', err);
        alert(`CUSTOM ADD FAILED ${err.status}: ${err.message}`);
        return null;
      }
    },
    [token, activeDate, loadSummary]
  );

  /**
   * Two modes. With `food`, only food_id goes up and the server computes
   * nutrition from the portion — sending macros alongside food_id is what
   * makes logged values disagree with the catalogue. With `custom`, the
   * caller supplies the nutrition and no catalogue row is referenced.
   */
  const addEntry = async ({ meal, food, custom, quantity = 1, unit = 'serving', grams }) => {
    if (!token) return null;
      console.log('addEntry meal =', meal, 'food =', food?.id, 'custom =', !!custom);

    if (custom) {
      return addCustomEntry({
        meal,
        name: custom.name,
        quantity: custom.quantity ?? 1,
        unit: custom.unit ?? 'serving',
        nutrition: custom.nutrition ?? {},
      });
    }

    if (!food) return null;

    try {
      const created = await api.createFoodLog(token, {
        meal_type: meal,
        log_date: activeDate,
        food_id: food.id,
        quantity,
        unit,
        ...(grams != null ? { grams } : {}),
      });
      foodIdByLogId.current[created.id] = food.id;
      setEntries((prev) => [...prev, created]);
      loadSummary(activeDate);
      return created;
    } catch (err) {
      console.warn('Could not add food log', err);
      alert(`ADD FAILED ${err.status}: ${err.message}`);
      return null;
    }
  };

  const deleteEntry = async (logId) => {
    if (!token) return;

    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== logId));

    try {
      await api.deleteFoodLog(token, logId);
      delete foodIdByLogId.current[logId];
      loadSummary(activeDate);
    } catch (err) {
      console.warn('Could not delete food log', err);
      setEntries(previous);   // restore without a round trip
    }
  };

  /**
   * No PUT endpoint, so this is create-then-delete: the replacement is made
   * first, and the old row is only removed once it succeeds. Doing it the
   * other way round loses the entry entirely if the create fails.
   *
   * Requires knowing the original food_id, which the API doesn't return, so
   * this only works for entries added during this session. Adding food_id to
   * FoodLogResponse on the backend would remove the limitation.
   */
  const updateQuantity = async (logId, quantity) => {
    if (!token || quantity <= 0 || quantity > 100) return;

    const entry = entries.find((e) => e.id === logId);
    if (!entry) return;

    const foodId = foodIdByLogId.current[logId];
    if (!foodId) {
      console.warn('Quantity edit unavailable: original food_id unknown for log', logId);
      return;
    }

    try {
      const created = await api.createFoodLog(token, {
        meal_type: entry.meal_type,
        log_date: entry.log_date,
        food_id: foodId,
        quantity,
        unit: entry.unit,
      });
      await api.deleteFoodLog(token, logId);

      foodIdByLogId.current[created.id] = foodId;
      delete foodIdByLogId.current[logId];
      setEntries((prev) => prev.map((e) => (e.id === logId ? created : e)));
      loadSummary(entry.log_date);
    } catch (err) {
      console.warn('Could not update quantity', err);
      loadEntries(entry.log_date);
      loadSummary(entry.log_date);
    }
  };

  const isFavourite = useCallback(
    (foodId) => favourites.some((f) => f.id === foodId),
    [favourites]
  );

  /** Takes the whole food object, not an id, so it can be rendered later. */
  const toggleFavourite = (food) => {
    setFavourites((prev) =>
      prev.some((f) => f.id === food.id)
        ? prev.filter((f) => f.id !== food.id)
        : [...prev, food]
    );
  };

  return (
    <FoodContext.Provider
      value={{
        entries,
        summary,
        activeDate,
        isLoading,
        loadEntries,
        loadSummary,
        searchFoods,
        addEntry,
        addCustomEntry,
        deleteEntry,
        updateQuantity,
        favourites,
        isFavourite,
        toggleFavourite,
      }}
    >
      {children}
    </FoodContext.Provider>
  );
}

export const useFood = () => useContext(FoodContext);