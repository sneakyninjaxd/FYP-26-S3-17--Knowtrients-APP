export const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const CONDITIONS = [
  { id: 'none', label: 'None' },
  { id: 'type1_diabetes', label: 'Type 1 Diabetes' },
  { id: 'type2_diabetes', label: 'Type 2 Diabetes' },
  { id: 'hypertension', label: 'Hypertension' },
  { id: 'lactose_intolerant', label: 'Lactose Intolerant' },
  { id: 'other', label: 'Other' },
];

export const GOALS = [
  { id: 'lose_weight', label: 'Lose Weight' },
  { id: 'gain_weight', label: 'Gain Weight' },
  { id: 'maintain_weight', label: 'Maintain Weight' },
  { id: 'build_muscle', label: 'Build Muscle' },
  { id: 'improve_health', label: 'Improve Overall Health' },
  { id: 'better_lifestyle', label: 'Better Lifestyle' },
  { id: 'balanced_meals', label: 'Eat More Balanced Meals' },
  { id: 'better_sleep', label: 'Better Sleep Schedule' },
  { id: 'other', label: 'Other' },
];

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', description: 'Mostly sitting' },
  { id: 'lightly_active', label: 'Lightly Active', description: 'Exercise a few times per month' },
  { id: 'moderately_active', label: 'Moderately Active', description: 'Exercise 1-2 days / week' },
  { id: 'very_active', label: 'Very Active', description: 'Exercise almost daily' },
  { id: 'athlete', label: 'Athlete', description: '' },
];

export const DIETARY = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'halal', label: 'Halal' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'gluten_free', label: 'Gluten Free' },
  { id: 'dairy_free', label: 'Dairy Free' },
  { id: 'low_carb', label: 'Low Carb' },
  { id: 'high_protein', label: 'High Protein' },
  { id: 'seafood_allergy', label: 'Seafood Allergy' },
  { id: 'other', label: 'Other' },
];

// helper for the view screens
export const labelFor = (list, id) =>
  list.find((item) => item.id === id)?.label ?? id;