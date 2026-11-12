import { useAuth } from '@/contexts/auth-context';
import { api, toLogDate } from '@/services/api';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const FoodContext = createContext(null);

/**
 * The meal ids in the route are hyphenated, because that reads better in a
 * URL: /log/foodintake/morning-snack. The API expects underscores and
 * rejects anything else with a 422.
 *
 * Converting here rather than in each screen means a new caller can't forget
 * to do it. Breakfast, lunch and dinner are unaffected, which is why only the
 * snacks ever failed.
 */
export const toMealType = (meal) =>
  typeof meal === 'string' ? meal.replace(/-/g, '_') : meal;

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

  /**
   * Quantity edits are create-then-delete, so the row's id changes with every
   * step. A second tap arriving before React re-renders still holds the old
   * id and tries to delete a row that is already gone — "Log entry not
   * found". A ref updates immediately, which is what the guard needs.
   */
  const editingLogs = useRef(new Set());

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

  /**
   * Every nutrition field is validated server-side as >= 0, and the whole
   * request is rejected if one isn't. Values copied off an existing log can
   * fail that: a nullable column comes back as null, and rescaling a portion
   * can leave a rounding artefact just below zero.
   *
   * Clamping here rather than at each call site means re-logging a past meal
   * can't fail on a field the screen never shows.
   */
  const cleanNutrition = (nutrition = {}) => {
    const safe = {};
    for (const [key, value] of Object.entries(nutrition)) {
      const n = Number(value);
      safe[key] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return safe;
  };

  /** Quick-add: no catalogue entry, so nutrition is supplied by the caller. */
  const addCustomEntry = useCallback(
    async ({ meal, name, quantity = 1, unit = 'serving', nutrition = {} }) => {
      if (!token) return null;

      try {
        const created = await api.createFoodLog(token, {
          meal_type: toMealType(meal),
          log_date: activeDate,
          food_name: name,
          quantity: Math.max(Number(quantity) || 1, 0.01),
          unit,
          ...cleanNutrition(nutrition),
        });
        setEntries((prev) => [...prev, created]);
        loadSummary(activeDate);
        return created;
      } catch (err) {
        console.warn('Could not add custom food log', err);
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
        meal_type: toMealType(meal),
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

  /** The nutrition fields a log row carries, for rescaling a portion. */
  const NUTRIENT_KEYS = [
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
    'saturated_fat_g',
    'fiber_g',
    'sugar_g',
    'sodium_mg',
  ];

  /**
   * No PUT endpoint, so this is create-then-delete: the replacement is made
   * first, and the old row is only removed once it succeeds. Doing it the
   * other way round loses the entry entirely if the create fails.
   *
   * Two routes to the replacement:
   *
   *  - With the original food_id, the server recomputes nutrition from the
   *    portion, which is the authoritative answer.
   *  - Without it — any entry not added in this session, since the API
   *    doesn't return food_id — the stored values are rescaled by the ratio
   *    of new to old quantity. Portion nutrition is linear, so this lands on
   *    the same numbers; it just can't be re-derived from the catalogue
   *    later. Adding food_id to FoodLogResponse would make the first route
   *    always available.
   */
  const updateQuantity = async (logId, quantity) => {
    if (!token || quantity <= 0 || quantity > 100) return;

    if (editingLogs.current.has(logId)) return;

    const entry = entries.find((e) => e.id === logId);
    if (!entry) return;

    editingLogs.current.add(logId);

    const foodId = foodIdByLogId.current[logId];

    const payload = foodId
      ? {
          meal_type: entry.meal_type,
          log_date: entry.log_date,
          food_id: foodId,
          quantity,
          unit: entry.unit,
        }
      : (() => {
          const previous = entry.quantity > 0 ? entry.quantity : 1;
          const factor = quantity / previous;

          const scaled = {};
          for (const key of NUTRIENT_KEYS) {
            const value = Number(entry[key]);
            if (Number.isFinite(value)) {
              // Never below zero: the server rejects the whole request if one
              // nutrition field is negative.
              scaled[key] = Math.max(Math.round(value * factor * 100) / 100, 0);
            }
          }

          return {
            meal_type: entry.meal_type,
            log_date: entry.log_date,
            food_name: entry.food_name,
            quantity,
            unit: entry.unit,
            ...scaled,
          };
        })();

    try {
      const created = await api.createFoodLog(token, payload);
      await api.deleteFoodLog(token, logId);

      if (foodId) {
        foodIdByLogId.current[created.id] = foodId;
        delete foodIdByLogId.current[logId];
      }

      setEntries((prev) => prev.map((e) => (e.id === logId ? created : e)));
      loadSummary(entry.log_date);
    } catch (err) {
      // Refetch rather than guess: the create may have succeeded before the
      // delete failed, which would otherwise leave a duplicate on screen.
      console.warn('Could not update quantity', err);
      loadEntries(entry.log_date);
      loadSummary(entry.log_date);
    } finally {
      editingLogs.current.delete(logId);
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