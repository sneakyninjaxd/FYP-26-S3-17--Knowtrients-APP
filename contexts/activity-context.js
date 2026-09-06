import { createContext, useContext, useState } from 'react';
{/*Place holder for add activities*/}
const ActivityContext = createContext(null);

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState([]);

  const addActivity = (activity) => {
    setActivities((prev) => [
      ...prev,
      { ...activity, id: Date.now().toString() },
    ]);
  };

  const deleteActivity = (id) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <ActivityContext.Provider value={{ activities, addActivity, deleteActivity }}>
      {children}
    </ActivityContext.Provider>
  );
}

export const useActivities = () => useContext(ActivityContext);