import { createContext, useContext, useState } from 'react';

const SleepContext = createContext(null);

export function SleepProvider({ children }) {
  const [sleepLogs, setSleepLogs] = useState([]);

  const addSleep = (entry) => {
    setSleepLogs((prev) => [
      ...prev.filter((s) => s.date !== entry.date),
      { ...entry, id: Date.now().toString() },
    ]);
  };

  const deleteSleep = (id) => {
    setSleepLogs((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <SleepContext.Provider value={{ sleepLogs, addSleep, deleteSleep }}>
      {children}
    </SleepContext.Provider>
  );
}

export const useSleep = () => useContext(SleepContext);