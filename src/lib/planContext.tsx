import { createContext, useContext } from 'react';
import type { PlanSlug } from './planFeatures';

interface PlanCtx {
  planSlug: PlanSlug;
  planName: string;
}

export const PlanContext = createContext<PlanCtx>({ planSlug: '', planName: '' });

export function usePlan() {
  return useContext(PlanContext);
}
