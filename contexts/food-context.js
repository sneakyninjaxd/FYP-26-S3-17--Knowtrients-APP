import { createContext, useContext, useState } from 'react';

const FoodContext = createContext(null);

export function FoodProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [favourites, setFavourites] = useState([]);

  const addEntry = (entry) => {
    setEntries((prev) => [...prev, { ...entry, id: Date.now().toString() }]);
  };

  const updateQuantity = (id, qty) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, quantity: Math.max(1, qty) } : e))
    );
  };

  const deleteEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const toggleFavourite = (foodId) => {
    setFavourites((prev) =>
      prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId]
    );
  };

  return (
    <FoodContext.Provider
      value={{ entries, addEntry, updateQuantity, deleteEntry, favourites, toggleFavourite }}
    >
      {children}
    </FoodContext.Provider>
  );
}

export const useFood = () => useContext(FoodContext);