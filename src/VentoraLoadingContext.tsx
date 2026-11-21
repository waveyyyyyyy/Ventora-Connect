import { createContext, useContext, useEffect } from 'react';
import type { VentoraLoaderVariant } from './VentoraLoader';

export type VentoraLoadingSetter = (active:boolean, variant?:VentoraLoaderVariant, status?:string) => void;
export const VentoraLoadingContext = createContext<VentoraLoadingSetter>(() => {});

export function useVentoraLoading(active:boolean, variant:VentoraLoaderVariant='pulse', status?:string) {
  const setGlobalLoading=useContext(VentoraLoadingContext);
  useEffect(()=>{setGlobalLoading(active,variant,status);return()=>setGlobalLoading(false,variant);},[active,variant,status,setGlobalLoading]);
}
