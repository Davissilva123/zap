import { createContext, useContext } from 'react';
import type { AdminRole } from './auth';

export type { AdminRole };
export const AdminContext = createContext<AdminRole>(null);
export function useAdminRole(): AdminRole { return useContext(AdminContext); }
