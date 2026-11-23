import { createContext, useContext, useLayoutEffect, useId } from 'react';
import type { VentoraLoaderVariant } from './VentoraLoader';

export type VentoraLoadingSetter = (active:boolean, variant?:VentoraLoaderVariant, status?:string, key?:string) => void;
export const VentoraLoadingContext = createContext<VentoraLoadingSetter>(() => {});

export function useVentoraLoading(active:boolean, variant:VentoraLoaderVariant='pulse', status?:string) {
  const setGlobalLoading=useContext(VentoraLoadingContext);
  const id=useId();
  useLayoutEffect(()=>{setGlobalLoading(active,variant,status,id);return()=>setGlobalLoading(false,variant,undefined,id);},[active,variant,status,id,setGlobalLoading]);
}
