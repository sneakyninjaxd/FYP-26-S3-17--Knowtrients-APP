// thresholds are percentages of the bar width
export const NUTRIENTS = [
  {
    id: 'protein',
    label: 'Protein',
    unit: 'g',
    average: 87.2,
    lowMax: 40,          // below this % = low intake
    recommendedMax: 75,  // below this % = recommended, above = high
    sources: [
      { name: 'Calories 116g', amount: '200g' },
      { name: 'Rocky Strawberry (150ml)', amount: '17g' },
    ],
  },
  {
    id: 'fibre',
    label: 'Fibre',
    unit: 'g',
    average: 3.5,
    lowMax: 40,
    recommendedMax: 75,
    sources: [
      { name: 'Rocky Strawberry (150ml)', amount: '3.5g' },
    ],
  },
  {
    id: 'saturated_fat',
    label: 'Saturated Fat',
    unit: 'g',
    average: 16.4,
    lowMax: 40,
    recommendedMax: 75,
    sources: [
      { name: 'Rocky Strawberry (150ml)', amount: '15.4g' },
      { name: 'Calories 116g', amount: '1g' },
    ],
  },
];

// where the marker sits on the bar, 0-100
export const positionFor = (nutrient) => {
  // placeholder until real intake data exists
  return { protein: 62, fibre: 22, saturated_fat: 88 }[nutrient.id] ?? 50;
};