/**
 * Daily targets derived from the user's profile.
 *
 * Calories use Mifflin-St Jeor for BMR, scaled by an activity factor and
 * adjusted for the user's stated goal. Sugar and sodium follow WHO guidance
 * rather than anything personalised — they're ceilings, not targets.
 */

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  'lightly active': 1.375,
  'moderately active': 1.55,
  'very active': 1.725,
  'extremely active': 1.9,
};

const DEFAULTS = { calories: 2000, sugar_g: 50, sodium_mg: 2000 };

function activityFactor(level) {
  if (!level) return 1.375;
  return ACTIVITY_FACTORS[String(level).toLowerCase().trim()] ?? 1.375;
}

/** Mifflin-St Jeor. Falls back to the midpoint when gender isn't given. */
function bmr({ weight_kg, height_cm, age, gender }) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const g = String(gender ?? '').toLowerCase();
  if (g.startsWith('m')) return base + 5;
  if (g.startsWith('f')) return base - 161;
  return base - 78;
}

function goalAdjustment(goals = []) {
  const list = goals.map((g) => String(g).toLowerCase());
  if (list.some((g) => g.includes('lose') || g.includes('weight loss'))) return -400;
  if (list.some((g) => g.includes('gain') || g.includes('muscle'))) return 300;
  return 0;
}

/**
 * Returns { calories, sugar_g, sodium_mg }. Profile may be partial or null —
 * missing measurements fall back to general reference values.
 */
export function dailyGoals(profile) {
  if (!profile?.weight_kg || !profile?.height_cm || !profile?.age) {
    return { ...DEFAULTS };
  }

  const calories =
    bmr(profile) * activityFactor(profile.activity_level) + goalAdjustment(profile.goals);

  return {
    // clamped so an unusual profile can't produce an unsafe-looking target
    calories: Math.round(Math.min(Math.max(calories, 1200), 4000) / 10) * 10,
    sugar_g: DEFAULTS.sugar_g,
    sodium_mg: DEFAULTS.sodium_mg,
  };
}