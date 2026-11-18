import { createContext, useContext } from 'react';

export interface StatFilter {
  selected: string;
  onSelect: (key: string) => void;
}

export const StatFilterContext = createContext<StatFilter | null>(null);
export const useStatFilter = () => useContext(StatFilterContext);
