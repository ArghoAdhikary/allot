import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { runScheduled, seedData } from '../lib/actions.ts';
import { formatMoney } from '../lib/money.ts';
import type { Data } from '../lib/types.ts';

const KEY = 'allot:data:v1';

interface Store {
  data: Data;
  update: (fn: (d: Data) => Data) => void;
  replace: (d: Data) => void;
  money: (cents: number) => string;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      let loaded: Data | null = null;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw) as Data;
      } catch {
        // corrupt or unavailable storage: start fresh
      }
      setData(runScheduled(loaded ?? seedData()));
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
    }, 250);
  }, [data]);

  const update = useCallback((fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d)), []);
  const replace = useCallback((d: Data) => setData(d), []);

  if (!data) return <>{fallback}</>;
  const currency = data.settings.currency;
  return (
    <StoreContext.Provider value={{ data, update, replace, money: (c) => formatMoney(c, currency) }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
