/**
 * Nutrient targets and intake bands for the Nutrition Summary screen.
 *
 * Nothing here is sample data — values come from what the user logged, and
 * targets are derived from their profile where the figure depends on body
 * size, or from public guidance where it doesn't.
 */
import { dailyGoals } from '@/src/goals';

/**
 * `type` decides how the bar reads.
 *
 *  - goal:  too little is the problem. Low / recommended / high.
 *  - limit: there is no "too little". Recommended up to the target, high
 *           beyond it — so the blue zone is suppressed rather than
 *           implying someone should eat more saturated fat.
 */
const DEFS = [
  { id: 'protein',        key: 'protein_g',           label: 'Protein',        unit: 'g',  type: 'goal'  },
  { id: 'fibre',          key: 'fiber_g',             label: 'Fibre',          unit: 'g',  type: 'goal'  },
  { id: 'carbs',          key: 'carbs_g',             label: 'Carbohydrates',  unit: 'g',  type: 'goal'  },
  { id: 'fat',            key: 'fat_g',               label: 'Fat',            unit: 'g',  type: 'goal'  },
  { id: 'saturated_fat',  key: 'saturated_fat_g',     label: 'Saturated Fat',  unit: 'g',  type: 'limit' },
  { id: 'sugar',          key: 'sugar_g',             label: 'Sugar',          unit: 'g',  type: 'limit' },
  { id: 'sodium',         key: 'sodium_mg',           label: 'Sodium',         unit: 'mg', type: 'limit' },
  { id: 'vegetables',     key: 'vegetable_servings',  label: 'Vegetables',     unit: 'servings', type: 'goal' },
  { id: 'water',          key: 'water_ml',            label: 'Water',          unit: 'ml', type: 'goal'  },
];

/**
 * Daily targets.
 *
 * Calories, sugar and sodium come from src/goals.js, which already derives
 * them from the profile. The macronutrients are split off the calorie
 * target using the usual acceptable distribution ranges; protein is by body
 * weight, since that is what it actually scales with.
 */
export function targetsFor(profile) {
  const goals = dailyGoals(profile);
  const calories = goals.calories ?? 2000;
  const weight = Number(profile?.weight_kg) || 70;

  return {
    protein_g: Math.round(weight * 1.2),
    fiber_g: 25,
    carbs_g: Math.round((calories * 0.5) / 4),
    fat_g: Math.round((calories * 0.3) / 9),
    saturated_fat_g: Math.round((calories * 0.1) / 9),
    sugar_g: goals.sugar_g ?? 50,
    sodium_mg: goals.sodium_mg ?? 2000,
    vegetable_servings: 5,
    water_ml: 2000,
  };
}

/**
 * One row per nutrient: the value, its target, and where the marker sits.
 *
 * The bar runs from zero to 150% of target, so being over shows as over
 * rather than silently pinning at the end.
 */
export function nutrientRows(totals, profile) {
  const targets = targetsFor(profile);

  return DEFS.map((def) => {
    const target = targets[def.key] || 1;
    const value = Number(totals?.[def.key] ?? 0);

    const barMax = target * 1.5;
    const pct = (v) => Math.max(0, Math.min((v / barMax) * 100, 100));

    // Where the coloured zones end, as percentages of the bar.
    const lowMax = def.type === 'limit' ? 0 : pct(target * 0.7);
    const recommendedMax = def.type === 'limit' ? pct(target) : pct(target * 1.1);

    return {
      ...def,
      value,
      target,
      position: pct(value),
      lowMax,
      recommendedMax,
    };
  });
}

/** Rounds for display — sodium in whole mg, everything else to one decimal. */
export function formatAmount(value, unit) {
  if (unit === 'mg' || unit === 'ml') return `${Math.round(value)}${unit}`;
  if (unit === 'servings') return `${Math.round(value * 10) / 10}`;
  return `${Math.round(value * 10) / 10}${unit}`;
}

/**
 * The biggest contributors to one nutrient from the day's food logs, so the
 * bar can be traced back to actual meals rather than just asserted.
 */
export function topSources(entries, key, unit, limit = 3) {
  return (entries ?? [])
    .map((e) => ({ name: e.food_name, amount: Number(e[key] ?? 0) }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((s) => ({ name: s.name, amount: formatAmount(s.amount, unit) }));
}