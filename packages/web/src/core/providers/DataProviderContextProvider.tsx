import React, { type ReactNode } from 'react';
import type { DataProvider } from './types.js';
import { DataProviderContext } from './context.js';

interface DataProviderProps {
  provider: DataProvider;
  children: ReactNode;
}

/**
 * Provider component that injects a data provider into the React tree
 */
export const DataProviderContextProvider: React.FC<DataProviderProps> = ({
  provider,
  children,
}) => {
  return (
    <DataProviderContext.Provider value={{ provider }}>
      {children}
    </DataProviderContext.Provider>
  );
};
