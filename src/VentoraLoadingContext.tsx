import { createContext, useContext, useEffect } from 'react';

export const VentoraLoadingContext = createContext<(active: boolean) => void>(() => {});

export function useVentoraLoading(active: boolean) {
  const setGlobalLoading = useContext(VentoraLoadingContext);
  useEffect(() => {
    setGlobalLoading(active);
    return () => setGlobalLoading(false);
  }, [active, setGlobalLoading]);
}
