export const FOODS = [
  { id: 'chicken-wings', name: 'Chicken Wings', kcal: 80,  unit: 'piece(s)' },
  { id: 'chicken-rice',  name: 'Chicken Rice',  kcal: 600, unit: 'plate(s)' },
  { id: 'kaya-toast',    name: 'Kaya Toast',    kcal: 190, unit: 'set(s)' },
  { id: 'laksa',         name: 'Laksa',         kcal: 550, unit: 'bowl(s)' },
  { id: 'char-kway-teow',name: 'Char Kway Teow',kcal: 740, unit: 'plate(s)' },
  { id: 'soy-milk',      name: 'Soy Milk',      kcal: 140, unit: 'cup(s)' },
];

export const searchFoods = (query) =>
  FOODS.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));